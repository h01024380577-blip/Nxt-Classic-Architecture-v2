const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const { createRouter } = require('../src/routes/debate');
const { _reset } = require('../src/sessions');

function buildApp({ invokeLambda, db }) {
  const app = express();
  app.use(express.json());
  app.use('/api/debate', createRouter({ invokeLambda, db }));
  return app;
}

const fakeDb = {
  insertResult: async () => 42,
  getStats: async () => ({
    geminiWins: 5, novaWins: 3, totalDebates: 8,
    geminiWinRate: 5 / 8, novaWinRate: 3 / 8
  }),
  getRecentResults: async () => []
};

test('POST /start creates a session and returns matchup without model names', async () => {
  _reset();
  const app = buildApp({
    invokeLambda: async () => 'unused',
    db: fakeDb
  });
  const res = await request(app).post('/api/debate/start').send({
    topic: '점심', positionA: '짜장면', positionB: '짬뽕'
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.sessionId);
  assert.strictEqual(res.body.state, 'idle');
  assert.deepStrictEqual(res.body.availableActions, ['opening']);
  // The response must NOT leak model names
  const json = JSON.stringify(res.body);
  assert.doesNotMatch(json, /"model"/);
  assert.doesNotMatch(json, /gemini/i);
  assert.doesNotMatch(json, /nova/i);
});

test('POST /:id/turn invokes the lambda and returns content', async () => {
  _reset();
  const calls = [];
  const app = buildApp({
    invokeLambda: async (args) => {
      calls.push(args);
      return '짜장면이야말로 정수입니다.';
    },
    db: fakeDb
  });
  const start = await request(app).post('/api/debate/start').send({
    topic: 't', positionA: 'a', positionB: 'b'
  });
  const sid = start.body.sessionId;

  const turn = await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'opening' });
  assert.strictEqual(turn.status, 200);
  assert.strictEqual(turn.body.content, '짜장면이야말로 정수입니다.');
  assert.strictEqual(turn.body.speaker.side, 'A');
  assert.ok(turn.body.speaker.persona);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].history.length, 0);
  assert.strictEqual(calls[0].action, 'opening');
});

test('POST /:id/turn rejects invalid action with 400', async () => {
  _reset();
  const app = buildApp({ invokeLambda: async () => '', db: fakeDb });
  const start = await request(app).post('/api/debate/start').send({ topic: 't', positionA: 'a', positionB: 'b' });
  const res = await request(app).post(`/api/debate/${start.body.sessionId}/turn`).send({ action: 'rebuttal' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /not allowed/);
});

test('POST /:id/conclude reveals models and persists result', async () => {
  _reset();
  const inserts = [];
  const app = buildApp({
    invokeLambda: async () => 'turn content',
    db: { ...fakeDb, insertResult: async (row) => { inserts.push(row); return 1; } }
  });
  const start = await request(app).post('/api/debate/start').send({ topic: 't', positionA: 'a', positionB: 'b' });
  const sid = start.body.sessionId;
  // Walk the FSM to ready_to_conclude
  await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'opening' });
  await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'opening' });
  await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'closing' });
  await request(app).post(`/api/debate/${sid}/turn`).send({ action: 'closing' });

  const res = await request(app).post(`/api/debate/${sid}/conclude`).send({ chosenSide: 'A' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.chosen.model);
  assert.ok(res.body.passed.model);
  assert.notStrictEqual(res.body.chosen.model, res.body.passed.model);
  assert.strictEqual(res.body.stats.totalDebates, 8);
  assert.strictEqual(inserts.length, 1);
});

test('GET /results returns recent rows + stats', async () => {
  _reset();
  const app = buildApp({ invokeLambda: async () => '', db: fakeDb });
  const res = await request(app).get('/api/debate/results');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(Object.keys(res.body).sort(), ['recent', 'stats']);
});
