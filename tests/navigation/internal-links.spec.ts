import { test, expect } from '../fixtures/test';

// Collects every same-origin link reachable from the main super-user pages and
// opens each one in the same tab (the session is per tab). Links that look
// destructive are never followed. Detail pages are capped to keep the run fast.
const UNSAFE = /logout|keluar|delete|hapus|remove|destroy/i;
const START_PAGES = ['/dashboard', '/dashboard?view=all', '/admin/akun'];
const MAX_DETAIL_PAGES = 5;

test('@navigation internal links open without error pages (super user)', async ({ page, loginAs, monitor }, testInfo) => {
  test.setTimeout(180_000);
  await loginAs('super-user');
  const origin = new URL(page.url()).origin;

  const found = new Set<string>();
  for (const path of START_PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    for (const href of await page.locator('a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
      const url = href.split('#')[0];
      if (url.startsWith(origin) && !UNSAFE.test(url)) found.add(url);
    }
  }
  let details = 0;
  const targets = [...found].filter((u) => !/\/permohonan\/[0-9a-f-]{36}/.test(u) || ++details <= MAX_DETAIL_PAGES);

  const results: { url: string; status?: number; finalUrl: string; h1: string; problem?: string }[] = [];
  for (const url of targets) {
    const res = await page.goto(url);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    await expect(page.getByText('Memuat halaman...')).toHaveCount(0);
    const text = (await h1.innerText()).trim();
    const notFound = await page.getByText(/Halaman tidak ditemukan|Data yang diminta tidak ditemukan/).count();
    results.push({
      url, status: res?.status(), finalUrl: page.url(), h1: text,
      problem: (res && res.status() >= 400) ? `HTTP ${res.status()}`
        : notFound ? 'error page' : /\/login$/.test(page.url()) ? 'unexpected redirect to login' : undefined,
    });
  }

  await testInfo.attach('internal-links.json', { body: JSON.stringify({ checked: results.length, results }, null, 2), contentType: 'application/json' });
  expect(results.length, 'links discovered').toBeGreaterThan(3);
  expect(results.filter((r) => r.problem).map((r) => `${r.problem}: ${r.url}`), 'broken internal links').toEqual([]);
  monitor.assertHealthy();
});
