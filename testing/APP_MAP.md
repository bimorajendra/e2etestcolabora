# COLABORA (Aksara) — Application Map

- **App:** https://colabora.aksara.blog/ (Next.js front end). `http://` → **308** → `https://`. `/` → `/login` when logged out.
- **API:** https://api-colabora.anargya.fun/api/* (separate origin, Bearer token)
- **Session:** `sessionStorage["colabora_tokens"]` = `{access_token, refresh_token, role}`. No cookies, so the session is **scoped to one tab**.
- **Explored:** 2026-09-23, black-box, Chromium. 17 of 18 accounts logged in (`admin1234@gmail.com` → "email not found").
- **Method:** `scripts/explore.mjs` (read-only crawler, one run per role) plus targeted probes. Every probe ran behind a guard that aborts all POST/PUT/PATCH/DELETE requests except login.

Status legend: `DISCOVERED` · `TESTED` · `PARTIAL` · `BLOCKED`

## Roles and what they can reach

| Role(s) | Beranda / Permohonan | Buat permohonan | Workflow action | Manajemen akun |
|---|---|---|---|---|
| super-user | ✔ (monitoring, "Dalam pemantauan") | ✘ | ✘ (read-only) | ✔ |
| user | ✔ ("Tugas saya") | ✘ "tidak berwenang" | ✘ | ✘ "Akses terbatas" |
| pelayanan-taman / -menganti / -pilang | ✔ | ✔ (JTR) | — | ✘ |
| nps-up | ✔ | ✔ (JTM/Gardu, ULP select) | — | ✘ |
| teknik-taman / -menganti / -pilang | ✔ | ✘ "tidak berwenang" | Survei (teknik-pilang had 3 tasks) | ✘ |
| perencanaan-up, konstruksi-up, transaksi-up, vendor-konstruksi | ✔ | ✘ | "Lanjutkan proses" | ✘ |
| jaringan-up, pdkb-up, vendor-tiang, vendor-srapp | ✔ | ✘ | none open at test time | ✘ |
| admin (`admin1234@gmail.com`) | BLOCKED: account does not exist in this environment | | | |

---

## Route: `/login` — TESTED
Page: "Masuk | COLABORA" · H1 "Masuk ke COLABORA"
Purpose: Email/password sign-in.

Interactive Elements:
- Email (`type=email`, placeholder `nama@perusahaan.co.id`)
- Kata sandi (`type=password`, `autocomplete=current-password`)
- "Tampilkan / Sembunyikan kata sandi" toggle (`aria-pressed`)
- "Masuk" submit (shows "Memverifikasi..." while pending)

Forms:
- Client validation: "Email wajib diisi.", "Kata sandi wajib diisi.", "Format email tidak valid."
- Server errors (inline `role=alert` + toast): unknown email → "email not found"; wrong password → "invalid credentials".

Observed API Calls:
- `POST /api/auth/login` → 200 on success, **400** on failure
- `GET /api/user/me`

Potential Test Cases: all implemented in `tests/auth/login.spec.ts`.

## Route: `/dashboard` (Beranda) — TESTED
Page: H1 "Beranda", H2 "Permohonan terbaru" (table)

