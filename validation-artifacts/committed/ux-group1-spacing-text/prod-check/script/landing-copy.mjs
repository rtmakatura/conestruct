// #435 production check: the landing's copy as served (check 7).
// usage: node landing-copy.mjs <origin> <out.json>; gate header from SHOT_TOKEN (never printed).
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [ORIGIN, OUT] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-conestruct-gate': process.env.SHOT_TOKEN ?? '' } })).newPage();
await p.goto(ORIGIN + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForSelector('.a-open .a-head');
const t = (q) => p.evaluate((q) => { const e = document.querySelector(q); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, q);
const out = {
  strip: await t('.status-bar'),
  whereHelper: await t('[data-testid=band-where] .a-question-prov'),
  whereHeaderHint: await t('[data-testid=band-where] .a-head .a-prov'),
  whatLine: await t('[data-testid=fact-what] .a-fact-prov'),
  generateReason: await t('[data-testid=cta-reason]'),
  generateCaption: await t('[data-testid=generate-caption]'),
  footerLine: await t('[data-testid=draft-notice]'),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
await b.close();
