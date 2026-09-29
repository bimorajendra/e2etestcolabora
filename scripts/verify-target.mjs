// Phase 4: verify target availability with a real browser (read-only).
import { chromium } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';

const target = process.env.BASE_URL || 'https://colabora.aksara.blog/';
const out = { target, redirects: [], console: [], pageErrors: [], failedRequests: [], badResponses: [] };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => out.console.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => out.pageErrors.push(String(e)));
page.on('requestfailed', (r) => out.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
page.on('response', (r) => {
  if (r.status() >= 300 && r.status() < 400) out.redirects.push({ url: r.url(), status: r.status(), location: r.headers()['location'] });
  if (r.status() >= 400) out.badResponses.push({ url: r.url(), status: r.status() });
});

try {
  const res = await page.goto(target, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  out.status = res?.status();
  out.finalUrl = page.url();
  out.title = await page.title();
  out.h1 = await page.locator('h1').allInnerTexts();
  out.bodyTextSample = (await page.locator('body').innerText()).slice(0, 1500);
  fs.mkdirSync('artifacts/exploration', { recursive: true });
  await page.screenshot({ path: 'artifacts/exploration/00-home.png', fullPage: true });
} catch (e) {
  out.error = String(e);
}
await browser.close();
fs.mkdirSync('artifacts/exploration', { recursive: true });
fs.writeFileSync('artifacts/exploration/verify-target.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
