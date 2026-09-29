import { test, expect } from '../fixtures/test';
import { PermohonanList } from '../fixtures/pages';

const COLUMNS = ['Nomor permohonan', 'Pelanggan', 'Unit', 'Tahap saat ini', 'Status', 'SLA', 'Aksi'];

test.describe('@feature daftar permohonan (super user)', () => {
  let list: PermohonanList;

  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('super-user');
    list = new PermohonanList(page);
    await list.goto('all');
    await expect(list.rows.first()).toBeVisible();
  });

  test('table has the expected columns and the count label matches the rows', async ({ monitor }) => {
    await expect(list.page.getByRole('columnheader')).toHaveText(COLUMNS);
    expect(await list.shownCount()).toBe(await list.rows.count());
    for (const row of await list.rows.all()) {
      await expect(list.cell(row, 0)).toHaveText(/^PBPD-\d{4}-\d{4}$/);
      await expect(list.action(row)).toHaveAttribute('href', /\/permohonan\/[0-9a-f-]{36}/);
    }
    monitor.assertHealthy();
  });

  test('search by application number narrows to that row and syncs the URL', async ({ page }) => {
    const target = (await list.cell(list.rows.nth(1), 0).innerText()).trim();
    await list.search.fill(target);
    await expect(page).toHaveURL(new RegExp(`q=${target}`));
    await expect(list.rows).toHaveCount(1);
    await expect(list.cell(list.rows.first(), 0)).toHaveText(target);
    await expect(list.summary).toHaveText('1 permohonan ditampilkan');
  });

  // Search is token-AND across all columns: every word must appear somewhere in the row.
  test('search by customer name matches case-insensitively', async () => {
    const customer = (await list.cell(list.rows.first(), 1).innerText()).split('\n')[0].trim();
    await list.search.fill(customer.toUpperCase());
    await expect(list.rows.first()).toBeVisible();
    for (const row of await list.rows.all()) {
      for (const token of customer.split(/\s+/)) {
        await expect(row).toContainText(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      }
    }
  });

  test('search with no match shows an empty result', async () => {
    await list.search.fill('zzzz-tidak-ada-e2e');
    await expect(list.dataRows).toHaveCount(0);
    await expect(list.summary).toHaveText('0 permohonan ditampilkan');
  });

  test('status filter lists the four options', async ({ page }) => {
    await list.statusFilter.click();
    // Option order differs between runs, so compare as a set.
    await expect(page.getByRole('option')).toHaveCount(4);
    expect((await page.getByRole('option').allInnerTexts()).sort())
      .toEqual(['Menunggu tindakan', 'PK dikembalikan', 'Selesai', 'Semua status']);
    await page.keyboard.press('Escape');
  });

  for (const status of ['Selesai', 'PK dikembalikan', 'Menunggu tindakan'] as const) {
    test(`status filter "${status}" shows only matching rows`, async ({ page }) => {
      const total = await list.rows.count();
      await list.filterStatus(status);
      await expect(page).toHaveURL(new RegExp(`status=${encodeURIComponent(status).replace(/%20/g, '(%20|\\+)')}`));
      await expect(list.summary).not.toHaveText(`${total} permohonan ditampilkan`);
      const n = await list.rows.count();
      for (let i = 0; i < n; i++) await expect(list.cell(list.rows.nth(i), 4)).toHaveText(status);

      await list.filterStatus('Semua status');
      await expect(list.rows).toHaveCount(total);
    });
  }

  test('"Lihat" opens the matching detail page', async ({ page }) => {
    const row = list.rows.first();
    const number = (await list.cell(row, 0).innerText()).trim();
    const customer = (await list.cell(row, 1).innerText()).split('\n')[0].trim();
    await list.action(row).click();
    await expect(page.getByRole('heading', { level: 1, name: customer })).toBeVisible();
    await expect(page.getByText(number).first()).toBeVisible();
  });
});

test.describe('@feature tugas saya per role', () => {
  // The tab label "Tugas saya (N)" must match the rows listed under it.
  for (const role of ['transaksi-up', 'teknik-pilang', 'user']) {
    test(`${role}: task count label matches the task list`, async ({ page, loginAs }) => {
      await loginAs(role);
      const list = new PermohonanList(page);
      await list.goto('mine');
      const tab = page.getByRole('link', { name: /^(Tugas saya|Dalam pemantauan) \(\d+\)$/ });
      const expected = Number((await tab.innerText()).match(/\d+/)![0]);
      await expect(list.dataRows).toHaveCount(expected);
    });
  }
});
