# COLABORA (Aksara) — Test Plan

Scope: black-box E2E of https://colabora.aksara.blog/ and its API (https://api-colabora.anargya.fun), Chromium.
Built from the exploration in `APP_MAP.md`. Execution status is in `TEST_COVERAGE.md`; issues are in `BUG_REPORT.md`.

## Safety rules (shared environment, assume real data)
- **Enforced in code:** the auto `guard` fixture (`tests/fixtures/test.ts`) aborts every POST/PUT/PATCH/DELETE except
  `/api/auth/(login|logout|refresh)`. Tests assert `guard.list()` is empty, which proves client-side validation stopped
  a submit on its own.
- Destructive buttons are only opened to their confirmation UI and then cancelled ("Hapus" → Batal).
- Only one wrong-password attempt per run (no brute force). No random registrations.
- `E2E_SAFE_ENV=true` turns the guard off. Use it only on a disposable environment.

## Test data
- `accounts.local.json` (gitignored): 18 role accounts; `disabled` marks unusable ones (admin). `E2E_ROLES` narrows a run.
- Login happens once per role per worker through the UI; the token is then seeded into `sessionStorage` for later tests.

## SMOKE — `tests/smoke/`
- `http` → `https` 308; `/` → `/login`; title and heading; critical assets (JS/CSS/font) load; no console errors on login
- 404 page for an unknown route
- Per role (17): login → Beranda, `user/me` and `permohonan` API 200, app shell present, role label, account menu only for super user, healthy console and network

## NAVIGATION — `tests/navigation/`
- Sidebar links, collapse/expand, skip link, dashboard shortcuts, browser back
- List → detail → "Kembali ke daftar" → browser Back
- Internal links crawl (super user): every same-origin link from dashboard, list and account pages opens without an error page or unexpected redirect

## AUTH — `tests/auth/`
- Form: fields, required, email format, password toggle, unknown email, wrong password (1×)
- Session: protected route, reload persistence, per-tab scope, logout clears and re-protects, **token revoked after logout (security)**

## FORMS — `tests/forms/` (validation only; valid submits are destructive)
- Permohonan baru: defaults, dropdown options, required messages, phone format, error clears, Batal, beforeunload prompt
- Buat akun: 14 roles, required messages, email/length/confirmation, masked inputs, Batal
- Survei: reach the form through the task's "Lanjutkan proses"; empty submit → date and evidence required; no request sent

## FEATURES — `tests/features/`
- Permohonan list: stage summary, columns, count consistency, search (number, name, no match, URL sync), status filter (3 values + reset), detail link, "Tugas saya (N)" = rows for 3 roles
- Detail: 6 sections and 3 API calls, document actions, invalid id handled, workflow action visible only to the task owner
- Manajemen akun: table, search, delete confirmation cancel, create link
- RBAC (security): `/admin/akun` UI and `GET /api/user` (403) for 5 non-admin roles; "tidak berwenang" on create for 4 roles; anonymous API → 401

## NETWORK & CONSOLE (every test, via the auto `monitor` fixture)
- Both the app origin and the API origin are first-party. `requestfailed` and HTTP ≥ 400 are classified as
  `BUG_CANDIDATE` · `EXPECTED` (declared per test, e.g. 400 on bad login, 404 on bad id) · `BLOCKED_BY_GUARD` · `THIRD_PARTY` · `NOISE` (aborted prefetch).
- Console output is counted by type (log/info/warning/error) and attached as `page-monitor.json`. Only uncaught
  `pageerror` and `BUG_CANDIDATE` requests fail a test (`monitor.assertHealthy()`). Warnings never fail a test.

## Next steps (when possible)
- Disposable environment + `E2E_SAFE_ENV=true` → full CRUD / workflow E2E (create permohonan → survey → … → penutupan)
- A valid admin credential
- Firefox/WebKit and mobile viewport projects
