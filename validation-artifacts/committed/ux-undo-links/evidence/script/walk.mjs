// #457 walk (local), adapted from #446's and #453's walk.mjs.
// usage: node walk.mjs <outdir> <port> <phase: before|after>
// Local `next dev` on the issue-457 worktree, MODAL_RENDER_URL at the local
// backend (ux-group3-where's serve_replay.py, Overpass replayed).
// /api/road-bearing is stubbed from the recorded fixture.  The gate header
// goes through scripts/gate.cjs newGatedContext (the local site's own host
// only); the token is read from the main checkout's .env.local, never printed.
// Chromium, DPR 1 (crops at DPR 1).  Widths 1440x900 and 390x844, plus
// 390x664 for focus after Move.
// Captures, per width: the CONFIRM card with the kind answered (U-a), the
// cross street's ✓ row (U-e), the cross answered row (U-a), the NEEDS YOU
// answered row after Generate (U-b); a keyboard-focus crop on the NEEDS YOU
// Undo; every Undo's box, type, ink and its row's edges; axe on each block;
// every target under 44 px.
import { createRequire } from 'module';
import fs from 'fs';
const MAIN = 'C:/Users/rtmak/Documents/traffic-control-tool';
const W = `${MAIN}/.claude/worktrees/issue-457`;
for (const line of fs.readFileSync(`${MAIN}/conestruct/site/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = /^GATE_BYPASS_TOKEN=(.*)$/.exec(line.trim());
  if (m) process.env.GATE_BYPASS_TOKEN = m[1].replace(/^"|"$/g, '');
}
const require = createRequire(`${MAIN}/package.json`);
const { chromium } = require('playwright');
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${W}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PORT, PHASE] = process.argv.slice(2);
// A request still in the gate's route when a browser closes rejects after
// the close; it's the walk's own teardown, not the page.  Counted, not thrown.
let lateRejections = 0;
process.on('unhandledRejection', () => { lateRejections += 1; });
const BASE = `http://localhost:${PORT}`;
const SIZES = (process.env.SIZES ?? '1440x900,390x844,390x664').split(',').map((s) => s.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(`${W}/validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json`, 'utf8'));
const PIN0 = { lat: 39.739781, lng: -104.968249 };
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
const addrFor = (w) => (w === 390 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => { const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)); const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)); return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; };
const distM = (a, at) => Math.hypot((a.lat - at.lat) * 111320, (a.lon - at.lng) * 111320 * Math.cos(rad(at.lat)));
const COLFAX_WEST = [1547338997, 1547338998, 223788857, 600545918, 791808880];
function chainGeometry(ids) {
  const out = [];
  for (const id of ids) {
    const g = FIX.elements.find((e) => e.type === 'way' && e.id === id).geometry;
    for (const n of g) { const l = out[out.length - 1]; if (!l || l.lat !== n.lat || l.lon !== n.lon) out.push(n); }
  }
  return out;
}
function cand(id, at, chain = null) {
  const w = FIX.elements.find((e) => e.type === 'way' && e.id === id);
  const g = chain ? chainGeometry(chain) : w.geometry;
  let i = 0; g.forEach((n, k) => { if (distM(n, at) < distM(g[i], at)) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return { way_id: String(id), highway_class: w.tags.highway, name: w.tags.name, ref: s('ref'), bearing: +brg(a, b).toFixed(2),
    snap_distance_m: +distM(g[i], at).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
    tags: { oneway: s('oneway'), maxspeed: s('maxspeed'), lanes: s('lanes'), lanes_forward: s('lanes:forward'), lanes_backward: s('lanes:backward'),
      lanes_both_ways: s('lanes:both_ways'), turn_lanes: s('turn:lanes'), turn_lanes_forward: s('turn:lanes:forward'), turn_lanes_backward: s('turn:lanes:backward') },
    geometry: g.map((n) => [n.lat, n.lon]) };
}
const det = (cands) => JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: cands });
function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}

