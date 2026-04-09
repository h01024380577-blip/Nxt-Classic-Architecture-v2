const express = require('express');
const { createSession, getSession, addTurn } = require('../sessions');
const { availableActions, applyAction, nextSpeaker } = require('../stateMachine');

function publicPersona(p) {
  return { id: p.id, name: p.name, image: p.image, color: p.color };
}

function publicSession(s) {
  return {
    sessionId: s.id,
    topic: s.topic,
    matchup: {
      A: { persona: publicPersona(s.sides.A.persona), position: s.sides.A.position },
      B: { persona: publicPersona(s.sides.B.persona), position: s.sides.B.position }
    },
    state: s.fsm.state,
    availableActions: availableActions(s.fsm),
    turnCount: s.fsm.turnCount
  };
}

function buildHistoryFor(side, fullHistory) {
  // Flip to self/opponent perspective.
  return fullHistory.map(t => ({
    speaker: t.side === side ? 'self' : 'opponent',
    action: t.action,
    content: t.content
  }));
}

function createRouter({ invokeLambda, db }) {
  const router = express.Router();

  router.get('/results', async (_req, res) => {
    try {
      const [stats, recent] = await Promise.all([db.getStats(), db.getRecentResults()]);
      res.json({ stats, recent });
    } catch (err) {
      console.error('[debate.results] db error', err);
      res.status(500).json({ error: 'failed to fetch results' });
    }
  });

  router.post('/start', (req, res) => {
    const { topic, positionA, positionB } = req.body || {};
    if (!topic || !positionA || !positionB) {
      return res.status(400).json({ error: 'topic, positionA, positionB are required' });
    }
    const s = createSession({ topic, positionA, positionB });
    return res.json(publicSession(s));
  });

  router.post('/:id/turn', async (req, res) => {
    let s;
    try {
      s = getSession(req.params.id);
    } catch {
      return res.status(404).json({ error: '세션이 만료되었습니다. 새 토론을 시작해주세요.' });
    }
    const { action } = req.body || {};
    const allowed = availableActions(s.fsm);
    if (!allowed.includes(action)) {
      return res.status(400).json({
        error: `현재 단계에서 '${action}' 액션은 사용할 수 없습니다 (not allowed).`,
        availableActions: allowed
      });
    }

    const speakerSide = nextSpeaker(s.fsm);
    const speakerInfo = s.sides[speakerSide];
    const opponent = speakerSide === 'A' ? s.sides.B : s.sides.A;

    let content;
    try {
      content = await invokeLambda({
        model: speakerInfo.model,
        persona: speakerInfo.persona,
        topic: s.topic,
        myPosition: speakerInfo.position,
        opponentPosition: opponent.position,
        history: buildHistoryFor(speakerSide, s.history),
        action
      });
    } catch (err) {
      console.error('[debate.turn] lambda error', err);
      return res.status(503).json({ error: 'AI 응답 생성 중 문제가 발생했습니다. 다시 시도해주세요.' });
    }

    addTurn(s.id, { side: speakerSide, action, content });

    return res.json({
      speaker: {
        side: speakerSide,
        persona: publicPersona(speakerInfo.persona)
      },
      action,
      content,
      state: s.fsm.state,
      availableActions: availableActions(s.fsm),
      turnCount: s.fsm.turnCount
    });
  });

  router.post('/:id/conclude', async (req, res) => {
    let s;
    try {
      s = getSession(req.params.id);
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }
    const { chosenSide } = req.body || {};
    if (chosenSide !== 'A' && chosenSide !== 'B') {
      return res.status(400).json({ error: 'chosenSide must be A or B' });
    }
    const allowed = availableActions(s.fsm);
    if (!allowed.includes('conclude')) {
      return res.status(400).json({ error: 'conclude not allowed yet', availableActions: allowed });
    }

    const passedSide = chosenSide === 'A' ? 'B' : 'A';
    const chosen = s.sides[chosenSide];
    const passed = s.sides[passedSide];

    s.fsm = applyAction(s.fsm, 'conclude');

    let stats = { geminiWins: 0, novaWins: 0, totalDebates: 0, geminiWinRate: 0, novaWinRate: 0 };
    try {
      await db.insertResult({
        topic: s.topic,
        positionA: s.positionA,
        positionB: s.positionB,
        geminiSide: s.sides.A.model === 'gemini' ? 'a' : 'b',
        novaSide: s.sides.A.model === 'nova' ? 'a' : 'b',
        userChoice: chosenSide.toLowerCase(),
        winnerModel: chosen.model,
        turnCount: s.fsm.turnCount
      });
      stats = await db.getStats();
    } catch (err) {
      console.error('[debate.conclude] db error', err);
    }

    return res.json({
      chosen: {
        side: chosenSide,
        persona: publicPersona(chosen.persona),
        position: chosen.position,
        model: chosen.model
      },
      passed: {
        side: passedSide,
        persona: publicPersona(passed.persona),
        position: passed.position,
        model: passed.model
      },
      stats
    });
  });

  return router;
}

module.exports = { createRouter };
