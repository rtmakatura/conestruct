// #410 (round 4) before/after shots: the landing page's HOW IT WORKS step 1.
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev`: a git archive of 28b2d17 for "before", the issue-410
// worktree for "after".  Playwright Chromium at DPR 2, 1440x900 and 390x844.
// `/` is public (no gate token).  Reduced motion is emulated so the reveal
// animations settle at once; the step is shot after it scrolls into view.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

async function run(w, h) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  try {
    await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 180000 });
    const step = p.locator('#how .lv-step').first();
    await step.scrollIntoViewIfNeeded();
    await p.waitForTimeout(3500);
    const bb = await step.boundingBox();
    const pad = 16;
    await p.screenshot({ path: `${OUT}/${phase}-step1-${w}.png`, clip: { x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad), width: Math.min(bb.width + 2 * pad, w), height: bb.height + 2 * pad } });
    const para = step.locator('p');
    const pb = await para.boundingBox();
    const info = await para.evaluate((e) => {
      const cs = getComputedStyle(e);
      return { text: e.textContent, color: cs.color, lineHeight: cs.lineHeight, opacity: cs.opacity };
    });
    const lh = parseFloat(info.lineHeight);
    return { step: { width: +bb.width.toFixed(2), height: +bb.height.toFixed(2) }, paragraph: { ...info, width: +pb.width.toFixed(2), height: +pb.height.toFixed(2), lines: Number.isFinite(lh) ? Math.round(pb.height / lh) : null } };
  } finally {
    await b.close();
  }
}

const out = {};
for (const [w, h] of [[1440, 900], [390, 844]]) out[w] = await run(w, h);
fs.writeFileSync(`${OUT}/text-${phase}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