// Every Undo control on the page: its box, type and ink, and its row's edges.
const undos = (p) => p.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('button')) {
    const text = (e.innerText ?? '').replace(/\s+/g, ' ').trim();
    if (!/^undo\b/i.test(text)) continue;
    const b = e.getBoundingClientRect();
    if (!b.width) continue;
    const cs = getComputedStyle(e);
    const row = e.closest('li, .wq-cross-row, .border') ?? e.parentElement;
    const r = row.getBoundingClientRect();
    const rs = getComputedStyle(row);
    out.push({
      testid: e.getAttribute('data-testid'), cls: String(e.className), text, tag: e.tagName,
      w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      font: `${/mono/i.test(cs.fontFamily) ? 'mono' : cs.fontFamily.split(',')[0].replace(/"/g, '')} ${cs.fontSize}/${cs.fontWeight}`,
      color: cs.color, border: `${cs.borderTopWidth} ${cs.borderTopStyle}`, background: cs.backgroundColor,
      transform: cs.textTransform, decoration: cs.textDecorationLine, padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      row: { cls: String(row.className).slice(0, 60), h: +r.height.toFixed(1), paddingRight: rs.paddingRight },
      gaps: { top: +(b.top - r.top).toFixed(1), bottom: +(r.bottom - b.bottom).toFixed(1), right: +(r.right - b.right).toFixed(1) },
    });
  }
  return out;
});
const axe = async (p, sel) => {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return 'no root';
    const r = await window.axe.run(root, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  }, sel);
};
const small = (p, sel) => p.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return 'no root';
  const s = []; let n = 0;
  for (const e of root.querySelectorAll('button, a, input')) {
    const b = e.getBoundingClientRect();
    if (!b.width) continue;
    n += 1;
    if (b.width < 44 || b.height < 44) s.push({ tag: e.tagName, cls: String(e.className).slice(0, 50), text: (e.innerText ?? '').slice(0, 30), w: +b.width.toFixed(1), h: +b.height.toFixed(1) });
  }
  return { targets: n, small: s };
}, sel);

async function pin(p, w) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(addrFor(w));
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
  if (await want.count()) await want.first().click().catch(() => {});
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
}

