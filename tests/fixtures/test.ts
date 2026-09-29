import { test as base, expect, type Page } from '@playwright/test';
import { PageMonitor } from './monitor';
import { getAccount, type Account } from './accounts';
import { LoginPage } from './pages';

export const API_ORIGIN = process.env.E2E_API_ORIGIN || 'https://api-colabora.anargya.fun';
export const TOKEN_KEY = 'colabora_tokens';
export const isSafeEnv = () => process.env.E2E_SAFE_ENV === 'true';

// Requests the guard lets through even in a non-safe environment: they only
// create/destroy the tester's own session.
const ALLOWED_MUTATIONS = /\/api\/auth\/(login|logout|refresh)\b/;

// Aksara keeps its session in sessionStorage (per tab), which storageState
// cannot persist. Tokens are cached per worker after the first UI login and
// seeded into each new page, so each role logs in through the UI once per worker.
const tokenCache = new Map<string, string>();

type Fixtures = {
  /** Mutating requests (POST/PUT/PATCH/DELETE) aborted by the safety guard. */
  guard: { blocked: Set<string>; list: () => string[] };
  monitor: PageMonitor;
  /** Native dialogs seen by the page; beforeunload is accepted, others dismissed. */
  dialogs: { type: string; message: string }[];
  /** Log in as a role from accounts.local.json and land on /dashboard. */
  loginAs: (role: string) => Promise<Account>;
};

export const test = base.extend<Fixtures>({
  guard: [async ({ context }, use) => {
    const blocked = new Set<string>();
    if (!isSafeEnv()) {
      await context.route('**/*', (route) => {
        const req = route.request();
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method()) || ALLOWED_MUTATIONS.test(req.url())) {
          return route.fallback();
        }
        blocked.add(`${req.method()} ${req.url()}`);
        return route.abort('blockedbyclient');
      });
    }
    await use({ blocked, list: () => [...blocked] });
  }, { auto: true }],

  monitor: [async ({ page, baseURL, guard }, use, testInfo) => {
    const monitor = new PageMonitor(page, [new URL(baseURL!).origin, API_ORIGIN], guard.blocked);
    await use(monitor);
    await monitor.attach(testInfo);
  }, { auto: true }],

  dialogs: [async ({ page }, use) => {
    const seen: { type: string; message: string }[] = [];
    page.on('dialog', async (d) => {
      seen.push({ type: d.type(), message: d.message() });
      if (d.type() === 'beforeunload') await d.accept();
      else await d.dismiss();
    });
    await use(seen);
  }, { auto: true }],

  loginAs: async ({ page }, use) => {
    await use(async (role: string) => {
      const account = getAccount(role);
      test.skip(!account, `BLOCKED: no enabled account for role "${role}" in accounts.local.json`);
      const cached = tokenCache.get(role);
      if (cached) {
        await seedSession(page, cached);
        await page.goto('/dashboard');
        if (await isOnDashboard(page)) return account!;
        tokenCache.delete(role); // expired: fall back to a UI login
      }
      await new LoginPage(page).login(account!.email, account!.password);
      // The login API is intermittently slow (BUG_REPORT ENV-002), so allow 30s.
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
      await dismissWelcome(page);
      const token = await page.evaluate((k) => sessionStorage.getItem(k), TOKEN_KEY);
      if (token) tokenCache.set(role, token);
      return account!;
    });
  },
});

async function seedSession(page: Page, token: string) {
  // Seed once per tab so a later logout in the same test is not undone.
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem('__e2e_seeded')) {
      sessionStorage.setItem('__e2e_seeded', '1');
      sessionStorage.setItem(key, value);
    }
  }, [TOKEN_KEY, token]);
}

/**
 * Since the 2026-09 release the dashboard opens a modal "Selamat datang, <user>"
 * (role="alertdialog", button "Nanti") that hides the page from the a11y tree.
 * Dismiss it when it shows up; a test that covers the modal itself opens
 * /dashboard directly instead of going through loginAs.
 */
export async function dismissWelcome(page: Page) {
  const dialog = page.getByRole('alertdialog', { name: /Selamat datang/ });
  const shown = await dialog.waitFor({ timeout: 5_000 }).then(() => true, () => false);
  if (shown) {
    await dialog.getByRole('button', { name: 'Nanti' }).click();
    await expect(dialog).toBeHidden();
  }
}

async function isOnDashboard(page: Page) {
  await dismissWelcome(page);
  return page.getByRole('heading', { level: 1, name: 'Beranda' })
    .waitFor({ timeout: 10_000 }).then(() => true, () => false);
}

/** Read the access token of the logged-in tab (for GET-only API checks). */
export async function accessToken(page: Page): Promise<string> {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), TOKEN_KEY);
  expect(raw, 'session token present').toBeTruthy();
  return JSON.parse(raw!).access_token;
}

export { expect };
