# AI Debate Studio — Server

Express 백엔드. 클라이언트(React)와 두 AI Lambda(Gemini / Bedrock Nova) 사이의 중개자 역할을 합니다. 토론 상태 머신·세션 저장·결과 집계를 담당합니다.

```
[React Client]  ──►  [Express Server (this)]  ──►  [Gemini Lambda]
                           │                   └►  [Bedrock Nova Lambda]
                           └──►  [MySQL / RDS]  (debate_results 테이블)
```

---

## 구성 요소

```
src/
├── index.js            # Express 엔트리
├── routes/debate.js    # /api/debate/* 라우트
├── stateMachine.js     # 토론 FSM (순수 함수, TDD)
├── sessions.js         # 인메모리 세션 저장소
├── personas.js         # 페르소나 정적 레지스트리
├── lambdaClient.js     # Lambda Function URL 호출 (axios)
└── db.js               # mysql2/promise 풀 + 집계 쿼리

scripts/
├── init-db.sql         # debate_results 테이블 스키마
├── run-init-db.js      # .env 읽어서 스키마 적용
└── stub-lambda.js      # 로컬 E2E용 스텁 Lambda (모의 AI)

tests/
├── stateMachine.test.js
├── sessions.test.js
└── debate.routes.test.js
```

---

## 환경 변수 (`.env`)

`.env.example` 복사 후 채우세요.

```bash
cp .env.example .env
```

| 변수 | 설명 |
|------|------|
| `PORT` | Express 포트 (기본 4000) |
| `GEMINI_LAMBDA_URL` | Gemini Lambda Function URL |
| `BEDROCK_LAMBDA_URL` | Bedrock Nova Lambda Function URL |
| `DB_HOST` | RDS 엔드포인트 |
| `DB_PORT` | 3306 |
| `DB_USER` / `DB_PASSWORD` | MySQL 계정 |
| `DB_NAME` | 기본 `debate_studio` (공유 DB면 수업 DB명) |

> `dotenv`는 `src/index.js` 최상단에서 로드됩니다. `require('./lambdaClient')`가 import time에 환경변수를 읽기 때문에 순서를 바꾸지 마세요.

---

## DB 초기화

MySQL CLI 없이도 Node만으로 실행할 수 있습니다.

```bash
cd 4.lambda/server
npm install
node scripts/run-init-db.js
```

출력:

```
[init-db] connected to <DB_HOST>/<DB_NAME>
[init-db] SQL applied successfully.
[init-db] ✅ debate_results table exists.
```

공유 DB 사용 시: `init-db.sql`은 `CREATE TABLE IF NOT EXISTS`만 실행하므로 기존 수업 DB에 그대로 얹어도 안전합니다. 충돌이 우려되면 `debate_results` 앞에 접두사를 붙여 복사본을 만드세요.

---

## 실행

```bash
npm install
npm run dev     # 파일 변경 감지 (--watch)
npm start       # 일반 실행
```

기본 URL: `http://localhost:4000`

헬스체크:

```bash
curl http://localhost:4000/health
# {"ok":true}
```

### Lambda 없이 로컬 E2E 실행

`scripts/stub-lambda.js`가 모의 AI 응답을 돌려주는 작은 HTTP 서버입니다. 포트 4101/4102로 띄워놓고 `.env`의 `GEMINI_LAMBDA_URL` / `BEDROCK_LAMBDA_URL`을 해당 주소로 바꾸면 API 키 없이도 클라이언트 전체 플로우를 확인할 수 있습니다.

```bash
node scripts/stub-lambda.js 4101 gemini &
node scripts/stub-lambda.js 4102 nova   &
```

---

## API

모든 요청/응답은 JSON. Base path: `/api/debate`.

### `POST /start`

```jsonc
// 요청
{ "topic": "아침 식사로 빵 vs 밥", "positionA": "빵", "positionB": "밥" }
```

```jsonc
// 응답
{
  "sessionId": "uuid",
  "topic": "...",
  "matchup": {
    "A": { "persona": { "id": "hanjiho", "name": "한지호", ... }, "position": "빵" },
    "B": { "persona": { "id": "leeseoyeon", "name": "이서연", ... }, "position": "밥" }
  },
  "state": "idle",
  "availableActions": ["opening"],
  "turnCount": 0
}
```

- Gemini / Nova 모델은 세션 생성 시점에 A/B 어느 한쪽에 **랜덤**으로 배정됩니다 (`sessions.js`).
- 클라이언트는 어느 모델이 어느 쪽인지 알 수 없습니다. 결과 화면에서만 공개.