async function run(w, h) {
  const tag = `${PHASE}-${w}x${h}`;
  const focusOnly = h === 664;
  const b = await chromium.launch();
  const out = { size: `${w}x${h}`, phase: PHASE, errors: [], steps: {} };
  let p = null;
  try {
    const ctx = await newGatedContext(b, `${BASE}/sandbox`, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p = await ctx.newPage();
    p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
    let mode = 'pin';
    let lastMeta = null;
    p.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/api/render/corridor-geometry')) {
        const m = JSON.parse(r.postData() ?? '{}').scenario?.meta;
        if (m) lastMeta = { lat: m.lat, lng: m.lng };
      }
    });
    await p.route('**/api/road-bearing**', async (r) => {
      const asked = JSON.parse(r.request().postData() ?? 'null');
      const at = asked && typeof asked.lat === 'number' ? { lat: asked.lat, lng: asked.lng } : PIN0;
      const body = mode === 'pin' ? det([cand(1547338997, at, COLFAX_WEST)]) : det([cand(1547338997, CROSSING, COLFAX_WEST), cand(492215711, CROSSING)]);
      return r.fulfill({ status: 200, contentType: 'application/json', body });
    });
    const unstick = () => p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } document.querySelector('.workbench-frame')?.style.setProperty('display', 'none'); });
    const restick = () => p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } document.querySelector('.workbench-frame')?.style.removeProperty('display'); });
    const crop = async (name, sel) => {
      const l = p.locator(sel).first();
      if (!(await l.count())) return null;
      await unstick();
      const file = `${tag}-${name}.png`;
      await l.screenshot({ path: `${OUT}/${file}` });
      await restick();
      return file;
    };
    const record = async (name, sel, root) => {
      await p.mouse.move(w - 3, h - 3);
      await p.waitForTimeout(200);
      const s = { shot: await crop(name, sel), undos: await undos(p), axe: await axe(p, root), targets: await small(p, root) };
      out.steps[name] = s;
      console.log(tag, name, '| undos', s.undos.length, '| axe', Array.isArray(s.axe) ? s.axe.length : s.axe, '| small', s.targets.small?.length);
    };

    // The WHERE band: the near-intersection kind, the cross street tapped.
    await pin(p, w);
    await p.locator('label.nyq-answer:has([data-testid=kind-chip-near_intersection])').click();
    await p.waitForTimeout(800);
    await p.locator('[data-testid=where-questions] .nyq-card .wq-next').click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(1500);
    if (!focusOnly) await record('01-confirm-kind-answered', '[data-testid=where-questions]', '[data-testid=band-where]');
    mode = 'cross';
    const img = p.locator('[data-testid=band-aerial-img]');
    await p.evaluate(() => document.querySelector('[data-testid=band-aerial-frame]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(400);
    const box = await img.boundingBox();
    const at = pixelOf(CROSSING, lastMeta ?? PIN0, box.width, box.height);
    await p.mouse.click(box.x + at.x, box.y + at.y);
    await p.waitForSelector('[data-testid=cross-row]', { timeout: 60000 });
    await p.waitForFunction(() => /of where the work starts/.test(document.querySelector('[data-testid=cross-row-line]')?.innerText ?? ''), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);
    if (!focusOnly) await record('02-cross-row', '[data-testid=where-questions]', '[data-testid=band-where]');

    // Focus after Move, by keyboard: the heading has focus after the tap;
    // Tab reaches Move, Enter presses it.
    const focusRead = () => p.evaluate(() => {
      const a = document.activeElement;
      const r = a?.getBoundingClientRect();
      const nav = document.querySelector('.a-nav, nav')?.getBoundingClientRect().bottom ?? 0;
      return { testid: a?.getAttribute('data-testid') ?? null, tag: a?.tagName, text: (a?.innerText ?? '').trim().slice(0, 40),
        top: r ? +r.top.toFixed(1) : null, bottom: r ? +r.bottom.toFixed(1) : null, onScreen: r ? r.top >= nav && r.bottom <= window.innerHeight : null,
        outline: a ? `${getComputedStyle(a).outlineWidth} ${getComputedStyle(a).outlineStyle}` : null, scrollY: Math.round(window.scrollY) };
    });
    await p.locator('[data-testid=cross-move]').focus();
    await p.keyboard.press('Shift+Tab');
    await p.keyboard.press('Tab');
    out.steps.beforeMove = await focusRead();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(1500);
    out.steps.afterMove = await focusRead();
    console.log(tag, 'after Move focus', JSON.stringify(out.steps.afterMove));
    const vfile = `${tag}-03-after-move-viewport.png`;
    await p.screenshot({ path: `${OUT}/${vfile}` });
    out.steps.afterMove.shot = vfile;
    if (focusOnly) return out;
    // Cancel the Move, then Next: the cross question's answered row.
    await p.locator('[data-testid=cross-move]').click();
    await p.waitForTimeout(800);
    await p.locator('[data-testid=where-questions] .nyq-card .wq-next').click();
    await p.waitForTimeout(1500);
    await record('04-confirm-cross-answered', '[data-testid=where-questions]', '[data-testid=band-where]');

    // A generated plan's NEEDS YOU: a fresh page, Shoulder work.
    mode = 'pin';
    await pin(p, w);
    const chips = await p.locator('[data-testid^=kind-chip-]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
    const kind = chips.find((c) => /shoulder/.test(c)) ?? chips[0];
    await p.locator(`label.nyq-answer:has([data-testid=${kind}])`).click();
    await p.waitForTimeout(800);
    await p.locator('[data-testid=where-questions] .nyq-card .wq-next').click();
    await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 30000 });
    await p.waitForTimeout(1200);
    await p.locator('[data-testid=where-questions] label.nyq-answer').first().click();
    await p.waitForTimeout(1500);
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
    await p.waitForTimeout(3000);
    const oneWay = p.getByRole('button', { name: /^One-way$/ });
    if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(4000); }
    await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
    await p.getByTestId('generate-plan').click();
    await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
    await p.waitForSelector('.needs-you .nyq-card label.nyq-answer', { timeout: 120000 });
    await p.waitForTimeout(3000);
    await p.locator('.needs-you .nyq-card label.nyq-answer').first().click();
    await p.waitForTimeout(500);
    await p.locator('.needs-you .nyq-card').getByRole('button', { name: 'Next question' }).click();
    await p.waitForTimeout(1200);
    await record('05-needs-you-answered', '.needs-you', '.needs-you');
    // One keyboard-focus crop: Tab from the answered row's own button.
    const rowBtn = p.locator('.needs-you .nyq-answered .nyq-row-btn').first();
    await rowBtn.focus();
    await p.keyboard.press('Shift+Tab');
    await p.keyboard.press('Tab');
    await p.keyboard.press('Tab');
    out.steps.needsYouFocus = await focusRead();
    out.steps.needsYouFocus.shot = await crop('06-needs-you-undo-focus', '.needs-you .nyq-answered');
    console.log(tag, 'focus', JSON.stringify(out.steps.needsYouFocus));
  } catch (e) {
    out.errors.push(`walk: ${String(e).slice(0, 400)}`);
    console.log(tag, 'ERROR', String(e).slice(0, 400));
    if (p && process.env.DEBUG_SHOT) await p.screenshot({ path: process.env.DEBUG_SHOT }).catch(() => {});
  } finally {
    await b.close();
  }
  return out;
}

const all = [];
for (const [w, h] of SIZES) all.push(await run(w, h));
fs.writeFileSync(`${OUT}/walk-${PHASE}.json`, JSON.stringify({ lateRejections, runs: all }, null, 1));
