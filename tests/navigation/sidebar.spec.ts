import { test, expect } from '../fixtures/test';
import { AppShell, PermohonanList } from '../fixtures/pages';

test.describe('@navigation sidebar & in-app links (super user)', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('super-user');
  });

  test('sidebar links open their pages', async ({ page, monitor }) => {
    const shell = new AppShell(page);

    await shell.navLink('Permohonan').click();
    await expect(page).toHaveURL(/\/dashboard\?view=all$/);
    await expect(shell.heading('Permohonan')).toBeVisible();

    await shell.navLink('Manajemen akun').click();
    await expect(page).toHaveURL(/\/admin\/akun$/);
    await expect(shell.heading('Manajemen akun')).toBeVisible();

    await shell.navLink('Beranda').click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(shell.heading('Beranda')).toBeVisible();
    monitor.assertHealthy();
  });

  test('sidebar collapses and expands', async ({ page }) => {
    await page.getByRole('button', { name: 'Ciutkan sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Perluas sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Perluas sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Ciutkan sidebar' })).toBeVisible();
  });

  test('skip link targets the main content', async ({ page }) => {
    const skip = page.getByRole('link', { name: 'Lewati ke konten utama' });
    await expect(skip).toHaveAttribute('href', '#main-content');
    await expect(page.locator('#main-content')).toHaveCount(1);
  });

  test('dashboard shortcuts open the list views', async ({ page }) => {
    // Super user has no "Tugas saya" shortcut; every entry point goes to view=all.
    for (const name of ['Lihat semua', 'Buka daftar']) {
      await page.getByRole('link', { name, exact: true }).first().click();
      await expect(page).toHaveURL(/view=all/);
      await expect(page.getByRole('heading', { name: 'Daftar permohonan' })).toBeVisible();
      await page.goBack();
      await expect(new AppShell(page).heading('Beranda')).toBeVisible();
    }
  });

  test('list -> detail -> back link returns to the list', async ({ page }) => {
    const list = new PermohonanList(page);
    await list.goto('all');
    const first = list.rows.first();
    const customer = (await list.cell(first, 1).innerText()).split('\n')[0].trim();
    await list.action(first).click();
    await expect(page).toHaveURL(/\/permohonan\/[0-9a-f-]{36}\?returnTo=/);
    const detailUrl = page.url();
    await expect(page.getByRole('heading', { level: 1, name: customer })).toBeVisible();

    await page.getByRole('link', { name: 'Kembali ke daftar permohonan' }).click();
    await expect(page).toHaveURL(/view=all/);
    await expect(page.getByRole('heading', { name: 'Daftar permohonan' })).toBeVisible();

    // The back link pushes a new history entry, so browser Back returns to the detail.
    await page.goBack();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByRole('heading', { level: 1, name: customer })).toBeVisible();
  });
});
