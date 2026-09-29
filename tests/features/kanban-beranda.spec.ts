import { test, expect, API_ORIGIN, accessToken, dismissWelcome } from '../fixtures/test';
import { AppShell, LoginPage } from '../fixtures/pages';
import { getAccount } from '../fixtures/accounts';

const STAGES = ['Permohonan PB/PD', 'Survei Perluasan Jaringan', 'Perencanaan Perluasan', 'Pra Pelaksanaan Konstruksi',
  'Pelaksanaan Konstruksi', 'Energize Jaringan', 'Penutupan / Selesai'];

// The stage board ("Papan proses permohonan") and the welcome modal exist only
// on the Super User dashboard (confirmed by the team).
test.describe('@feature kanban Beranda (super user)', () => {
  test('board shows the 7 stages in order, each with a count', async ({ page, loginAs, monitor }) => {
    await loginAs('super-user');
    await expect(page.getByRole('heading', { level: 2, name: 'Permohonan per tahap' })).toBeVisible();
    const board = page.getByRole('region', { name: 'Papan proses permohonan' });
    await expect(board).toBeVisible();
    for (const [i, stage] of STAGES.entries()) {
      await expect(board.getByRole('region', { name: `Tahap ${i + 1}: ${stage}` })).toBeVisible();
    }
    monitor.assertHealthy();
  });

  test('column counts and totals agree with the API', async ({ page, loginAs }) => {
    await loginAs('super-user');
    const token = await accessToken(page);
    const res = await page.request.get(`${API_ORIGIN}/api/permohonan?per_page=100`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items: unknown[] = body.data ?? body.items ?? body;
    const total = Number((await page.getByText('Total permohonan').locator('xpath=following::*[1]').innerText()).trim());
    expect(total, 'Total permohonan card equals API count').toBe(items.length);
  });

  test('cards link to the matching detail page and the board links to the list', async ({ page, loginAs }) => {
    await loginAs('super-user');
    const board = page.getByRole('region', { name: 'Papan proses permohonan' });
    const card = board.getByRole('link').filter({ hasText: /PBPD-\d{4}-\d{4}/ }).first();
    await expect(card).toHaveAttribute('href', /\/permohonan\/[0-9a-f-]{36}/);
    const number = (await card.innerText()).match(/PBPD-\d{4}-\d{4}/)![0];
    await card.click();
    await expect(page).toHaveURL(/\/permohonan\/[0-9a-f-]{36}/);
    await expect(page.getByText(number).first()).toBeVisible();
  });

  test('"Buka daftar" opens the full list', async ({ page, loginAs }) => {
    await loginAs('super-user');
    await page.getByRole('link', { name: 'Buka daftar' }).click();
    await expect(page).toHaveURL(/view=all/);
    await expect(page.getByRole('heading', { name: 'Daftar permohonan' })).toBeVisible();
  });

  test('overdue cards show an SLA warning', async ({ page, loginAs }) => {
    await loginAs('super-user');
    const board = page.getByRole('region', { name: 'Papan proses permohonan' });
    await expect(board.getByText(/Terlambat \d+ hari/).first()).toBeVisible();
    await expect(board.getByText(/Batas \d+ \w+ \d{4}/).first()).toBeVisible();
  });

  test('other roles do not get the board', async ({ page, loginAs }) => {
    await loginAs('teknik-pilang');
    await expect(new AppShell(page).heading('Beranda')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Papan proses permohonan' })).toHaveCount(0);
  });
});

test.describe('@feature modal sapaan', () => {
  async function login(page: import('@playwright/test').Page, role: string) {
    const acc = getAccount(role);
    test.skip(!acc, `BLOCKED: no "${role}" account`);
    await new LoginPage(page).login(acc!.email, acc!.password);
    return page.getByRole('alertdialog', { name: /Selamat datang/ });
  }

  test('super user sees the summary and can dismiss with "Nanti"', async ({ page }) => {
    const dialog = await login(page, 'super-user');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText('Super User / Monitoring');
    for (const label of ['Total', 'Dalam proses', 'Selesai', 'Over SLA']) await expect(dialog).toContainText(label);
    await dialog.getByRole('button', { name: 'Nanti' }).click();
    await expect(dialog).toBeHidden();
    await expect(new AppShell(page).heading('Beranda')).toBeVisible();
    // Once dismissed it stays away on reload.
    await page.reload();
    await expect(new AppShell(page).heading('Beranda')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('"Buka pemantauan" opens the list', async ({ page }) => {
    const dialog = await login(page, 'super-user');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Buka pemantauan' }).or(dialog.getByRole('link', { name: 'Buka pemantauan' })).click();
    await expect(page).toHaveURL(/view=all/);
  });

  test('"Tutup sapaan" closes the modal', async ({ page }) => {
    const dialog = await login(page, 'super-user');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Tutup sapaan' }).click();
    await expect(dialog).toBeHidden();
  });

  test('a role without tasks gets the empty-state greeting', async ({ page }) => {
    const dialog = await login(page, 'pelayanan-pilang');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole('button', { name: 'Nanti' })).toBeVisible();
    await dismissWelcome(page);
  });
});
