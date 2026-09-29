# COLABORA (Aksara) — Bug Report

Target: https://colabora.aksara.blog/ · API: https://api-colabora.anargya.fun · Playwright 1.63 / Chromium · 2026-09-29 (re-run after the registration / verification / kanban / PDPB changes)
Final run: **see "Re-run 2026-09-29" below**; previous run 2026-09-23: 89 passed · 1 failed · 1 skipped (91 tests) — report: `artifacts/html-report/index.html`

| ID | Title | Severity | Classification | Status |
|---|---|---|---|---|
| SEC-001 | Access token still accepted by the API after logout | Medium | Application Bug (security) | OPEN, test fails |
| BUG-WF-001 | WO vendor list fails to load (403), so the workflow cannot pass Pra konstruksi | High | Application Bug | **FIXED** (2026-09-29: vendor-list and 6 full-flow scenarios pass) |
| SEC-002 | Login error reveals whether an email is registered | Low | Application Bug (security) | OPEN, test documents behavior |
| ENV-002 | Intermittent slow API responses (login > 10 s, GET > 15 s) | Low | Network / Environment | OBSERVED, mitigated in suite |
| DATA-001 | Provided admin account does not exist | — | Blocked | **CLOSED** (2026-09-29: admin1234 logs in, suite enabled) |
| OBS-001 | "Peran" header shows a dropdown chevron but is not interactive | Low | Unknown Requirement | OPEN |
| OBS-002 | Failed login returns HTTP 400 instead of 401 | Low | Unknown Requirement | OPEN |
| OBS-003 | Session is per tab (links opened in a new tab require re-login) | Info | Expected Behavior (design) | NOTED |
| SEC-001b | Same as SEC-001, re-confirmed 2026-09-29 (old token → 200 after logout) | Medium | Application Bug (security) | OPEN |
| UI-001 | Verifikasi akun dialog text lacks a space: "…08:43:02sebelum akun diaktifkan." | Low | Application Bug (cosmetic) | OPEN |
| OBS-004 | Status filter option order on Permohonan changes between runs ("Selesai" / "PK dikembalikan") | Low | Unknown Requirement | OPEN |
| CHG-001 | Welcome modal (`alertdialog`) on every dashboard hides the page from the a11y tree | Info | Expected (new feature) | Suite adapted |
| ENV-001 | Original URL `aksara.colabora.blog` does not resolve | — | Environment | CLOSED (URL typo) |

Automation bugs found and fixed during the run (not app issues): a locator that matched both the inline alert and the
toast; a wrong forward-history assumption; row action "Lanjutkan" vs "Lihat"; a list-loading race; the drop zone and
button sharing the name "Pilih berkas"; a group label with no accessible name.

---

## SEC-001 — Access token still accepted by the API after logout

Severity: Medium
Classification: Application Bug (security). Could be a deliberate stateless-JWT design, but then the token lifetime is the only protection.

URL: https://colabora.aksara.blog/dashboard → Keluar

Precondition: Logged in as any role (reproduced with `user1234@gmail.com`).

Steps to Reproduce:
1. Log in, then copy `sessionStorage.colabora_tokens.access_token`.
2. Click "Keluar". You are redirected to `/login` and sessionStorage is cleared.
3. `GET https://api-colabora.anargya.fun/api/user/me` with `Authorization: Bearer <old token>`.

Expected: 401. Logout should revoke the session server-side, or at least the refresh token.
Actual: **200** with the user profile. **No logout/revoke request is sent to the API** (0 calls observed); logout only clears client storage.

HTTP / API: `GET /api/user/me` → 200 after logout
Console Error: none
Evidence: `artifacts/test-results/auth-session--auth-session-98629-ted-by-the-API-after-logout-chromium/` (screenshot, trace, video); annotation "logout API calls: 0; /api/user/me with old token -> 200"
Affected Test: `tests/auth/session.spec.ts` › "@security access token is rejected by the API after logout"

Recommended Investigation: add `POST /api/auth/logout` that invalidates the refresh token (and ideally the access token via a denylist or short TTL); call it from "Keluar". Check the `access_token` expiry. Also consider not storing `refresh_token` in sessionStorage, where any XSS can read it.

## BUG-WF-001 — WO vendor list fails to load, blocking the workflow at Pra konstruksi

Severity: High (no permohonan can get past stage 4 through the UI)
Classification: Application Bug (authorization mismatch between front end and API)
Found: 2026-09-25

URL: https://colabora.aksara.blog/permohonan/:id → "Lanjutkan proses" on WO Vendor Tiang / WO Vendor Konstruksi / WO Vendor APP

Precondition: Log in as perencanaan-up, konstruksi-up or transaksi-up, with a permohonan waiting at that WO step.

Steps to Reproduce:
1. Open the permohonan and click "Lanjutkan proses".
2. Open the vendor combobox ("Vendor Tiang", "Vendor Konstruksi" or "Vendor SR/APP").

Expected: the matching vendor account (vendor.tiang, vendor.konstruksi, vendor.srapp) is listed.
Actual: "Daftar vendor gagal dimuat." and no options. Submitting shows "Vendor … wajib diisi.", so the activity cannot be completed.

