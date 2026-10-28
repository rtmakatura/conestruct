// #426 before/after shots of the working band while the zip renders.
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev` of the issue worktree ("before": the band string set
// back to 5661100's "MHT package ZIP"; "after": the branch), its render
// calls going to the backend named in the main checkout's .env.local (no
// backend change on this branch).  Playwright Chromium at DPR 2, 1440x900
// and 390x844.  /api/road-bearing is stubbed with the Colfax candidate (as
// #398 and #401 did); Generate and its audit are live.  /api/render/bundle
// is held open (never fulfilled until the band is measured, then aborted),
// so the band can be shot while it says RENDERING.  The dev server runs
// with a local-only GATE_BYPASS_TOKEN (SHOT_TOKEN here); no real token is
// read or printed.  Adapted from walkthrough-followups/401/script/shoot.mjs.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const site = {
  search: '1600 E Colfax Ave, Denver',
  pick: /Colfax/i,
  side: /South side/i,
  cand: { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', bearing: 90, snapped_lat: 39.74003, snapped_lng: -104.96555,
    tags: { oneway: 'yes', maxspeed: '30 mph', lanes: '3' } },
  kind: 'shoulder',
};

function stub(c) {
  return JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver',
    candidates: [{ way_id: c.way_id, highway_class: c.highway_class, name: c.name, ref: null, bearing: c.bearing, snap_distance_m: 0,
      snapped_lat: c.snapped_lat, snapped_lng: c.snapped_lng, signal_distance_m: null,
      tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null, ...c.tags } }] });
}

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

function boxOf(p, sel) {
  return p.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, width: +r.width.toFixed(2), height: +r.height.toFixed(2), text: e.textContent.replace(/\s+/g, ' ').trim() };
  }, sel);
}

function track(p) {
  const open = new Set();
  p.on('request', (r) => { if (r.url().includes('/api/')) open.add(r); });
  p.on('requestfinished', (r) => open.delete(r));
  p.on('requestfailed', (r) => open.delete(r));
  return () => [...open].map((r) => new URL(r.url()).pathname).filter((u) => !u.includes('/api/render/bundle'));
}

async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const openNow = track(p);
  const held = [];
  const out = {};
  try {
    await p.route('**/api/road-bearing**', r => r.fulfill({ status: 200, contentType: 'application/json', body: stub(site.cand) }));
    await p.route('**/api/render/bundle**', r => { held.push(r); });
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(site.search);
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
    await p.getByRole('dialog').getByRole('button', { name: site.pick }).first().click();
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
    await p.waitForTimeout(1500);
    const side = p.locator('[data-testid=side-option]').filter({ hasText: site.side });
    if (await side.count()) await side.first().click(); else await p.locator('[data-testid=side-option]').first().click();
    await p.waitForSelector(`[data-testid=kind-chip-${site.kind}]`, { timeout: 60000 });
    await p.locator(`[data-testid=kind-chip-${site.kind}]`).click();
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
    await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'One-way', exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.getByRole('button', { name: /Generate plan/ }).first().click();
    await p.waitForSelector('.dl-all', { timeout: 180000 });
    for (let i = 0; i < 180 && openNow().length; i += 1) await p.waitForTimeout(1000);
    await p.waitForTimeout(3000);
    await p.locator('.dl-all button').scrollIntoViewIfNeeded();
    await p.locator('.dl-all button').click();
    await p.waitForSelector('.working-band .wb-object', { timeout: 30000 });
    await park(p);
    await p.waitForTimeout(800);
    out.heldBundleRequests = held.length;
    out.band = await boxOf(p, '.working-band');
    out.row = await boxOf(p, '.working-band .wb-row');
    out.object = await boxOf(p, '.working-band .wb-object');
    out.lock = await boxOf(p, '.working-band .wb-lock');
    const bb = out.band;
    await p.screenshot({ path: `${OUT}/${phase}-${tag}-band.png`, clip: { x: 0, y: Math.max(0, bb.y - 8), width: w, height: Math.min(bb.height + 16, h - Math.max(0, bb.y - 8)) } });
    await p.screenshot({ path: `${OUT}/${phase}-${tag}-viewport.png` });
    for (const r of held) await r.abort().catch(() => {});
  } catch (e) {
    out.error = String(e);
    await p.screenshot({ path: `${OUT}/FAILED-${phase}-${tag}.png` }).catch(() => {});
  } finally {
    await b.close();
  }
  return out;
}

const res = { phase, at1440: await run(1440, 900), at390: await run(390, 844) };
fs.writeFileSync(`${OUT}/text-${phase}.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res));
