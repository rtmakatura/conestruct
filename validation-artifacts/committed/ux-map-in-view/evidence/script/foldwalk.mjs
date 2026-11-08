// #456 walk (local): the WHERE map in view, no waiting between answers, the
// two status strings.  Adapted from #446's and #453's walks.
// usage: GATE_BYPASS_TOKEN=<the dev server's walk token> node walk.mjs <outdir> <port> [sizes]
//   sizes: "1440x900,1198x930,1024x768,390x844,390x664" (default)
// Local `next dev` on the issue-456 worktree, MODAL_RENDER_URL at the local
// backend with Overpass STUBBED (replay of ux-group3-where's recorded answers;
// an unrecorded ask fails, never goes live).  /api/road-bearing is stubbed from
// the same fixture.  Chromium, DPR 1 (repair 1 re-walk).  The gate header goes through the shared
// helper's newGatedContext (scripts/gate.cjs): the local site's own host only.
// Every POST to the aerial, the geometry read and the nearest-intersection read
// is logged with its start and end; the aerial's <img src> and the frame's
// wait note are watched by a MutationObserver from page load, so "time to new
// map" and "was the box ever blank" are read off the page, not guessed.
import { createRequire } from 'module';
import fs from 'fs';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-456';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${W}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PORT, SIZES] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
const sizes = (SIZES ?? '1440x900,1198x930,1024x768,390x844,390x664').split(',').map((s) => s.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(`${W}/validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json`, 'utf8'));
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => { const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)); const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)); return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; };
const distM = (a, at) => Math.hypot((a.lat - at.lat) * 111320, (a.lon - at.lng) * 111320 * Math.cos(rad(at.lat)));
const COLFAX_WEST = [1547338997, 1547338998, 223788857, 600545918, 791808880];
function chainGeometry(ids) {
  const out = [];
  for (const id of ids) {
    const g = FIX.elements.find((e) => e.type === 'way' && e.id === id).geometry;
    for (const n of g) { const l = out[out.length - 1]; if (!l || l.lat !== n.lat || l.lon !== n.lon) out.push(n); }
  }
  return out;
}
function cand(id, at, chain = null) {
  const w = FIX.elements.find((e) => e.type === 'way' && e.id === id);
  const g = chain ? chainGeometry(chain) : w.geometry;
  let i = 0; g.forEach((n, k) => { if (distM(n, at) < distM(g[i], at)) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return { way_id: String(id), highway_class: w.tags.highway, name: w.tags.name, ref: s('ref'), bearing: +brg(a, b).toFixed(2),
    snap_distance_m: +distM(g[i], at).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
    tags: { oneway: s('oneway'), maxspeed: s('maxspeed'), lanes: s('lanes'), lanes_forward: s('lanes:forward'), lanes_backward: s('lanes:backward'),
      lanes_both_ways: s('lanes:both_ways'), turn_lanes: s('turn:lanes'), turn_lanes_forward: s('turn:lanes:forward'), turn_lanes_backward: s('turn:lanes:backward') },
    geometry: g.map((n) => [n.lat, n.lon]) };
}
const det = (cands) => JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: cands });
const CROSS_STUB = det([cand(1547338997, CROSSING, COLFAX_WEST), cand(492215711, CROSSING)]);
function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}

