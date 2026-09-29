import { test, expect } from '../fixtures/test';
import { PermohonanList } from '../fixtures/pages';

const SECTIONS = ['Tahapan proses', 'Dokumen & Evidence', 'Informasi permohonan', 'Keputusan workflow', 'Riwayat aktivitas'];

test.describe('@feature detail permohonan', () => {
  test('detail page shows all sections and loads its data', async ({ page, loginAs, monitor }) => {
    await loginAs('super-user');
    const list = new PermohonanList(page);
    await list.goto('all');
    const detail = page.waitForResponse((r) => /\/api\/permohonan\/[0-9a-f-]{36}$/.test(r.url()));
    const docs = page.waitForResponse((r) => /\/api\/permohonan\/[0-9a-f-]{36}\/documents/.test(r.url()));
    const logs = page.waitForResponse((r) => /\/api\/permohonan\/[0-9a-f-]{36}\/logs/.test(r.url()));
    await list.action(list.rows.first()).click();

    for (const r of [await detail, await docs, await logs]) expect(r.status(), r.url()).toBe(200);
    for (const s of SECTIONS) await expect(page.getByRole('heading', { level: 2, name: s })).toBeVisible();
    monitor.assertHealthy();
  });

  test('document actions are labelled per file', async ({ page, loginAs }) => {
    await loginAs('super-user');
    const list = new PermohonanList(page);
    await list.goto('all');
    await list.action(list.rows.first()).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Dokumen & Evidence' })).toBeVisible();

    const open = page.getByRole('button', { name: /^Buka .+ di tab baru$/ });
    const download = page.getByRole('button', { name: /^Unduh .+/ });
    const n = await open.count();
    test.skip(n === 0, 'this application has no documents');
    await expect(download).toHaveCount(n);
  });

  for (const id of ['00000000-0000-0000-0000-000000000000', 'bukan-uuid']) {
    test(`unknown id "${id}" shows a not-found state, not a crash`, async ({ page, loginAs, monitor }) => {
      monitor.expect(/\/api\/permohonan\//); // 404 from the API is EXPECTED here
      await loginAs('super-user');
      await page.goto(`/permohonan/${id}`);
      await expect(page.getByText('Detail permohonan belum tersedia')).toBeVisible();
      await expect(page.getByText('Data yang diminta tidak ditemukan.')).toBeVisible();
      await page.getByRole('link', { name: 'Kembali ke daftar' }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      expect(monitor.pageErrors).toEqual([]);
    });
  }

  test('workflow decision is read-only for a role without the task', async ({ page, loginAs }) => {
    // Super user monitors but does not act; no workflow action should be offered.
    await loginAs('super-user');
    const list = new PermohonanList(page);
    await list.goto('all');
    await list.action(list.rows.first()).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Keputusan workflow' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Lanjutkan proses|Simpan dan selesaikan/ })).toHaveCount(0);
  });

  test('role with a pending task sees the workflow action (not executed)', async ({ page, loginAs }) => {
    await loginAs('transaksi-up');
    const list = new PermohonanList(page);
    await list.goto('mine');
    const withTask = list.dataRows;
    test.skip(await withTask.count() === 0, 'BLOCKED: transaksi-up currently has no pending task');
    await list.action(withTask.first()).click();
    // Presence only: executing "Lanjutkan proses" advances real workflow data (SKIPPED-DESTRUCTIVE).
    await expect(page.getByRole('button', { name: 'Lanjutkan proses' }).or(page.getByRole('link', { name: 'Lanjutkan proses' })).first()).toBeVisible();
  });
});
