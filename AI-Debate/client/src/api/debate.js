const BASE = (process.env.REACT_APP_API_BASE || '') + '/api/debate';

async function jsonPost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function jsonGet(path) {
  const res = await fetch(BASE + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  start: ({ topic, positionA, positionB }) =>
    jsonPost('/start', { topic, positionA, positionB }),
  turn: (sessionId, action) =>
    jsonPost(`/${sessionId}/turn`, { action }),
  conclude: (sessionId, chosenSide) =>
    jsonPost(`/${sessionId}/conclude`, { chosenSide }),
  results: () => jsonGet('/results')
};
