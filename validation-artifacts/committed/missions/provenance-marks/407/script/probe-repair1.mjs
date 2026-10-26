// #407 repair cycle 1.  usage: node probe-repair1.mjs <outdir> <port>
// (1) The dismiss-reason chip's real ground: NeedsYou mounts as a sibling of
//     [data-testid=results-placeholder] (GeneratorShell.tsx, the
//     `resultsVisible && <NeedsYou …>` block), so the chip is injected there
//     with NeedsYou's own structure (section.needs-you > ul.ny-items >
//     li.ny-item.ny-sub.site-correction-picker > .ny-mid > .sc-picker >
//     fieldset > label.reason-chip.chosen), with and without .owns-primary,
//     and every ancestor's computed background is recorded.
// (2) The segmented ●'s vertical centre vs its label's: the pressed Hours
//     option is screenshotted and its blue (mark) and light (label) ink rows
//     are found by pixel.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const CAND = { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', ref: null, bearing: 90, snap_distance_m: 5,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null,
  tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null,
    oneway: 'yes', maxspeed: '30 mph', lanes: '3' } };
const STUB = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [CAND] });

const MEASURE_CHIP = (glyphMode) => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const cr = (a, b) => { const A = lum(a), B = lum(b); return Math.round(((Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05)) * 100) / 100; };
  const parent = document.querySelector('.zone.results');
  const out = {};
  for (const primary of [false, true]) {
    const sec = document.createElement('section');
    sec.className = `needs-you jump-anchor outline-none${primary ? ' owns-primary' : ''}`;
    sec.innerHTML = `<ul class="ny-items"><li class="ny-item ny-sub site-correction-picker"><span class="ny-glyph" aria-hidden="true"></span><div class="ny-mid"><div class="sc-picker"><fieldset class="site-correction-reasons" role="radiogroup"><legend>Reason</legend><label class="reason-chip chosen"><input type="radio" checked><span class="reason-glyph sym-select" aria-hidden="true">●</span><span class="reason-text">Removed</span></label></fieldset></div></div></li></ul>`;
    parent.appendChild(sec);
    const g = sec.querySelector('.reason-glyph');
    const chain = []; for (let e = g; e; e = e.parentElement) chain.push(e);
    const bgs = chain.map((e) => ({ el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''), bg: getComputedStyle(e).backgroundColor })).filter((x) => parse(x.bg).a > 0);
    let gr = { r: 255, g: 255, b: 255 };
    for (const e of chain.slice().reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) gr = { r: c.r * c.a + gr.r * (1 - c.a), g: c.g * c.a + gr.g * (1 - c.a), b: c.b * c.a + gr.b * (1 - c.a) }; }
    const act = { r: 52, g: 169, b: 232 }, actBright = { r: 86, g: 188, b: 242 };
    out[primary ? 'ownsPrimary' : 'plain'] = {
      paintedAncestors: bgs,
      ground: `rgb(${gr.r.toFixed(1)}, ${gr.g.toFixed(1)}, ${gr.b.toFixed(1)})`,
      glyphColor: getComputedStyle(g).color,
      contrastGlyph: cr(parse(getComputedStyle(g).color), gr),
      contrastActOnGround: cr(act, gr),
      contrastActBrightOnGround: cr(actBright, gr),
    };
    sec.remove();
  }
  return out;
};

async function inkRows(p, sel) {
  // The label's own box, widened 24 px left for a leading mark and 24 px
  // right for a trailing one; the chip's border stays outside the clip.
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250);
  const r = await el.evaluate((e) => { const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; });
  const buf = await p.screenshot({ clip: { x: r.x - 24, y: r.y, width: r.w + 48, height: r.h } });
  return p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const blue = [], light = [];
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) {
      const o = (y * c.width + i) * 4, r = d[o], g = d[o + 1], bl = d[o + 2];
      if (bl > 180 && r < 110 && g > 120 && g < 200) blue.push([i, y]);
      else if (r > 170 && g > 170 && bl > 170) light.push([i, y]);
    }
    const ext = (pts) => pts.length ? { top: Math.min(...pts.map((q) => q[1])), bottom: Math.max(...pts.map((q) => q[1])) } : null;
    const B = ext(blue), L = ext(light);
    // DPR 2: halve to CSS px.  Label ink rows include ascenders/descenders
    // ("Daytime": D cap, y descender); its x-height middle is reported by the
    // caller's eye in the shots; here: the centres of both extents.
    return { dpr2: { mark: B, label: L }, markCentrePx: B ? (B.top + B.bottom) / 4 : null, labelCentrePx: L ? (L.top + L.bottom) / 4 : null,
      offsetPx: B && L ? Math.round((((B.top + B.bottom) - (L.top + L.bottom)) / 4) * 100) / 100 : null };
  }, buf.toString('base64'));
}

const res = {};
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const r = {};
  try {
    await p.route('**/api/road-bearing**', (q) => q.fulfill({ status: 200, contentType: 'application/json', body: STUB }));
    await p.goto(`http://localhost:${PORT}/sandbox`, { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
    await p.getByRole('dialog').getByRole('button', { name: /Colfax/i }).first().click();
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
    await p.locator('[data-testid=side-option]').first().click();
    await p.locator('[data-testid=kind-chip-shoulder]').click();
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-night]', { timeout: 90000 });
    await p.waitForTimeout(2500);
    await p.waitForSelector('.zone.results', { state: 'attached', timeout: 30000 });
    r.reasonChip = await p.evaluate(MEASURE_CHIP);
    r.segInk = await inkRows(p, '[data-testid=cell-night] button[aria-pressed="true"] > .a-seg-label');
  } catch (e) { r.error = String(e).slice(0, 300); }
  res[w] = r;
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/repair1-probe.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
