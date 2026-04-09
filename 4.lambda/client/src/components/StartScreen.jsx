import { useState } from 'react';

export function StartScreen({ onStart }) {
  const [topic, setTopic] = useState('');
  const [positionA, setPositionA] = useState('');
  const [positionB, setPositionB] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canStart = topic.trim() && positionA.trim() && positionB.trim() && !busy;

  async function handleStart() {
    if (!canStart) return;
    setBusy(true);
    setError('');
    try {
      await onStart({ topic: topic.trim(), positionA: positionA.trim(), positionB: positionB.trim() });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="column">
      <header className="brand-header">
        <div className="super">AI Debate Studio</div>
        <h1>두 AI의 토론을 중재하세요</h1>
        <p>주제를 던지고, 두 캐릭터의 공방을 듣고, 당신만의 결론을 내리세요</p>
      </header>

      <div className="persona-preview">
        <div className="pp red">
          <div className="photo" style={{ backgroundImage: 'url(/personas/hanjiho.png)' }} />
          <div className="name">한지호</div>
          <div className="role">전직 변호사</div>
        </div>
        <div className="vs">vs</div>
        <div className="pp blue">
          <div className="photo" style={{ backgroundImage: 'url(/personas/leeseoyeon.png)' }} />
          <div className="name">이서연</div>
          <div className="role">전직 기자</div>
        </div>
      </div>

      <div className="form">
        <div className="field">
          <div className="field-label">토론 주제</div>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 점심 메뉴 논쟁" />
        </div>
        <div className="row">
          <div className="field red">
            <div className="field-label">입장 A</div>
            <input value={positionA} onChange={(e) => setPositionA(e.target.value)} placeholder="예: 짜장면이 최고" />
          </div>
          <div className="field blue">
            <div className="field-label">입장 B</div>
            <input value={positionB} onChange={(e) => setPositionB(e.target.value)} placeholder="예: 짬뽕이 최고" />
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <button className="primary" disabled={!canStart} onClick={handleStart}>
        {busy ? '세션 생성 중…' : '▶ 토론 시작 (포지션 랜덤 배정)'}
      </button>
    </div>
  );
}
