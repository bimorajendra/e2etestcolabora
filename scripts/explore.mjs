// Phase 6: bounded same-origin crawler that inventories each page's
// interactive elements, console output and failing requests. Read-only:
// it only navigates via GET and never clicks, submits or types.
// Usage: npm run explore  (writes artifacts/exploration/app-map.json)
import { chromium } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';

// Optional: EXPLORE_ROLE=<role from accounts.local.json> logs in first (the
// only form this script ever submits) and crawls as that user.
const START = process.env.BASE_URL || 'https://colabora.aksara.blog/';
const MAX_PAGES = Number(process.env.EXPLORE_MAX_PAGES || 50);
const ROLE = process.env.EXPLORE_ROLE;
const UNSAFE = /logout|log-out|signout|sign-out|delete|remove|destroy|hapus|keluar|export|download|unduh/i;
const visited = new Set();
const queue = [START];
const MAX_PER_PATTERN = 2; // e.g. only 2 of /permohonan/<uuid>
const patternCount = new Map();
const pattern = (u) => {
  const x = new URL(u);
  x.searchParams.delete('returnTo');
  const path = x.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/\/\d+(?=\/|$)/g, '/:n');
  return path + (x.searchParams.size ? '?' + x.searchParams.toString() : '');
};
const OUT = `artifacts/exploration${ROLE ? '/' + ROLE : ''}`;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
// Aksara keeps its auth token in sessionStorage (per tab), so the whole crawl
// reuses one tab; a new tab would be logged out.
const page = await context.newPage();

if (ROLE) {
  const accounts = JSON.parse(fs.readFileSync('accounts.local.json', 'utf8'));
  const acc = accounts.find((a) => a.role === ROLE);
  if (!acc) throw new Error(`role ${ROLE} not in accounts.local.json`);
  const p = page;
  await p.goto(new URL('/login', START).toString());
  await p.getByLabel('Email', { exact: true }).fill(acc.email);
  await p.getByLabel('Kata sandi', { exact: true }).fill(acc.password);
  await p.getByRole('button', { name: /masuk|login/i }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
    .catch(async () => { throw new Error(`login failed for ${ROLE}: ${(await p.locator('body').innerText()).slice(0, 300)}`); });
  queue[0] = p.url();
  console.log(`logged in as ${ROLE} -> ${p.url()}`);
}
const pages = [];
let origin;

const normalize = (u) => { const x = new URL(u); x.hash = ''; return x.toString(); };

while (queue.length && pages.length < MAX_PAGES) {
  const url = normalize(queue.shift());
  if (visited.has(url)) continue;
  visited.add(url);
  const pat = pattern(url);
  if ((patternCount.get(pat) ?? 0) >= MAX_PER_PATTERN) continue;
  patternCount.set(pat, (patternCount.get(pat) ?? 0) + 1);

  page.removeAllListeners();
  const rec = { url, console: [], pageErrors: [], failedRequests: [], badResponses: [], apiCalls: [] };
  page.on('console', (m) => rec.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => rec.pageErrors.push(String(e)));
  page.on('requestfailed', (r) => rec.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', (r) => {
    const t = r.request().resourceType();
    if (t === 'xhr' || t === 'fetch') rec.apiCalls.push({ method: r.request().method(), url: r.url(), status: r.status() });
    if (r.status() >= 400) rec.badResponses.push({ url: r.url(), status: r.status() });
  });

  try {
    const res = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    origin ??= new URL(page.url()).origin;
    rec.status = res?.status();
    rec.finalUrl = page.url();
    rec.title = await page.title();
    rec.inventory = await page.evaluate(() => {
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const txt = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || '').trim().slice(0, 80);
      const all = (sel) => [...document.querySelectorAll(sel)].filter(vis);
      return {
        headings: all('h1,h2').map((h) => `${h.tagName}: ${txt(h)}`),
        nav: all('nav, [role=navigation]').map((n) => [...n.querySelectorAll('a')].map(txt).filter(Boolean)),
        links: all('a[href]').map((a) => ({ text: txt(a), href: a.href })),
        buttons: all('button, [role=button], input[type=submit], input[type=button]').map(txt),
        forms: all('form').map((f) => ({
          action: f.getAttribute('action'), method: f.getAttribute('method'),
          fields: [...f.querySelectorAll('input,select,textarea')].map((i) => ({
            tag: i.tagName.toLowerCase(), type: i.getAttribute('type'), name: i.getAttribute('name'),
            label: i.labels?.[0]?.innerText?.trim(), placeholder: i.getAttribute('placeholder'), required: i.required,
          })),
        })),
        inputs: all('input:not([type=hidden]),textarea').length,
        selects: all('select, [role=combobox], [role=listbox]').length,
        dialogs: document.querySelectorAll('dialog, [role=dialog], [aria-modal=true]').length,
        tabs: all('[role=tab]').map(txt),
        tables: all('table, [role=grid], [role=table]').length,
        search: all('input[type=search], [role=search], input[placeholder*="earch" i], input[placeholder*="cari" i]').length,
        pagination: all('[aria-label*="pagination" i], nav .pagination, .pagination').length,
        destructive: all('button, a').map(txt).filter((t) => /delete|remove|hapus|destroy/i.test(t)),
      };
    });
    const safeName = String(pages.length).padStart(2, '0');
    await page.screenshot({ path: `${OUT}/page-${safeName}.png`, fullPage: true });
    for (const l of rec.inventory.links) {
      try {
        const u = new URL(l.href);
        if (u.origin === origin && !UNSAFE.test(u.href) && /^https?:$/.test(u.protocol)) queue.push(u.href);
      } catch { /* ignore */ }
    }
  } catch (e) {
    rec.error = String(e).split('\n')[0];
  }
  pages.push(rec);
  console.log(`${rec.status ?? 'ERR'}  ${url}${rec.error ? '  ' + rec.error : ''}`);
}

await browser.close();
fs.writeFileSync(`${OUT}/app-map.json`, JSON.stringify({ start: START, generatedAt: new Date().toISOString(), pages }, null, 2));
console.log(`\nExplored ${pages.length} page(s). Output: ${OUT}/app-map.json`);
