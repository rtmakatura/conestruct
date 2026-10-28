// #425 / #406 before/after shots (adapted from #398's script/shoot.mjs).
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev`: "before" on a git archive of a0c666d, "after" on the
// issue worktree.  Playwright Chromium at DPR 2, 1440x900 and 390x844.
// /api/road-bearing is stubbed with one candidate (as #398/#420 did); the
// audit is live for the declined case and answered 500 by the route for
// the failed-check control.  The dev server runs with a local-only
// GATE_BYPASS_TOKEN passed in the environment (SHOT_TOKEN here); no real
// token is read or printed.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const CAND = { way_id: '600545937', highway_class: 'primary', name: 'East Colfax Avenue', bearing: 270, snapped_lat: 39.74030, snapped_lng: -104.96555,
  tags: { oneway: 'yes', maxspeed: '30 mph', lanes: '3' } };
// The issue's repro: flagger lane closure on Colfax westbound (one-way), declined.
const FLAGGER = { search: 'Colfax & Williams, Denver', pick: /Colfax/i, side: /North side/i, cand: CAND, kind: 'flagger_lane_closure' };
const SITES = {
  declined: FLAGGER,
  failed: { ...FLAGGER, audit500: true },
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
  // The fix's case: the plan's own audit, live.  The control: the same
  // plan with the audit answered 500 (a failed check, not a decline).
  if (site.audit500) await p.route('**/api/render/audit**', r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'render failed: shot control' }) }));
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

// The cell, its line, its marker, and their computed colours.
async function readCell(p) {
  return p.evaluate(() => {
    const cell = document.querySelector('[data-testid=cell-jurisdiction]');
    const line = document.querySelector('[data-testid=prov-jurisdiction]');
    const mark = cell.querySelector('.a-mark');
    const glyph = mark ? mark.querySelector('span span') : null;
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return null; };
    const r = cell.getBoundingClientRect();
    const lr = line.getBoundingClientRect();
    return {
      state: document.getElementById('what-jurisdiction')?.getAttribute('data-jurisdiction-state') ?? null,
      cellBox: { width: +r.width.toFixed(2), height: +r.height.toFixed(2) },
      line: line.textContent,
      lineClass: line.className,
      lineOnShow: !line.closest('[hidden]'),
      lineBox: { width: +lr.width.toFixed(2), height: +lr.height.toFixed(2) },
      lineColor: getComputedStyle(line).color,
      lineBg: bgOf(line.closest('[hidden]') ? cell : line),
      marker: mark ? mark.textContent : null,
      markerClass: mark ? mark.className : null,
      markerWordColor: mark ? getComputedStyle(mark).color : null,
      glyphColor: glyph ? getComputedStyle(glyph).color : null,
      markerBg: mark ? bgOf(mark) : null,
      windowsLine: document.querySelector('[data-testid=what-windows-line]')?.textContent ?? null,
    };
  });
}

async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const out = {};
  for (const [name, site] of Object.entries(SITES)) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
    const p = await ctx.newPage();
    try {
      await locate(p, site);
      if (name === 'declined') await p.waitForFunction(() => /PLAN DECLINED/i.test(document.body.innerText), null, { timeout: 120000 });
      await p.waitForFunction(() => { const s = document.getElementById('what-jurisdiction')?.getAttribute('data-jurisdiction-state'); return s && s !== 'evaluating'; }, null, { timeout: 120000 });
      await p.waitForTimeout(5000);
      const o = await readCell(p);
      o.shot = await shotOf(p, '[data-testid=cell-jurisdiction]', `${phase}-${tag}-${name}-cell.png`);
      const t = p.locator('[data-testid=info-toggle-jurisdiction]');
      if (await t.count()) {
        await t.click();
        await p.waitForTimeout(400);
        o.details = (await p.locator('[data-testid=info-jurisdiction]').innerText()).replace(/\s+/g, ' ').trim();
        o.openShot = await shotOf(p, '[data-testid=cell-jurisdiction]', `${phase}-${tag}-${name}-cell-open.png`);
      }
      out[name] = o;
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

const M = {};
await run(1440, 900);
await run(390, 844);
fs.writeFileSync(`${OUT}/text-${phase}.json`, JSON.stringify(M, null, 1));
