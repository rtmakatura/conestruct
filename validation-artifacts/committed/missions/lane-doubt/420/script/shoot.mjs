// #420 before/after shots (adapted from #397's script/shoot.mjs; Wadsworth only).  usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev` of the issue worktree (base sources for "before", the fix
// for "after"); Playwright Chromium at DPR 2, 1440x900 and 390x844.
// /api/road-bearing is stubbed with one candidate per site (as L2 did, so
// the shots don't hang on Overpass); everything else is live.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
// The dev server runs with a local-only GATE_BYPASS_TOKEN passed in the
// environment (SHOT_TOKEN here); no real token is read or printed.
const TOK = process.env.SHOT_TOKEN ?? '';
// Cycle 4: SHOT_ONLY=wadsworth runs one site; SHOT_SUFFIX names its text file.
const ONLY = ['wadsworth'];
const SUFFIX = process.env.SHOT_SUFFIX ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(phase, ...a);

const SITES = {
  colfax: {
    search: '1600 E Colfax Ave, Denver',
    pick: /Colfax/i,
    cand: { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', bearing: 90, snapped_lat: 39.74003, snapped_lng: -104.96555,
      tags: { oneway: 'yes', maxspeed: '30 mph', lanes: '3' } },
    kind: 'shoulder',
  },
  wadsworth: {
    search: 'Wadsworth Blvd & W 10th Ave, Lakewood, CO',
    pick: /Wadsworth/i,
    cand: { way_id: '427683596', highway_class: 'primary', name: 'Wadsworth Boulevard', bearing: 0, snapped_lat: 39.73296, snapped_lng: -105.08131,
      tags: { oneway: 'yes', maxspeed: '45 mph', lanes: '4' } },
    kind: 'near_intersection',
  },
  // Repair cycle 3: a pin with no road (the scan finds no candidate), so
  // nothing is detected: the WHAT header and the shoulder's lanes line.
  none: {
    search: '1600 E Colfax Ave, Denver',
    pick: null,
    cand: null,
    kind: 'shoulder',
  },
};

function stub(site) {
  const c = site.cand;
  if (!c) return JSON.stringify({ scan_status: 'ok', primary_index: null, isUrban: true, placeName: 'Denver', candidates: [] });
  return JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver',
    candidates: [{ way_id: c.way_id, highway_class: c.highway_class, name: c.name, ref: null, bearing: c.bearing, snap_distance_m: 5,
      snapped_lat: c.snapped_lat, snapped_lng: c.snapped_lng, signal_distance_m: null,
      tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null, ...c.tags } }] });
}

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

async function shotOf(p, sel, file, extraSel) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate(([s, x]) => {
    const els = [document.querySelector(s), x ? document.querySelector(x) : null].filter(Boolean);
    const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
    const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
    const r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
    return { x: l, y: t, width: r - l, height: b - t, text: els.map(e => e.innerText).join(' | ') };
  }, [sel, extraSel ?? null]);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${file}`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, vw), height: box.height + 16 } });
  return { text: box.text.replace(/\s+/g, ' ').trim(), width: +box.width.toFixed(2), height: +box.height.toFixed(2) };
}

async function locate(p, site) {
  await p.route('**/api/road-bearing**', r => r.fulfill({ status: 200, contentType: 'application/json', body: stub(site) }));
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(site.search);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
  if (site.pick) await p.getByRole('dialog').getByRole('button', { name: site.pick }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=cell-worklen]', { timeout: 60000 });
  await p.waitForTimeout(1500);
}

async function toStep2(p, site, len) {
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector(`[data-testid=kind-chip-${site.kind}]`, { timeout: 60000 });
  await p.locator(`[data-testid=kind-chip-${site.kind}]`).click();
  if (len) {
    const f = p.locator('#band-worklen');
    await f.fill(String(len));
    await f.press('Enter');
    await p.waitForTimeout(800);
  }
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
}

const M = {};
async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const out = {};
  for (const [name, site] of Object.entries(SITES)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
    const p = await ctx.newPage();
    try {
      await locate(p, site);
      if (name === 'colfax') {
        out.ledger = await shotOf(p, '[data-testid=move-ledger]', `${phase}-${tag}-w1-ledger-extent.png`);
        out.worklen = await shotOf(p, '[data-testid=cell-worklen]', `${phase}-${tag}-w1-length-field.png`);
        await toStep2(p, site, null);
        out.workType = await shotOf(p, '[data-testid=cell-work-type]', `${phase}-${tag}-w2-work-type.png`);
      } else if (name === 'none') {
        await toStep2(p, site, null);
        // The pin's jurisdiction guess is the one ⚠ on this plan; the
        // operator confirms it (re-selects its value) so the header can
        // show its nothing-guessed line.
        const j = p.locator('#what-jurisdiction');
        const jv = await j.inputValue();
        if (jv) { await j.selectOption(jv); await p.waitForTimeout(1500); }
        out.guessMarkers = await p.$$eval('[data-testid^=info-toggle-]', (es) => es.map((e) => e.textContent).filter((t) => t.startsWith('⚠')));
        out.whatHeader = await shotOf(p, '.a-open .a-head', `${phase}-${tag}-r3-what-header-no-detection.png`);
        await p.locator('[data-testid=info-toggle-lanes]').click();
        await p.waitForTimeout(400);
        out.noDetectionLanes = await shotOf(p, '[data-testid=cell-lanes]', `${phase}-${tag}-r3-lanes-no-detection.png`, '[data-testid=info-lanes]');
      } else {
        await toStep2(p, site, 500);
        // Cycle 4: the header's guess count on this plan.
        out.guessMarkers = await p.$$eval('[data-testid^=info-toggle-]', (es) => es.map((e) => e.textContent).filter((t) => t.startsWith('⚠')));
        out.whatHeader = await shotOf(p, '.a-open .a-head', `${phase}-${tag}-what-header.png`);
        await p.locator('[data-testid=info-toggle-lanes]').click();
        await p.waitForTimeout(400);
        out.lanes = await shotOf(p, '[data-testid=cell-lanes]', `${phase}-${tag}-lanes-details.png`, '[data-testid=info-lanes]');
      }
    } catch (e) {
      out[`${name}Error`] = String(e).slice(0, 300);
      await p.screenshot({ path: `${OUT}/${phase}-${tag}-${name}-error.png` }).catch(() => {});
    }
    await ctx.close();
  }
  await b.close();
  M[tag] = out;
  log(tag, JSON.stringify(out));
}

await run(1440, 900);
await run(390, 844);
fs.writeFileSync(`${OUT}/text-${phase}${SUFFIX}.json`, JSON.stringify(M, null, 1));
