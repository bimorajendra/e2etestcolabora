import { chromium } from '@playwright/test';
import fs from 'node:fs';
const B='https://colabora.aksara.blog';
const accs=JSON.parse(fs.readFileSync('accounts.local.json','utf8'));
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1400,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});
const a=accs.find(x=>x.role==='super-user');
await p.goto(B+'/login');await p.getByLabel('Email',{exact:true}).fill(a.email);await p.getByLabel('Kata sandi',{exact:true}).fill(a.password);
await p.getByRole('button',{name:'Masuk'}).click();await p.waitForURL(/dashboard/,{timeout:30000});
await p.getByRole('button',{name:'Nanti'}).click();
await p.getByRole('region',{name:'Papan proses permohonan'}).getByRole('link').first().click();
await p.waitForURL(/permohonan\//);await p.waitForLoadState('networkidle').catch(()=>{});
console.log('detail url',p.url().slice(0,90));
for (let i=0;i<3;i++){
  await p.goBack();await p.waitForTimeout(2500);
  console.log('after back',i,'url:',p.url().slice(0,80),'| h1:',await p.locator('h1').allInnerTexts(),'| body len:',(await p.locator('body').innerText()).length,'| dialog:',await p.getByRole('alertdialog').count());
  break;
}
await p.screenshot({path:'artifacts/exploration-new/after-back.png'});
console.log('errors:',errs);
await b.close();
