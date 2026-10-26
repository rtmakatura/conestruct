// #412 — vertical centre of the selection ● vs its label's body middle, on
// the four controls, plus before/after shots.
// PROD CHECK copy: drives the LIVE https://www.conestruct.com/sandbox, real road-bearing (no stub).
// usage: node prodcheck412.mjs <outdir> [address for site-scan]
// Method (pixel, DPR 2): the control is screenshotted with and without the ●
// (its colour forced transparent); the differing pixels are the ●'s ink.
// The label's text is then swapped for "xxxx" (same font, same line) and
// screenshotted with and without the label ink; the differing pixels are the
// x-height band (cap-height on the dismiss-reason chip, which is uppercased).
// offset = ●'s ink centre − band centre, CSS px, + = the ● sits lower.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [OUT, SCANADDR] = process.argv.slice(2);
const phase = 'prod';
const ENV = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/.env.local', 'utf8');
const TOK = ((ENV.match(/^GATE_BYPASS_TOKEN=(.*)$/m) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
if (!TOK) { console.log('no token'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const CAND = { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', ref: null, bearing: 90, snap_distance_m: 5,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null,
  tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null,
    oneway: 'yes', maxspeed: '30 mph', lanes: '3' } };
// (stub unused on prod)
const STUB_UNUSED = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [CAND] });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
const css = (p, text) => p.evaluate((t) => { let s = document.getElementById('probe412'); if (!s) { s = document.createElement('style'); s.id = 'probe412'; document.head.appendChild(s); } s.textContent = t; }, text);

async function diffRows(p, a, b) {
  return p.evaluate(async ([A, B]) => {
    const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const da = await load(A), db = await load(B);
    const W = da.width, H = da.height;
    let top = null, bottom = null, left = null, right = null, sw = 0, swy = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const d = Math.abs(da.data[o] - db.data[o]) + Math.abs(da.data[o + 1] - db.data[o + 1]) + Math.abs(da.data[o + 2] - db.data[o + 2]);
      if (d > 24) { // CHOSEN: > 24 summed channel levels = ink, below = rasterisation noise
        if (top === null) top = y; bottom = y;
        left = left === null ? x : Math.min(left, x); right = right === null ? x : Math.max(right, x);
        sw += d; swy += d * (y + 0.5);
      }
    }
    if (top === null) return null;
    // device px -> CSS px (DPR 2)
    return { topPx: top / 2, bottomPx: (bottom + 1) / 2, leftPx: left / 2, rightPx: (right + 1) / 2,
      centrePx: (top + bottom + 1) / 4, centroidPx: swy / sw / 2 };
  }, [a.toString('base64'), b.toString('base64')]);
}

// root: the control box; hide: CSS that hides the mark; label: the label element; reasonChip: uppercase
async function measure(p, name, root, hide, label, file) {
  await p.locator(root).first().scrollIntoViewIfNeeded();
  await park(p);
  const r = await p.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, root);
  const vw = p.viewportSize().width;
  const clip = { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: Math.min(r.w + 16, vw - Math.max(0, r.x - 8)), height: r.h + 16 };
  await css(p, '');
  const A = await p.screenshot({ clip });
  fs.writeFileSync(`${OUT}/${phase}-${CURW}-${name}.png`, A);
  await css(p, hide);
  const B = await p.screenshot({ clip });
  const mark = await diffRows(p, A, B);
  // label position (first glyph of the label's words), for movement
  const lab = await p.evaluate((s) => {
    const el = document.querySelector(s);
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let last = null; for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.textContent.trim() && !n.parentElement.className.toString().includes('sym-select')) last = n;
    const rg = document.createRange(); const i = last.textContent.search(/\S/); rg.setStart(last, i); rg.setEnd(last, last.textContent.length);
    const q = rg.getBoundingClientRect();
    // swap the label's words for x's, keep the original to restore
    const saved = last.textContent; window.__probeSaved = [last, saved];
    last.textContent = saved.replace(/\S+/g, (w) => 'x'.repeat(w.length));
    return { left: q.left, top: q.top, right: q.right, bottom: q.bottom, text: saved.trim() };
  }, label);
  await css(p, hide);
  const C = await p.screenshot({ clip });
  await css(p, hide + `\n${label} { color: transparent !important; }`);
  const D = await p.screenshot({ clip });
  await p.evaluate(() => { const [n, t] = window.__probeSaved; n.textContent = t; });
  await css(p, '');
  const band = await diffRows(p, C, D);
  const contrast = await p.evaluate(([s]) => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const [sel, ps] = s;
    const el = document.querySelector(sel); const fg = parse(getComputedStyle(el, ps).color);
    const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let g = { r: 255, g: 255, b: 255 };
    for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) g = { r: c.r * c.a + g.r * (1 - c.a), g: c.g * c.a + g.g * (1 - c.a), b: c.b * c.a + g.b * (1 - c.a) }; }
    const L1 = lum(fg), L2 = lum(g);
    return { color: getComputedStyle(el, ps).color, ground: `rgb(${g.r.toFixed(1)}, ${g.g.toFixed(1)}, ${g.b.toFixed(1)})`, ratio: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100 };
  }, [MARKEL[name]]);
  const rel = (v) => (v == null ? null : Math.round(v * 100) / 100);
  return {
    clipTopPx: rel(clip.y), mark, band,
    offsetPx: mark && band ? rel(mark.centrePx - band.centrePx) : null,
    offsetCentroidPx: mark && band ? rel(mark.centroidPx - band.centroidPx) : null,
    markLeftAbsPx: mark ? rel(clip.x + mark.leftPx) : null, markTopAbsPx: mark ? rel(clip.y + mark.topPx) : null,
    label: { text: lab.text, left: rel(lab.left), top: rel(lab.top), relTop: rel(lab.top - r.y), relLeft: rel(lab.left - r.x) },
    controlBox: { x: rel(r.x), y: rel(r.y), w: rel(r.w), h: rel(r.h) },
    contrast,
  };
}
const MARKEL = {}; let CURW = 0;

