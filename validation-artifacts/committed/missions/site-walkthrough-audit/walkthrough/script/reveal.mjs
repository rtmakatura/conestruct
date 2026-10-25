import {chromium,gate} from './lib.mjs';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}); await gate(ctx);
const p=await ctx.newPage();
await p.goto('https://www.conestruct.com/',{waitUntil:'networkidle'});
const y = await p.evaluate(()=>{const h=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/HOW IT WORKS/i.test(e.textContent)&&e.getBoundingClientRect().top>500); return h? h.getBoundingClientRect().top+scrollY:null});
for(let s=0;s<6000;s+=400){ await p.evaluate(s=>scrollTo(0,s),s); await p.waitForTimeout(150);}
await p.evaluate(y=>scrollTo(0,y-60),y); await p.waitForTimeout(1500);
await p.screenshot({path:process.argv[2]});
console.log('y',y);
await b.close();