### `POST /:sessionId/turn`

```jsonc
// 요청
{ "action": "opening" | "rebuttal" | "example" | "counter_rebuttal" | "closing" }
```

다음 발언자(자동 번갈아짐)가 해당 액션으로 말합니다. 서버가 선택된 Lambda를 호출하고 응답을 돌려줍니다.

허용 액션은 FSM 상태에 따라 달라집니다. 잘못된 액션을 보내면 400과 함께 `availableActions`가 반환됩니다.

### `POST /:sessionId/conclude`

```jsonc
// 요청
{ "chosenSide": "A" | "B" }
```

사용자가 승자를 고르면 결과를 `debate_results`에 insert하고 전체 통계를 반환합니다.

```jsonc
// 응답
{
  "chosen":  { "side": "A", "persona": {...}, "position": "...", "model": "gemini" | "nova" },
  "passed":  { "side": "B", "persona": {...}, "position": "...", "model": "..." },
  "stats":   { "geminiWins": 7, "novaWins": 5, "totalDebates": 12, "geminiWinRate": 0.58, "novaWinRate": 0.42 }
}
```

### `GET /results`

전체 통계 + 최근 20건 결과.

```jsonc
{
  "stats":  { "geminiWins": 7, "novaWins": 5, "totalDebates": 12, ... },
  "recent": [ { "id": 12, "topic": "...", "winner_model": "gemini", ... } ]
}
```

---

## 토론 상태 머신

`stateMachine.js`는 I/O 없는 순수 함수. 상태 흐름:

```
idle
 └─ opening  → A_opened
              └─ opening → B_opened
                          ├─ rebuttal/example/counter_rebuttal → mid (번갈아 발언)
                          └─ closing → A_closed
                                       └─ closing → ready_to_conclude
                                                    └─ conclude → concluded
```

- `availableActions(state)` 만 UI에 노출 → 잘못된 액션 차단.
- `nextSpeaker(state)` 가 `mid` 상태에서 `lastSpeaker` 를 뒤집어 교대 발언 보장.

---

## 세션 저장

현재는 **인메모리 Map** (`sessions.js`):

- 단일 Express 프로세스 전제. 멀티 인스턴스 배포 시 Redis/DB로 옮겨야 함.
- 1시간 지난 세션은 5분마다 자동 만료 (`expireOlderThan(ONE_HOUR)`).
- 프로세스 재시작 시 진행중 세션은 모두 소실됩니다 (사용자에게 "세션이 만료되었습니다" 토스트).

---

## 테스트

```bash
npm test
```

- `stateMachine.test.js` — FSM 전이 커버.
- `sessions.test.js` — 세션 생성/만료/모델 랜덤 분배.
- `debate.routes.test.js` — supertest 기반 라우트 smoke, invokeLambda mock.

---

## 보안 / 운영 주의사항

- **CORS는 전체 허용** (`app.use(cors())`) — 교육용 기본값. 운영 전엔 `cors({ origin: process.env.CLIENT_ORIGIN })` 로 제한하세요.
- **Rate limiting 없음** — `express-rate-limit`으로 `/api/debate/start`·`/turn` 에 캡을 씌우는 걸 권장.
- **Lambda Function URL Auth**: 개발 중엔 `NONE` 허용했으나, 운영에선 IAM 또는 VPC 통신으로 바꾸세요. 누구든 URL만 알면 호출 가능 = 비용 노출.
- **DB 자격증명은 `.env`에만** — `.env` 는 저장소 최상단 `.gitignore`로 제외돼 있습니다 (`git check-ignore 4.lambda/server/.env` 로 확인).
- **SQL 인젝션 방지**: `db.js` 와 `run-init-db.js` 모두 placeholder(`?`) 사용. 문자열 연결로 쿼리를 조립하지 마세요.
- **DoS 완화**: `express.json({ limit: '64kb' })` 로 본문 크기 제한.

---

## EC2 배포 힌트 (요약)

1. EC2에 Node 18+ 설치, `git clone`.
2. `cd 4.lambda/server && npm install --omit=dev`.
3. `.env` 작성 (RDS / Lambda URL).
4. 프로세스 매니저로 상시 실행:
   ```bash
   # pm2 예시
   npm i -g pm2
   pm2 start src/index.js --name debate-server
   pm2 save && pm2 startup
   ```
5. 보안 그룹: 클라이언트(S3 CloudFront 등) → EC2 4000 포트 허용. 또는 ALB/Nginx 앞단에 두기.
6. RDS 보안 그룹: EC2 보안 그룹에서만 3306 허용.
