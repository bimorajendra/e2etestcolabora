import { test, expect } from '../fixtures/test';
import { AppShell } from '../fixtures/pages';

// Creating a permohonan writes real data, so a valid submit is never sent
// (SKIPPED-DESTRUCTIVE). Every test asserts the guard saw no mutating request,
// i.e. client-side validation stopped the submit on its own.
test.describe('@form permohonan PB/PD baru (pelayanan)', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('pelayanan-taman');
    await page.goto('/permohonan/baru');
    await expect(new AppShell(page).heading('Permohonan PB/PD baru')).toBeVisible();
  });

  test('form shows its fields with defaults', async ({ page, monitor }) => {
    await expect(page.getByLabel('Nama pelanggan')).toBeEmpty();
    await expect(page.getByLabel('No. HP / telepon')).toHaveAttribute('type', 'tel');
    await expect(page.getByLabel('Lokasi')).toHaveAttribute('placeholder', 'Jl. Pahlawan No. 10, Surabaya');
    await expect(page.getByRole('combobox').nth(0)).toHaveText('Pasang baru');
    await expect(page.getByRole('combobox').nth(1)).toHaveText('JTR');
    monitor.assertHealthy();
  });

  test('"Jenis permohonan" offers Pasang baru and Perubahan daya', async ({ page }) => {
    await page.getByRole('combobox').nth(0).click();
    await expect(page.getByRole('option')).toHaveText(['Pasang baru', 'Perubahan daya']);
    await page.getByRole('option', { name: 'Perubahan daya' }).click();
    await expect(page.getByRole('combobox').nth(0)).toHaveText('Perubahan daya');
  });

  test('"Jenis sambungan" offers JTR and JTM / Gardu', async ({ page }) => {
    await page.getByRole('combobox').nth(1).click();
    await expect(page.getByRole('option')).toHaveText(['JTR', 'JTM / Gardu']);
    await page.keyboard.press('Escape');
  });

  test('empty submit shows every required-field message', async ({ page, guard }) => {
    await page.getByRole('button', { name: 'Simpan permohonan' }).click();
    await expect(page.getByText('Nama pelanggan minimal 2 karakter.')).toBeVisible();
    await expect(page.getByText('Nomor telepon minimal 8 karakter.')).toBeVisible();
    await expect(page.getByText('Lokasi minimal 2 karakter.')).toBeVisible();
    await expect(page).toHaveURL(/\/permohonan\/baru/);
    expect(guard.list()).toEqual([]);
  });

  test('phone number with letters is rejected', async ({ page, guard }) => {
    await page.getByLabel('Nama pelanggan').fill('E2E Validasi');
    await page.getByLabel('No. HP / telepon').fill('abcdefghij');
    await page.getByLabel('Lokasi').fill('Jl. Validasi');
    await page.getByRole('button', { name: 'Simpan permohonan' }).click();
    await expect(page.getByText('Nomor telepon hanya boleh berisi angka dan tanda telepon umum.')).toBeVisible();
    expect(guard.list()).toEqual([]);
  });

  test('field errors clear once the value becomes valid', async ({ page }) => {
    await page.getByRole('button', { name: 'Simpan permohonan' }).click();
    await expect(page.getByText('Nama pelanggan minimal 2 karakter.')).toBeVisible();
    await page.getByLabel('Nama pelanggan').fill('E2E Validasi');
    await page.getByLabel('Lokasi').click();
    await expect(page.getByText('Nama pelanggan minimal 2 karakter.')).toBeHidden();
  });

  test('"Batal" returns to the list without saving', async ({ page, guard }) => {
    await page.getByRole('link', { name: 'Batal' }).or(page.getByRole('button', { name: 'Batal' })).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
    expect(guard.list()).toEqual([]);
  });

  test('leaving a dirty form triggers the unsaved-changes prompt', async ({ page, dialogs }) => {
    await page.getByLabel('Nama pelanggan').fill('E2E belum disimpan');
    await page.goto('/dashboard');
    expect(dialogs.map((d) => d.type)).toContain('beforeunload');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
