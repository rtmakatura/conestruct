// #470: makes the committed crops from walk470.mjs's screenshots, each at
// half size (a small PNG for Ryan's hand check).  Local files only, no
// network.  usage: node crops470.mjs <walk-out-dir> <crops-dir> <name>...
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [SRC, OUT, ...names] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
await p.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
for (const n of names) {
  const f = path.join(SRC, n);
  if (!fs.existsSync(f)) { console.log('missing', n); continue; }
  const data = fs.readFileSync(f).toString('base64');
  await p.setContent(`<body style="margin:0"><img id=i src="data:image/png;base64,${data}"></body>`);
  const { w, h } = await p.evaluate(async () => { const i = document.getElementById('i'); await i.decode(); return { w: i.naturalWidth, h: i.naturalHeight }; });
  await p.setViewportSize({ width: Math.ceil(w / 2), height: Math.ceil(h / 2) });
  await p.evaluate((w) => { const i = document.getElementById('i'); i.style.width = `${w / 2}px`; i.style.display = 'block'; }, w);
  await p.screenshot({ path: path.join(OUT, n), clip: { x: 0, y: 0, width: Math.ceil(w / 2), height: Math.ceil(h / 2) } });
  console.log('crop', n);
}
await b.close();
