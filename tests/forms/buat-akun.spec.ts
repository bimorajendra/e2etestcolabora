import { test, expect } from '../fixtures/test';
import { AppShell } from '../fixtures/pages';

const ROLES = [
  'Admin · Administrasi', 'User · Pengguna', 'Bagian Teknik · ULP', 'Pelayanan Pelanggan · ULP', 'NPS · UP3',
  'Bagian Perencanaan · UP3', 'Bagian Konstruksi · UP3', 'Transaksi Energi · UP3', 'Bagian Jaringan · UP3',
  'Tim PDKB · UP3', 'Vendor Tiang · Vendor', 'Vendor Konstruksi · Vendor', 'Vendor SR/APP · Vendor',
  'Super User / Monitoring · Management',
];

// Creating an account adds a real user, so a valid submit is never sent
// (SKIPPED-DESTRUCTIVE). Only client-side validation is exercised.
test.describe('@form buat akun pengguna (super user)', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('super-user');
    await page.goto('/admin/akun/baru');
    await expect(new AppShell(page).heading('Buat akun pengguna')).toBeVisible();
  });

  test('role dropdown lists every role and defaults to User', async ({ page }) => {
    const role = page.getByRole('combobox').first();
    await expect(role).toHaveText('User · Pengguna');
    await role.click();
    await expect(page.getByRole('option')).toHaveText(ROLES);
    await page.getByRole('option', { name: 'Vendor Tiang · Vendor' }).click();
    await expect(role).toHaveText('Vendor Tiang · Vendor');
  });

  test('empty submit shows required-field messages', async ({ page, guard }) => {
    await page.getByRole('button', { name: 'Buat akun' }).click();
    await expect(page.getByText('Nama minimal 2 karakter.')).toBeVisible();
    await expect(page.getByText('Masukkan alamat email yang valid.')).toBeVisible();
    await expect(page.getByText('Kata sandi minimal 8 karakter.')).toBeVisible();
    expect(guard.list()).toEqual([]);
  });

  test('invalid email, short password and mismatched confirmation are rejected', async ({ page, guard }) => {
    await page.getByLabel('Nama lengkap').fill('E2E Validasi');
    await page.getByLabel('Email', { exact: true }).fill('bukan-email');
    await page.getByLabel('Kata sandi sementara').fill('abc');
    await page.getByLabel('Konfirmasi kata sandi').fill('xyz');
    await page.getByRole('button', { name: 'Buat akun' }).click();
    await expect(page.getByText('Masukkan alamat email yang valid.')).toBeVisible();
    await expect(page.getByText('Kata sandi minimal 8 karakter.')).toBeVisible();
    await expect(page.getByText('Konfirmasi kata sandi belum sama.')).toBeVisible();
    await expect(page.getByText('Nama minimal 2 karakter.')).toBeHidden();
    expect(guard.list()).toEqual([]);
  });

  test('phone is optional and password inputs are masked', async ({ page }) => {
    await expect(page.getByLabel('No. HP / telepon (opsional)')).toHaveAttribute('type', 'tel');
    await expect(page.getByLabel('Kata sandi sementara')).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Konfirmasi kata sandi')).toHaveAttribute('type', 'password');
  });

  test('"Batal" returns to the account list', async ({ page, guard }) => {
    await page.getByRole('link', { name: 'Batal' }).or(page.getByRole('button', { name: 'Batal' })).first().click();
    await expect(page).toHaveURL(/\/admin\/akun$/);
    await expect(new AppShell(page).heading('Manajemen akun')).toBeVisible();
    expect(guard.list()).toEqual([]);
  });
});
