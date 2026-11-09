// #469 crops: one contact sheet per size, every walked CONFIRM state's band
// side by side at a fixed scale, each captioned with its measured band
// height, so equal heights read as one line of equal boxes.  Also writes
// single crops at half scale for the states named.  Local files only, no
// network.  usage: node sheet469.mjs <walkdir> <outdir> <label> [scale] [singles]
//   singles: comma-separated step names (e.g. "kind-question,side-question")
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [DIR, OUT, LABEL, SCALE, SINGLES] = process.argv.slice(2);
const scale = Number(SCALE || 0.25);
const singles = (SINGLES || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: 1, viewport: { width: 1600, height: 900 } });
// Nothing leaves the machine: every request but the data the page is handed is refused.
await p.route('**/*', (r) => (r.request().url().startsWith('data:') ? r.continue() : r.abort()));
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const size = f.replace('.json', '');
  const j = JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'));
  const cells = j.steps.map((s) => ({ name: s.name, h: s.band?.h, src: `data:image/png;base64,${fs.readFileSync(`${DIR}/${s.shot}`).toString('base64')}` }));
  const html = `<body style="margin:8px;font:12px system-ui;background:#fff;color:#111">
    <div style="font-weight:600;margin-bottom:6px">${LABEL} ${size}: the WHERE band per CONFIRM state, scale ${scale}, measured band height in px</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">${cells
      .map((c) => `<figure style="margin:0"><img src="${c.src}" style="display:block;zoom:${scale};outline:1px solid #888"><figcaption>${c.name}<br><b>${c.h}</b></figcaption></figure>`)
      .join('')}</div></body>`;
  await p.setContent(html);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${LABEL}-${size}-sheet.png`, fullPage: true });
  for (const s of j.steps.filter((x) => singles.includes(x.name))) {
    const src = `data:image/png;base64,${fs.readFileSync(`${DIR}/${s.shot}`).toString('base64')}`;
    await p.setContent(`<body style="margin:0"><img id="i" src="${src}" style="display:block;zoom:0.5"></body>`);
    await p.waitForTimeout(150);
    await p.locator('#i').screenshot({ path: `${OUT}/${LABEL}-${size}-${s.name}.png` });
  }
}
await b.close();