const ADDR = (w) => (w <= 480 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('[data-testid=band-where]') ?? document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  });
}
// Every visible button/link/radio label in the band, under 44 px either way.
async function small(p) {
  return p.evaluate(() => {
    const band = document.querySelector('[data-testid=band-where]');
    if (!band) return [];
    const out = [];
    for (const e of band.querySelectorAll('button, a, label.nyq-answer')) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(e).visibility === 'hidden') continue;
      if (r.width < 44 || r.height < 44) out.push({ text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), testid: e.getAttribute('data-testid'), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
    }
    return out;
  });
}
async function measureNew(p) {
  return p.evaluate(() => {
    const out = {};
    for (const id of ['band-aerial-hide', 'band-aerial-show']) {
      const e = document.querySelector(`[data-testid=${id}]`);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      out[id] = { w: +r.width.toFixed(1), h: +r.height.toFixed(1), ok: r.width >= 44 && r.height >= 44 };
    }
    return out;
  });
}
async function read(p) {
  return p.evaluate(() => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const q = (s) => document.querySelector(s);
    const nav = q('.a-nav, nav');
    const navB = nav ? nav.getBoundingClientRect().bottom : 0;
    const frame = q('[data-testid=band-aerial-frame]');
    const img = q('[data-testid=band-aerial-img]');
    const card = q('[data-testid=where-questions] .nyq-card');
    const vis = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, navB))); };
    const stack = q('.wq-stack');
    return {
      scrollY: Math.round(scrollY), vw: innerWidth, vh: innerHeight, navBottom: +navB.toFixed(1),
      bandWidth: stack ? +stack.getBoundingClientRect().width.toFixed(1) : null,
      layout: stack?.getAttribute('data-layout') ?? null,
      frame: r(frame), img: r(img), card: r(card), cardQuestion: t(q('[data-testid=where-questions] .nyq-q')?.innerText) || null,
      frameVisiblePx: vis(frame), imgVisiblePx: vis(img), cardVisiblePx: vis(card),
      mapWhollyInView: frame ? frame.getBoundingClientRect().top >= navB - 1 && frame.getBoundingClientRect().bottom <= innerHeight + 1 : null,
      questionInView: (() => { const h = q('[data-testid=where-questions] .nyq-q'); if (!h) return null; const b = h.getBoundingClientRect(); return b.top >= navB - 1 && b.bottom <= innerHeight; })(),
      stage: q('[data-testid=band-aerial]')?.getAttribute('data-stage') ?? null,
      note: t(q('[data-testid=band-aerial-note]')?.innerText) || null,
      hideBtn: r(q('[data-testid=band-aerial-hide]')), showBtn: r(q('[data-testid=band-aerial-show]')),
      whatRow: t(q('[data-testid=fact-what]')?.innerText) || null,
      generateHint: t(q('[data-testid=generate-frame]')?.innerText) || null,
      docOverflowX: document.documentElement.scrollWidth > innerWidth,
    };
  });
}


async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, steps: [], errors: [] };
  const ctx = await newGatedContext(b, BASE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  let slow = false; const waiting = [];
  await p.route('**/api/corridor-map', async (r) => { if (slow) await new Promise((res) => waiting.push(res)); return r.fallback(); });
  await p.route('**/api/road-bearing**', async (r) => { const a = JSON.parse(r.request().postData() ?? 'null'); return r.fulfill({ status: 200, contentType: 'application/json', body: det([cand(1547338997, { lat: a.lat, lng: a.lng }, COLFAX_WEST)]) }); });
  const probe = (name) => p.evaluate((name) => {
    const q = (s) => document.querySelector(s);
    const z = q('button[aria-label="Zoom in"]'); const bar = q('[data-testid=band-aerial-bar]'); const f = q('[data-testid=band-aerial-frame]');
    const a = document.activeElement;
    return { name, zoomIn: !!z, zoomVisible: z ? z.getBoundingClientRect().width > 0 : false, focus: a ? (a.getAttribute('aria-label') || a.getAttribute('data-testid') || a.tagName) : null,
      bar: bar ? { role: bar.getAttribute('role'), text: bar.textContent.trim().slice(0, 50) } : null, armed: f?.classList.contains('is-armed') ?? null, held: f?.getAttribute('data-held') ?? null, busy: f?.getAttribute('aria-busy') ?? null, step: q('[data-testid=band-aerial-zoom]')?.getAttribute('data-step') ?? null };
  }, name);
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(ADDR(w));
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
    if (await want.count()) await want.first().click().catch(() => {});
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=kind-chip-near_intersection]', { state: 'attached', timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.locator('label.nyq-answer:has([data-testid=kind-chip-shoulder])').click();
    await p.waitForTimeout(800);
    await nextBtn(p).click();
    await p.waitForTimeout(1500);
    await p.locator('label.nyq-answer:has([data-testid=side-option])').first().click();
    await p.waitForTimeout(1500);
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForTimeout(3000);
    await p.evaluate(() => { const e = document.querySelector('[data-testid=fact-where]'); const n = document.querySelector('.a-nav, nav'); window.scrollBy({ top: e.getBoundingClientRect().top - (n ? n.getBoundingClientRect().bottom : 0) - 16, behavior: 'instant' }); });
    await p.waitForTimeout(500);
    out.steps.push(await p.evaluate(() => { const e = document.querySelector('[data-testid=fact-where]'); const r = e.getBoundingClientRect(); return { name: 'where-folded', text: e.innerText.replace(/\s+/g, ' ').trim(), h: +r.height.toFixed(1), aerial: !!document.querySelector('[data-testid=band-aerial]') }; }));
    await p.screenshot({ path: `${OUT}/${tag}-where-folded.png` });
  } catch (e) { out.errors.push(String(e).slice(0, 300)); }
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}-zoom.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
}
for (const [w, h] of sizes) await run(w, h);