HTTP / API: `GET /api/user?page=1&per_page=100` → **403** `{"message":"denied access","error":"account management requires admin or super-user"}`
Proof it is only the list: replaying that GET with a super-user token makes the options appear, and `POST /api/permohonan/:id/vendor-assignments` then succeeds (200) with the WO role's own token.
Affected Tests: `tests/workflow/vendor-list.spec.ts` (fails, 3 roles). `tests/workflow/full-flow.spec.ts` uses the super-user replay as a documented workaround.
Recommended Investigation: add a vendor lookup endpoint that the WO roles are allowed to call (e.g. `GET /api/vendors?type=tiang`), or let the user list be filtered to vendor roles for them.

## SEC-002 — Login error reveals whether an email is registered (user enumeration)

Severity: Low
Classification: Application Bug (security)
URL: https://colabora.aksara.blog/login

Steps to Reproduce:
1. Log in with `tidak-terdaftar-e2e@example.com` and any password → "email not found".
2. Log in with a registered email and a wrong password → "invalid credentials".

Expected: one generic message for both cases (e.g. "Email atau kata sandi salah").
Actual: different messages, so anyone can check which emails have accounts.

HTTP / API: `POST /api/auth/login` → 400 in both cases, with different error bodies
Console Error: browser "Failed to load resource: 400" (expected side effect)
Affected Test: `tests/auth/login.spec.ts` › "unknown email is rejected with a message" (asserts the current text; update it when fixed)
Recommended Investigation: unify the error message and response body; consider rate limiting on `/api/auth/login`.

## ENV-002 — Intermittent slow API responses

Severity: Low
Classification: Network / Environment (FLAKY source, not reproduced consistently)

Observed during runs with 4 parallel workers:
1. Login button stayed on "Memverifikasi..." for more than 10 s (`POST /api/auth/login`).
2. Anonymous `GET /api/permohonan?page=1&per_page=1` timed out after 15 s (normally 401 in about 0.3 s).
3. Two tests exceeded the 45 s test timeout while navigating.

Expected: sub-second responses (typical in the other runs).
Mitigation in the suite (does not hide app failures): workers reduced to 2, login wait 30 s, retries = 1. Final run: 0 flaky.
Recommended Investigation: check API server logs and resources around 2026-09-23 16:45–16:55 WIB; check cold starts, DB pool and rate limiting.

## DATA-001 — Provided admin account does not exist

Classification: Blocked
`admin1234@gmail.com / <password omitted>` → "email not found". The Admin role ("Admin · Administrasi") exists in the role list, but no working admin credential was provided. Admin-only tests are skipped with a BLOCKED reason (`smoke/role-dashboards.spec.ts` › "Admin: login").

## OBS-001 — "Peran" header looks like a dropdown but is not interactive

Severity: Low · Classification: Unknown Requirement
The header shows "Peran / Super User / Monitoring ⌄". The chevron suggests a menu, but the element is a plain `group` with no button, so nothing opens.
Evidence: `artifacts/test-results/navigation-sidebar-*/test-failed-1.png` (first run)
Recommendation: remove the chevron, or implement the menu if role switching is planned.

## OBS-002 — Failed login returns 400, not 401

Severity: Low · Classification: Unknown Requirement
`POST /api/auth/login` with bad credentials → 400. 401 is the conventional status for authentication failure; 400 usually means a malformed request. No functional impact.

## OBS-003 — Session is scoped to a single tab

Severity: Info · Classification: Expected Behavior (design)
Tokens live in sessionStorage, so "open in new tab", or pasting a detail URL into a new tab, lands on `/login`. The session does survive a reload.
Tested in `tests/auth/session.spec.ts`. Confirm this UX is intended.

## ENV-001 — Original URL does not resolve (CLOSED)

`http://aksara.colabora.blog/` → NXDOMAIN (the `.blog` registry has no `colabora.blog`). The correct address, confirmed by the user, is `https://colabora.aksara.blog/`.


---

## Re-run 2026-09-29 (new features)

Confirmed by the team: registration has **no email verification**; a Super User/Admin approves unverified accounts
(role + unit); the Kanban board and welcome modal are **Super User only**; password reset cannot be tested end to end
because **SMTP is not connected**.

**Suite adaptations (UI changed, not app bugs):** welcome modal dismissed in `loginAs`; status filter "Ditolak" is now
"PK dikembalikan"; Beranda stage summary replaced by the Kanban board; new create-form fields (Tarif, Permohonan daya /
Daya lama + Daya baru, evidence); WO Konstruksi "Estimasi tanggal selesai"; Pemasangan Tiang latitude/longitude; +1 document
(creation evidence) per permohonan.

**New tests:** `auth/registrasi.spec.ts` (register + lupa/reset password validation, nothing sent),
`features/kanban-beranda.spec.ts` (board + modal), `workflow/registrasi-verifikasi.spec.ts` (@e2e-write: register →
pending login redirect → Super User verifies with role/unit → login → cleanup).

**Not executable:** password reset submit / new password via emailed token (SMTP); kanban drag & drop (not investigated;
board appears read-only).
