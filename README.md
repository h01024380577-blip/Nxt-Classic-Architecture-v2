# AI Debate Studio

두 AI 모델(Google Gemini / AWS Bedrock Nova)이 동일한 주제로 토론하면, 사용자가 직접 승자를 고르는 **3-Tier + Serverless** 실습 프로젝트입니다. 수업에서 배운 EC2/RDS/Lambda/S3 조합을 하나의 완결된 앱으로 엮는 것이 목표입니다.

```
[ React Client ]        [ Express Server ]        [ Lambda x2 ]       [ RDS MySQL ]
   S3/CloudFront   ──►     EC2 (Node.js)    ──►    Gemini        ──►  debate_results
                                            ──►    Bedrock Nova
```

- **Presentation (S3)**: React SPA — 주제 입력, 토론 진행, 결과 선택.
- **Application (EC2)**: Express — 세션·상태머신 관리, Lambda 중개, 결과 집계.
- **AI Microservices (Lambda)**: 두 개의 Function URL — 각각 Gemini, Bedrock Nova 호출.
- **Data (RDS)**: MySQL — 토론 결과 및 누적 승률 저장.

---

## 리포지토리 구조

```
4.lambda/
├── client/           React (CRA) — 토론 UI
├── server/           Express — API, 상태머신, DB
├── gemini-lambda/    Node.js Lambda — Google Gemini
├── bedrock-lambda/   Python Lambda — AWS Bedrock Nova
└── DropTable.md      DB 수동 리셋 스니펫
docs/                 (보조 문서)
```

각 하위 디렉터리에 자체 README가 있습니다. 전체 흐름을 보고 싶으면 **이 파일 → server/README → client/README → gemini-lambda/README → bedrock-lambda/README** 순서를 추천합니다.

---

## 토론 흐름

1. 사용자가 **주제 + 두 입장(A/B)** 입력
2. 서버가 세션 생성 — 이때 Gemini / Nova를 A/B 어느 쪽에 배정할지 **랜덤**으로 결정 (클라이언트에는 공개 X)
3. 상태 머신이 허용하는 액션만 UI에 노출:
   `opening → opening → (rebuttal | example | counter_rebuttal)* → closing → closing → conclude`
4. 각 턴마다 서버가 해당 모델의 Lambda를 호출 → 페르소나 프롬프트로 발언 생성
5. 사용자가 승자(A / B) 선택 → 서버가 `debate_results` 에 insert 후 통계 업데이트
6. 결과 화면에서 **어떤 모델이 어느 쪽이었는지** 공개

---

## 빠른 시작 (로컬)

**선행 조건**: Node.js 18+, MySQL 접근 가능한 DB (RDS 또는 로컬).

```bash
# 1. 저장소 클론
git clone <repo>
cd Nxt-Classic-Architecture-v2

# 2. 서버 설치 + .env 작성
cd 4.lambda/server
cp .env.example .env          # 값 채우기: DB, Lambda URL
npm install

# 3. DB 스키마 생성
node scripts/run-init-db.js   # debate_results 테이블 생성

# 4. 서버 실행
npm run dev                   # http://localhost:4000

# 5. 별도 터미널에서 클라이언트
cd ../client
npm install
npm start                     # http://localhost:3000
```

Lambda 배포 없이 UI만 체험하려면 `server/scripts/stub-lambda.js` 로 모의 Lambda를 띄우면 됩니다. 자세한 내용은 [`4.lambda/server/README.md`](4.lambda/server/README.md).

---

## 배포 개요 (AWS)

> 상세 단계는 각 하위 README 참고.

1. **RDS**: MySQL 인스턴스 생성. 보안 그룹에서 EC2 → RDS:3306 허용.
2. **Lambda (gemini)**: Node.js 20, `GEMINI_API_KEY` / `GEMINI_MODEL` 환경 변수. Function URL 활성화.
3. **Lambda (bedrock)**: Python 3.11, IAM에 `bedrock:InvokeModel` on Nova Lite. Bedrock 콘솔에서 Nova Lite 모델 접근 enable. Function URL 활성화.
4. **EC2**: Node.js 18+ 설치 → 저장소 clone → `server/.env` 작성 → `pm2 start src/index.js` → 보안 그룹 4000 개방 (또는 Nginx/ALB 앞단).
5. **S3 + CloudFront**: `client/ && npm run build` → `aws s3 sync build/ s3://<bucket>` → CloudFront behavior로 `/api/*` 를 EC2로 라우팅 (또는 클라이언트에서 `REACT_APP_API_BASE` 사용).

