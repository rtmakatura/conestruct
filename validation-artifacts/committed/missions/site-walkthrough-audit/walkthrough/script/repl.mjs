import {chromium,webkit,firefox,devices,TOK,dump,gate} from './lib.mjs';
import fs from 'fs';
const mobile = process.argv[2]==='m';
const eng={c:chromium,w:webkit,f:firefox}[process.argv[3]||'c']; const b = await eng.launch();
const opts = mobile ? {viewport:{width:390,height:844},isMobile:process.argv[3]!=='f',hasTouch:true,deviceScaleFactor:2,acceptDownloads:true} : {viewport:{width:1440,height:900},acceptDownloads:true};
const ctx = await b.newContext(opts); await gate(ctx);
const p = await ctx.newPage();
globalThis.p=p; globalThis.ctx=ctx; globalThis.dump=dump; globalThis.fs=fs;
const tag = process.argv[4]||(mobile?'m':'d');
const net=[]; globalThis.net=net;
p.on('response',r=>{const u=r.url(); if(u.includes('conestruct.com/api')) net.push(`${r.status()} ${r.request().method()} ${u.replace(/^https:\/\/www.conestruct.com/,'')} ${r.headers()['content-type']||''}`)});
const dir='cmd/'+tag;
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/ready','1');
while(true){
  const f=dir+'/in.js';
  if(fs.existsSync(f)){
    const code=fs.readFileSync(f,'utf8'); fs.unlinkSync(f);
    let out;
    try{ out = await (new Function('return (async()=>{'+code+'})()'))(); }catch(e){ out='ERR '+String(e.message).replace(TOK,'X').slice(0,800); }
    fs.writeFileSync(dir+'/out.txt', typeof out==='string'?out:String(JSON.stringify(out,null,1)));
    fs.writeFileSync(dir+'/done','1');
    if(code.includes('__quit')) break;
  }
  await new Promise(r=>setTimeout(r,200));
}
await b.close();
