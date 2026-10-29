// #402 (round 4) before/after shots: the picker with a pin dropped and the
// side not yet answered: the map overlay and the panel note.
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev`: a git archive of 74cb1b5 for "before", the issue-402
// worktree for "after".  Playwright Chromium at DPR 2, 1440x900 and 390x844.
// /api/road-bearing is stubbed with one candidate (East Colfax Avenue at
// 1600 E Colfax Ave) and /api/render/corridor-geometry with a
// "side_not_confirmed" answer (what the backend returns before the side is
// chosen), so the picker draws the pin and the side sentence; /api/geocode
// is not stubbed (the search drops the pin).  The dev server runs with a
// local-only GATE_BYPASS_TOKEN (SHOT_TOKEN here).
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
const ADDRESS = '1600 E Colfax Ave, Denver';
fs.mkdirSync(OUT, { recursive: true });

const tags = { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null, oneway: 'yes', maxspeed: '30 mph', lanes: '3' };
const road = { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', ref: null, bearing: 90, snap_distance_m: 3,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null, tags };
const detect = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [road] });
const geometry = (pin) => JSON.stringify({ status: 'side_not_confirmed', pin_model: 'work_start', pin, travel_bearing_deg: null,
  work: null, approaches: [], coverage_ft: null, message: null,
  side_options: [{ work: { side: 'right', travel: 'with_geometry' }, label: 'South side · eastbound traffic', built: true }] });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

async function clipOf(p, testid, file) {
  const el = p.getByTestId(testid);
  await el.scrollIntoViewIfNeeded();
  await park(p);
  const bb = await el.boundingBox();
  if (!bb) return { error: 'not shown' };
  const vw = p.viewportSize().width;
  const pad = 24;
  await p.screenshot({ path: `${OUT}/${file}`, clip: { x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad), width: Math.min(bb.width + 2 * pad, vw), height: bb.height + 2 * pad } });
  const info = await el.evaluate((e) => ({ text: e.textContent, rendered: e.innerText, color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
  return { ...info, width: +bb.width.toFixed(2), height: +bb.height.toFixed(2) };
}

async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const out = {};
  try {
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: detect }));
    await p.route('**/api/render/corridor-geometry**', (r) => {
      let pin = [39.74003, -104.96555];
      try { const m = JSON.parse(r.request().postData()).scenario.meta; pin = [m.lat, m.lng]; } catch {}
      return r.fulfill({ status: 200, contentType: 'application/json', body: geometry(pin) });
    });
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForSelector('[role=dialog] .mapboxgl-canvas', { timeout: 60000 });
    const box = p.getByLabel('Address or intersection search');
    await box.fill(ADDRESS);
    await box.press('Enter');
    await p.getByTestId('picker-side-sentence').waitFor({ timeout: 90000 });
    await p.getByTestId('picker-corridor-note').waitFor({ timeout: 30000 });
    await p.waitForTimeout(3000); // map tiles
    await park(p);
    await p.screenshot({ path: `${OUT}/${phase}-${tag}-picker.png` });
    out.overlay = await clipOf(p, 'picker-side-sentence', `${phase}-${tag}-overlay.png`);
    out.panel = await clipOf(p, 'picker-corridor-note', `${phase}-${tag}-panel.png`);
  } catch (e) {
    out.error = String(e).slice(0, 300);
    await p.screenshot({ path: `${OUT}/${phase}-${tag}-error.png` }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  console.log(phase, tag, JSON.stringify(out));
  return out;
}

const M = { '1440': await run(1440, 900), '390': await run(390, 844) };
fs.writeFileSync(`${OUT}/text-${phase}.json`, JSON.stringify(M, null, 1));
