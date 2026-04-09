const test = require('node:test');
const assert = require('node:assert');
const { initialState, applyAction, availableActions, nextSpeaker } = require('../src/stateMachine');

test('initialState — idle, only opening allowed, A speaks first', () => {
  const s = initialState();
  assert.strictEqual(s.state, 'idle');
  assert.deepStrictEqual(availableActions(s), ['opening']);
  assert.strictEqual(nextSpeaker(s), 'A');
});

test('opening x2 advances idle → A_opened → B_opened', () => {
  let s = initialState();
  s = applyAction(s, 'opening');           // A speaks
  assert.strictEqual(s.state, 'A_opened');
  assert.strictEqual(nextSpeaker(s), 'B');
  assert.deepStrictEqual(availableActions(s), ['opening']);

  s = applyAction(s, 'opening');           // B speaks
  assert.strictEqual(s.state, 'B_opened');
  assert.strictEqual(nextSpeaker(s), 'A');
  assert.deepStrictEqual(
    availableActions(s).sort(),
    ['closing', 'counter_rebuttal', 'example', 'rebuttal'].sort()
  );
});

test('mid stage allows reb/example/counter back-and-forth', () => {
  let s = initialState();
  s = applyAction(s, 'opening'); // A
  s = applyAction(s, 'opening'); // B
  s = applyAction(s, 'rebuttal'); // A
  assert.strictEqual(s.state, 'mid');
  assert.strictEqual(nextSpeaker(s), 'B');
  s = applyAction(s, 'example'); // B
  assert.strictEqual(nextSpeaker(s), 'A');
});

test('closing × 2 advances to ready_to_conclude', () => {
  let s = initialState();
  s = applyAction(s, 'opening');
  s = applyAction(s, 'opening');
  s = applyAction(s, 'closing'); // A closes
  assert.strictEqual(s.state, 'A_closed');
  assert.strictEqual(nextSpeaker(s), 'B');
  s = applyAction(s, 'closing'); // B closes
  assert.strictEqual(s.state, 'ready_to_conclude');
  assert.deepStrictEqual(availableActions(s), ['conclude']);
  assert.strictEqual(nextSpeaker(s), null);
});

test('conclude advances to concluded, no actions left', () => {
  let s = initialState();
  s = applyAction(s, 'opening');
  s = applyAction(s, 'opening');
  s = applyAction(s, 'closing');
  s = applyAction(s, 'closing');
  s = applyAction(s, 'conclude');
  assert.strictEqual(s.state, 'concluded');
  assert.deepStrictEqual(availableActions(s), []);
});

test('invalid action throws', () => {
  const s = initialState();
  assert.throws(() => applyAction(s, 'rebuttal'), /Action 'rebuttal' not allowed in state 'idle'/);
});
