import { useState } from 'react';
import { api } from './api/debate';
import { StartScreen } from './components/StartScreen';
import { MainScreen } from './components/MainScreen';
import { ResultScreen } from './components/ResultScreen';

export default function App() {
  const [phase, setPhase] = useState('start');   // 'start' | 'main' | 'result'
  const [session, setSession] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startSession({ topic, positionA, positionB }) {
    const s = await api.start({ topic, positionA, positionB });
    setSession({ ...s });
    setCurrentTurn(null);
    setPhase('main');
  }

  async function takeAction(action) {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.turn(session.sessionId, action);
      setCurrentTurn({ speaker: r.speaker, action: r.action, content: r.content });
      setSession((prev) => ({
        ...prev,
        state: r.state,
        availableActions: r.availableActions,
        turnCount: r.turnCount
      }));
    } catch (err) {
      setError(err.message || 'turn failed');
    } finally {
      setBusy(false);
    }
  }

  async function concludeDebate(chosenSide) {
    setBusy(true);
    setError('');
    try {
      const r = await api.conclude(session.sessionId, chosenSide);
      setResult(r);
      setPhase('result');
    } catch (err) {
      setError(err.message || 'conclude failed');
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setSession(null);
    setCurrentTurn(null);
    setResult(null);
    setError('');
    setPhase('start');
  }

  return (
    <div className="app-shell">
      {phase === 'start' && <StartScreen onStart={startSession} />}
      {phase === 'main' && session && (
        <MainScreen
          session={session}
          currentTurn={currentTurn}
          onAction={takeAction}
          onConclude={concludeDebate}
          busy={busy}
          error={error}
        />
      )}
      {phase === 'result' && session && result && (
        <ResultScreen session={session} result={result} onRestart={restart} />
      )}
    </div>
  );
}
