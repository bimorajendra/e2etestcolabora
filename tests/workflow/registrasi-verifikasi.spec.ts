import path from 'node:path';
import { test, expect, isSafeEnv, dismissWelcome } from '../fixtures/test';
import { LoginPage } from '../fixtures/pages';

const PDF = path.resolve(__dirname, '../fixtures/files/e2e-evidence.pdf');
const PASSWORD = 'E2ePassword123';

// Writes real data (a pending account, then a verified one, then removes it).
// Registration has no email verification; a Super User/Admin approves it by
// choosing a role and unit ("Verifikasi" on Manajemen akun).
test.describe('@workflow @e2e-write registrasi -> verifikasi Super User', () => {
  test.skip(!isSafeEnv(), 'writes real data: set E2E_SAFE_ENV=true (development server only)');
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const email = `e2e-reg-${stamp}@example.com`;
  const name = `E2E Registrasi ${stamp}`;

  test('user registers and lands on "Menunggu verifikasi"', async ({ page }) => {
    await page.goto('/registrasi');
    await page.getByLabel('Nama lengkap').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('No. HP / telepon (opsional)').fill('081234567890');
    await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Konfirmasi kata sandi').fill(PASSWORD);
    await page.locator('input[type=file]').setInputFiles(PDF);
    const res = page.waitForResponse((r) => r.url().endsWith('/api/auth/register') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Kirim registrasi' }).click();
    expect((await res).status()).toBe(200);
    await expect(page).toHaveURL(/\/menunggu-verifikasi$/);
    await expect(page.getByText('Menunggu verifikasi', { exact: true })).toBeVisible();
    await expect(page.getByText('Dokumen registrasi sedang ditinjau oleh Admin atau Super User.')).toBeVisible();
  });

  test('registering the same email again is rejected', async ({ page, monitor }) => {
    monitor.expect(/\/api\/auth\/register/);
    await page.goto('/registrasi');
    await page.getByLabel('Nama lengkap').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Konfirmasi kata sandi').fill(PASSWORD);
    await page.locator('input[type=file]').setInputFiles(PDF);
    const res = page.waitForResponse((r) => r.url().endsWith('/api/auth/register'));
    await page.getByRole('button', { name: 'Kirim registrasi' }).click();
    expect((await res).status()).toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/registrasi$/);
  });

  test('an unverified account cannot enter: login redirects to "Menunggu verifikasi"', async ({ page, monitor }) => {
    monitor.expect(/\/api\/auth\/login/);
    await new LoginPage(page).login(email, PASSWORD);
    await expect(page).toHaveURL(/\/menunggu-verifikasi$/);
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('super user sees it as "Belum diverifikasi" and verifies it with role and unit', async ({ page, loginAs }) => {
    await loginAs('super-user');
    await page.goto('/admin/akun');
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row).toContainText('Belum diverifikasi');

    await row.getByRole('button', { name: 'Verifikasi' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Verifikasi akun' });
    await expect(dialog).toBeVisible();
    const submit = dialog.getByRole('button', { name: 'Verifikasi akun' });
    // Submit and Unit stay locked until a role is chosen.
    await expect(submit).toBeDisabled();
    await expect(dialog.locator('#verification-unit')).toBeDisabled();

    await dialog.locator('#verification-role').click();
    await page.getByRole('option', { name: 'Bagian Teknik', exact: true }).click();
    await expect(dialog.locator('#verification-unit')).toBeEnabled();
    await dialog.locator('#verification-unit').click();
    await expect(page.getByRole('option')).toHaveText(['ULP Karang Pilang', 'ULP Taman', 'ULP Menganti']);
    await page.getByRole('option', { name: 'ULP Taman', exact: true }).click();
    await expect(submit).toBeEnabled();

    const verified = page.waitForResponse((r) => /\/api\/auth\/verify\//.test(r.url()) && r.request().method() === 'POST');
    await submit.click();
    expect((await verified).status()).toBe(200);
    await expect(row).toContainText('Terverifikasi');
    await expect(row).toContainText('Bagian Teknik');
    await expect(row.getByRole('button', { name: 'Verifikasi' })).toHaveCount(0);
  });

  test('the verified user can log in with the assigned role and unit', async ({ page }) => {
    await new LoginPage(page).login(email, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await dismissWelcome(page);
    await expect(page.getByRole('group').filter({ hasText: /^Peran/ })).toContainText('Bagian Teknik');
    await expect(page.getByText('ULP Taman').first()).toBeVisible();
  });

  // Cleanup: remove every account this suite created (including leftovers of earlier runs).
  test('cleanup: super user deletes the E2E registration accounts', async ({ page, loginAs }) => {
    await loginAs('super-user');
    await page.goto('/admin/akun');
    const stale = page.getByRole('row').filter({ hasText: /e2e-reg-\d+@example\.com/ });
    await expect(stale.first()).toBeVisible();
    while (await stale.count()) {
      const total = await stale.count();
      await stale.first().getByRole('button', { name: 'Hapus' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Hapus akun' }).click();
      await expect(stale).toHaveCount(total - 1);
    }
  });
});
