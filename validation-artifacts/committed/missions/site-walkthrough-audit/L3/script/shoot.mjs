// #396 L3 (W14): the location picker at 1440, 390, 360 (Chromium) and 390 (WebKit).
// usage: node shoot.mjs <before|after> <outdir> <tokenfile>
// The token file holds a throwaway local gate token (never the real one).
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium, webkit } = require('playwright');
const [phase, OUT, TOKFILE] = process.argv.slice(2);
const TOK = fs.readFileSync(TOKFILE, 'utf8').trim();
const BASE = 'http://localhost:3413';
fs.mkdirSync(OUT, { recursive: true });
const M = {};

// Four candidates, as the walkthrough saw at 1600 E Colfax Ave (Overpass
// unavailable 2026-10-25, so /api/road-bearing is stubbed; the rest is live).
const cand = (way_id, highway_class, name, bearing, snap, oneway) => ({ way_id, highway_class, name, ref: null, bearing, snap_distance_m: snap,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null,
  tags: { oneway, maxspeed: '30 mph', lanes: '2', lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null } });
const BODY = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [
  cand('589340254', 'residential', 'Franklin Street', 180, 18, 'yes'),
  cand('900002', 'primary', 'East Colfax Avenue', 90, 21, 'yes'),
  cand('900003', 'primary', 'East Colfax Avenue', 270, 27, 'yes'),
  cand('900004', 'residential', 'Franklin Street', 0, 33, 'yes') ] });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
// Like-for-like: no focus left on SEARCH, pointer parked, and Mapbox tile/style/glyph
// requests settled (none in flight for 1.5 s, capped at 45 s) before every measure and shot.
async function settle(p, inflight) {
  await p.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur());
  await park(p);
  const t0 = Date.now(); let quietSince = Date.now();
  while (Date.now() - t0 < 45000) { if (inflight.n > 0) quietSince = Date.now(); else if (Date.now() - quietSince > 1500) break; await p.waitForTimeout(100); }
  await p.waitForTimeout(500);
  return { waitedMs: Date.now() - t0, inflightAtShot: inflight.n };
}
// Stacking: the frame is pointer-events:none, so elementFromPoint skips it.  Switch it
// on for the probe only, hit-test its three rules, and switch it back.
const FRAME = () => {
  const f = document.querySelector('.workbench-frame'); const d = document.querySelector('[role=dialog]');
  if (!f || !d) return { frame: !!f };
  const fr = f.getBoundingClientRect(); const dr = d.getBoundingClientRect(); const prev = f.style.pointerEvents; f.style.pointerEvents = 'auto';
  const vw = innerWidth, vh = innerHeight; const probes = [];
  for (const [side, x, y] of [['left', fr.left + 0.5, vh * 0.25], ['left', fr.left + 0.5, vh * 0.6], ['right', fr.right - 0.5, vh * 0.25], ['right', fr.right - 0.5, vh * 0.6], ['top', vw * 0.3, fr.top + 0.5], ['top', vw * 0.6, fr.top + 0.5]]) {
    const e = document.elementFromPoint(x, y);
    probes.push({ side, x: +x.toFixed(1), y: +y.toFixed(1), frameOnTop: e === f, insideDialog: x > dr.left + 1 && x < dr.right - 1 && y > dr.top + 1 && y < dr.bottom - 1 });
  }
  f.style.pointerEvents = prev;
  return { frame: true, frameRect: { x: fr.left, y: fr.top, right: fr.right }, zFrame: getComputedStyle(f).zIndex, zPicker: getComputedStyle(d.parentElement).zIndex, probes,
    frameOnTopInsideDialog: probes.filter(q => q.frameOnTop && q.insideDialog).length };
};

