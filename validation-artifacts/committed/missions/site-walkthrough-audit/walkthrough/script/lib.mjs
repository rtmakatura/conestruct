import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
export const { chromium, webkit, firefox, devices } = require('playwright');
const env = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/.env.local','utf8');
export const TOK = env.split(/\r?\n/).find(l=>l.startsWith('GATE_BYPASS_TOKEN=')).slice(18).replace(/^"|"$/g,'');
export async function dump(p){
  return p.evaluate(()=>{
  const r=[];
  document.querySelectorAll('button,input,select,textarea,a,[role=button],[role=radio],[role=option],[role=combobox],[role=status],[role=alert]').forEach(e=>{
    const s=e.getBoundingClientRect(); if(!s.width) return;
    r.push(`${e.tagName}${e.getAttribute('aria-checked')==='true'||e.getAttribute('aria-pressed')==='true'?'(ON)':''}${e.disabled?'(dis)':''} ${e.getAttribute('type')||e.getAttribute('role')||''} aria=${e.getAttribute('aria-label')||''} val=${e.value||''} [${Math.round(s.x)},${Math.round(s.y)} ${Math.round(s.width)}x${Math.round(s.height)}] | ${(e.innerText||'').replace(/\s+/g,' ').slice(0,80)}`);
  });
  return r.join('\n');
});}
export async function gate(ctx){
  await ctx.route(/^https:\/\/(www\.)?conestruct\.com\//, r=>r.continue({headers:{...r.request().headers(),'x-conestruct-gate':TOK}}));
}
