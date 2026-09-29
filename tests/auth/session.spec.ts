import { test, expect, API_ORIGIN, TOKEN_KEY, accessToken, dismissWelcome } from '../fixtures/test';
import { AppShell, LoginPage } from '../fixtures/pages';
import { getAccount } from '../fixtures/accounts';

test.describe('@auth session', () => {
  test('protected route redirects an anonymous visitor to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Masuk ke COLABORA' })).toBeVisible();
  });

  test('session survives a page reload', async ({ page, loginAs }) => {
    await loginAs('user');
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(new AppShell(page).heading('Beranda')).toBeVisible();
  });

  // Design note (EXPECTED): the token lives in sessionStorage, so it is scoped
  // to one tab. A new tab starts logged out.
  test('session is scoped to the tab (new tab is not logged in)', async ({ page, context, loginAs }) => {
    await loginAs('user');
    const other = await context.newPage();
    await other.goto('/dashboard');
    await expect(other).toHaveURL(/\/login$/);
    await other.close();
  });

  test('logout clears the session and re-protects the dashboard', async ({ page }) => {
    const account = getAccount('user');
    test.skip(!account, 'BLOCKED: no "user" account configured');
    await new LoginPage(page).login(account!.email, account!.password);
    await dismissWelcome(page);
    const shell = new AppShell(page);
    await expect(shell.heading('Beranda')).toBeVisible();

    await shell.logout.click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate((k) => sessionStorage.getItem(k), TOKEN_KEY)).toBeNull();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  // Security check (GET only): after logout the old access token should no
  // longer be accepted by the API.
  test('@security access token is rejected by the API after logout', async ({ page, request }) => {
    const account = getAccount('user');
    test.skip(!account, 'BLOCKED: no "user" account configured');
    await new LoginPage(page).login(account!.email, account!.password);
    await dismissWelcome(page);
    await expect(new AppShell(page).heading('Beranda')).toBeVisible();
    const token = await accessToken(page);

    const logoutCalls: string[] = [];
    page.on('request', (r) => { if (r.url().startsWith(API_ORIGIN) && /logout|revoke/i.test(r.url())) logoutCalls.push(r.url()); });
    await new AppShell(page).logout.click();
    await expect(page).toHaveURL(/\/login$/);

    const res = await request.get(`${API_ORIGIN}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } });
    test.info().annotations.push({ type: 'observation', description: `logout API calls: ${logoutCalls.length}; /api/user/me with old token -> ${res.status()}` });
    expect(res.status(), 'old token must be rejected after logout').toBe(401);
  });
});
