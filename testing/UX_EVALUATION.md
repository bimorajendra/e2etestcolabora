# Evaluasi UI/UX — COLABORA (Aksara)

**Aplikasi:** https://colabora.aksara.blog/ · **Tanggal:** 23 Sep 2026 · **Perspektif:** Senior UI/UX Designer & Usability Testing
**Metode:** evaluasi heuristik (Nielsen 10) + pengukuran otomatis (Playwright: kontras, ukuran font, target sentuh,
fokus keyboard, overflow) di **desktop 1440×900** dan **mobile 390×844**, untuk 5 peran berbeda. Screenshot ada di `testing/ux-screenshots/`.

> **Catatan konteks.** Template evaluasi meminta tujuan proyek dan target pengguna. Keduanya disimpulkan dari aplikasinya sendiri:
> - **Tujuan:** mengoordinasikan permohonan **PB/PD** (Pasang Baru / Perubahan Daya) lintas PIC, dari permohonan sampai penyalaan, dalam 7 tahap dan 17 aktivitas, dengan SLA per aktivitas.
> - **Pengguna:** staf internal PLN (ULP: Pelayanan, Teknik · UP3: NPS, Perencanaan, Konstruksi, Transaksi Energi, Jaringan, PDKB), **vendor** (Tiang, Konstruksi, SR/APP), dan **manajemen** (Super User / monitoring). Sebagian bekerja di lapangan (survei + unggah evidence), jadi penggunaan **mobile** relevan.
> - **Metrik keberhasilan:** tugas tiap PIC selesai tepat waktu (SLA), dan setiap orang langsung tahu "apa yang harus saya kerjakan sekarang".

---

## Ringkasan

| Aspek | Nilai | Inti |
|---|---|---|
| Heuristic / user flow | **B** | Alur per peran jelas, RBAC tegas, validasi baik. Makna status ambigu dan pemulihan error kurang. |
| Aksesibilitas | **B+** | Kontras lolos AA, fokus terlihat, skip link, `role=alert`. Banyak teks 12 px; tabel di mobile terpotong. |
| Visual hierarchy | **B** | CTA utama kuat di desktop, halaman detail untuk pemilik tugas sangat baik. Di mobile, konten inti turun ke bawah layar. |

Secara umum ini desain yang **rapi, konsisten, dan dewasa**: design system satu warna (teal PLN-ish), tipografi Inter, komponen seragam.
Masalah utamanya ada di **prioritas informasi** ("tugas saya" kalah menonjol dibanding statistik) dan **adaptasi mobile**,
bukan di estetika.

---

## 1. Heuristic Evaluation — apakah alur intuitif dan meminimalkan kesalahan?

