# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Debate Studio — Two AI models (Google Gemini & AWS Bedrock Nova) debate a user-chosen topic on opposing sides. Users pick the winner; cumulative win rates are tracked in MySQL. The debate is "blind": models are randomly assigned sides at session start, and identity is revealed only at the results screen.

Deployed on AWS: S3 (static frontend) → EC2 (Express API) → RDS MySQL + 2 Lambda functions (Gemini Node.js, Bedrock Python). UI and content are in Korean.

## Common Commands

### Server (AI-Debate/server/)
```bash
npm run dev          # Start with --watch (port 4000)
npm start            # Production start
npm test             # Run all tests: node --test "tests/**/*.test.js"
```

### Client (AI-Debate/client/)
```bash
npm start            # CRA dev server (port 3000, proxies /api to :4000)
npm run build        # Production build → build/
npm test             # Jest via react-scripts (--watchAll=false)
```

### Gemini Lambda (AI-Debate/gemini-lambda/)
```bash
npm test             # node --test "tests/**/*.test.js"
```

### Local Development Without AWS
Use the stub Lambda server for local E2E without real AI calls:
```bash
node AI-Debate/server/scripts/stub-lambda.js   # Mock Gemini on :4101, Nova on :4102
```
Set `GEMINI_LAMBDA_URL=http://localhost:4101` and `BEDROCK_LAMBDA_URL=http://localhost:4102` in server `.env`.

### Database Init
```bash
node AI-Debate/server/scripts/run-init-db.js   # Creates debate_results table from init-db.sql
```

## Architecture

### Three-tier + serverless hybrid

```
React SPA (S3)  →  Express API (EC2:4000)  →  RDS MySQL
                        ↓
              ┌─────────┴─────────┐
        Gemini Lambda        Bedrock Lambda
        (Node.js, @google/   (Python, boto3,
         generative-ai)       amazon.nova-lite)
```

### Server core design pattern — Finite State Machine

The debate flow is driven by a pure FSM in `stateMachine.js`:
```
idle → A_opened → B_opened → mid → A_closed → ready_to_conclude → concluded
```
Each state transition is validated; invalid transitions throw. The FSM is pure (no side effects), making it easy to test independently.

### Session management

Sessions live in an in-memory `Map` (`sessions.js`) with 1-hour TTL and 5-minute cleanup intervals. Each session stores: topic, positions, model assignments (random A/B), conversation history, and current FSM state.

### Lambda communication

`lambdaClient.js` wraps axios calls to Lambda Function URLs with a 15-second timeout. Both Lambdas accept `{topic, positionA, positionB, side, history, action}` and return `{text}`.

### Client phase machine

`App.jsx` manages three phases: `start` → `main` → `result`. The `MainScreen` renders turn-by-turn debate with action buttons (rebuttal/example/counter). `ResultScreen` reveals which AI was which side and shows aggregate stats.

## Environment Variables

**Server**: `PORT`, `GEMINI_LAMBDA_URL`, `BEDROCK_LAMBDA_URL`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default: debate_studio)

**Gemini Lambda**: `GEMINI_API_KEY`, `GEMINI_MODEL` (default: gemini-2.5-flash)

**Bedrock Lambda**: `BEDROCK_MODEL_ID` (default: amazon.nova-lite-v1:0), region from Lambda env

## Testing

Tests use Node.js native test runner (`node --test`), not Jest (except CRA client). Server tests mock Lambda calls and don't require AWS credentials or a running database. Run from each package directory.

## Key Conventions

- No monorepo tooling (no Turborepo/Lerna) — each subdirectory under `AI-Debate/` is independent with its own package.json
- SQL queries use parameterized placeholders (mysql2/promise) — maintain this pattern
- Bedrock Lambda is Python-only (boto3, no package.json) — deploy with `zip -j`
- Gemini Lambda bundles node_modules into function.zip for Lambda deployment
- Client proxy config in package.json routes `/api` to Express during local dev
