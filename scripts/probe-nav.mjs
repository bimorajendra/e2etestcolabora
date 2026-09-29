import { chromium } from '@playwright/test';
import fs from 'node:fs';
const B='https://colabora.aksara.blog';
const accs=JSON.parse(fs.readFileSync('accounts.local.json','utf8'));
const role=process.argv[2]||'super-user'; const a=accs.find(x=>x.role===role);
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(B+'/login');
await p.getByLabel('Email',{exact:true}).fill(a.email);
await p.getByLabel('Kata sandi',{exact:true}).fill(a.password);
await p.getByRole('button',{name:'Masuk'}).click();
await p.waitForURL(/dashboard/,{timeout:30000});
await p.waitForLoadState('networkidle').catch(()=>{});
console.log(role,'links:',await p.$$eval('a',as=>[...new Set(as.map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')))]));
console.log('buttons:',await p.$$eval('button,[role=tab]',bs=>bs.map(x=>x.textContent.trim()||x.getAttribute('aria-label'))));
console.log((await p.locator('main').innerText()).slice(0,900));
await p.screenshot({path:`artifacts/exploration-new/${role}-dash.png`,fullPage:true});
for (const path of ['/kanban','/dashboard/kanban','/permohonan/kanban','/dashboard?view=kanban','/admin/registrasi','/admin/verifikasi','/admin/akun/verifikasi','/admin/pendaftaran']) {
  const r=await p.goto(B+path); await p.waitForLoadState('networkidle').catch(()=>{});
  console.log(path,r.status(),'|',await p.locator('h1').first().innerText().catch(()=>'-'));
}
await b.close();
