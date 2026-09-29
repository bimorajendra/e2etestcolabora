import { test, expect } from '../fixtures/test';

// Gatekeeper: if these fail, the target itself is unavailable and every other
// failure in the run should be read as ENVIRONMENT / AVAILABILITY, not an app bug.
test.describe('@smoke availability', () => {
  test('HTTP entrypoint redirects permanently to HTTPS', async ({ request, baseURL }) => {
    const http = new URL(baseURL!);
    http.protocol = 'http:';
    const res = await request.get(http.toString(), { maxRedirects: 0, failOnStatusCode: false });
    expect([301, 308]).toContain(res.status());
    expect(res.headers()['location']).toMatch(/^https:\/\//);
  });

  test('root redirects an anonymous visitor to the login page', async ({ page, monitor }) => {
    const response = await page.goto('/');
    expect(response?.status(), 'document HTTP status').toBeLessThan(400);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page).toHaveTitle('Masuk | COLABORA');
    await expect(page.getByRole('heading', { level: 1, name: 'Masuk ke COLABORA' })).toBeVisible();
    monitor.assertHealthy();
  });

  test('login page loads its critical assets without errors', async ({ page, monitor }) => {
    const failedAssets: string[] = [];
    page.on('response', (r) => {
      if (['script', 'stylesheet', 'font'].includes(r.request().resourceType()) && r.status() >= 400) {
        failedAssets.push(`${r.status()} ${r.url()}`);
      }
    });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    expect(failedAssets).toEqual([]);
    expect(monitor.consoleErrors().map((c) => c.text)).toEqual([]);
    monitor.assertHealthy();
  });

  test('unknown route renders the 404 page', async ({ page, monitor }) => {
    monitor.expect(/\/halaman-tidak-ada-e2e/);
    const response = await page.goto('/halaman-tidak-ada-e2e');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Halaman tidak ditemukan')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kembali' }).or(page.getByRole('button', { name: 'Kembali' })).first()).toBeVisible();
  });
});
