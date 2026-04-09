const test = require('node:test');
const assert = require('node:assert');
const { buildPrompt, ACTION_INSTRUCTIONS } = require('../prompts');

const persona = {
  name: '한지호',
  role: '전직 변호사, 토론 챔피언',
  voice: '자신감 있고 직설적, 논리 정연, 살짝 도발적'
};

test('buildPrompt — opening uses persona + position, no history reference', () => {
  const out = buildPrompt({
    persona,
    topic: '점심 메뉴 논쟁',
    myPosition: '짜장면이 최고',
    opponentPosition: '짬뽕이 최고',
    history: [],
    action: 'opening'
  });
  assert.match(out.system, /한지호/);
  assert.match(out.system, /전직 변호사/);
  assert.match(out.system, /자신감 있고 직설적/);
  assert.match(out.user, /짜장면이 최고/);
  assert.match(out.user, /짬뽕이 최고/);
  assert.match(out.user, /점심 메뉴 논쟁/);
  assert.match(out.user, new RegExp(ACTION_INSTRUCTIONS.opening));
});

test('buildPrompt — rebuttal includes history block with previous turns', () => {
  const out = buildPrompt({
    persona,
    topic: '점심 메뉴 논쟁',
    myPosition: '짜장면이 최고',
    opponentPosition: '짬뽕이 최고',
    history: [
      { speaker: 'opponent', action: 'opening', content: '짬뽕이 더 자극적이라 좋습니다.' },
      { speaker: 'self', action: 'opening', content: '짜장면은 절제의 미학입니다.' }
    ],
    action: 'rebuttal'
  });
  assert.match(out.user, /상대가 직전에 말한 내용/);
  assert.match(out.user, /짬뽕이 더 자극적/);
  assert.match(out.user, /짜장면은 절제/);
  assert.match(out.user, new RegExp(ACTION_INSTRUCTIONS.rebuttal));
});

test('buildPrompt — unknown action throws', () => {
  assert.throws(() => buildPrompt({
    persona, topic: 't', myPosition: 'a', opponentPosition: 'b', history: [], action: 'bogus'
  }), /Unknown action/);
});
