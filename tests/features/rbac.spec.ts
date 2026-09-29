import { test, expect, API_ORIGIN, accessToken } from '../fixtures/test';

// Access control for pages and APIs that a role should not reach. All checks
// are GET-only.
const NON_ADMIN = ['user', 'pelayanan-taman', 'teknik-taman', 'nps-up', 'vendor-tiang'];
const CANNOT_CREATE = ['user', 'teknik-taman', 'perencanaan-up', 'vendor-konstruksi'];

test.describe('@feature @security role-based access', () => {
  for (const role of NON_ADMIN) {
    test(`${role}: /admin/akun is restricted`, async ({ page, loginAs }) => {
      await loginAs(role);
      await page.goto('/admin/akun');
      await expect(page.getByText('Akses terbatas')).toBeVisible();
      await expect(page.getByText('Halaman ini hanya dapat diakses oleh Admin dan Super User.')).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Email' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Hapus' })).toHaveCount(0);
    });

    test(`${role}: account API rejects the request`, async ({ page, loginAs, request, monitor }) => {
      await loginAs(role);
      const res = await request.get(`${API_ORIGIN}/api/user?page=1&per_page=5`, {
        headers: { Authorization: `Bearer ${await accessToken(page)}` },
      });
      expect(res.status()).toBe(403);
      expect(await res.text()).not.toMatch(/@pln\.com/);
      monitor.assertHealthy();
    });
  }

  for (const role of CANNOT_CREATE) {
    test(`${role}: cannot create a permohonan`, async ({ page, loginAs }) => {
      await loginAs(role);
      await page.goto('/permohonan/baru');
      await expect(page.getByText('Peran ini tidak berwenang membuat permohonan')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Simpan permohonan' })).toHaveCount(0);
    });
  }

  test('anonymous API call is rejected', async ({ request }) => {
    const res = await request.get(`${API_ORIGIN}/api/permohonan?page=1&per_page=1`);
    expect([401, 403]).toContain(res.status());
  });
});
