import path from 'node:path';
import { test, expect } from '../fixtures/test';

const PDF = path.resolve(__dirname, '../fixtures/files/e2e-evidence.pdf');

test.describe('@auth registrasi akun', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/registrasi');
    await expect(page.getByText('Registrasi akun').first()).toBeVisible();
  });

  test('login page links to registrasi and back', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Registrasi' }).click();
    await expect(page).toHaveURL(/\/registrasi$/);
    await page.getByRole('link', { name: 'Kembali ke masuk' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('form shows its fields and the file restriction', async ({ page, monitor }) => {
    await expect(page.getByLabel('Nama lengkap')).toBeEmpty();
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email');
    await expect(page.getByLabel('No. HP / telepon (opsional)')).toHaveAttribute('type', 'tel');
    await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Konfirmasi kata sandi')).toHaveAttribute('type', 'password');
    await expect(page.locator('input[type=file]')).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png');
    await expect(page.getByText('Pilih satu file PDF, JPG, JPEG, atau PNG.')).toBeVisible();
    // Role and unit are assigned by an admin, so the form must not offer them.
    await expect(page.getByLabel('Peran')).toHaveCount(0);
    monitor.assertHealthy();
  });

  test('empty submit shows every required-field message and sends no request', async ({ page, guard }) => {
    let calls = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && /registr|register|user/i.test(r.url())) calls++; });
    await page.getByRole('button', { name: 'Kirim registrasi' }).click();
    for (const msg of ['Nama minimal 2 karakter.', 'Email wajib diisi.', 'Kata sandi minimal 8 karakter.',
      'Konfirmasi kata sandi wajib diisi.', 'Dokumen verifikasi wajib dilampirkan.']) {
      await expect(page.getByText(msg)).toBeVisible();
    }
    // Phone is optional: it must not be reported when left empty.
    await expect(page.getByText(/Nomor telepon/)).toHaveCount(0);
    expect(calls).toBe(0);
    expect(guard.list()).toEqual([]);
  });

  test('malformed email and short phone are rejected client-side', async ({ page, guard }) => {
    await page.getByLabel('Nama lengkap').fill('E2E Registrasi');
    await page.getByLabel('Email').fill('bukan-email');
    await page.getByLabel('No. HP / telepon (opsional)').fill('abc');
    await page.getByRole('button', { name: 'Kirim registrasi' }).click();
    await expect(page.getByText('Format email tidak valid.')).toBeVisible();
    await expect(page.getByText('Nomor telepon minimal 8 karakter.')).toBeVisible();
    expect(guard.list()).toEqual([]);
  });

  test('password confirmation mismatch is reported once other fields are valid', async ({ page, guard }) => {
    await page.getByLabel('Nama lengkap').fill('E2E Registrasi');
    await page.getByLabel('Email').fill('e2e-registrasi@example.com');
    await page.getByLabel('Kata sandi', { exact: true }).fill('E2ePassword123');
    await page.getByLabel('Konfirmasi kata sandi').fill('Berbeda12345');
    await page.locator('input[type=file]').setInputFiles(PDF);
    await page.getByRole('button', { name: 'Kirim registrasi' }).click();
    await expect(page.getByText('Konfirmasi kata sandi tidak cocok.')).toBeVisible();
    expect(guard.list()).toEqual([]);
  });

  test('a selected document is shown and the required message clears', async ({ page }) => {
    await page.getByRole('button', { name: 'Kirim registrasi' }).click();
    await expect(page.getByText('Dokumen verifikasi wajib dilampirkan.')).toBeVisible();
    await page.locator('input[type=file]').setInputFiles(PDF);
    await expect(page.getByText('e2e-evidence.pdf')).toBeVisible();
    await expect(page.getByText('Dokumen verifikasi wajib dilampirkan.')).toHaveCount(0);
  });

  test('a file type outside PDF/JPG/PNG is rejected client-side', async ({ page, guard }) => {
    await page.getByLabel('Nama lengkap').fill('E2E Tipe File');
    await page.getByLabel('Email').fill('e2e-tipefile@example.com');
    await page.getByLabel('Kata sandi', { exact: true }).fill('E2ePassword123');
    await page.getByLabel('Konfirmasi kata sandi').fill('E2ePassword123');
    await page.locator('input[type=file]').setInputFiles({ name: 'catatan.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await page.getByRole('button', { name: 'Kirim registrasi' }).click();
    await expect(page.getByText('Dokumen harus berupa PDF, JPG, JPEG, atau PNG.')).toBeVisible();
    expect(guard.list()).toEqual([]);
  });
});

test.describe('@auth lupa & reset kata sandi', () => {
  // SMTP is not connected yet, so a valid request is never submitted here.
  test('login page links to lupa kata sandi', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Lupa kata sandi?' }).click();
    await expect(page).toHaveURL(/\/lupa-kata-sandi$/);
    await expect(page.getByRole('heading', { name: 'Lupa kata sandi?' })).toBeVisible();
    await page.getByRole('link', { name: 'Kembali ke masuk' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('lupa kata sandi validates the email client-side', async ({ page, guard }) => {
    await page.goto('/lupa-kata-sandi');
    await page.getByRole('button', { name: 'Kirim tautan reset' }).click();
    await expect(page.getByText('Email wajib diisi.')).toBeVisible();
    await page.getByLabel('Email').fill('bukan-email');
    await page.getByRole('button', { name: 'Kirim tautan reset' }).click();
    await expect(page.getByText('Format email tidak valid.')).toBeVisible();
    expect(guard.list()).toEqual([]);
  });

  test('reset password without a token explains the problem', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText('Tautan reset tidak memuat token yang diperlukan.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Minta tautan baru' })).toHaveAttribute('href', /lupa-kata-sandi/);
    await expect(page.getByLabel('Kata sandi baru')).toHaveCount(0);
  });

  test('reset password with a token validates length and confirmation', async ({ page, guard }) => {
    await page.goto('/reset-password?token=e2e-dummy');
    await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click();
    await expect(page.getByText('Kata sandi minimal 8 karakter.')).toBeVisible();
    await expect(page.getByText('Konfirmasi kata sandi wajib diisi.')).toBeVisible();
    await page.getByLabel('Kata sandi baru').fill('E2ePassword123');
    await page.getByLabel('Konfirmasi kata sandi').fill('Berbeda12345');
    await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click();
    await expect(page.getByText('Konfirmasi kata sandi tidak cocok.')).toBeVisible();
    expect(guard.list()).toEqual([]);
  });
});
