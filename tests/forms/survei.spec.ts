import { test, expect } from '../fixtures/test';
import { PermohonanList } from '../fixtures/pages';

// "Simpan dan selesaikan aktivitas" advances the real workflow, so it is only
// clicked with the form empty to check validation; the guard would abort any
// mutating request that slipped through, and the test fails if one was attempted.
test.describe('@form survei perluasan jaringan (teknik)', () => {
  test('survey form validates before completing the activity', async ({ page, loginAs, guard, monitor }) => {
    await loginAs('teknik-pilang');
    const list = new PermohonanList(page);
    await list.goto('mine');

    // "Lanjutkan proses" on a task in the Survei stage leads to /permohonan/:id/survei.
    const proceed = page.getByRole('link', { name: 'Lanjutkan proses' });
    const taskUrls = await list.dataRows.getByRole('link', { name: 'Lanjutkan' })
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    let found = false;
    for (const url of taskUrls) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 2, name: 'Riwayat aktivitas' })).toBeVisible();
      if (await proceed.count() && /\/survei/.test(await proceed.getAttribute('href') ?? '')) { found = true; break; }
    }
    test.skip(!found, 'BLOCKED: teknik-pilang has no open survey task right now');

    await proceed.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Survei Perluasan Jaringan' })).toBeVisible();
    await expect(page.getByLabel('Tanggal survei')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pilih berkas', exact: true })).toBeVisible();
    await expect(page.getByText(/PDF, JPG, JPEG, atau PNG · maksimal 10 MB/)).toBeVisible();

    await page.getByRole('button', { name: 'Simpan dan selesaikan aktivitas' }).click();
    await expect(page).toHaveURL(/\/survei/);
    await expect(page.getByText(/wajib diisi\.$/).first()).toBeVisible();
    await expect(page.getByText(/minimal satu evidence\.$/)).toBeVisible();
    expect(guard.list(), 'empty survey must not be submitted').toEqual([]);
    monitor.assertHealthy();
  });
});
