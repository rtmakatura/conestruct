globalThis.locate = async (q)=>{
  net.length=0;
  await p.goto('https://www.conestruct.com/sandbox',{waitUntil:'networkidle'});
  await p.getByRole('button',{name:'Pick on map'}).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(q);
  await p.getByRole('button',{name:'SEARCH'}).click();
  const t0=Date.now();
  await p.waitForFunction(()=>{const d=document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText)},null,{timeout:90000}).catch(()=>{});
  return (Date.now()-t0)+'ms\n'+await p.evaluate(()=>document.querySelector('[role=dialog]')?.innerText.slice(0,1500));
};
globalThis.pickSave = async (re)=>{
  const d=p.getByRole('dialog');
  await d.getByRole('button',{name:re}).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button',{name:'Save & Close'}).click();
  await p.waitForTimeout(5000);
};
globalThis.dlAll = async (prefix)=>{
const out=[];
const btns = await p.locator('.dl-btn, button:has-text("(.ZIP)"), button:has-text("(.zip)")').all();
for (let i=0;i<btns.length;i++){
  const b=btns[i];
  if(!(await b.isVisible())) { out.push(i+' hidden'); continue; }
  const label=(await b.getAttribute('aria-label'))||(await b.innerText()).replace(/\s+/g,' ');
  const respP = p.waitForResponse(r=>/\/api\/render\/(pdf|xlsx|markdown|crew-pdf|audit-pdf|bundle)\b/.test(r.url()),{timeout:120000}).catch(e=>null);
  const dlP = p.waitForEvent('download',{timeout:120000}).catch(e=>null);
  const t0=Date.now();
  await b.click();
  const [resp,dl]=await Promise.all([respP,dlP]);
  let size=null,fn=null;
  if(dl){ fn=dl.suggestedFilename(); const path='dl/'+prefix+'-'+i+'-'+fn; await dl.saveAs(path); size=fs.statSync(path).size; }
  out.push(`${i} ${label} -> ${resp?resp.status()+' '+resp.url().replace(/^https:\/\/www.conestruct.com/,'')+' '+(resp.headers()['content-type']||''):'no resp'} | file=${fn} size=${size} ms=${Date.now()-t0}`);
  await p.waitForTimeout(1200);
}
return out.join('\n');};
globalThis.alerts = async()=>p.evaluate(()=>[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText).join(' | '));
globalThis.banner = async()=>p.evaluate(()=>document.body.innerText.match(/PLAN DECLINED[^\n]*|INVALID INPUT[^\n]*|VERIFIED[^\n]*|AWAITING[^\n]*/)?.[0]||'no banner');
return 'helpers ok';
