import { test, expect } from '../fixtures/test';
import { AppShell } from '../fixtures/pages';

test.describe('@feature manajemen akun (super user)', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('super-user');
    await page.goto('/admin/akun');
    await expect(new AppShell(page).heading('Manajemen akun')).toBeVisible();
    await expect(page.locator('main table tbody tr').first()).toBeVisible();
  });

  test('lists accounts with name, email, role and verification', async ({ page, monitor }) => {
    await expect(page.getByRole('columnheader')).toHaveText(['Nama', 'Email', 'Peran', 'Verifikasi', 'Aksi']);
    const rows = page.locator('main table tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      await expect(row.getByRole('cell').nth(1)).toHaveText(/^[^@\s]+@[^@\s]+\.[a-z]+$/i);
    }
    monitor.assertHealthy();
  });

  test('search narrows accounts by email', async ({ page }) => {
    const rows = page.locator('main table tbody tr');
    const total = await rows.count();
    await page.getByRole('textbox', { name: 'Cari akun' }).fill('vendor.');
    await expect(rows).not.toHaveCount(total);
    for (const row of await rows.all()) await expect(row).toContainText(/vendor\./i);
  });

  // Destructive: only the confirmation UI is exercised. "Hapus akun" is never
  // clicked, and the network guard would abort a DELETE even if it were.
  test('"Hapus" asks for confirmation and "Batal" keeps the account', async ({ page, guard }) => {
    const rows = page.locator('main table tbody tr');
    const total = await rows.count();
    const row = rows.filter({ hasText: 'vendor.srapp' }).first();
    await row.getByRole('button', { name: 'Hapus' }).click();

    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Hapus akun ini?' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Hapus akun' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Batal' }).click();

    await expect(dialog).toBeHidden();
    await expect(rows).toHaveCount(total);
    expect(guard.list().filter((r) => r.startsWith('DELETE'))).toEqual([]);
  });

  test('"Buat akun" opens the create form', async ({ page }) => {
    await page.getByRole('link', { name: 'Buat akun' }).click();
    await expect(page).toHaveURL(/\/admin\/akun\/baru$/);
    await expect(new AppShell(page).heading('Buat akun pengguna')).toBeVisible();
  });
});
