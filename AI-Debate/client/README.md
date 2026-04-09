# AI Debate Studio — Client

Create React App 기반의 프론트엔드. 토론 주제와 두 입장을 입력받고, 두 AI(한지호 / 이서연 페르소나)의 공방을 보여주며, 사용자가 승자를 골라 결과를 기록합니다.

---

## 화면 구성

```
App (phase 상태로 분기)
├── StartScreen    — 주제 입력 + 두 입장 + "토론 시작"
├── MainScreen     — 현재 발언자 카드 + 액션 버튼 + 결론 내기
└── ResultScreen   — 선택된 승자 / 모델 공개 / 통계 / 재시작
```

- 모델(Gemini / Nova) ↔ 페르소나 매핑은 **서버가 세션 생성 시 랜덤**으로 결정합니다. 결과 화면 전까지는 어떤 페르소나가 어떤 모델인지 클라이언트에 노출되지 않습니다.
- 페르소나 이미지는 `public/personas/` 에 있습니다 (`hanjiho.png`, `leeseoyeon.png`).

```
src/
├── App.jsx                  # phase 상태 머신 (start / main / result)
├── index.js
├── api/debate.js            # /api/debate/* fetch 래퍼
├── components/
│   ├── StartScreen.jsx
│   ├── MainScreen.jsx
│   └── ResultScreen.jsx
├── state/                   # 공용 훅/리듀서 (있는 경우)
└── styles.css               # TV 토론 스튜디오 다크 테마
```

---

## 설치 & 실행

```bash
cd 4.lambda/client
npm install
npm start
```

기본 포트: `http://localhost:3000`

`package.json` 에 `"proxy": "http://localhost:4000"` 이 설정돼 있어 개발 모드에서 `/api/*` 호출이 자동으로 Express 서버로 프록시됩니다. 서버를 먼저 띄워두세요 (`4.lambda/server`).

---

## 환경 변수

이 클라이언트는 **환경변수 없이** 동작합니다.

- 개발: CRA proxy → `http://localhost:4000`
- 배포 (S3 + 별도 API 호스트): 현재는 `fetch('/api/debate/...')` 상대 경로를 씁니다. 프론트엔드를 S3에서 서빙하고 API를 EC2/ALB에서 서빙한다면 둘 중 하나를 선택하세요:
  1. **CloudFront 단일 오리진 통합**: `/api/*` 경로를 EC2 behavior로, 나머지는 S3 behavior로 분기 → 기존 상대 경로 그대로 작동.
  2. **BASE URL 분리**: `src/api/debate.js` 의 `const BASE = '/api/debate'` 를 `process.env.REACT_APP_API_BASE + '/api/debate'` 로 바꾸고, `.env.production` 에 `REACT_APP_API_BASE=https://api.example.com` 지정 후 빌드.

---

## 빌드

```bash
npm run build
```

`build/` 디렉터리에 정적 산출물(HTML/JS/CSS + `personas/*.png`)이 생성됩니다.

---

## 배포 (S3 정적 호스팅 예시)

```bash
# 빌드
npm run build

# S3 동기화 (버킷명은 본인 것으로)
aws s3 sync build/ s3://<your-bucket>/ --delete

# CloudFront 무효화 (배포 후 변경 반영)
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

체크리스트:

- S3 버킷 정적 웹 호스팅 활성화 또는 CloudFront OAC(Origin Access Control) 사용
- SPA 라우팅 대비: 4xx → `/index.html` 200 으로 리다이렉트 (본 앱은 단일 페이지라 필수 아님)
- API를 별도 호스트에서 서빙한다면 위 환경 변수 섹션 참고
- Express 서버의 `CORS_ORIGIN` 을 클라이언트 도메인으로 제한

---

## 로컬 E2E 흐름

```
1) server:   cd ../server && npm start          (:4000)
2) client:   npm start                          (:3000)
3) 브라우저: http://localhost:3000
   - 주제/입장 입력 → [토론 시작]
   - [오프닝] → [반박] → [사례] → [재반박] → [마무리] 순환
   - [결론] 버튼 활성화되면 승자 선택
   - 결과 화면에서 승자 모델 공개 + 누적 통계
```

Lambda 없이 UI만 테스트하려면 서버 README 의 "Lambda 없이 로컬 E2E 실행" 섹션 참고 (스텁 Lambda 사용).

---

## 스타일

- `styles.css` 에 TV 토론 스튜디오 분위기의 **다크 테마**. 레드/블루 두 색으로 A/B 진영 구분.
- CRA 기본 템플릿 CSS는 전부 제거되고 하나의 파일에 통합돼 있습니다.
- 페르소나 이미지와 함께 `background-image` 로 원형 카드 렌더링.

---

## 주의사항

- 세션은 서버 인메모리 저장 → 서버 재시작 시 진행 중 세션은 모두 404로 리턴 ("세션이 만료되었습니다" 에러 표시됨). 다시 [토론 시작]을 누르면 됩니다.
- Lambda 응답은 최대 15초 타임아웃 (서버 `lambdaClient.js`). 15초 넘으면 UI에 "AI 응답 생성 중 문제가 발생했습니다" 표시.
- 프로덕션 빌드에서 콘솔 경고를 에러로 취급하지 않도록 `.env` 에 `CI=false` 를 설정할 필요가 있을 수 있습니다 (react-scripts 5 동작).