| # | Heuristik (Nielsen) | Nilai | Bukti |
|---|---|---|---|
| 1 | Visibility of system status | ✅ | Tombol login berubah jadi "Memverifikasi...". Label "N permohonan ditampilkan", stepper "Tahap 4 dari 7", banner **Pengingat SLA** ("Jatuh tempo besok"), badge status berikon. |
| 2 | Match with real world | ⚠️ | Istilah domain tepat (PB/PD, JTR, WO, PDKB). **Tetapi** badge **"Menunggu tindakan"** tidak menyebut *tindakan siapa*: di tabel yang sama, satu baris bertombol "Lanjutkan" (tugas saya) dan yang lain "Lihat" (tugas orang lain), padahal badgenya sama. Pesan error login berbahasa **Inggris** ("email not found", "invalid credentials") di UI berbahasa Indonesia. |
| 3 | User control & freedom | ✅/⚠️ | Ada "Batal", "Kembali ke daftar", konfirmasi **Hapus akun**, dan peringatan *unsaved changes* (`beforeunload`). **Tetapi** tombol logout di mobile hanya ikon di sebelah logo: sekali ketuk langsung keluar, tanpa konfirmasi, dan sesi tidak bisa dipulihkan. |
| 4 | Consistency & standards | ⚠️ | Label tidak seragam: "Permohonan baru" vs "Buat baru" (bottom nav). Select dan date picker berlatar **abu-abu** sementara input teks putih, sehingga terlihat seperti *disabled*. Header "Peran ⌄" punya chevron dropdown tetapi **tidak bisa diklik** (affordance palsu). |
| 5 | Error prevention | ✅ | Validasi klien lengkap dan spesifik (min. karakter, format telepon, konfirmasi password, evidence wajib). Aksi yang tidak berwenang disembunyikan per peran. Form tidak terkirim bila tidak valid (terverifikasi: 0 request). |
| 6 | Recognition rather than recall | ⚠️ | Halaman **Survei** menampilkan **UUID mentah** (`a859ae94-4882-43b7-…`) di header, bukan nomor permohonan (`PBPD-2026-0009`) yang dikenal pengguna. Sesi hanya berlaku per tab, jadi link yang dibuka di tab baru meminta login ulang. |
| 7 | Flexibility & efficiency | ✅/⚠️ | Pencarian dan filter status tersinkron ke URL (bisa dibagikan/di-bookmark), sidebar bisa diciutkan. Belum ada sortir kolom (mis. SLA terdekat) dan tidak ada aksi massal. |
| 8 | Aesthetic & minimalist | ⚠️ | Detail permohonan sangat panjang (**±2.200 px**): 17 aktivitas ditampilkan penuh, termasuk yang "Belum dimulai", dan **Dokumen & Evidence** ada di paling bawah. |
| 9 | Help users recover from errors | ⚠️ | Pesan validasi jelas dan berada di dekat field. **Tidak ada "Lupa kata sandi"**. Halaman 404 dan "data tidak ditemukan" ramah dan punya jalan kembali. |
| 10 | Help & documentation | ⚠️ | Deskripsi singkat di tiap halaman sudah membantu. Belum ada penjelasan tahapan/SLA (tooltip/legend) untuk pengguna baru atau vendor. |

**Alur yang diuji:**
- **Login → Beranda → Lanjutkan tugas → Survei:** 4 klik, jelas.
- **Buat permohonan (Pelayanan):** 1 klik dari Beranda, form pendek (5 field).
- **Monitoring (Super User):** banner "Mode monitoring" menjelaskan kenapa tidak ada tombol aksi. Ini solusi yang bagus.
- **Akses terlarang:** halaman "Akses terbatas" menjelaskan siapa yang berhak, bukan sekadar error.

---

## 2. Aksesibilitas — kontras, font, elemen visual

| Kriteria | Hasil | Detail |
|---|---|---|
| Kontras teks (WCAG 1.4.3 AA) | ✅ Lolos | Teks utama `#172F3B` di putih ≈ 14:1. Teks sekunder `#526875` ≈ 5,9:1 di putih, ≈ 5,4:1 di header tabel. Tombol primer putih di teal. *(Dua "fail" dari scanner otomatis terbukti false positive karena background `oklab()` transparan. Sudah diverifikasi manual.)* |
| Makna tidak hanya lewat warna (1.4.1) | ✅ | Badge status = ikon + teks + warna. SLA terlambat = merah + ikon jam + teks "Terlambat 8 hari". |
| Ukuran font | ⚠️ | Dasar 16 px, H1 30 px (24 px di mobile). **Detail permohonan memuat 45 elemen teks 12 px** (PIC, status aktivitas, timestamp, meta dokumen), dan halaman list 19 elemen. Untuk pengguna lapangan/usia 40+ di layar kecil atau di bawah sinar matahari, 12 px abu-abu terlalu kecil. |
| Fokus keyboard (2.4.7) | ✅ | Semua elemen yang dicek punya outline/ring saat Tab. Ada **skip link** "Lewati ke konten utama". |
| Nama aksesibel / ARIA | ✅ | Toggle password memakai `aria-pressed` dan label berubah "Tampilkan/Sembunyikan". Error memakai `role=alert`. Tombol dokumen berlabel per file ("Unduh Berita Acara…pdf"). Tidak ada tombol tanpa nama. |
| Target sentuh (2.5.8, min. 24 px) | ✅/⚠️ | Hampir semua ≥ 24 px, tombol utama 44 px. Link "Kembali ke daftar permohonan" hanya **20 px** tinggi. Di Manajemen akun mobile, 20 dari 27 target < 44 px. |
| Reflow mobile (1.4.10) | ⚠️ | Halaman tidak meluber horizontal ✅. **Tetapi tabel Manajemen akun di mobile memotong kolom Peran, Verifikasi, Aksi (Hapus)** tanpa petunjuk scroll. |

