// #401 before/after shots of the zip row, plus the real downloads.
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev` of the issue worktree (982c544's frontend for "before",
// the fix for "after"), its render calls going to the .env.local backend
// (no backend change on this branch).  Playwright Chromium at DPR 2,
// 1440x900 and 390x844.  /api/road-bearing is stubbed with the Colfax
// candidate (as #398 did); the audit, renders and bundle are live.  The dev
// server runs with a local-only GATE_BYPASS_TOKEN (SHOT_TOKEN here); no real
// token is read or printed.  Every download's suggested filename is
// recorded, and the zip is saved and its entries listed with JSZip.
// The after run was retaken in repair cycle 1 (fingerprint in the names,
// .quote.xlsx, the zip timed); the before run used this script without
// the zipMs lines.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const JSZip = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-401/conestruct/site/package.json')('jszip');
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

async function shotOf(p, sel, file) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0);
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, text: e.innerText };
  }, sel);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${file}`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, vw), height: box.height + 16 } });
  return { text: box.text.replace(/\s+/g, ' ').trim(), width: +box.width.toFixed(2), height: +box.height.toFixed(2) };
}

function track(p) {
  const open = new Set();
  p.on('request', (r) => { if (r.url().includes('/api/')) open.add(r); });
  p.on('requestfinished', (r) => open.delete(r));
  p.on('requestfailed', (r) => open.delete(r));
  return () => [...open].map((r) => new URL(r.url()).pathname);
}

async function grab(p, click) {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), click()]);
  return dl;
}

async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const openNow = track(p);
  const out = {};
  try {
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
    if (w >= 1000) {
      out.zipRow = await shotOf(p, '.dl-all', `${phase}-${tag}-zip-row.png`);
    } else {
      out.filesLine = await shotOf(p, '.dl-files', `${phase}-${tag}-files-line.png`);
      out.zipRow = await shotOf(p, '.dl-all', `${phase}-${tag}-zip-row.png`);
    }
    // The zip: its suggested name and its entries.
    // zipMs (repair cycle 1): click to download event, one local sample.
    const t0 = Date.now();
    const zdl = await grab(p, () => p.locator('.dl-all button').click());
    out.zipMs = Date.now() - t0;
    out.zipName = zdl.suggestedFilename();
    const zpath = `${OUT}/${phase}-${tag}.zip`;
    await zdl.saveAs(zpath);
    const z = await JSZip.loadAsync(fs.readFileSync(zpath));
    out.zipEntries = Object.keys(z.files);
    fs.rmSync(zpath);
    await p.waitForTimeout(1500);
    // Each card's download.
    if (w < 1000) { await p.locator('.dl-files').click(); await p.waitForTimeout(500); }
    out.cardNames = [];
    const n = await p.locator('#dl-cards .dl-btn').count();
    for (let i = 0; i < n; i += 1) {
      const btn = p.locator('#dl-cards .dl-btn').nth(i);
      if (await btn.isDisabled()) { out.cardNames.push('(disabled)'); continue; }
      const d = await grab(p, () => btn.click());
      out.cardNames.push(d.suggestedFilename());
      await p.waitForTimeout(1000);
    }
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
