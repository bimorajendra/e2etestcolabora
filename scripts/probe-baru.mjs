import { chromium } from '@playwright/test';
import fs from 'node:fs';
const B='https://colabora.aksara.blog';
const accs=JSON.parse(fs.readFileSync('accounts.local.json','utf8'));
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1400,height:1000}});
for (const role of ['pelayanan-taman','nps-up']) {
  const a=accs.find(x=>x.role===role);
  const ctx=await b.newContext();const q=await ctx.newPage();
  await q.goto(B+'/login');await q.getByLabel('Email',{exact:true}).fill(a.email);await q.getByLabel('Kata sandi',{exact:true}).fill(a.password);
  await q.getByRole('button',{name:'Masuk'}).click();await q.waitForURL(/dashboard/,{timeout:30000});await q.getByRole('button',{name:'Nanti'}).click({timeout:4000}).catch(()=>{});
  await q.goto(B+'/permohonan/baru');await q.getByRole('heading',{level:1,name:'Permohonan PB/PD baru'}).waitFor();
  console.log('==',role,'combos:',await q.getByRole('combobox').evaluateAll(e=>e.map(x=>x.getAttribute('aria-label')||x.id+':'+x.textContent)));
  const tarif=q.getByRole('combobox',{name:'Tarif',exact:true});await tarif.click();
  const topts=await q.getByRole('option').allInnerTexts();console.log('Tarif options:',topts);await q.getByRole('option').first().click();
  const daya=q.getByRole('combobox',{name:'Permohonan daya',exact:true});await daya.click();console.log('Daya options (for',topts[0],'):',await q.getByRole('option').allInnerTexts());await q.keyboard.press('Escape');
  if(role==='nps-up'){const u=q.getByRole('combobox',{name:/Unit/});if(await u.count()){await u.first().click();console.log('Unit opts:',await q.getByRole('option').allInnerTexts());}}
  await ctx.close();
}
await b.close();
