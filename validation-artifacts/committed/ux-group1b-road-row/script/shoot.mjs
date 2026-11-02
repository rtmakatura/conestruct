// #436 (UX group 1b) evidence for the picked-road row.
// usage: node shoot.mjs <outdir> <port>
// Local `next dev` of the ux-group1b worktree with a local-only
// GATE_BYPASS_TOKEN (SHOT_TOKEN here); no real token is read or printed.
// Playwright Chromium at DPR 2, 1440x900 and 390x844.  /api/road-bearing
// is stubbed: two roads (the picker, then the picked row with Change) and
// one road (the auto-adopted row, no Change), as #435's script did.
// Measured: the name's line count, the three line gaps, the band padding,
// Change's hit box and border, the Details open / close / Escape (picker
// still open), the picker header's i details still there, axe on the row.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync(new URL('../../../../conestruct/site/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const NOTAGS = { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null };
const cand = (way, cls, name, bearing, d) => ({ way_id: way, highway_class: cls, name, ref: null, bearing, snap_distance_m: d,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null, tags: { ...NOTAGS, oneway: 'yes', maxspeed: '30 mph', lanes: '2' } });
const body = (cs) => JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: cs });
const TWO = body([cand('1547338992', 'primary', 'East Colfax Avenue', 271, 1.2), cand('628643782', 'primary', 'East Colfax Avenue', 91, 6.1)]);
const ONE = body([cand('1547338992', 'primary', 'East Colfax Avenue', 271, 1.2)]);

const ROW = '[data-testid=road-picked]';

async function rowFacts(p) {
  return p.evaluate((sel) => {
    const row = document.querySelector(sel);
    const r = (q) => row.querySelector(q)?.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    const head = r('.road-picked-head'), name = r('.road-picked-name'), sub = r('.road-picked-sub');
    const nameEl = row.querySelector('.road-picked-name');
    const ncs = getComputedStyle(nameEl);
    const lines = Math.round(nameEl.getBoundingClientRect().height / parseFloat(ncs.lineHeight));
    const ch = row.querySelector('.road-pick-change');
    const chs = ch && getComputedStyle(ch);
    const cs = getComputedStyle(row);
    const det = row.querySelector('[data-testid=info-toggle-road-picked]');
    const ds = getComputedStyle(det);
    return {
      row: { width: +rr.width.toFixed(2), height: +rr.height.toFixed(2), padding: cs.padding },
      name: { text: nameEl.textContent, lines, font: `${ncs.fontFamily.split(',')[0]} ${ncs.fontSize}/${ncs.fontWeight}`, color: ncs.color, left: +(name.left - rr.left).toFixed(2) },
      gapHeadToName: +(name.top - head.bottom).toFixed(2),
      gapNameToSub: +(sub.top - name.bottom).toFixed(2),
      headHeight: +head.height.toFixed(2),
      sub: { text: row.querySelector('.road-picked-sub').textContent, size: getComputedStyle(row.querySelector('.road-picked-sub')).fontSize, color: getComputedStyle(row.querySelector('.road-picked-sub')).color },
      change: ch ? { text: ch.textContent, height: +ch.getBoundingClientRect().height.toFixed(2), border: chs.borderTopWidth, color: chs.color, font: `${chs.fontSize}/${chs.fontWeight}`, insideRow: ch.getBoundingClientRect().top >= rr.top } : null,
      details: { text: det.textContent, underline: ds.textDecorationLine, color: ds.color },
      monoToggleInRow: !!row.querySelector('.a-info-toggle'),
    };
  }, ROW);
}

async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async (sel) => {
    const r = await window.axe.run(document.querySelector(sel), { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, n: v.nodes.length }));
  }, ROW);
}

async function openPicker(p, stub) {
  await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: stub }));
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
  await p.getByRole('button', { name: 'SEARCH' }).click();
}

async function shot(p, file) {
  const loc = p.locator(ROW).first();
  await loc.scrollIntoViewIfNeeded();
  await p.mouse.move(p.viewportSize().width - 3, p.viewportSize().height - 3);
  await p.waitForTimeout(250);
  await loc.screenshot({ path: `${OUT}/${file}` });
}

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = {};
  for (const [kind, stub] of [['two', TWO], ['one', ONE]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
    const p = await ctx.newPage();
    const o = (out[kind] = {});
    try {
      await openPicker(p, stub);
      if (kind === 'two') {
        await p.waitForSelector('[data-testid=road-pick-panel]', { timeout: 90000 });
        await p.getByRole('dialog').getByRole('radio', { name: /westbound/i }).click();
      }
      await p.waitForSelector(ROW, { timeout: 90000 });
      await p.waitForTimeout(800);
      o.closed = await rowFacts(p);
      await shot(p, `${tag}-${kind}-closed.png`);
      o.axeClosed = await axe(p);
      const det = p.getByTestId('info-toggle-road-picked');
      await det.click();
      await p.waitForTimeout(300);
      o.openedVisible = await p.getByTestId('info-road-picked').isVisible();
      o.openedText = (await p.getByTestId('info-road-picked').innerText()).replace(/\s+/g, ' ').trim();
      await shot(p, `${tag}-${kind}-details-open.png`);
      o.axeOpen = await axe(p);
      await det.click();
      await p.waitForTimeout(300);
      o.closedByClick = !(await p.getByTestId('info-road-picked').isVisible());
      await det.click();
      await p.waitForTimeout(300);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);
      o.closedByEscape = !(await p.getByTestId('info-road-picked').isVisible());
      o.dialogOpenAfterEscape = await p.locator('[role=dialog]').isVisible();
      if (kind === 'two') {
        await p.getByRole('button', { name: 'Change' }).click();
        await p.waitForTimeout(400);
        o.changeReopensPicker = await p.locator('[data-testid=road-pick-panel]').isVisible();
        o.headerInfoToggle = await p.getByTestId('info-toggle-road-pick').isVisible();
      }
    } catch (e) {
      o.error = String(e).slice(0, 400);
      await p.screenshot({ path: `${OUT}/${tag}-${kind}-error.png` }).catch(() => {});
    }
    await ctx.close();
  }
  await b.close();
  return out;
}

const res = { 1440: await run(1440, 900), 390: await run(390, 844) };
fs.writeFileSync(`${OUT}/facts.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, (k, v) => (k === 'openedText' || k === 'text' ? undefined : v)));
