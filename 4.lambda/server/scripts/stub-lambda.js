// Tiny HTTP stub that pretends to be both lambdas. Run on port 9999.
// Used only for local smoke-testing the server/client without real AWS.

const http = require('http');

const responses = {
  opening:          (b) => `${b.persona.name}로서 ${b.myPosition}에 대한 첫 발언입니다. 핵심 근거는 단순합니다.`,
  rebuttal:         (b) => `${b.persona.name}의 반박: 상대 주장에는 핵심 약점이 있습니다.`,
  example:          (b) => `${b.persona.name}: 구체적인 사례를 하나 들어보겠습니다.`,
  counter_rebuttal: (b) => `${b.persona.name}의 재반박: 다시 한번 짚어드리죠.`,
  closing:          (b) => `${b.persona.name}의 마무리: 결국 ${b.myPosition}이 답입니다.`
};

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const payload = JSON.parse(body || '{}');
    const fn = responses[payload.action] || ((b) => `(${payload.action})`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ content: fn(payload) }));
  });
}).listen(9999, () => console.log('[stub] http://localhost:9999'));
