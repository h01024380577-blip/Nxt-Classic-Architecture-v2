# gemini-lambda

AWS Lambda (Node.js 20) — Google Gemini 모델을 사용해 토론 페르소나의 발언을 생성합니다. `bedrock-lambda` 와 동일한 입력/출력 계약을 가집니다.

## 파일

- `index.js` — Lambda 핸들러 (Function URL 진입점)
- `prompts.js` — 프롬프트 빌더 (`bedrock-lambda/prompts.py` 와 내용 일치)
- `tests/prompts.test.js` — 프롬프트 빌더 스냅샷성 검증

## 입력 계약

```jsonc
{
  "persona":          { "id": "hanjiho", "name": "한지호", "role": "...", "voice": "..." },
  "topic":            "점심 메뉴 논쟁",
  "myPosition":       "짜장면이 최고",
  "opponentPosition": "짬뽕이 최고",
  "history": [
    { "speaker": "self" | "opponent", "action": "opening", "content": "..." }
  ],
  "action": "opening" | "rebuttal" | "example" | "counter_rebuttal" | "closing"
}
```

## 출력 계약

```jsonc
// 성공
{ "statusCode": 200, "body": "{\"content\": \"...발언 본문...\"}" }

// 실패
{ "statusCode": 500, "body": "{\"error\": \"...메시지...\"}" }
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `GEMINI_API_KEY` | (없음, 필수) | Google AI Studio 키 |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 사용할 모델 ID |

로컬 테스트용 `.env.example`이 함께 제공됩니다. **운영에선 Lambda 콘솔 → Configuration → Environment variables 에 직접 넣으세요.** 키를 repo에 커밋하지 마세요.

## 응답 품질 이슈 대응

Gemini 2.5 Flash는 내부 "thinking" 토큰을 `maxOutputTokens` 예산에서 소비합니다. 이걸 끄지 않으면 토론 발언이 **중간에 잘려서 끝납니다** (예: `"...빠른 조리 시간'과"` 에서 종료).

본 Lambda는 다음을 적용해 이 문제를 해결했습니다 (`index.js`):

```js
generationConfig: {
  temperature: 0.85,
  maxOutputTokens: 2048,
  thinkingConfig: { thinkingBudget: 0 }  // thinking 비활성화
}
```

`finishReason !== 'STOP'` 인 경우 경고 로그를 남기므로 CloudWatch에서 잘림을 탐지할 수 있습니다.

## 배포

```bash
cd 4.lambda/gemini-lambda

# 배포 패키지 생성 (node_modules 포함)
npm install --omit=dev
zip -r function.zip index.js prompts.js package.json node_modules

# Lambda 코드 업데이트
aws lambda update-function-code \
  --function-name debate-gemini \
  --zip-file fileb://function.zip
```

> `function.zip` 은 저장소 `.gitignore` 에 등록되어 있습니다.

최초 생성 시:

1. Lambda 생성 — Runtime: **Node.js 20**, Architecture: x86_64(또는 arm64).
2. Handler: `index.handler`
3. Environment variables: `GEMINI_API_KEY`, `GEMINI_MODEL` 설정
4. Function URL 활성화 — Auth: `NONE` (개발) / `AWS_IAM` (운영 권장)
5. Timeout: 30s 이상 권장 (Gemini 응답 여유)
6. 생성된 Function URL 을 `4.lambda/server/.env` 의 `GEMINI_LAMBDA_URL` 에 넣기

## 테스트

```bash
npm test
```

`tests/prompts.test.js` 는 `buildPrompt()` 출력에 action 별 지시문과 history 가 반영되는지 확인합니다.

## 보안 주의

- Function URL Auth = NONE 이면 **URL을 아는 누구나 호출 가능** → 호출 비용 노출. 운영 전에 IAM 으로 전환하거나, Express 서버 IP/보안그룹으로 제한하세요.
- Gemini API 키가 유출되면 Google Cloud 콘솔에서 키를 revoke 하고 재발급하세요.
