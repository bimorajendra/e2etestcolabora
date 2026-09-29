import { test, expect, API_ORIGIN } from '../fixtures/test';
import { AppShell } from '../fixtures/pages';
import { loadAccounts, disabledAccounts } from '../fixtures/accounts';

const ADMIN_ROLES = new Set(['super-user', 'admin']);

test.describe('@smoke dashboard per role', () => {
  const accounts = loadAccounts();
  test.skip(accounts.length === 0, 'BLOCKED: accounts.local.json missing or empty');

  for (const account of accounts) {
    test(`${account.label}: login lands on a healthy dashboard`, async ({ page, loginAs, monitor }) => {
      const me = page.waitForResponse((r) => r.url().startsWith(`${API_ORIGIN}/api/user/me`));
      const list = page.waitForResponse((r) => r.url().startsWith(`${API_ORIGIN}/api/permohonan?`));
      await loginAs(account.role);
      expect((await me).status()).toBe(200);
      expect((await list).status()).toBe(200);

      const shell = new AppShell(page);
      await expect(shell.heading('Beranda')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Permohonan terbaru' })).toBeVisible();
      await expect(shell.navLink('Beranda')).toBeVisible();
      await expect(shell.navLink('Permohonan')).toBeVisible();
      await expect(shell.logout).toBeVisible();
      // Header shows the active role (read-only label).
      await expect(page.getByRole('group').filter({ hasText: /^Peran/ })).toHaveText(/^Peran\s*\S.+/);

      // Account management is only offered to admin / super user.
      const akun = page.getByRole('link', { name: 'Manajemen akun' });
      if (ADMIN_ROLES.has(account.role)) await expect(akun.first()).toBeVisible();
      else await expect(akun).toHaveCount(0);

      monitor.assertHealthy();
    });
  }

  for (const account of disabledAccounts()) {
    test(`${account.label}: login`, () => {
      test.skip(true, `BLOCKED: ${account.disabled}`);
    });
  }
});
