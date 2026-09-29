// Read-only UX evidence collector: screenshots (desktop + mobile), color
// contrast, font sizes, tap targets, focus visibility and horizontal overflow.
// All mutating requests except login are aborted.
// Usage: node scripts/ux-audit.mjs  -> artifacts/ux/
import { chromium } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';

const B = (process.env.BASE_URL || 'https://colabora.aksara.blog/').replace(/\/$/, '');
const OUT = 'artifacts/ux';
fs.mkdirSync(OUT, { recursive: true });
const accs = JSON.parse(fs.readFileSync('accounts.local.json', 'utf8'));
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

const PAGES = [
  { role: null, name: 'login', path: '/login' },
  { role: 'pelayanan-taman', name: 'dashboard', path: '/dashboard' },
  { role: 'super-user', name: 'list', path: '/dashboard?view=all' },
  { role: 'super-user', name: 'detail', path: 'FIRST_DETAIL' },
  { role: 'pelayanan-taman', name: 'form-baru', path: '/permohonan/baru' },
  { role: 'teknik-pilang', name: 'survei', path: 'FIRST_SURVEY' },
  { role: 'super-user', name: 'akun', path: '/admin/akun' },
  { role: 'teknik-taman', name: 'no-access', path: '/admin/akun' },
];

// Runs in the page: sample visible text elements and measure contrast/size.
// Contrast is approximate: backgrounds in oklab()/oklch() or translucent layers
// are not composited, so every AA "fail" must be confirmed visually or by pixel sampling.
function audit() {
  const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => {
    for (let x = el; x; x = x.parentElement) {
      const c = parse(getComputedStyle(x).backgroundColor);
      if (c && (c.length < 4 || c[3] > 0.5)) return c.slice(0, 3);
    }
    return [255, 255, 255];
  };
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0'; };
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!own) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color).slice(0, 3);
    const bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(s.fontSize);
    const weight = Number(s.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const key = `${own.slice(0, 40)}|${s.color}|${size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: own.slice(0, 60), tag: el.tagName.toLowerCase(), size, weight, color: s.color, ratio: +ratio.toFixed(2), passAA: ratio >= (large ? 3 : 4.5) });
  }
  const targets = [...document.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, [role=combobox]')]
    .filter(vis).map((el) => { const r = el.getBoundingClientRect(); return { name: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; });
  const h1 = document.querySelector('h1');
  return {
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    fontFamily: getComputedStyle(document.body).fontFamily,
    baseSize: getComputedStyle(document.body).fontSize,
    h1: h1 ? { text: h1.innerText, size: getComputedStyle(h1).fontSize, top: Math.round(h1.getBoundingClientRect().top) } : null,
    texts: out,
    smallTargets: targets.filter((t) => t.h < 24 || t.w < 24),
    targetsUnder44: targets.filter((t) => t.h < 44).length,
    targetsTotal: targets.length,
  };
}

const b = await chromium.launch();
const report = {};
const tokenFor = new Map();
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const pg of PAGES) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.route('**/*', (r) => (['GET', 'HEAD', 'OPTIONS'].includes(r.request().method()) || /\/api\/auth\/login/.test(r.request().url())) ? r.continue() : r.abort());
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.dismiss());
    try {
      if (pg.role) {
        if (tokenFor.has(pg.role)) {
          await p.addInitScript((t) => sessionStorage.setItem('colabora_tokens', t), tokenFor.get(pg.role));
        } else {
          const a = accs.find((x) => x.role === pg.role);
          await p.goto(B + '/login');
          await p.getByLabel('Email', { exact: true }).fill(a.email);
          await p.getByLabel('Kata sandi', { exact: true }).fill(a.password);
          await p.getByRole('button', { name: 'Masuk' }).click();
          await p.waitForURL(/dashboard/, { timeout: 30000 });
          tokenFor.set(pg.role, await p.evaluate(() => sessionStorage.getItem('colabora_tokens')));
        }
      }
      let path = pg.path;
      if (path === 'FIRST_DETAIL' || path === 'FIRST_SURVEY') {
        await p.goto(B + (path === 'FIRST_DETAIL' ? '/dashboard?view=all' : '/dashboard?view=mine'));
        // Desktop renders a table, mobile renders cards: take the first visible detail link.
        const link = p.locator('main a[href*="/permohonan/"]:not([href*="/baru"])').filter({ visible: true }).first();
        await link.waitFor({ timeout: 20000 });
        path = await link.getAttribute('href');
        if (pg.path === 'FIRST_SURVEY') {
          await p.goto(B + path);
          const proceed = p.getByRole('link', { name: 'Lanjutkan proses' });
          await proceed.waitFor({ timeout: 20000 });
          path = await proceed.getAttribute('href');
        }
      }
      await p.goto(B + path);
      await p.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 20000 });
      await p.waitForLoadState('networkidle').catch(() => {});
      await p.screenshot({ path: `${OUT}/${pg.name}-${vpName}.png`, fullPage: false });
      if (vpName === 'desktop') await p.screenshot({ path: `${OUT}/${pg.name}-${vpName}-full.png`, fullPage: true });
      const data = await p.evaluate(audit);
      // Focus visibility: tab to the first 3 focusable elements and check for an outline/ring.
      const focus = [];
      for (let i = 0; i < 3; i++) {
        await p.keyboard.press('Tab');
        focus.push(await p.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return null;
          const s = getComputedStyle(el);
          return { name: (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 30), outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, ring: s.boxShadow !== 'none' };
        }));
      }
      data.focus = focus;
      report[`${pg.name}@${vpName}`] = data;
      console.log(`ok ${pg.name}@${vpName}`);
    } catch (e) {
      report[`${pg.name}@${vpName}`] = { error: String(e).split('\n')[0] };
      console.log(`ERR ${pg.name}@${vpName}: ${String(e).split('\n')[0]}`);
    }
    await ctx.close();
  }
}
await b.close();
fs.writeFileSync(`${OUT}/ux-audit.json`, JSON.stringify(report, null, 2));
console.log(`saved ${OUT}/ux-audit.json`);
