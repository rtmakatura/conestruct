// #407 fold-in: the dismiss-reason chip's mark, measured on a replica.
// usage: node measure-reason.mjs <outdir> <port>
// The real chip appears only after a live site scan reports a condition, so
// this injects the chip's markup (NeedsYouConditions.tsx's own classes)
// inside the live page's `.workbench`, wrapped in `.needs-you .sc-picker`,
// and reads computed styles.  The CSS rules that colour it are the same on
// base and this branch except `.sym-select` (added), so the "before" markup
// (✓, no class) and "after" markup (●, sym-select) are measured on one page.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const res = {};
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/sandbox`, { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.workbench', { timeout: 120000 });
  res[w] = await p.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const wb = document.querySelector('.workbench');
    const out = {};
    for (const [phase, glyph, cls] of [['before', '✓', 'reason-glyph'], ['after', '●', 'reason-glyph sym-select']]) {
      const host = document.createElement('div');
      host.className = 'needs-you';
      host.innerHTML = `<div class="sc-picker"><fieldset class="site-correction-reasons"><label class="reason-chip chosen"><input type="radio" checked><span class="${cls}" aria-hidden="true">${glyph}</span><span class="reason-text">Removed</span></label></fieldset></div>`;
      wb.appendChild(host);
      const g = host.querySelector('.reason-glyph');
      const chain = []; for (let e = g; e; e = e.parentElement) chain.push(e);
      let gr = { r: 255, g: 255, b: 255 };
      for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) gr = { r: c.r * c.a + gr.r * (1 - c.a), g: c.g * c.a + gr.g * (1 - c.a), b: c.b * c.a + gr.b * (1 - c.a) }; }
      const fg = parse(getComputedStyle(g).color);
      const L1 = lum(fg), L2 = lum(gr);
      const t = host.querySelector('.reason-text').getBoundingClientRect();
      out[phase] = { glyph, color: getComputedStyle(g).color, label: getComputedStyle(host.querySelector('.reason-text')).color,
        ground: `rgb(${gr.r.toFixed(1)}, ${gr.g.toFixed(1)}, ${gr.b.toFixed(1)})`,
        contrast: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100,
        glyphCellWidth: Math.round(g.getBoundingClientRect().width * 100) / 100, labelLeftInChip: Math.round((t.left - host.querySelector('.reason-chip').getBoundingClientRect().left) * 100) / 100 };
      host.remove();
    }
    return out;
  });
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/measurements-reason-chip.json`, JSON.stringify({ about: 'Replica of the chosen dismiss-reason chip injected into the live .workbench (see script/measure-reason.mjs); not a captured live chip.', AA_floor: 4.5, ...res }, null, 1));
console.log(JSON.stringify(res));
