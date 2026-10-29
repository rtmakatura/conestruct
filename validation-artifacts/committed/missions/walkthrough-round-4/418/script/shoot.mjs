// #418 before/after shots of the WHAT band's Lanes row (adapted from
// #432's script).
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev`: a git archive of 8fc833d for "before", the issue-418
// worktree for "after"; API calls go to the .env.local backend (no
// backend change on this branch).  Playwright Chromium at DPR 2, 1440x900
// and 390x844.  /api/road-bearing is stubbed (as #398, #401 and #432 did).
// The dev server runs with a local-only GATE_BYPASS_TOKEN (SHOT_TOKEN
// here); no real token is read or printed.
// Case a (shoulder re-pick): pin a way tagged lanes=4 oneway=yes (4 per
// side), side, shoulder, Confirm; then re-pick through WHERE's "Pick on
// map" onto a different way with no lanes tag, Save; open the Lanes row.
// Case b (near intersection): pin a way tagged lanes=2 oneway=no (1 per
// side), side, near-intersection kind, Confirm; open the Lanes row.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const NOTAGS = { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null };
function stub(way, name, tags) {
  return JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver',
    candidates: [{ way_id: way, highway_class: 'primary', name, ref: null, bearing: 90, snap_distance_m: 0,
      snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null, tags: { ...NOTAGS, ...tags } }] });
}
const COUNTED = stub('600545936', 'East Colfax Avenue', { oneway: 'yes', maxspeed: '30 mph', lanes: '4' });
const BARE = stub('600545937', 'East Colfax Avenue', { oneway: 'yes', maxspeed: '30 mph' });
const TWO_WAY = stub('600545938', 'East Colfax Avenue', { oneway: 'no', maxspeed: '30 mph', lanes: '2' });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

// Shoot the union of the visible elements matching `sel` and `also` (the
// row's details popover, absolutely placed), padded 8 px.
async function shotOf(p, sel, file, also) {
  await p.locator(sel).first().scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate(([s, a]) => {
    const vis = (q) => [...document.querySelectorAll(q)].find((x) => x.getBoundingClientRect().width > 0);
    const e = vis(s);
    const rs = [e, a && vis(a)].filter(Boolean).map((x) => x.getBoundingClientRect());
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    const rr = Math.max(...rs.map((r) => r.right)), bb = Math.max(...rs.map((r) => r.bottom));
    return { x: l, y: t + window.scrollY, width: rr - l, height: bb - t, text: e.innerText };
  }, [sel, also ?? null]);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${file}`, fullPage: true, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, vw), height: box.height + 16 } });
  return { text: box.text.replace(/\s+/g, ' ').trim(), width: +box.width.toFixed(2), height: +box.height.toFixed(2) };
}

async function pick(p) {
  await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
  await p.getByRole('dialog').getByRole('button', { name: /Colfax/i }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Save & Close' }).click();
}

async function lanesRow(p, out, file) {
  if (!(await p.locator('[data-testid=cell-lanes]').isVisible().catch(() => false))) {
    await p.locator('[data-testid=fact-link-what]').first().click();
  }
  await p.waitForSelector('[data-testid=cell-lanes]', { state: 'visible', timeout: 60000 });
  await p.waitForTimeout(1500);
  out.marker = (await p.getByTestId('info-toggle-lanes').innerText()).trim();
  out.markerParts = await p.getByTestId('info-toggle-lanes').evaluate((e) => [e, ...e.querySelectorAll('*')].map((c) => ({ cls: String(c.className), color: getComputedStyle(c).color, text: c.textContent })));
  out.header = await p.evaluate(() => { const m = document.body.innerText.match(/\d+ guess(es)? marked ⚠[^\n]*|prefilled from the road|nothing detected[^\n]*/); return m ? m[0] : null; });
  out.closed = await shotOf(p, '[data-testid=cell-lanes]', `${file}-closed.png`);
  await p.getByTestId('info-toggle-lanes').click();
  await p.waitForTimeout(500);
  out.provenance = await p.getByTestId('prov-lanes').textContent();
  out.provClass = await p.getByTestId('prov-lanes').getAttribute('class');
  out.provColor = await p.getByTestId('prov-lanes').evaluate((e) => getComputedStyle(e).color);
  out.doubt = await p.locator('[data-testid=detect-lanes-doubt]').textContent().catch(() => null);
  out.open = await shotOf(p, '[data-testid=cell-lanes]', `${file}-open.png`, '[data-testid=info-lanes]');
}

async function start(p, kind) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await pick(p);
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  const side = p.locator('[data-testid=side-option]').filter({ hasText: /South side|Right/i });
  if (await side.count()) await side.first().click(); else await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector(`[data-testid=kind-chip-${kind}]`, { timeout: 60000 });
  await p.locator(`[data-testid=kind-chip-${kind}]`).click();
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
}

async function run(w, h, which) {
  const tag = `${which}-${w}`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const out = {};
  let body = which === 'a' ? COUNTED : TWO_WAY;
  try {
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body }));
    if (which === 'a') {
      await start(p, 'shoulder');
      out.firstMarker = (await p.getByTestId('info-toggle-lanes').innerText().catch(() => '')).trim();
      out.firstValue = await p.locator('#what-lanes').inputValue().catch(() => null);
      body = BARE;
      await p.locator('[data-testid=fact-link-where]').first().click();
      // A located plan's button reads "Edit on map" (WhereBand.tsx).
      await p.getByRole('button', { name: 'Edit on map' }).click();
      await p.waitForTimeout(1500);
      await pick(p);
      await p.waitForTimeout(3000);
    } else {
      await start(p, 'near_intersection');
    }
    await lanesRow(p, out, `${phase}-${tag}-lanes`);
    out.value = await p.locator('#what-lanes').inputValue().catch(() => null);
  } catch (e) {
    out.error = String(e).slice(0, 300);
    await p.screenshot({ path: `${OUT}/${phase}-${tag}-error.png` }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  console.log(phase, tag, JSON.stringify(out));
  return out;
}

const M = {};
for (const which of ['a', 'b']) {
  M[`${which}-1440`] = await run(1440, 900, which);
  M[`${which}-390`] = await run(390, 844, which);
}
fs.writeFileSync(`${OUT}/text-${phase}.json`, JSON.stringify(M, null, 1));
