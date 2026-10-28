// #399 before/after shots of the near-intersection refusal (adapted from #420's script/shoot.mjs).
// usage: node shoot.mjs <before|after> <outdir> <port>
// The issue worktree's site (no frontend change on this branch), its
// MODAL_RENDER_URL pointed at a local uvicorn of the backend.  "before":
// `next dev` against a `git archive` of 994d2ee.  "after": a production
// build (`npm --prefix conestruct/site run build`, then `run start -- -p
// 3431`) against this branch.
// This file is the retake version that took the "after" shots: it waits for
// the map canvas and the marker, scrolls the marker on screen and records
// `markHit`.  The "before" shots came from an earlier version that wasn't
// kept (same flow, pointer-events style and -20 px click, but no canvas or
// marker wait, no scroll and no markHit, hence none in text-before.json).  Playwright
// Chromium at DPR 2, 1440x900 and 390x844.  /api/road-bearing is stubbed with
// the Wadsworth candidate (as #420 did); everything else is live.  The site
// server (`next dev` for "before", `next start` for "after") runs with a
// local-only GATE_BYPASS_TOKEN (SHOT_TOKEN here); no real token is read or
// printed.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(phase, ...a);

const SITE = {
  search: 'Wadsworth Blvd & W 10th Ave, Lakewood, CO',
  pick: /Wadsworth/i,
  cand: { way_id: '427683596', highway_class: 'primary', name: 'Wadsworth Boulevard', bearing: 0, snapped_lat: 39.73296, snapped_lng: -105.08131,
    tags: { maxspeed: '45 mph', lanes: '4' } },
  kind: 'near_intersection',
};

function stub(c) {
  return JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Lakewood',
    candidates: [{ way_id: c.way_id, highway_class: c.highway_class, name: c.name, ref: null, bearing: c.bearing, snap_distance_m: 0,
      snapped_lat: c.snapped_lat, snapped_lng: c.snapped_lng, signal_distance_m: null,
      tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null, ...c.tags } }] });
}

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

async function shotOf(p, sel, file) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate((s) => {
    const e = document.querySelector(s); const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, text: e.innerText };
  }, sel);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${file}`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, vw), height: box.height + 16 } });
  return { text: box.text.replace(/\s+/g, ' ').trim(), width: +box.width.toFixed(2), height: +box.height.toFixed(2) };
}

async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const out = {};
  try {
    await p.route('**/api/road-bearing**', r => r.fulfill({ status: 200, contentType: 'application/json', body: stub(SITE.cand) }));
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(SITE.search);
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
    await p.getByRole('dialog').getByRole('button', { name: SITE.pick }).first().click();
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.locator('[data-testid=side-option]').first().click();
    await p.waitForSelector(`[data-testid=kind-chip-${SITE.kind}]`, { timeout: 60000 });
    await p.locator(`[data-testid=kind-chip-${SITE.kind}]`).click();
    const f = p.locator('#band-worklen');
    await f.fill('500');
    await f.press('Enter');
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForTimeout(3000);
    // Mark the cross street at the work-start pin (the issue's step 3).
    await p.getByRole('button', { name: /Mark on map/i }).first().click();
    // Retake: wait for the map (its canvas and the work-start marker) and
    // let the tiles settle, then bring the marker on screen before the click.
    await p.waitForSelector('[role=dialog] canvas.mapboxgl-canvas', { timeout: 90000 });
    await p.waitForSelector('[role=dialog] .mapboxgl-marker', { timeout: 90000 });
    await p.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(4000);
    await p.addStyleTag({ content: '.mapboxgl-marker{pointer-events:none !important}' });
    await p.locator('[role=dialog] .mapboxgl-marker').first().scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    const pin = await p.evaluate(() => {
      const m = document.querySelector('[role=dialog] .mapboxgl-marker');
      const r = m.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 20);
      window.__markHit = hit ? hit.className : null;
      // A few px north of the marker's foot: inside the work zone, as on the live site.
      // (-8 px landed ~11 ft south of the pin on the first take: the
      // far-side curb refusal, not the inside one; -20 px is north of it.)
      return { x: r.left + r.width / 2, y: r.bottom - 20 };
    });
    out.markClick = pin;
    out.markHit = await p.evaluate(() => String(window.__markHit));
    await p.mouse.click(pin.x, pin.y);
    await p.waitForFunction(() => /two-way|one-way|signal|no cross/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(1500);
    out.pickerLine = (await p.getByRole('dialog').innerText()).match(/West 10th[^\n]*/i)?.[0] ?? null;
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForTimeout(2000);
    const lc = p.getByText('Lane count is right').first();
    if (await lc.count()) { await lc.click(); await p.waitForTimeout(500); }
    // The cross street's speed isn't detected here; the operator sets it.
    const sp = p.locator('select#ni-cross-speed');
    if (await sp.count()) { await sp.selectOption({ index: 1 }).catch(() => {}); await p.waitForTimeout(1500); }
    const gen = p.getByRole('button', { name: 'Generate plan' });
    if (await gen.isEnabled().catch(() => false)) await gen.click();
    await p.waitForSelector('.status-bar.fail', { timeout: 120000 });
    await p.waitForTimeout(1500);
    out.banner = await shotOf(p, '.status-bar.fail', `${phase}-${tag}-declined-banner.png`);
  } catch (e) {
    out.error = String(e).slice(0, 300);
    await p.screenshot({ path: `${OUT}/${phase}-${tag}-error.png` }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  log(tag, JSON.stringify(out));
  return out;
}

const M = { '1440': await run(1440, 900), '390': await run(390, 844) };
fs.writeFileSync(`${OUT}/text-${phase}.json`, JSON.stringify(M, null, 1));