Navigation (shared app shell on every authenticated page):
- Sidebar: COLABORA logo, Beranda, Permohonan, Manajemen akun (admin/super user only), Keluar
- "Ciutkan sidebar" ↔ "Perluas sidebar" toggle
- "Lewati ke konten utama" skip link → `#main-content`
- Header: "Peran <role label>", a read-only group (the chevron suggests a menu, but it isn't clickable)

Important Actions:
- "Lihat semua" → `?view=all`; "Lihat tugas saya" / "Lihat permohonan dalam pemantauan" → `?view=mine`
- Row "Lihat" / "Lanjutkan" → detail

Observed API Calls: `GET /api/user/me`, `GET /api/permohonan?page=1&per_page=100`

## Route: `/dashboard?view=all | mine` (Permohonan) — TESTED
Page: H1 "Permohonan", H2 "Posisi proses aktif", H2 "Daftar permohonan"

Interactive Elements:
- Stage summary: 7 stages (Permohonan, Survei, Perencanaan, Pra konstruksi, Konstruksi, Energize, Penutupan) with counts
- Tabs (links): "Semua permohonan", "Tugas saya (N)" or "Dalam pemantauan (N)"
- Search "Cari permohonan" (number / customer / unit), synced to `?q=`
- Status combobox: Semua status / Menunggu tindakan / Ditolak / Selesai, synced to `?status=`
- Table: Nomor permohonan, Pelanggan, Unit, Tahap saat ini, Status, SLA, Aksi ("Lihat" or "Lanjutkan" for your own task)
- No pagination in the UI (the API is called with `per_page=100`)

Observed API Calls: `GET /api/permohonan?page=1&per_page=100`

## Route: `/permohonan/:id` (detail) — TESTED
Page: H1 = customer name. H2 sections: WO Vendor Tiang, Tahapan proses, Dokumen & Evidence, Informasi permohonan, Keputusan workflow, Riwayat aktivitas.

Interactive Elements:
- "Kembali ke daftar permohonan" (returns to `returnTo`)
- Per document: "Buka <file> di tab baru", "Unduh <file>" (presence tested; not downloaded)
- "Lanjutkan proses" (only for the role holding the task) → stage form, e.g. `/permohonan/:id/survei`

Observed API Calls: `GET /api/permohonan/:id`, `/documents`, `/logs`
Unknown or invalid id → "Detail permohonan belum tersedia / Data yang diminta tidak ditemukan." (API 404, handled).

## Route: `/permohonan/:id/survei` — PARTIAL (validation only)
Page: H1 "Survei Perluasan Jaringan" (teknik)
Forms: Tanggal survei (date + "Buka kalender"), Catatan (optional), evidence drop zone / "Pilih berkas" (PDF/JPG/JPEG/PNG, max 10 MB), "Batal", "Simpan dan selesaikan aktivitas".
Validation: "… wajib diisi.", "… minimal satu evidence."
Important Actions: "Simpan dan selesaikan aktivitas" advances the real workflow, so it was **not executed** (SKIPPED-DESTRUCTIVE).

## Route: `/permohonan/baru` — PARTIAL (validation only)
Page: H1 "Permohonan PB/PD baru" (pelayanan-*, nps-up)
Forms: Nama pelanggan, No. HP / telepon (`tel`), Jenis permohonan (Pasang baru / Perubahan daya), Jenis sambungan (JTR / JTM / Gardu; nps-up also has a ULP select), Lokasi, "Batal", "Simpan permohonan".
Validation: "Nama pelanggan minimal 2 karakter.", "Nomor telepon minimal 8 karakter.", "Nomor telepon hanya boleh berisi angka dan tanda telepon umum.", "Lokasi minimal 2 karakter."
Unsaved changes: leaving a dirty form triggers `beforeunload`.
Other roles see "Peran ini tidak berwenang membuat permohonan".
Important Actions: a valid "Simpan permohonan" creates real data, so it was **not executed**.

## Route: `/admin/akun` (Manajemen akun) — TESTED
Page: H1 "Manajemen akun" (admin / super user). Other roles see "Akses terbatas — Halaman ini hanya dapat diakses oleh Admin dan Super User."
Interactive Elements: search "Cari akun" (name/email/role), "Buat akun" link, table (Nama, Email, Peran, Verifikasi, Aksi), a "Hapus" button per row → alertdialog "Hapus akun ini?" with Batal / "Hapus akun".
Observed API Calls: `GET /api/user?page=1&per_page=100&sort=name&order=asc` (non-admin token → **403** "denied access")
Important Actions: "Hapus akun" is **never confirmed** (SKIPPED-DESTRUCTIVE); only the dialog and Batal are tested.

## Route: `/admin/akun/baru` — PARTIAL (validation only)
Page: H1 "Buat akun pengguna"
Forms: Nama lengkap, Email, No. HP / telepon (opsional), Peran (14 roles, default "User · Pengguna"), Kata sandi sementara, Konfirmasi kata sandi, Batal, Buat akun.
Validation: "Nama minimal 2 karakter.", "Masukkan alamat email yang valid.", "Kata sandi minimal 8 karakter.", "Konfirmasi kata sandi belum sama."
Important Actions: a valid "Buat akun" creates a real user, so it was **not executed**.

## Route: any unknown path — TESTED
HTTP 404, "Halaman tidak ditemukan" page with a "Kembali" action.
