import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly togglePassword: Locator;
  /** Server-side login error shown inside the form (not the field validation). */
  readonly formAlert: Locator;

  constructor(readonly page: Page) {
    this.formAlert = page.getByRole('region', { name: 'Masuk ke COLABORA' }).getByRole('alert')
      .filter({ hasNotText: /wajib diisi|Format email/ });
    this.email = page.getByLabel('Email', { exact: true });
    this.password = page.getByLabel('Kata sandi', { exact: true });
    this.submit = page.getByRole('button', { name: 'Masuk' });
    this.togglePassword = page.getByRole('button', { name: /(Tampilkan|Sembunyikan) kata sandi/ });
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.page.getByRole('heading', { level: 1, name: 'Masuk ke COLABORA' })).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.goto();
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

/** Sidebar + header shared by every authenticated page. */
export class AppShell {
  constructor(readonly page: Page) {}

  navLink(name: 'Beranda' | 'Permohonan' | 'Manajemen akun') {
    return this.page.getByRole('link', { name, exact: true }).filter({ visible: true }).first();
  }

  get logout() {
    return this.page.getByRole('button', { name: 'Keluar' });
  }

  heading(name: string | RegExp) {
    return this.page.getByRole('heading', { level: 1, name });
  }
}

export class PermohonanList {
  readonly search: Locator;
  readonly statusFilter: Locator;
  readonly rows: Locator;
  readonly summary: Locator;

  constructor(readonly page: Page) {
    this.search = page.getByRole('textbox', { name: 'Cari permohonan' });
    this.statusFilter = page.getByRole('combobox').first();
    this.rows = page.locator('main table tbody tr');
    this.summary = page.getByText(/\d+ permohonan ditampilkan/);
  }

  async goto(view: 'all' | 'mine' = 'all') {
    // Rows render after /api/permohonan resolves; wait for it so counts are real.
    // Listen only after the new document commits, so a response belonging to
    // the previous page (e.g. the dashboard right after login) cannot match.
    await this.page.goto(`/dashboard?view=${view}`, { waitUntil: 'commit' });
    await this.page.waitForResponse((r) => /\/api\/permohonan\?/.test(r.url()) && r.request().method() === 'GET');
    await expect(this.page.getByRole('heading', { level: 1, name: 'Permohonan' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Daftar permohonan' })).toBeVisible();
  }

  /** Number reported by the "N permohonan ditampilkan" label. */
  async shownCount() {
    return Number((await this.summary.innerText()).match(/\d+/)![0]);
  }

  /** Row action: "Lihat" (view) or "Lanjutkan" (the role has a pending task on it). */
  action(row: Locator) {
    return row.getByRole('link', { name: /^(Lihat|Lanjutkan)$/ });
  }

  /** Data rows (excludes an empty-state row). */
  get dataRows() {
    return this.rows.filter({ has: this.page.getByRole('link', { name: /^(Lihat|Lanjutkan)$/ }) });
  }

  cell(row: Locator, index: number) {
    return row.getByRole('cell').nth(index);
  }

  async filterStatus(option: 'Semua status' | 'Menunggu tindakan' | 'Ditolak' | 'Selesai') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }
}
