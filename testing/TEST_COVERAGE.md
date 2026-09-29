# COLABORA (Aksara) — Test Coverage Inventory

Last run: 2026-09-23 · **91 tests: 89 passed · 1 failed (SEC-001) · 1 skipped (DATA-001) · 0 flaky** · 1.9 min, 2 workers
Discovered: **10 routes**, **55 interactive elements**, 18 accounts (17 usable)
Result legend: PASS · FAIL (bug) · SKIPPED-DESTRUCTIVE (deliberately not executed) · BLOCKED · NOT TESTED

| PAGE | ELEMENT | TYPE | ACTION | TESTED? | RESULT | TEST FILE |
|---|---|---|---|---|---|---|
| `http://…/` | HTTP entrypoint | Redirect | 308 → https | TESTED | PASS | smoke/availability |
| `/` | Root | Redirect | → /login when anonymous | TESTED | PASS | smoke/availability |
| any | Unknown route | Page | 404 page + status | TESTED | PASS | smoke/availability |
| `/login` | Email | Input | required / format / placeholder | TESTED | PASS | auth/login |
| `/login` | Kata sandi | Input | required / masked / autocomplete | TESTED | PASS | auth/login |
| `/login` | Tampilkan kata sandi | Toggle | show ↔ hide, aria-pressed | TESTED | PASS | auth/login |
| `/login` | Masuk | Button | empty, bad format, unknown email, wrong password (1×) | TESTED | PASS (see SEC-002) | auth/login |
| `/login` | Masuk | Button | valid login × 17 roles | TESTED | PASS | smoke/role-dashboards |
| `/login` | Masuk (admin1234) | Button | valid login | NOT RUN | BLOCKED (DATA-001) | smoke/role-dashboards |
| shell | Keluar | Button | logout, clears session, re-protects route | TESTED | PASS | auth/session |
| shell | Keluar | Button | server revokes token | TESTED | **FAIL (SEC-001)** | auth/session |
| shell | Session | sessionStorage | reload keeps / new tab loses | TESTED | PASS | auth/session |
| shell | Protected route | Guard | /dashboard anonymous → /login | TESTED | PASS | auth/session |
| shell | Beranda / Permohonan / Manajemen akun | Link | navigate + heading | TESTED | PASS | navigation/sidebar |
| shell | Manajemen akun | Link | visible only to super user (17 roles) | TESTED | PASS | smoke/role-dashboards |
| shell | Ciutkan / Perluas sidebar | Button | collapse ↔ expand | TESTED | PASS | navigation/sidebar |
| shell | Lewati ke konten utama | Link | target #main-content | TESTED | PASS | navigation/sidebar |
| shell | Peran label | Group | shows role text | TESTED | PASS (see OBS-001) | smoke/role-dashboards |
| shell | COLABORA logo | Link | → /dashboard | TESTED | PASS | navigation/internal-links |
| `/dashboard` | Lihat semua / Lihat tugas saya | Link | → view=all / view=mine; back | TESTED | PASS | navigation/sidebar |
| `/dashboard` | Permohonan terbaru | Table | loads, API 200 | TESTED | PASS | smoke/role-dashboards |
| `?view=all` | Stage summary (7) | Display | labels present | TESTED | PASS | features/permohonan-list |
| `?view=all` | Table | Table | columns, count label = rows, number format | TESTED | PASS | features/permohonan-list |
| `?view=all` | Cari permohonan | Search | by number (URL sync), by name (case-insens.), no match | TESTED | PASS | features/permohonan-list |
| `?view=all` | Status | Dropdown | options; filter Selesai/Ditolak/Menunggu; reset | TESTED | PASS | features/permohonan-list |
| `?view=mine` | Tugas saya (N) | Tab | N = rows (3 roles) | TESTED | PASS | features/permohonan-list |
| list | Lihat / Lanjutkan | Link | opens matching detail | TESTED | PASS | features/permohonan-list, navigation/sidebar |
| list | Pagination | — | none in UI (API per_page=100) | N/A | — | — |
| `/permohonan/:id` | 6 sections | Display | headings + 3 API calls 200 | TESTED | PASS | features/permohonan-detail |
| `/permohonan/:id` | Kembali ke daftar permohonan | Link | back to list; browser Back | TESTED | PASS | navigation/sidebar |
| `/permohonan/:id` | Buka / Unduh file | Button | labelled per file | PARTIAL | PASS (not downloaded) | features/permohonan-detail |
| `/permohonan/:id` | Lanjutkan proses | Link | visible for task owner, hidden for super user | TESTED | PASS | features/permohonan-detail |
| `/permohonan/:id` | Lanjutkan proses | Link | execute | NO | SKIPPED-DESTRUCTIVE | — |
| `/permohonan/<bad id>` | Not-found state | Page | 2 variants, no crash | TESTED | PASS | features/permohonan-detail |
| `/permohonan/:id` | All same-origin links | Link | open without error | TESTED | PASS | navigation/internal-links |
| `/permohonan/:id/survei` | Tanggal, evidence, Simpan | Form | empty submit → validation, no request | TESTED | PASS | forms/survei |
| `/permohonan/:id/survei` | Buka kalender, Catatan, Batal | Button/Input | interact | NO | NOT TESTED | — |
| `/permohonan/:id/survei` | Simpan dan selesaikan (valid) | Button | submit | NO | SKIPPED-DESTRUCTIVE | — |
| `/permohonan/baru` | 5 fields + 2 selects | Form | defaults, options | TESTED | PASS | forms/permohonan-baru |
| `/permohonan/baru` | Simpan permohonan | Button | empty, letters in phone, error clears | TESTED | PASS | forms/permohonan-baru |
| `/permohonan/baru` | Simpan permohonan (valid) | Button | submit | NO | SKIPPED-DESTRUCTIVE | — |
| `/permohonan/baru` | Batal / dirty-form leave | Link/Dialog | back to list; beforeunload | TESTED | PASS | forms/permohonan-baru |
| `/permohonan/baru` | ULP select (nps-up only) | Dropdown | options | NO | NOT TESTED | — |
| `/permohonan/baru` | Access for other roles | Guard | "tidak berwenang" (4 roles) | TESTED | PASS | features/rbac |
| `/admin/akun` | Table | Table | columns, email format | TESTED | PASS | features/admin-akun |
| `/admin/akun` | Cari akun | Search | filter by "vendor." | TESTED | PASS | features/admin-akun |
| `/admin/akun` | Hapus | Button | opens confirmation; Batal keeps row, no DELETE | TESTED | PASS | features/admin-akun |
| `/admin/akun` | Hapus akun (confirm) | Button | delete | NO | SKIPPED-DESTRUCTIVE | — |
| `/admin/akun` | Buat akun | Link | → /admin/akun/baru | TESTED | PASS | features/admin-akun |
| `/admin/akun` | Access for 5 non-admin roles | Guard | "Akses terbatas" + API 403 | TESTED | PASS | features/rbac |
| `/admin/akun/baru` | Peran | Dropdown | 14 options, default, select | TESTED | PASS | forms/buat-akun |
| `/admin/akun/baru` | Buat akun | Button | empty; bad email/short pw/mismatch | TESTED | PASS | forms/buat-akun |
| `/admin/akun/baru` | Buat akun (valid) | Button | submit | NO | SKIPPED-DESTRUCTIVE | — |
| `/admin/akun/baru` | Batal | Link | → /admin/akun | TESTED | PASS | forms/buat-akun |
| API | Anonymous request | HTTP | 401/403 | TESTED | PASS | features/rbac |

## Not tested and why
- **Create/delete account**: SKIPPED-DESTRUCTIVE. The network guard in `tests/fixtures/test.ts` aborts every POST/PUT/PATCH/DELETE except login unless `E2E_SAFE_ENV=true`.
- **Full PB/PD workflow**: covered by `tests/workflow/full-flow.spec.ts` (@e2e-write), which only runs with `E2E_SAFE_ENV=true` on the development server. Six scenarios: JTR Taman with and without tiang/PDKB, JTR Perubahan daya Karang Pilang, NPS PLG TM <5 GWNG for Menganti, NPS PLG TM >5 GWNG for Karang Pilang, and NPS "Dikembalikan" (ends as `returned`, nobody can act afterwards). Each asserts final status, decisions, skipped nodes, one evidence per activity and, where set, that the ULP's own teknik/pelayanan acted. Not yet covered: JTR from pelayanan-menganti, and what (if anything) should happen to a returned permohonan.
- **Admin role**: DATA-001.
- **File upload**: evidence upload (PDF) is exercised by the full-flow test. Download: presence only.
- **Browsers other than Chromium, and mobile viewports**: out of scope for this run.