---

## 3. Visual Hierarchy — apakah elemen terpenting terlihat dalam 3 detik?

| Layar | Lolos 3 detik? | Analisis |
|---|---|---|
| **Login** | ✅ | Judul, 2 field, tombol **Masuk** teal penuh. Ilustrasi petugas lapangan memperkuat konteks tanpa mengganggu. |
| **Beranda (desktop)** | ⚠️ | Mata langsung ke CTA **"Permohonan baru"** (kanan atas) dan 4 kartu statistik. Informasi terpenting bagi pengguna, *"1 permohonan menunggu tindakan peran Anda"*, justru tampil sebagai **teks kecil biasa** di antara kartu dan tabel. |
| **Detail (pemilik tugas)** | ✅✅ | Contoh terbaik di aplikasi: banner kuning **Pengingat SLA**, lalu kartu **"Tindakan diperlukan: WO Vendor APP"** dengan tombol **Lanjutkan proses**, semuanya di atas lipatan. |
| **Detail (monitoring)** | ✅ | Banner "Mode monitoring" langsung menjelaskan status baca-saja. |
| **Daftar permohonan (mobile)** | ❌ | Layar pertama habis untuk **7 kartu tahapan** (grid 2 kolom + 1 kartu yatim). Judul "Daftar permohonan" baru muncul di bawah; **pencarian, filter, dan daftar tidak terlihat** tanpa scroll. |
| **Form permohonan / survei** | ✅ | Satu kolom, label di atas field, tombol primer kanan bawah + "Batal" sekunder. Drop zone evidence jelas (format + batas 10 MB). |
| **Manajemen akun (mobile)** | ⚠️ | CTA "Buat akun" menonjol, tetapi aksi per baris (Hapus) dan peran tidak terlihat. |

---

## 4. Tiga Kelemahan Utama & Solusi

### ① "Menunggu tindakan" tidak menjawab *tindakan siapa?*, dan "tugas saya" kalah menonjol

**Masalah.** Tujuan inti aplikasi adalah membuat tiap PIC tahu apa yang harus dikerjakan. Saat ini:
- Badge status sama untuk tugas saya dan tugas orang lain. Pembedanya hanya teks link kecil "Lanjutkan" vs "Lihat" di kolom terakhir.
- Di Beranda, jumlah tugas saya ditampilkan sebagai kalimat kecil. Visual yang dominan justru statistik agregat (Total/Dalam proses/Selesai), yang bersifat informatif, bukan aksi.
- Daftar tidak bisa diurutkan menurut SLA, padahal SLA adalah tekanan utama pekerjaan.

**Solusi konkret.**
1. Pecah status menjadi dua informasi: **status proses** + **PIC saat ini**. Contoh badge baris:
   `🟠 Giliran Anda` (warna aksen) vs `⏳ Menunggu UP3 — Perencanaan` (netral).
2. Jadikan **kartu "Tugas saya (N)"** sebagai kartu pertama dan terbesar di Beranda, dengan daftar 3 tugas teratas yang **diurutkan dari SLA terdekat/terlambat**. Statistik agregat dipindah ke baris kedua.
3. Default sortir tabel = **SLA terdekat**, dengan header kolom yang bisa diklik untuk sortir.

*Dampak yang diharapkan:* waktu dari login sampai membuka tugas turun, dan jumlah item Over SLA berkurang.

### ② Pengalaman mobile belum mendahulukan konten inti

**Masalah.** Pengguna lapangan (Teknik, Vendor) kemungkinan besar memakai HP.
- Di **Daftar permohonan**, 7 kartu tahapan mengisi seluruh layar pertama, sehingga pencarian dan daftar baru terlihat setelah scroll.
- **Tabel Manajemen akun** memotong kolom Peran/Verifikasi/Hapus.
- **Detail** sepanjang ±2.200 px, dan dokumen/evidence ada di paling bawah.
- Teks meta 12 px abu-abu sulit dibaca di luar ruangan.

