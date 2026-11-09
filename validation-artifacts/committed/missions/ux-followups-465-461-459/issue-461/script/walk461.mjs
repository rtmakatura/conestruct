// #461 walk (local): is each CONFIRM question's heading and its first line
// below the 390 strip, measured against the strip (not the nav)?  And at the
// desktop sizes, is the aerial whole on every question?  Adapted from #456's
// walk.mjs (same steps, same stubs) after #460's landing.
// usage: WALK_SECRETS_DIR=<dir> node walk461.mjs <outdir> <port> [sizes]
//   sizes: "390x844,390x664,1440x900,1198x930,1024x768" (default)
// Local `next dev` on the issue-461 worktree, MODAL_RENDER_URL at the local
// backend with Overpass STUBBED (replay of ux-group3-where's recorded
// answers); /api/road-bearing stubbed from the same fixture.  Chromium, DPR 1.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-461';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
if (!process.env.GATE_BYPASS_TOKEN) {
  process.env.GATE_BYPASS_TOKEN = JSON.parse(fs.readFileSync(path.join(process.env.WALK_SECRETS_DIR, 'walk-secrets.json'), 'utf8')).gate;
}
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const [OUT, PORT, SIZES] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
const sizes = (SIZES ?? '390x844,390x664,1440x900,1198x930,1024x768').split(',').map((s) => s.split('x').map(Number));
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

