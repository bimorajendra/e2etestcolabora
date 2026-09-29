import { test, expect } from '../fixtures/test';
import { PermohonanList } from '../fixtures/pages';

// Regression check for BUG-WF-001 (vendor list 403 for perencanaan / konstruksi / transaksi).
// Read-only: the form is opened, never sent.
const WO_ROLES = [
  { role: 'perencanaan-up', form: 'WO Vendor Tiang', vendor: 'Vendor Tiang' },
  { role: 'konstruksi-up', form: 'WO Vendor Konstruksi', vendor: 'Vendor Konstruksi' },
  { role: 'transaksi-up', form: 'WO Vendor APP', vendor: 'Vendor SR/APP' },
];

test.describe('@workflow WO vendor list', () => {
  for (const { role, form, vendor } of WO_ROLES) {
    test(`${role} can choose a vendor on "${form}"`, async ({ page, loginAs }) => {
      await loginAs(role);
      const list = new PermohonanList(page);
      await list.goto('mine');

      // Find one of the role's tasks that is at this WO step.
      const urls = await list.dataRows.getByRole('link', { name: 'Lanjutkan' })
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
      const region = page.getByRole('region', { name: form });
      let found = false;
      for (const url of urls) {
        await page.goto(url);
        await expect(page.getByRole('heading', { level: 2, name: 'Riwayat aktivitas' })).toBeVisible();
        await page.getByRole('link', { name: 'Lanjutkan proses' }).or(page.getByRole('button', { name: 'Lanjutkan proses' })).click();
        if (await region.isVisible()) { found = true; break; }
      }
      test.skip(!found, `BLOCKED: ${role} has no open "${form}" task right now`);

      await expect(region.getByText('Daftar vendor gagal dimuat.')).toBeHidden();
      await region.getByRole('combobox', { name: vendor }).click();
      await expect(page.getByRole('option').first()).toBeVisible();
    });
  }
});
