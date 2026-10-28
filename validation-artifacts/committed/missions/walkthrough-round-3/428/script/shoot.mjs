// #428 before/after shots of the work-zone length field and the Generate
// blocker with a typed 0 committed (adapted from #403's script).
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev`: a git archive of 1a0f7d1 for "before", the issue-428
// worktree for "after"; API calls go to the .env.local backend (no
// backend change on this branch).  Playwright Chromium at DPR 2, 1440x900
// and 390x844.  /api/road-bearing is stubbed with the Colfax candidate (as
// #398 and #401 did).  The dev server runs with a local-only
// GATE_BYPASS_TOKEN (SHOT_TOKEN here); no real token is read or printed.
// Flow: pin, side, shoulder kind, Confirm, reopen WHERE, type 0 in
// "Work zone length (ft)", Tab out.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const cand = { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', bearing: 90, snapped_lat: 39.74003, snapped_lng: -104.96555,
  tags: { oneway: 'yes', maxspeed: '30 mph', lanes: '3' } };
const stub = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver',
  candidates: [{ way_id: cand.way_id, highway_class: cand.highway_class, name: cand.name, ref: null, bearing: cand.bearing, snap_distance_m: 0,
    snapped_lat: cand.snapped_lat, snapped_lng: cand.snapped_lng, signal_distance_m: null,
    tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null, ...cand.tags } }] });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

// Shoot the first visible element matching `sel` (or, with `up`, its
// closest ancestor matching `up`), padded 8 px, and return its text and box.
async function shotOf(p, sel, up, file) {
  await p.locator(sel).first().scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate(([s, u]) => {
    let e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0);
    if (u) e = e.closest(u);
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, text: e.innerText };
  }, [sel, up]);
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
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: stub }));
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
    await p.getByRole('dialog').getByRole('button', { name: /Colfax/i }).first().click();
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
    await p.waitForTimeout(1500);
    const side = p.locator('[data-testid=side-option]').filter({ hasText: /South side/i });
    if (await side.count()) await side.first().click(); else await p.locator('[data-testid=side-option]').first().click();
    await p.waitForSelector('[data-testid=kind-chip-shoulder]', { timeout: 60000 });
    await p.locator('[data-testid=kind-chip-shoulder]').click();
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
    await p.waitForTimeout(3000);
    if (!(await p.locator('#band-worklen').isVisible().catch(() => false))) {
      await p.locator('[data-testid=fact-link-where]').first().click();
    }
    await p.waitForSelector('#band-worklen', { state: 'visible', timeout: 60000 });
    await p.locator('#band-worklen').fill('0');
    await p.keyboard.press('Tab');
    await p.waitForTimeout(3000);
    out.fieldValue = await p.locator('#band-worklen').inputValue();
    out.marker = (await p.getByTestId('info-toggle-worklen').innerText()).trim();
    out.provenance = await p.getByTestId('prov-worklen').textContent();
    out.cell = await shotOf(p, '#band-worklen', '.a-col', `${phase}-${tag}-worklen-cell.png`);
    out.ctaReason = (await p.locator('[data-testid=cta-reason]').first().textContent().catch(() => null));
    out.generate = await shotOf(p, '[data-testid=generate-frame]', null, `${phase}-${tag}-generate.png`);
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