자세한 설정:
- [`4.lambda/server/README.md`](4.lambda/server/README.md) — EC2 배포 + pm2
- [`4.lambda/client/README.md`](4.lambda/client/README.md) — S3 정적 호스팅
- [`4.lambda/gemini-lambda/README.md`](4.lambda/gemini-lambda/README.md) — Gemini Lambda 배포
- [`4.lambda/bedrock-lambda/README.md`](4.lambda/bedrock-lambda/README.md) — Bedrock Lambda 배포

---

## 환경 변수 요약

| 위치 | 변수 | 설명 |
|------|------|------|
| `server/.env` | `PORT` | Express 포트 (기본 4000) |
| `server/.env` | `GEMINI_LAMBDA_URL` | Gemini Lambda Function URL |
| `server/.env` | `BEDROCK_LAMBDA_URL` | Bedrock Lambda Function URL |
| `server/.env` | `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | RDS 접속 정보 |
| `gemini-lambda` (Lambda Console) | `GEMINI_API_KEY` | Google AI Studio 키 |
| `gemini-lambda` (Lambda Console) | `GEMINI_MODEL` | 기본 `gemini-2.5-flash` |
| `bedrock-lambda` (Lambda Console) | `BEDROCK_MODEL_ID` | 기본 `amazon.nova-lite-v1:0` |

`.env` 는 최상단 `.gitignore`로 제외됩니다. 절대 커밋하지 마세요. 저장소엔 `.env.example` 템플릿만 있습니다.

---

## 테스트

```bash
# 서버 (상태머신, 세션, 라우트)
cd 4.lambda/server && npm test

# Gemini Lambda (프롬프트 빌더)
cd 4.lambda/gemini-lambda && npm test
```

서버 테스트는 Lambda 호출을 mock 하므로 인터넷/AWS 크리덴셜 없이 실행됩니다.

---

## 보안 / 운영 주의

- **CORS**: 서버는 기본 `cors()` (전부 허용). 운영 시 `cors({ origin: 'https://<your-client>' })` 로 좁히세요.
- **Lambda Function URL Auth**: 개발 중엔 `NONE` 허용, **운영엔 IAM**. NONE 상태에선 URL만 알면 누구나 호출 → API 비용 유출 위험.
- **Rate limiting 없음**: 필요하면 `express-rate-limit` 을 `/api/debate/start` `/turn` 에 추가.
- **SQL 인젝션 방지**: 모든 쿼리는 `?` 파라미터화. 문자열 연결 금지.
- **세션 저장**: 인메모리 Map → 단일 EC2 전제. 다중 인스턴스 배포 시 Redis/ElastiCache로 교체 필요.
- **Lambda 응답 타임아웃**: 서버에서 15초. Gemini가 `thinkingBudget: 0` 으로 응답 잘림 문제를 해결해둔 상태.
- **`debate_results` 리셋**: [`4.lambda/DropTable.md`](4.lambda/DropTable.md) 참고.

---

## 학습 포인트

- **상태 머신 설계**: 허용 액션을 서버가 계산해서 UI에 내려주므로, 프런트는 상태 로직을 몰라도 됩니다. 잘못된 액션은 전부 서버에서 400.
- **멀티 모델 중재**: 동일 입력 계약으로 두 Lambda를 추상화. 공정한 비교를 위해 프롬프트 빌더(`gemini-lambda/prompts.js` ↔ `bedrock-lambda/prompts.py`)를 1:1 미러링.
- **3-Tier 분리**: S3(정적) / EC2(앱) / RDS(데이터) / Lambda(마이크로서비스)를 한 프로젝트에 모아 실제 AWS 콘솔을 돌아다니며 연결.
- **세션 vs 영속**: 진행 중 상태(인메모리) vs 완료 결과(DB). 실패 시 영향 범위가 어디까지인지 관찰.

---

## 데모 & 스크린샷

데모 캡처 가이드: [`docs/demo.md`](docs/demo.md) — 화면별 스크린샷 목록, `curl` 기반 API 플로우, 화면 녹화 팁을 제공합니다.
