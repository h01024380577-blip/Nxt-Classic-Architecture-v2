import { useState } from 'react';

const ACTION_LABELS = {
  opening:          { icon: '▶️', label: '오프닝' },
  rebuttal:         { icon: '🔁', label: '반박' },
  example:          { icon: '💡', label: '예시' },
  counter_rebuttal: { icon: '🔥', label: '재반박' },
  closing:          { icon: '🎤', label: '마무리' },
  conclude:         { icon: '🏁', label: '결론' }
};
const ACTION_ORDER = ['opening', 'rebuttal', 'example', 'counter_rebuttal', 'closing', 'conclude'];

export function MainScreen({ session, currentTurn, onAction, onConclude, busy, error }) {
  const [chosenSide, setChosenSide] = useState(null);
  const available = new Set(session.availableActions);

  function handleClick(action) {
    if (busy) return;
    if (action === 'conclude') {
      // Show inline conclude picker (handled below)
      return;
    }
    if (!available.has(action)) return;
    onAction(action);
  }

  // Determine which side card to render. If a turn just happened, show it; otherwise show "waiting".
  const speakerCard = currentTurn ? renderSpeaker(currentTurn, session) : renderEmpty();

  return (
    <div className="column">
      <div className="live-bar">
        <div className="label">
          <div className="live-pulse" />
          <span>DEBATE · LIVE</span>
        </div>
        <div className="topic">"{session.topic}"</div>
        <div className="meta">{session.turnCount} turn</div>
      </div>

      <div className="matchup">
        <div className="side">
          <div className="avatar red" style={{ backgroundImage: `url(${session.matchup.A.persona.image})` }} />
          <div>
            <div className="name">{session.matchup.A.persona.name}</div>
            <div className="ai">??? AI</div>
          </div>
        </div>
        <div className="vs">vs</div>
        <div className="side">
          <div style={{ textAlign: 'right' }}>
            <div className="name">{session.matchup.B.persona.name}</div>
            <div className="ai">??? AI</div>
          </div>
          <div className="avatar blue" style={{ backgroundImage: `url(${session.matchup.B.persona.image})` }} />
        </div>
      </div>

      {speakerCard}

      <div className="blind-hint">🎭 어느 쪽이 Gemini이고 어느 쪽이 Nova인지는 토론이 끝나야 공개됩니다</div>

      {error && <div className="error-banner">{error}</div>}

      {available.has('conclude') ? (
        <div className="action-panel">
          <div className="label-row">
            <div className="label">중재자 결정</div>
          </div>
          <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 10px 0' }}>두 사람의 발언을 모두 들었습니다. 어느 입장에 더 설득됐나요?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className="ghost" style={{ borderColor: '#ef4444', color: '#fca5a5' }} disabled={busy} onClick={() => onConclude('A')}>
              A · {session.matchup.A.position}
            </button>
            <button className="ghost" style={{ borderColor: '#3b82f6', color: '#93c5fd' }} disabled={busy} onClick={() => onConclude('B')}>
              B · {session.matchup.B.position}
            </button>
          </div>
        </div>
      ) : (
        <div className="action-panel">
          <div className="label-row">
            <div className="label">중재자 컨트롤</div>
            <div className="next">다음: {nextLabel(session)}</div>
          </div>
          <div className="grid">
            {ACTION_ORDER.map((action) => {
              const isActive = available.has(action);
              return (
                <button
                  key={action}
                  className={`block ${isActive ? 'active' : ''}`}
                  disabled={!isActive || busy}
                  onClick={() => handleClick(action)}
                >
                  <span className="icon">{ACTION_LABELS[action].icon}</span>
                  <span>{ACTION_LABELS[action].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function nextLabel(session) {
  // Estimate next speaker side from FSM. Server is source of truth, so just hint.
  if (session.state === 'idle') return `${session.matchup.A.persona.name} 차례`;
  if (session.state === 'A_opened') return `${session.matchup.B.persona.name} 차례`;
  return '교차 진행 중';
}

function renderSpeaker(turn, session) {
  const side = turn.speaker.side;
  const persona = session.matchup[side].persona;
  const colorClass = side === 'A' ? 'red' : 'blue';
  return (
    <div className={`speaker-card ${colorClass}`}>
      <div className="glow" />
      <div className="photo" style={{ backgroundImage: `url(${persona.image})` }} />
      <div className="body">
        <div className="meta-row">
          <span className="speaker-name">{persona.name}</span>
          <span style={{ color: '#666' }}>·</span>
          <span className="action-tag">{turn.action}</span>
        </div>
        <p className="speech">{turn.content}</p>
      </div>
    </div>
  );
}

function renderEmpty() {
  return (
    <div className="speaker-card">
      <div className="body">
        <p className="speech empty">중재자 컨트롤에서 [오프닝]을 눌러 토론을 시작하세요.</p>
      </div>
    </div>
  );
}
