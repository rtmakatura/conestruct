// #398 before/after shots (adapted from #420's script/shoot.mjs).
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev` of the issue worktree (base sources for "before", the
// fix for "after"); Playwright Chromium at DPR 2, 1440x900 and 390x844.
// /api/road-bearing is stubbed with one candidate per site (as #420 did, so
// the shots don't wait on Overpass); the audit and everything else are live.
// The dev server runs with a local-only GATE_BYPASS_TOKEN passed in the
// environment (SHOT_TOKEN here); no real token is read or printed.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const SITES = {
  // W4: shoulder on Colfax eastbound, generated.
  shoulder: {
    search: '1600 E Colfax Ave, Denver',
    pick: /Colfax/i,
    side: /South side/i,
    cand: { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', bearing: 90, snapped_lat: 39.74003, snapped_lng: -104.96555,
      tags: { oneway: 'yes', maxspeed: '30 mph', lanes: '3' } },
    kind: 'shoulder',
  },
  // W5: flagger lane closure on Colfax westbound, declined (one-way).
  flagger: {
    search: 'Colfax & Williams, Denver',
    pick: /Colfax/i,
    side: /North side/i,
    cand: { way_id: '600545937', highway_class: 'primary', name: 'East Colfax Avenue', bearing: 270, snapped_lat: 39.74030, snapped_lng: -104.96555,
      tags: { oneway: 'yes', maxspeed: '30 mph', lanes: '3' } },
    kind: 'flagger_lane_closure',
  },
};

function stub(c) {
  return JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver',
    candidates: [{ way_id: c.way_id, highway_class: c.highway_class, name: c.name, ref: null, bearing: c.bearing, snap_distance_m: 5,
      snapped_lat: c.snapped_lat, snapped_lng: c.snapped_lng, signal_distance_m: null,
      tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null, ...c.tags } }] });
}

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

async function shotOf(p, sel, file) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, text: document.querySelector(s).innerText };
  }, sel);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${file}`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, vw), height: box.height + 16 } });
  return { text: box.text.replace(/\s+/g, ' ').trim(), width: +box.width.toFixed(2), height: +box.height.toFixed(2) };
}

async function locate(p, site) {
  await p.route('**/api/road-bearing**', r => r.fulfill({ status: 200, contentType: 'application/json', body: stub(site.cand) }));
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
  await p.waitForSelector('[data-testid=cell-worklen]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  const side = p.locator('[data-testid=side-option]').filter({ hasText: site.side });
  if (await side.count()) await side.first().click();
  else await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector(`[data-testid=kind-chip-${site.kind}]`, { timeout: 60000 });
  await p.locator(`[data-testid=kind-chip-${site.kind}]`).click();
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
}

// Requests to /api/ that have started and not finished.
function track(p) {
  const open = new Set();
  p.on('request', (r) => { if (r.url().includes('/api/')) open.add(r); });
  p.on('requestfinished', (r) => open.delete(r));
  p.on('requestfailed', (r) => open.delete(r));
  return () => [...open].map((r) => new URL(r.url()).pathname);
}

const M = {};
async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const out = {};
  for (const [name, site] of Object.entries(SITES)) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
    const p = await ctx.newPage();
    const openNow = track(p);
    try {
      await locate(p, site);
      if (name === 'shoulder') {
        // The audit asks which carriageway a one-way road is
        // (carriageway_undecided); answer it as the operator would.
        await p.waitForTimeout(3000);
        await p.getByRole('button', { name: 'One-way', exact: true }).first().click();
        await p.waitForTimeout(4000);
        await p.getByRole('button', { name: /Generate plan/ }).first().click();
        await p.waitForSelector('.tier-cue', { timeout: 180000 });
        // Wait for every request to answer, then 10 s more (the issue's
        // repro waited 40 s; 10 s is past any debounce window).
        for (let i = 0; i < 180 && openNow().length; i += 1) await p.waitForTimeout(1000);
        await p.waitForTimeout(10000);
        await p.evaluate(() => { document.querySelector('.tier-cue').parentElement.setAttribute('data-shot', 'cue-block'); });
        out.shoulderOpenRequests = openNow();
        out.cue = (await p.locator('.tier-cue').innerText()).trim();
        out.cueSlot = await shotOf(p, '.tier-cue', `${phase}-${tag}-w4-cue-slot.png`);
        out.cueBlock = await shotOf(p, '[data-shot=cue-block]', `${phase}-${tag}-w4-tier-stack.png`);
      } else {
        await p.waitForFunction(() => /PLAN DECLINED/i.test(document.body.innerText), null, { timeout: 120000 });
        for (let i = 0; i < 60 && openNow().length; i += 1) await p.waitForTimeout(1000);
        await p.waitForTimeout(5000);
        out.flaggerOpenRequests = openNow();
        out.declinedWindowsLine = await shotOf(p, '[data-testid=what-windows-line]', `${phase}-${tag}-w5-windows-line-declined.png`);
      }
    } catch (e) {
      out[`${name}Error`] = String(e).slice(0, 300);
      await p.screenshot({ path: `${OUT}/${phase}-${tag}-${name}-error.png` }).catch(() => {});
    }
    await ctx.close();
  }
  await b.close();
  M[tag] = out;
  console.log(phase, tag, JSON.stringify(out));
}

await run(1440, 900);
await run(390, 844);
fs.writeFileSync(`${OUT}/text-${phase}.json`, JSON.stringify(M, null, 1));
