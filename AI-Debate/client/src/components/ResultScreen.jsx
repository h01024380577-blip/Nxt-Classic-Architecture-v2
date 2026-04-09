export function ResultScreen({ session, result, onRestart }) {
  const chosen = result.chosen;
  const passed = result.passed;
  const stats = result.stats;
  const chosenColorClass = chosen.side === 'A' ? 'red' : 'blue';
  const passedColorClass = passed.side === 'A' ? 'red' : 'blue';
  const formatPct = (n) => `${Math.round(n * 100)}%`;

  return (
    <div className="column">
      <div className="verdict-header">
        <div className="label">VERDICT · REVEAL</div>
        <h2>중재자의 결정</h2>
        <p className="topic">"{session.topic}"</p>
      </div>

      <div className={`winner-card ${chosenColorClass}`}>
        <div className="photo" style={{ backgroundImage: `url(${chosen.persona.image})` }} />
        <div className="body">
          <div className="badges">
            <span className="badge-chosen">CHOSEN</span>
            <span className="badge-revealed">REVEALED</span>
          </div>
          <div className="name">{chosen.persona.name}</div>
          <div className="meta-row">
            <span className="position">{chosen.position}</span>
            <span style={{ width: 3, height: 3, background: '#555', borderRadius: '50%' }} />
            <span className={`model-badge ${chosen.model}`}>
              {chosen.model === 'gemini' ? '⚡ GEMINI' : 'NOVA'}
            </span>
          </div>
        </div>
      </div>

      <div className={`loser-card ${passedColorClass}`}>
        <div className="photo" style={{ backgroundImage: `url(${passed.persona.image})` }} />
        <div className="body">
          <div className="name">{passed.persona.name}</div>
          <div className="meta-row">
            <span style={{ fontSize: 9, color: '#666' }}>{passed.position}</span>
            <span style={{ width: 3, height: 3, background: '#444', borderRadius: '50%' }} />
            <span className={`small-badge ${passed.model}`}>
              {passed.model === 'gemini' ? '⚡ GEMINI' : 'NOVA'}
            </span>
          </div>
        </div>
        <span className="passed">PASSED</span>
      </div>

      <div className="matchup-summary">
        <div className="label">이번 토론 매치업</div>
        <div className="line">
          <span className={chosen.side === 'A' ? chosen.model : passed.model}>
            {session.matchup.A.persona.name} = {sideToModel(session, 'A', chosen, passed).toUpperCase()}
          </span>
          <span style={{ color: '#555', margin: '0 8px' }}>·</span>
          <span className={chosen.side === 'B' ? chosen.model : passed.model}>
            {session.matchup.B.persona.name} = {sideToModel(session, 'B', chosen, passed).toUpperCase()}
          </span>
        </div>
      </div>

      <div className="stats">
        <div className="label">역대 누적 승률 (모델 기준)</div>
        <div className="row">
          <div className="label-cell gemini">⚡ Gemini</div>
          <div className="bar">
            <div className="gemini" style={{ width: `${stats.geminiWinRate * 100}%` }} />
            <div className="nova" style={{ width: `${stats.novaWinRate * 100}%` }} />
          </div>
          <div className="label-cell nova" style={{ textAlign: 'right' }}>Nova</div>
        </div>
        <div className="nums">
          <div className="gemini">{formatPct(stats.geminiWinRate)} ({stats.geminiWins}승)</div>
          <div className="total">전체 {stats.totalDebates}회</div>
          <div className="nova">{formatPct(stats.novaWinRate)} ({stats.novaWins}승)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="primary" onClick={onRestart}>새 토론 시작</button>
        <button className="ghost" onClick={onRestart}>처음으로</button>
      </div>
    </div>
  );
}

function sideToModel(session, side, chosen, passed) {
  if (chosen.side === side) return chosen.model;
  if (passed.side === side) return passed.model;
  return '???';
}
