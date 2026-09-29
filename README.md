# aksara-e2e

Black-box Playwright E2E suite for COLABORA (Aksara): https://colabora.aksara.blog/

## Setup
```bash
npm install
npx playwright install chromium
cp .env.example .env                              # BASE_URL, E2E_API_ORIGIN
cp accounts.example.json accounts.local.json      # fill in role accounts (gitignored)
```

## Run
```bash
npm run test:e2e            # full suite (headless)
npm run test:e2e:headed     # watch it in a browser
npm run test:e2e:ui         # Playwright UI mode
npm run test:e2e:report     # open artifacts/html-report
npx playwright test --grep @smoke          # or @auth, @navigation, @feature, @form, @security
E2E_ROLES=super-user,user npx playwright test tests/smoke
EXPLORE_ROLE=teknik-pilang npm run explore # read-only crawl → artifacts/exploration/<role>/
```

## Safety
Every test runs behind a network guard that aborts POST/PUT/PATCH/DELETE (except login/logout), so the suite cannot
change server data. Set `E2E_SAFE_ENV=true` only for a disposable environment.

## Full workflow test (writes data)
`tests/workflow/full-flow.spec.ts` creates a real permohonan ("E2E Flow …") and completes every activity in the UI, uploading
`tests/fixtures/files/e2e-evidence.pdf` (a 1-page dummy PDF) as evidence at each step. It is skipped unless:
```bash
E2E_SAFE_ENV=true npx playwright test --grep @e2e-write
```
Each run adds 2 completed permohonan to the server. Use it on the development server only.

## Docs
`testing/APP_MAP.md` · `testing/TEST_PLAN.md` · `testing/TEST_COVERAGE.md` · `testing/BUG_REPORT.md`

## Playwright Test Agents
`.claude/agents/` (planner, generator, healer) and `.mcp.json` were created by `npx playwright init-agents --loop=claude`.
They are available when Claude Code is started **inside this folder**.
