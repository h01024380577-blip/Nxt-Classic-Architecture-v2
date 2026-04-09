# 데모 캡처 가이드

AI Debate Studio 의 동작을 스크린샷 / 짧은 화면 녹화로 남기는 절차입니다. 발표·수업 자료에 그대로 붙여넣을 수 있도록 화면 목록과 API 흐름을 분리했습니다.

> 실제 캡처 파일은 커밋하지 마세요. 저장소 용량 부풀리기 방지를 위해 `docs/screens/`, `*.mp4`, `*.gif` 는 `.gitignore` 에 추가하는 걸 권장합니다.

---

## 준비

1. 서버 실행:
   ```bash
   cd 4.lambda/server && npm run dev
   ```
2. 클라이언트 실행:
   ```bash
   cd 4.lambda/client && npm start
   ```
3. Lambda 가 배포돼 있지 않다면 `server/scripts/stub-lambda.js` 로 모의 Lambda 를 띄워서 플로우만 확인하세요. (server README 참고)
4. DB 가 비어 있지 않은 상태에서 시작하는 게 결과 화면 통계가 더 그럴듯합니다. 수 회 세션을 미리 돌려두세요.

---

## 스크린샷 체크리스트

브라우저 해상도 **1440 × 900** 또는 **1280 × 800** 권장. 다크 테마라 창 배경도 어두운 톤으로 맞추면 경계가 안 튑니다.

| # | 파일명 (예시) | 화면 | 포인트 |
|---|----|------|--------|
| 1 | `01-start-empty.png` | Start (빈 입력) | 페르소나 카드 두 개 + 브랜드 헤더 + 빈 입력 필드 |
| 2 | `02-start-filled.png` | Start (입력 완료) | 실제 주제/입장 입력 후 `▶ 토론 시작` 활성화 상태 |
| 3 | `03-main-initial.png` | Main (첫 오프닝) | 발언자 카드 + 현재 발언 + 사용 가능한 액션 버튼 |
| 4 | `04-main-midway.png` | Main (반박 중반) | 여러 번 턴이 지나 `rebuttal` / `example` / `counter_rebuttal` 가 노출된 상태 |
| 5 | `05-main-ready-to-conclude.png` | Main (결론 대기) | 양쪽 `closing` 완료 후 `결론` 버튼만 활성 |
| 6 | `06-result-winner.png` | Result | 선택된 승자 카드 + 공개된 모델(gemini / nova) + 누적 통계 |
| 7 | `07-result-stats-detail.png` | Result | 통계 영역 확대 — `geminiWinRate` / `novaWinRate` 수치가 잘 보이도록 |

브라우저 개발자도구(네트워크 탭)에서 `/api/debate/...` 요청이 200으로 찍히는 스크린샷도 함께 남기면 백엔드가 살아있음을 보여주기 좋습니다.

---

## 짧은 화면 녹화 (선택)

30-60초 클립 한 개면 충분합니다. 흐름 예시:

1. Start 화면 입력 (5s)
2. `▶ 토론 시작` 클릭 → Main 진입 (2s)
3. `오프닝` → `오프닝` → `반박` 한 바퀴 (15s, Lambda 응답 기다리는 시간 포함)
4. 빠른 편집으로 중간 턴 일부 스킵
5. `결론` 클릭 → 승자 선택 → Result 화면 (5s)

macOS 기본 녹화:

```bash
# ⇧⌘5 → 선택영역 녹화
# 또는 cli:
screencapture -v -V 60 -R "0,0,1440,900" demo.mov
```

GIF 로 변환 (ffmpeg):

```bash
ffmpeg -i demo.mov -vf "fps=12,scale=960:-1:flags=lanczos" -loop 0 demo.gif
```

---

## API 전용 데모 (터미널 녹화)

브라우저 없이 서버 동작만 보여주고 싶을 때. `asciinema` 또는 일반 스크린 녹화로 담으세요.

```bash
BASE=http://localhost:4000/api/debate

# 1) 세션 시작
SESSION=$(curl -s -X POST "$BASE/start" \
  -H 'content-type: application/json' \
  -d '{"topic":"점심 메뉴 논쟁","positionA":"짜장면이 최고","positionB":"짬뽕이 최고"}' \
  | tee /dev/tty | jq -r '.sessionId')

# 2) 양쪽 오프닝
curl -s -X POST "$BASE/$SESSION/turn" -H 'content-type: application/json' \
  -d '{"action":"opening"}' | jq .
curl -s -X POST "$BASE/$SESSION/turn" -H 'content-type: application/json' \
  -d '{"action":"opening"}' | jq .

# 3) 반박 → 사례 → 재반박
for ACT in rebuttal example counter_rebuttal; do
  curl -s -X POST "$BASE/$SESSION/turn" -H 'content-type: application/json' \
    -d "{\"action\":\"$ACT\"}" | jq .
done

# 4) 양쪽 마무리
curl -s -X POST "$BASE/$SESSION/turn" -H 'content-type: application/json' \
  -d '{"action":"closing"}' | jq .
curl -s -X POST "$BASE/$SESSION/turn" -H 'content-type: application/json' \
  -d '{"action":"closing"}' | jq .

# 5) 결론 (A 승)
curl -s -X POST "$BASE/$SESSION/conclude" -H 'content-type: application/json' \
  -d '{"chosenSide":"A"}' | jq .

# 6) 누적 결과
curl -s "$BASE/results" | jq '.stats'
```

이 블록을 터미널에 붙여넣고 녹화하면 "상태 머신이 허용 액션만 받고", "승자 선택이 DB에 반영되고", "통계가 누적된다" 는 3가지를 한 번에 보여줄 수 있습니다.

---

## 발표 때 강조할 지점

- **모델 랜덤 배정**: 같은 주제로 여러 번 돌리면 Gemini 가 A일 때도 B일 때도 승/패가 나오는 장면 → 편향 없는 비교.
- **상태 머신**: 잘못된 액션 호출 시 400 + `availableActions` 가 돌아오는 걸 콘솔에서 한 번 보여주기.
  ```bash
  curl -s -X POST "$BASE/$SESSION/turn" -H 'content-type: application/json' \
    -d '{"action":"closing"}' | jq .
  ```
  (오프닝 전에 closing 보내면 거절됨)
- **Lambda 장애 시 UI 회복**: Lambda 를 죽인 상태에서 턴을 호출 → 503 에러 배너 → Lambda 복구 → 재시도.
- **누적 통계**: `/api/debate/results` 의 `geminiWinRate` vs `novaWinRate` 를 크게 띄우며 설명.

---

## 캡처 파일 관리

```bash
# docs 하위에 스크린샷 보관 (gitignore 추천)
mkdir -p docs/screens
# 캡처물 이동
mv ~/Desktop/Screenshot*.png docs/screens/

# .gitignore 에 추가 (원하면)
echo "docs/screens/" >> .gitignore
echo "*.mov" >> .gitignore
echo "*.mp4" >> .gitignore
echo "*.gif" >> .gitignore
```

발표 직전 전체 점검용 스모크 테스트:

```bash
curl -s http://localhost:4000/health
cd 4.lambda/server && npm test
```

두 개 다 초록이면 데모 준비 완료.
