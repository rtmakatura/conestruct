import {chromium,gate} from './lib.mjs';
import fs from 'fs';
const OUT=process.argv[2];
const AXE='C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js';
const b=await chromium.launch();
const res={};
for (const [tag,opts] of [['1440',{viewport:{width:1440,height:900}}],['390',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){
  const ctx=await b.newContext(opts); await gate(ctx);
  const p=await ctx.newPage();
  for (const path of ['/','/terms','/privacy','/this-page-does-not-exist']){
    const r=await p.goto('https://www.conestruct.com'+path,{waitUntil:'networkidle'});
    await p.waitForTimeout(800);
    const name=(path==='/'?'home':path.slice(1).replace(/\W+/g,'-'));
    await p.screenshot({path:`${OUT}/${tag}-${name}.png`,fullPage:true});
    const lay=await p.evaluate(()=>{
      const vw=document.documentElement.clientWidth;
      const over=[];
      document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width&&(r.right>vw+1||r.left<-1)) { const cs=getComputedStyle(e); if(cs.position!=='fixed') over.push(`${e.tagName}.${(e.className+'').slice(0,40)} [${Math.round(r.left)}-${Math.round(r.right)}] ${(e.innerText||'').slice(0,30).replace(/\s+/g,' ')}`);}});
      // wrapped controls: buttons/links whose height > 1.6x line-height
      const wrapped=[];
      document.querySelectorAll('button,a,.btn,[role=button]').forEach(e=>{const r=e.getBoundingClientRect(); if(!r.width) return; const cs=getComputedStyle(e); const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2; const rects=[...e.getClientRects()]; const txt=(e.innerText||'').trim(); if(txt && (r.height - parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)) > lh*1.6 && !txt.includes('\n')) wrapped.push(`${e.tagName} "${txt.slice(0,40)}" h=${Math.round(r.height)} w=${Math.round(r.width)} lh=${Math.round(lh)}`);});
      return {sw:document.documentElement.scrollWidth, vw, over:over.slice(0,15), wrapped, title:document.title, h1:document.querySelector('h1')?.innerText};
    });
    await p.addScriptTag({path:AXE});
    const axe=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}); return r.violations.map(v=>`${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0,3).map(n=>n.target.join(' ')).join(' | ')}`);});
    res[`${tag} ${path}`]={status:r.status(),...lay,axe};
  }
  await ctx.close();
}
fs.writeFileSync(OUT+'/public-pages.json',JSON.stringify(res,null,1));
console.log(JSON.stringify(res,null,1));
await b.close();
