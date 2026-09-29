import { chromium } from '@playwright/test';
const B = 'https://colabora.aksara.blog';
const b = await chromium.launch(); const p = await b.newPage();
const api = [];
p.on('response', r => { if (['xhr','fetch'].includes(r.request().resourceType())) api.push(`${r.request().method()} ${r.status()} ${r.url()}`); });
await p.goto(B + '/login'); await p.waitForLoadState('networkidle').catch(()=>{});
console.log('LOGIN links:', await p.$$eval('a', as => as.map(a => a.textContent.trim() + ' -> ' + a.getAttribute('href'))));
console.log('LOGIN buttons:', await p.$$eval('button', bs => bs.map(x => x.textContent.trim())));
for (const path of ['/register','/daftar','/forgot-password','/lupa-password','/lupa-kata-sandi','/reset-password','/verify','/verifikasi','/verify-email']) {
  const r = await p.goto(B + path); await p.waitForLoadState('networkidle').catch(()=>{});
  const h = await p.locator('h1,h2').first().innerText().catch(()=>'-');
  console.log(path, r.status(), '=>', p.url().replace(B,''), '|', h);
}
console.log(api.join('\n'));
await b.close();
