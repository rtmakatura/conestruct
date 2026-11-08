// #460 walk (local): after the picker's Save & Close the WHERE band's top (its
// "Where is the work?" heading and the whole aerial) sits just under the nav,
// and while the aerial is not drawn the picker's picture stands in.
// usage: WALK_SECRETS_DIR=<dir> node walk460.mjs <outdir> <port> [sizes]
//   sizes: "1198x930,1440x900,390x844" (default, Ryan's three)
// Local `next dev` on the issue-460 worktree (launch.cjs), the local backend
// with Overpass STUBBED (serve_stub.py, ux-group3-where's recorded answers);
// /api/road-bearing is stubbed from the same fixture.  Chromium, DPR 1.  The
// gate header goes through scripts/gate.cjs (the local site's own host only).
// The first save holds every aerial answer 3 s, so the stand-in can be seen;
// what the frame shows is logged by a MutationObserver from page load.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-460';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const [OUT, PORT, SIZES] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
if (!process.env.GATE_BYPASS_TOKEN) {
  process.env.GATE_BYPASS_TOKEN = JSON.parse(fs.readFileSync(path.join(process.env.WALK_SECRETS_DIR, 'walk-secrets.json'), 'utf8')).gate;
}
const sizes = (SIZES ?? '1198x930,1440x900,390x844').split(',').map((s) => s.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(`${W}/validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json`, 'utf8'));
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
const ADDR = (w) => (w <= 480 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');

// Where the band's top and the aerial sit against the nav.
async function read(p) {
  return p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const nav = q('.a-nav, nav');
    const navB = nav ? nav.getBoundingClientRect().bottom : 0;
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), h: +b.height.toFixed(1) }; };
    const heading = [...document.querySelectorAll('[data-testid=band-stack] .a-open *')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Where is the work?') ?? null;
    const band = q('[data-testid=band-stack] .a-open');
    const frame = q('[data-testid=band-aerial-frame]');
    const fb = frame?.getBoundingClientRect();
    const max = document.documentElement.scrollHeight - innerHeight;
    return {
      scrollY: Math.round(scrollY), maxScroll: Math.round(max), atMax: Math.round(scrollY) >= Math.round(max) - 1,
      vw: innerWidth, vh: innerHeight, navBottom: +navB.toFixed(1),
      openBand: q('[data-testid=band-stack]')?.getAttribute('data-open-band') ?? null,
      band: r(band), heading: r(heading), frame: r(frame),
      bandTopMinusNav: band ? +(band.getBoundingClientRect().top - navB).toFixed(1) : null,
      headingInView: heading ? heading.getBoundingClientRect().top >= navB - 1 && heading.getBoundingClientRect().bottom <= innerHeight : null,
      aerialWhollyInView: fb ? fb.top >= navB - 1 && fb.bottom <= innerHeight + 1 : null,
      aerialVisiblePx: fb ? Math.round(Math.max(0, Math.min(fb.bottom, innerHeight) - Math.max(fb.top, navB))) : null,
      standIn: !!q('[data-testid=band-aerial-standin]'), aerialImg: !!q('[data-testid=band-aerial-img]'),
      note: q('[data-testid=band-aerial-note]')?.textContent ?? null, heldLine: q('[data-testid=band-aerial-held]')?.textContent ?? null,
      activeTestid: document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? null,
      docOverflowX: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, steps: [], errors: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await newGatedContext(b, BASE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__frame = [];
    const start = performance.now();
    const log = () => {
      const f = document.querySelector('[data-testid=band-aerial-frame]');
      if (!f) return;
      const state = document.querySelector('[data-testid=band-aerial-img]') ? 'aerial'
        : document.querySelector('[data-testid=band-aerial-standin]') ? 'stand-in'
        : document.querySelector('[data-testid=band-aerial-note]') ? `note: ${document.querySelector('[data-testid=band-aerial-note]').textContent}` : 'empty';
      const last = window.__frame[window.__frame.length - 1];
      if (!last || last.state !== state) window.__frame.push({ at: Math.round(performance.now() - start), state });
    };
    new MutationObserver(log).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'], characterData: true });
  });
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  let slowMap = false;
  await p.route('**/api/corridor-map', async (r) => { if (slowMap) await new Promise((res) => setTimeout(res, 3000)); return r.fallback(); });
  await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    return r.fulfill({ status: 200, contentType: 'application/json', body: det([cand(1547338997, { lat: asked.lat, lng: asked.lng }, COLFAX_WEST)]) });
  });
  const view = async (name) => { const file = `${tag}-${nn()}-${name}.png`; await p.screenshot({ path: `${OUT}/${file}` }); return file; };
  const step = async (name, extra = {}, { shot = true } = {}) => {
    const s = { name, ...extra, ...(await read(p)) };
    if (shot) s.shot = await view(name);
    out.steps.push(s);
    console.log(tag, name, '| y', s.scrollY, '/', s.maxScroll, '| band-nav', s.bandTopMinusNav, '| heading', s.headingInView, '| aerial', s.aerialWhollyInView, s.aerialVisiblePx, '| standIn', s.standIn, '| note', s.note);
    return s;
  };
  const frameLog = () => p.evaluate(() => window.__frame.slice());
  const pickInPicker = async () => {
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(ADDR(w));
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
    if (await want.count()) await want.first().click().catch(() => {});
    // The map settles on the pin before Save reads its picture.
    await p.waitForTimeout(3000);
  };
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await pickInPicker();
    await step('01-picker-before-save');
    // 1. The first Save & Close, the aerial held 3 s: the stand-in, then the aerial.
    slowMap = true;
    const before = (await frameLog()).length;
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForTimeout(1200);
    await step('02-saved-aerial-not-drawn');
    await p.waitForSelector('[data-testid=band-aerial-img]', { timeout: 60000 });
    await p.waitForTimeout(2500);
    slowMap = false;
    await step('03-saved-landed', { frameTrail: (await frameLog()).slice(before) });
    // 2. Again from the bottom of the page: Edit on map, Save & Close.
    await p.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await p.waitForTimeout(400);
    await step('04-scrolled-to-end', {}, { shot: false });
    await p.locator('[data-testid=where-open-picker]').first().click({ force: true });
    await p.waitForTimeout(3500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForTimeout(3000);
    await step('05-resaved-from-end');
    // 3. Cancel moves nothing.
    await p.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }));
    await p.waitForTimeout(400);
    const yBefore = await p.evaluate(() => Math.round(scrollY));
    await p.locator('[data-testid=where-open-picker]').first().click({ force: true });
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: /^Cancel$/ }).click();
    await p.waitForTimeout(1500);
    await step('06-cancelled', { yBefore }, { shot: false });
  } catch (e) {
    out.errors.push(`walk: ${String(e).slice(0, 300)}`);
    await view('error').catch(() => {});
  }
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 1));
  return out;
}

for (const [w, h] of sizes) await run(w, h);