const M = {};
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  // gate header only on first-party requests (never sent to third-party hosts)
  await ctx.route(/^https:\/\/(www\.)?conestruct\.com\//, (q) => q.continue({ headers: { ...q.request().headers(), 'x-conestruct-gate': TOK } }));
  const p = await ctx.newPage();
  const out = {}; CURW = w;
  try {
    await p.goto(`https://www.conestruct.com/sandbox`, { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(SCANADDR || '1600 E Colfax Ave, Denver');
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
    await p.getByRole('dialog').getByRole('button', { name: new RegExp(process.env.ROADRE || 'Colfax', 'i') }).first().click();
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
    await p.locator('[data-testid=side-option]').first().click();
    await p.waitForSelector('[data-testid=kind-chip-shoulder]', { timeout: 60000 });
    await p.locator('[data-testid=kind-chip-shoulder]').click();
    await p.waitForTimeout(800);
    await p.evaluate(() => document.fonts.ready);
    const side = '[data-testid=side-option][aria-checked="true"]';
    MARKEL['side-chip'] = [`${side} .tr-field > .sym-select`, null];
    out.sideChip = await measure(p, `${w}-side-chip`.replace(/^\d+-/, '') && 'side-chip', side, `${side} .sym-select { color: transparent !important; }`, `${side} .tr-field`);
    const kind = '[data-testid=kind-chip-shoulder]';
    MARKEL['kind-chip'] = [`${kind} > .tr-field`, '::after'];
    out.kindChip = await measure(p, 'kind-chip', kind, `${kind} > .tr-field::after { color: transparent !important; }`, `${kind} > .tr-field`);
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-night]', { timeout: 90000 });
    await p.waitForTimeout(2500);
    const seg = '[data-testid=cell-night] button[aria-pressed="true"]';
    MARKEL['segmented'] = [`${seg} > .a-seg-label`, '::before'];
    out.segmented = await measure(p, 'segmented', seg, `${seg} > .a-seg-label::before { color: transparent !important; }`, `${seg} > .a-seg-label`);
    // Real site-scan hit only (no injection): Generate, then look for a detected row's Dismiss.
    out.buttonsBefore = await p.$$eval('button', (bs) => bs.map((b) => b.innerText.trim()).filter(Boolean).slice(0, 80));
    const gen = p.getByRole('button', { name: /^Generate/i }).first();
    if (await gen.count()) { await gen.click(); }
    await p.waitForTimeout(15000);
    await p.waitForFunction(() => !/SCANNING/i.test(document.body.innerText), null, { timeout: 90000 }).catch(() => {});
    const dis = p.getByRole('button', { name: /^Dismiss$/i });
    out.dismissCount = await dis.count();
    out.siteText = await p.evaluate(() => { const z = document.querySelector('.needs-you'); return z ? z.innerText.slice(0, 1500) : null; });
    if (out.dismissCount > 0) {
      await dis.first().scrollIntoViewIfNeeded();
      await dis.first().click();
      await p.waitForSelector('.site-correction-reasons .reason-chip', { timeout: 20000 });
      await p.locator('.site-correction-reasons .reason-chip').first().click();
      await p.waitForSelector('.site-correction-reasons .reason-chip.chosen', { timeout: 10000 });
      await p.evaluate(() => { document.querySelector('.site-correction-reasons .reason-chip.chosen').id = 'probe412-chip'; });
      MARKEL['reason-chip'] = ['#probe412-chip .reason-glyph', null];
      out.reasonChip = await measure(p, 'reason-chip', '#probe412-chip', '#probe412-chip .reason-glyph { color: transparent !important; }', '#probe412-chip .reason-text');
      out.reasonChip.injected = false;
    } else { out.reasonChip = null; await p.screenshot({ path: `${OUT}/prod-${w}-no-scan-hit.png`, fullPage: false }).catch(() => {}); }
  } catch (e) { out.error = String(e).slice(0, 400); await p.screenshot({ path: `${OUT}/${phase}-${w}-error.png` }).catch(() => {}); }
  M[w] = out;
  await ctx.close();
}
await b.close();
// screenshots were written per control without the width; rename handled by caller
fs.writeFileSync(`${OUT}/measurements-${phase}.json`, JSON.stringify(M, null, 1));
for (const [w, o] of Object.entries(M)) console.log(w, o.error ?? '', 'dismiss=', o.dismissCount, ['sideChip','kindChip','segmented','reasonChip'].map((k) => k + ':' + (o[k] ? o[k].offsetCentroidPx + '/' + o[k].contrast.ratio : 'none')).join(' '));