**Solusi konkret.**
1. Di mobile, ubah "Posisi proses aktif" menjadi **baris chip horizontal yang bisa di-scroll** (`Survei 3 · Pra konstruksi 5 · …`), maksimal 1 baris, dan jadikan chip sebagai **filter tahap**. Letakkan pencarian di atasnya, sticky.
2. Ubah tabel akun di mobile menjadi **kartu per akun** (nama, email, peran, badge verifikasi) dengan menu "⋯" untuk Hapus.
3. Di detail, **ciutkan tahap yang sudah selesai dan yang belum dimulai** (accordion). Hanya tahap berjalan yang terbuka. Tambahkan **tab/anchor**: Proses · Dokumen · Info · Riwayat.
4. Naikkan teks meta minimum ke **13–14 px**, dan untuk informasi penting (status aktivitas, PIC) gunakan warna teks utama, bukan abu-abu.

### ③ Konsistensi affordance & pemulihan error yang belum tuntas

**Masalah.** Beberapa detail kecil menambah beban kognitif dan risiko salah langkah:
- Chevron di "Peran ⌄" terlihat seperti dropdown padahal statis.
- Select dan date picker berlatar abu-abu sehingga terlihat *disabled*.
- **UUID mentah** di halaman survei.
- **Pesan error login dalam bahasa Inggris**, dan pesannya juga membocorkan apakah email terdaftar (lihat SEC-002 di `BUG_REPORT.md`).
- **Tidak ada "Lupa kata sandi"**.
- Logout mobile berupa ikon satu ketuk tanpa konfirmasi, di posisi yang mudah tersentuh (sebelah logo).
- "Permohonan baru" vs "Buat baru".

**Solusi konkret.**
1. **Hapus chevron** di "Peran", atau jadikan menu nyata (profil, ganti kata sandi, keluar). Pindahkan **Keluar ke menu tersebut**, jangan ikon terpisah di header mobile.
2. Samakan gaya semua kontrol form: **latar putih + border** untuk input, select, dan date picker. Abu-abu hanya untuk *disabled*.
3. Ganti UUID dengan **"PBPD-2026-0009 · PT SOZIS MAKNYUS"**.
4. Satukan pesan login dalam bahasa Indonesia: *"Email atau kata sandi salah."* Tambahkan tautan **"Lupa kata sandi? Hubungi admin"**, atau alur reset.
5. Seragamkan label menjadi **"Permohonan baru"** di semua tempat.

---

## 5. Yang sudah bagus (pertahankan)

- **Halaman detail untuk pemilik tugas**: banner SLA + kartu "Tindakan diperlukan" + CTA tunggal. Ini pola yang layak ditiru di Beranda.
- **Mode monitoring** dan **"Akses terbatas"**: menjelaskan *kenapa*, bukan sekadar menolak.
- **Validasi form** spesifik dan berbahasa manusia, ditambah peringatan perubahan belum disimpan.
- **Konfirmasi hapus** dengan nama akun di dalam dialog.
- Aksesibilitas dasar yang solid: kontras AA, skip link, fokus terlihat, ARIA pada toggle dan alert, status tidak hanya dari warna.
- Tidak ada overflow horizontal di mobile, dan ada **bottom navigation** yang pas untuk jempol.

## 6. Keterbatasan evaluasi

- Tidak ada pengguna nyata. Semua temuan adalah evaluasi ahli + pengukuran otomatis, jadi sebaiknya divalidasi dengan **5 pengguna per peran utama** (Pelayanan, Teknik, Vendor), dengan tugas: *"temukan dan selesaikan tugas SLA paling mendesak"*.
- Alur yang mengubah data (submit form, keputusan workflow) tidak dijalankan karena environment dipakai bersama. Umpan balik setelah submit (toast/sukses) belum dievaluasi.
- Kontras diukur di mode terang saja. Mode gelap tidak ditemukan.

*Data mentah:* `artifacts/ux/ux-audit.json` · reproduksi: `npm run ux-audit`
