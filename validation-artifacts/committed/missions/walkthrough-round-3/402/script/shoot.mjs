// #402 before/after shots: the picker's Which-road card after a pick, and
// Enter in the WHERE band's address field.
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev`: a git archive of 90ab1fb for "before", the issue-402
// worktree for "after"; other API calls go to the .env.local backend (no
// backend change on this branch).  Playwright Chromium at DPR 2, 1440x900
// and 390x844.  /api/road-bearing is stubbed with four candidates (the
// issue's "4 DETECTED" at 1600 E Colfax Ave: Colfax both ways and Gilpin
// both ways), so the multi-road card shows; /api/geocode is not stubbed.
// The dev server runs with a local-only GATE_BYPASS_TOKEN (SHOT_TOKEN here).
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
const ADDRESS = '1600 E Colfax Ave, Denver';
fs.mkdirSync(OUT, { recursive: true });

const tags = { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null };
const c = (way_id, name, cls, bearing, snap, extra) => ({ way_id, highway_class: cls, name, ref: null, bearing, snap_distance_m: snap,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null, tags: { ...tags, ...extra } });
const stub = JSON.stringify({ scan_status: 'ok', primary_index: null, isUrban: true, placeName: 'Denver', candidates: [
  c('600545936', 'East Colfax Avenue', 'primary', 90, 3, { oneway: 'yes', maxspeed: '30 mph', lanes: '3' }),
  c('600545937', 'East Colfax Avenue', 'primary', 270, 9, { oneway: 'yes', maxspeed: '30 mph', lanes: '3' }),
  c('600545938', 'North Gilpin Street', 'residential', 0, 21, { oneway: 'no', lanes: '2' }),
  c('600545939', 'North Gilpin Street', 'residential', 180, 24, { oneway: 'no', lanes: '2' }),
] });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

// The Which-road card's frame: the parent of the head whose own words end
// in "detected" (the same element before and after).
async function cardShot(p, file) {
  const box = await p.evaluate(() => {
    const head = [...document.querySelectorAll('[role=dialog] div')].find((d) =>
      /^(⚠|✓)\s*(Which road\?|Road picked) · \d+ detected$/i.test(d.textContent.trim()) && d.children.length <= 1);
    if (!head) return null;
    const frame = head.parentElement;
    frame.scrollIntoView({ block: 'center' });
    const r = frame.getBoundingClientRect();
    const line = frame.querySelector('span.min-w-0');
    const lr = line ? line.getBoundingClientRect() : null;
    const cs = getComputedStyle(frame);
    return { x: r.left, y: r.top, width: r.width, height: r.height, head: head.innerText,
      headColor: getComputedStyle(head).color, glyphColor: getComputedStyle(head.querySelector('span')).color,
      frameBorder: cs.borderTopColor, frameBg: cs.backgroundColor,
      line: line ? line.textContent : null, lineRendered: line ? line.innerText : null,
      lineBox: lr ? { width: +lr.width.toFixed(2), height: +lr.height.toFixed(2) } : null,
      lineClipped: line ? line.scrollWidth > line.clientWidth : null,
      text: frame.innerText };
  });
  if (!box) return { error: 'no card' };
  await park(p);
  const r2 = await p.evaluate(() => {
    const head = [...document.querySelectorAll('[role=dialog] div')].find((d) =>
      /^(⚠|✓)\s*(Which road\?|Road picked) · \d+ detected$/i.test(d.textContent.trim()) && d.children.length <= 1);
    const r = head.parentElement.getBoundingClientRect(); return { x: r.left, y: r.top };
  });
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${file}`, clip: { x: Math.max(0, r2.x - 8), y: Math.max(0, r2.y - 8), width: Math.min(box.width + 16, vw), height: box.height + 16 } });
  const { x, y, ...rest } = box;
  return { ...rest, width: +box.width.toFixed(2), height: +box.height.toFixed(2), text: box.text.replace(/\s+/g, ' ').trim() };
}

async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const out = { geocodeBodies: [] };
  p.on('request', (rq) => { if (rq.url().includes('/api/geocode')) out.geocodeBodies.push(rq.postData()); });
  try {
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: stub }));
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });

    // 1. Enter in the band's address field.
    const field = p.getByLabel('Address or cross streets');
    await field.fill(ADDRESS);
    await field.press('Enter');
    await p.waitForTimeout(4000);
    out.dialogAfterEnter = await p.getByRole('dialog').isVisible().catch(() => false);
    if (!out.dialogAfterEnter) {
      await field.scrollIntoViewIfNeeded();
      await park(p);
      const fb = await p.locator('.a-findrow').first().boundingBox();
      await p.screenshot({ path: `${OUT}/${phase}-${tag}-enter.png`, clip: { x: Math.max(0, fb.x - 8), y: Math.max(0, fb.y - 8), width: Math.min(fb.width + 16, w), height: fb.height + 16 } });
      out.findrow = { width: +fb.width.toFixed(2), height: +fb.height.toFixed(2) };
      // The button path, unchanged on both: open the picker and search.
      await p.getByRole('button', { name: 'Pick on map' }).click();
      await p.waitForTimeout(4000);
    } else {
      await park(p);
      await p.screenshot({ path: `${OUT}/${phase}-${tag}-enter.png` });
    }
    out.searchBox = await p.getByLabel('Address or intersection search').inputValue();
    // On "before" the button-opened picker also searches the address on open;
    // wait for the candidates either way.
    await p.waitForFunction(() => /which road\?/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1000);

    // 2. The card, unpicked, then picked (Colfax eastbound).
    out.unpicked = await cardShot(p, `${phase}-${tag}-card-unpicked.png`);
    await p.getByRole('dialog').getByRole('button', { name: /East Colfax Avenue eastbound/i }).first().click();
    await p.waitForTimeout(2500);
    out.picked = await cardShot(p, `${phase}-${tag}-card-picked.png`);
    out.sideSentence = await p.getByTestId('picker-side-sentence').textContent().catch(() => null);
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
