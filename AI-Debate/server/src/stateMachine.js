// Debate state machine. Pure functions; no I/O.
// State shape: { state, turnCount, lastSpeaker }

const STATES = {
  idle: { actions: ['opening'], next: 'A' },
  A_opened: { actions: ['opening'], next: 'B' },
  B_opened: { actions: ['rebuttal', 'example', 'counter_rebuttal', 'closing'], next: 'A' },
  mid: { actions: ['rebuttal', 'example', 'counter_rebuttal', 'closing'], next: null /* alternates */ },
  A_closed: { actions: ['closing'], next: 'B' },
  B_closed: { actions: ['closing'], next: 'A' },
  ready_to_conclude: { actions: ['conclude'], next: null },
  concluded: { actions: [], next: null }
};

function initialState() {
  return { state: 'idle', turnCount: 0, lastSpeaker: null };
}

function availableActions(s) {
  return [...STATES[s.state].actions];
}

function nextSpeaker(s) {
  if (s.state === 'mid') {
    return s.lastSpeaker === 'A' ? 'B' : 'A';
  }
  return STATES[s.state].next;
}

function applyAction(s, action) {
  const allowed = STATES[s.state].actions;
  if (!allowed.includes(action)) {
    throw new Error(`Action '${action}' not allowed in state '${s.state}'`);
  }
  const speaker = nextSpeaker(s);

  let nextStateName;
  if (s.state === 'idle' && action === 'opening') nextStateName = 'A_opened';
  else if (s.state === 'A_opened' && action === 'opening') nextStateName = 'B_opened';
  else if (s.state === 'B_opened') {
    if (action === 'closing') nextStateName = 'A_closed';
    else nextStateName = 'mid';
  } else if (s.state === 'mid') {
    if (action === 'closing') {
      nextStateName = speaker === 'A' ? 'A_closed' : 'B_closed';
    } else {
      nextStateName = 'mid';
    }
  } else if (s.state === 'A_closed' && action === 'closing') nextStateName = 'ready_to_conclude';
  else if (s.state === 'B_closed' && action === 'closing') nextStateName = 'ready_to_conclude';
  else if (s.state === 'ready_to_conclude' && action === 'conclude') nextStateName = 'concluded';
  else throw new Error(`Unhandled transition: ${s.state} + ${action}`);

  return {
    state: nextStateName,
    turnCount: s.turnCount + (action === 'conclude' ? 0 : 1),
    lastSpeaker: action === 'conclude' ? s.lastSpeaker : speaker
  };
}

module.exports = { initialState, applyAction, availableActions, nextSpeaker, STATES };