// The measure #456's walk lacked: the cover is whatever is pinned under the
// nav right now (the strip, or the Show map row), read off the page; the
// heading and the sentence's first line must sit below its bottom edge and
// above the window's.
async function read(p) {
  return p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const nav = q('.a-nav, nav');
    const navB = nav ? nav.getBoundingClientRect().bottom : 0;
    const stuck = (e) => {
      if (!e) return null;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.position !== 'sticky') return null;
      const b = e.getBoundingClientRect();
      return Math.abs(b.top - navB) <= 1 ? b.bottom : null;
    };
    const frame = q('[data-testid=band-aerial-frame]');
    const showrow = q('.a-aerial-showrow');
    const cover = Math.max(navB, stuck(frame) ?? 0, stuck(showrow) ?? 0);
    const h = q('[data-testid=where-questions] .nyq-q');
    const why = q('[data-testid=where-questions] .nyq-why');
    const hb = h?.getBoundingClientRect();
    const wb = why?.getBoundingClientRect();
    const lh = why ? parseFloat(getComputedStyle(why).lineHeight) || 20 : 0;
    const fb = frame?.getBoundingClientRect();
    return {
      y: Math.round(scrollY), navB: Math.round(navB), cover: Math.round(cover),
      q: (h?.innerText ?? '').trim().slice(0, 44) || null,
      qTop: hb ? +hb.top.toFixed(1) : null, qBottom: hb ? +hb.bottom.toFixed(1) : null,
      whyTop: wb ? +wb.top.toFixed(1) : null,
      headingClear: hb ? hb.top >= cover - 0.5 && hb.bottom <= innerHeight + 0.5 : null,
      firstLineClear: wb ? wb.top >= cover - 0.5 && wb.top + lh <= innerHeight + 0.5 : null,
      frame: fb ? `${fb.top.toFixed(1)}..${fb.bottom.toFixed(1)}` : null,
      aerialWhole: fb ? fb.top >= navB - 1 && fb.bottom <= innerHeight + 1 : null,
      tap: q('.wq-stack')?.hasAttribute('data-tap') ?? null,
      mapHidden: q('.wq-stack')?.getAttribute('data-map') === 'hidden',
    };
  });
}

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, steps: [], errors: [], cls: null };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await newGatedContext(b, BASE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__cls = [];
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__cls.push({ at: Math.round(e.startTime), value: e.value, recent: e.hadRecentInput }); })
        .observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  let crossMode = false;
  await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    const body = crossMode ? CROSS_STUB : det([cand(1547338997, { lat: asked.lat, lng: asked.lng }, COLFAX_WEST)]);
    return r.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const step = async (name, extra = {}, { shot = true } = {}) => {
    const s = { name, ...extra, ...(await read(p)) };
    if (shot) { s.shot = `${tag}-${nn()}-${name}.png`; await p.screenshot({ path: `${OUT}/${s.shot}` }); }
    out.steps.push(s);
    console.log(tag, name.padEnd(22), 'y', s.y, 'cover', s.cover, 'q', s.qTop, 'why', s.whyTop, 'clear', s.headingClear, s.firstLineClear, 'frame', s.frame, 'whole', s.aerialWhole);
    return s;
  };
  const pick = async (testid) => { await p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click(); };
  const pinAndSave = async () => {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(ADDR(w));
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
    if (await want.count()) await want.first().click().catch(() => {});
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
    await p.waitForSelector('[data-testid=band-aerial-img]', { timeout: 60000 });
    await p.waitForTimeout(2500);
  };
  try {
    await pinAndSave();
    await step('01-kind-question');
    await pick('kind-chip-flagger_lane_closure');
    await p.waitForTimeout(2500);
    await step('02-kind-answered');
    await pick('kind-chip-shoulder');
    await p.waitForTimeout(2500);
    await nextBtn(p).click();
    await p.waitForTimeout(2500);
    await step('03-side-question');
    await pick('side-option');
    await p.waitForTimeout(2500);
    await step('04-side-answered');
    await p.locator('.nyq-answered .nyq-row-btn', { hasText: /kind of work/ }).first().click();
    await p.waitForTimeout(1500);
    await step('05-kind-reopened');
    await p.locator('[data-testid=step-undo-side]').click();
    await p.waitForTimeout(2500);
    await step('06-side-undone');
    await pick('side-option');
    await p.waitForTimeout(2500);
    await step('07-side-again');
    if (await p.locator('[data-testid=band-aerial-hide]').count() && await p.locator('[data-testid=band-aerial-hide]').isVisible()) {
      // #456's walk scrolled to 400 by hand here, then hid the map.
      await p.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
      await p.waitForTimeout(400);
      await step('08-scrolled-by-hand');
      await p.locator('[data-testid=band-aerial-hide]').click();
      await p.waitForTimeout(600);
      await step('09-map-hidden');
      await p.locator('.nyq-answered .nyq-row-btn', { hasText: /kind of work/ }).first().click();
      await p.waitForTimeout(800);
      await p.locator('[data-testid=step-undo-side]').click();
      await p.waitForTimeout(1500);
      await step('10-hidden-after-undo');
      await p.locator('[data-testid=band-aerial-show]').click();
      await p.waitForTimeout(1200);
      await step('11-map-shown');
    }

    // The intersection: kind, the tap question, the tap, then Next to the side.
    await pinAndSave();
    await pick('kind-chip-near_intersection');
    await p.waitForTimeout(2500);
    await step('12-ni-kind-answered', {}, { shot: false });
    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(1500);
    await step('13-cross-question');
    crossMode = true;
    const img = p.locator('[data-testid=band-aerial-img]');
    const box = await img.boundingBox();
    const geo = { lat: 39.739781, lng: -104.968249 };
    const at = pixelOf(CROSSING, geo, box.width, box.height);
    const scrollBefore = await p.evaluate(() => scrollY);
    await p.mouse.click(box.x + at.x, box.y + at.y);
    await p.waitForTimeout(3500);
    const scrollAfter = await p.evaluate(() => scrollY);
    await step('14-cross-found', { tapScroll: `${Math.round(scrollBefore)}->${Math.round(scrollAfter)}` });
    crossMode = false;
    await nextBtn(p).click();
    await p.waitForTimeout(2500);
    await step('15-side-after-tap');
  } catch (e) {
    out.errors.push(`walk: ${String(e).slice(0, 300)}`);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  out.cls = await p.evaluate(() => window.__cls.slice()).catch(() => null);
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 1));
  const noInput = (out.cls ?? []).filter((e) => !e.recent).reduce((a, e) => a + e.value, 0);
  console.log(tag, 'errors', out.errors.length, 'CLS(no input)', noInput.toFixed(4));
}

for (const [w, h] of sizes) await run(w, h);