const MEASURE = () => {
  const d = document.querySelector('[role=dialog]');
  const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { x: +q.x.toFixed(2), y: +q.y.toFixed(2), w: +q.width.toFixed(2), h: +q.height.toFixed(2), bottom: +q.bottom.toFixed(2) }; };
  const lines = (e) => { if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e); const tops = new Set(); for (const q of rg.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top)); return tops.size; };
  const footer = d.lastElementChild;
  const btn = (name) => [...footer.querySelectorAll('button')].find(b => b.innerText.trim() === name);
  const save = btn('Save & Close'), cancel = btn('Cancel');
  const status = [...footer.children].filter(e => e.tagName === 'SPAN');
  const rows = [...d.querySelectorAll('button')].filter(b => /way\s+\d+/i.test(b.innerText) && !footer.contains(b));
  let scroller = rows[0]?.parentElement; while (scroller && scroller !== d && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  const vw = innerWidth, vh = innerHeight;
  const pts = []; for (const y of [1, 4, vh - 4, vh - 1]) for (const x of [1, vw / 2, vw - 1]) { const e = document.elementFromPoint(x, y); pts.push({ x, y, inDialog: !!(e && d.contains(e)), hit: e ? e.tagName + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') : null }); }
  return {
    viewport: [vw, vh], dialog: r(d), dialogGap: { top: +d.getBoundingClientRect().top.toFixed(2), bottom: +(vh - d.getBoundingClientRect().bottom).toFixed(2), left: +d.getBoundingClientRect().left.toFixed(2), right: +(vw - d.getBoundingClientRect().right).toFixed(2) },
    edgePoints: pts, edgePointsOutsideDialog: pts.filter(q => !q.inDialog).length,
    header: r(d.firstElementChild), footer: r(footer),
    save: { rect: r(save), lines: lines(save), whiteSpace: save && getComputedStyle(save).whiteSpace },
    cancel: { rect: r(cancel), lines: lines(cancel) },
    status: status.map(s => ({ text: s.innerText.trim(), rect: r(s), lines: lines(s) })),
    scroller: scroller && scroller !== d ? { rect: r(scroller), scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight } : null,
    rows: rows.map(b => ({ text: b.innerText.replace(/\s+/g, ' ').trim().slice(0, 60), rect: r(b) })),
    docScroll: { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw },
  };
};

// Reachability: scroll each row into view in its scroller, then check that the
// row's centre hits the row (nothing on top) and the row ends above the footer.
const REACH = () => {
  const d = document.querySelector('[role=dialog]'); const footer = d.lastElementChild;
  const rows = [...d.querySelectorAll('button')].filter(b => /way\s+\d+/i.test(b.innerText) && !footer.contains(b));
  return rows.map(b => { b.scrollIntoView({ block: 'nearest' }); const q = b.getBoundingClientRect(); const f = footer.getBoundingClientRect();
    const hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
    const hitBottom = document.elementFromPoint(q.x + q.width / 2, q.bottom - 2);
    return { text: b.innerText.replace(/\s+/g, ' ').trim().slice(0, 40), top: +q.top.toFixed(2), bottom: +q.bottom.toFixed(2), footerTop: +f.top.toFixed(2),
      endsAboveFooter: q.bottom <= f.top + 0.5, centreHitsRow: !!hit && b.contains(hit), bottomEdgeHitsRow: !!hitBottom && b.contains(hitBottom) }; });
};

const run = async (engine, w, h, tag) => {
  const br = await (engine === 'webkit' ? webkit : chromium).launch();
  const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const out = { consoleErrors: [], pageErrors: [] };
  p.on('console', m => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => out.pageErrors.push(String(e).slice(0, 300)));
  out.httpErrors = {}; p.on('response', r => { if (r.status() >= 400) { const u = new URL(r.url()); const k = r.status() + ' ' + u.host + u.pathname; out.httpErrors[k] = (out.httpErrors[k] || 0) + 1; } });
  const inflight = { n: 0 }; const isTile = (r) => /mapbox\.com/.test(r.url()) && !/events\.mapbox/.test(r.url());
  p.on('request', r => { if (isTile(r)) inflight.n++; }); p.on('requestfinished', r => { if (isTile(r)) inflight.n--; }); p.on('requestfailed', r => { if (isTile(r)) inflight.n--; });
  out.settle = {};
  let release; const gate = new Promise(res => { release = res; });
  await p.route('**/api/road-bearing**', async r => { await gate; await r.fulfill({ status: 200, contentType: 'application/json', body: BODY }); });
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForSelector('[role=dialog]', { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
    await p.getByRole('button', { name: 'SEARCH' }).click();
    // Detection is held open until we release the stub: the "Detecting road…" footer.
    await p.waitForFunction(() => /Detecting road/i.test(document.querySelector('[role=dialog]')?.lastElementChild?.innerText || ''), null, { timeout: 60000 });
    out.settle.detecting = await settle(p, inflight);
    out.detecting = await p.evaluate(MEASURE);
    out.frameDetecting = await p.evaluate(FRAME);
    await p.screenshot({ path: `${OUT}/${tag}-w14-picker-detecting.png` });
    release();
    await p.waitForFunction(() => /Which road/i.test(document.querySelector('[role=dialog]')?.innerText || ''), null, { timeout: 60000 });
    out.settle.roads = await settle(p, inflight);
    out.roads = await p.evaluate(MEASURE);
    out.frameRoads = await p.evaluate(FRAME);
    await p.screenshot({ path: `${OUT}/${tag}-w14-picker-roads.png` });
    out.reach = await p.evaluate(REACH);
    await p.evaluate(() => { const d = document.querySelector('[role=dialog]'); for (const e of d.querySelectorAll('*')) if (/(auto|scroll)/.test(getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight; });
    out.settle.roadsEnd = await settle(p, inflight);
    out.frameRoadsEnd = await p.evaluate(FRAME);
    out.roadsEnd = await p.evaluate(MEASURE);
    await p.screenshot({ path: `${OUT}/${tag}-w14-picker-roads-end.png` });
  } catch (e) { out.error = String(e).slice(0, 300); await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {}); }
  await br.close();
  out.consoleErrors = [...new Set(out.consoleErrors)];
  M[tag] = out;
  console.log(phase, tag, out.error || 'ok');
};

const only = process.argv[5];
const RUNS = [['chromium', 1440, 900, '1440'], ['chromium', 390, 844, '390'], ['chromium', 360, 780, '360'], ['webkit', 390, 844, '390-webkit']];
for (const r of RUNS) if (!only || only === r[3]) await run(...r);
fs.writeFileSync(`${OUT}/../measure-${phase}.json`, JSON.stringify(M, null, 1));
