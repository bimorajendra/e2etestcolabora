import { chromium } from '@playwright/test';
const B = 'https://colabora.aksara.blog';
const b = await chromium.launch(); const p = await b.newPage();
for (const path of ['/registrasi','/lupa-kata-sandi','/reset-password','/reset-password?token=abc','/verifikasi-email','/verifikasi-akun']) {
  const r = await p.goto(B + path); await p.waitForLoadState('networkidle').catch(()=>{});
  console.log('\n##', path, r.status(), '=>', p.url().replace(B,''));
  console.log(await p.locator('main, body').first().innerText().then(t=>t.slice(0,600)));
  console.log('inputs:', await p.$$eval('input,select,textarea', els => els.map(e => `${e.tagName}[${e.type}] name=${e.name} label=${e.labels?.[0]?.textContent?.trim()||e.getAttribute('aria-label')||e.placeholder} req=${e.required}`)));
  console.log('buttons:', await p.$$eval('button', bs => bs.map(x => x.textContent.trim()+(x.disabled?'(disabled)':''))));
}
await b.close();
