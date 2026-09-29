import { test, expect } from '../fixtures/test';
import { LoginPage } from '../fixtures/pages';
import { getAccount } from '../fixtures/accounts';

test.describe('@auth login form', () => {
  test('shows email and password fields with a submit button', async ({ page, monitor }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.email).toHaveAttribute('type', 'email');
    await expect(login.email).toHaveAttribute('placeholder', 'nama@perusahaan.co.id');
    await expect(login.password).toHaveAttribute('type', 'password');
    await expect(login.password).toHaveAttribute('autocomplete', 'current-password');
    await expect(login.submit).toBeEnabled();
    monitor.assertHealthy();
  });

  test('empty submit shows required-field messages and sends no request', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    let loginCalls = 0;
    page.on('request', (r) => { if (/\/api\/auth\/login/.test(r.url())) loginCalls++; });
    await login.submit.click();
    await expect(page.getByText('Email wajib diisi.')).toBeVisible();
    await expect(page.getByText('Kata sandi wajib diisi.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(loginCalls).toBe(0);
  });

  test('malformed email is rejected client-side', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.email.fill('bukan-email');
    await login.password.fill('sembarang');
    await login.submit.click();
    await expect(page.getByText('Format email tidak valid.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('password visibility toggle switches the input type', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.password.fill('rahasia');
    await page.getByRole('button', { name: 'Tampilkan kata sandi' }).click();
    await expect(login.password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Sembunyikan kata sandi' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Sembunyikan kata sandi' }).click();
    await expect(login.password).toHaveAttribute('type', 'password');
  });

  test('unknown email is rejected with a message', async ({ page, monitor }) => {
    monitor.expect(/\/api\/auth\/login/); // 4xx here is EXPECTED
    const login = new LoginPage(page);
    await login.login('tidak-terdaftar-e2e@example.com', 'sembarang123');
    // The message is shown both inline (form alert) and as a toast.
    await expect(login.formAlert).toHaveText('email not found');
    await expect(page.getByRole('region', { name: /Notifications/ }).getByText('email not found')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  // One wrong-password attempt only: never loop, to avoid locking the account.
  test('wrong password is rejected with a message', async ({ page, monitor }) => {
    const account = getAccount('user');
    test.skip(!account, 'BLOCKED: no "user" account configured');
    monitor.expect(/\/api\/auth\/login/);
    const login = new LoginPage(page);
    const response = page.waitForResponse(/\/api\/auth\/login/);
    await login.login(account!.email, 'salah-password-e2e');
    expect((await response).status()).toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/login$/);
    await expect(login.submit).toBeVisible();
    await expect(login.formAlert).toBeVisible();
    await expect(login.formAlert).not.toHaveText('');
    test.info().annotations.push({ type: 'observation', description: `wrong-password message: "${await login.formAlert.innerText()}"` });
  });
});
