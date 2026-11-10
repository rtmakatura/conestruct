// #485 walk (local): editing and the CONFIRM questions take turns in the
// WHERE band (ruling 3; ruling 4's second bullet).  Adapted from #469's walk
// (missions/ux-wait-band-followups/issue-469/script/walk469.mjs: the same
// pin, the same road stub, the same box reads).  Each step reads the band's
// box, the aerial frame, the right column, the Edit panel, the waiting row
// and the CONFIRM card, runs axe on the band and the 44 px measure, and
// crops the band.
//
// The sequence, at each size:
//   A. the questions answered (Confirm on screen) -> Edit (the panel and the
//      waiting row) -> Cancel.
//   B. Edit -> the length typed (600) -> Done (nothing re-asked, E1).
//   C. Edit -> Move -> the picker -> another address -> Save & Close (the
//      side cleared, the panel still has the column) -> Done (the side
//      re-asked with E2's line).
//   D. the side answered -> Confirm (WHAT opens) -> WHERE reopened -> Edit ->
//      Cancel.
//
// usage: node walk.mjs <outdir> <port> [sizes]
// Local `next dev` on the issue-485 worktree, MODAL_RENDER_URL at the local
// backend with Overpass STUBBED (scripts/verify-generate-cls-stub.py, replay
// of ux-group3-where's and ux-site-map's recorded answers); /api/road-bearing
// stubbed from the same fixture.  Chromium, DPR 1.  The gate header rides
// only the site's own origin (scripts/gate.cjs); the token is read from the
// site's .env.local into the environment and never printed.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');
// Playwright is installed in the main checkout (the worktree has no root
// node_modules): the worktree's parent three folders up.
const require = createRequire(path.join(W, '../../..', 'package.json'));
const { chromium } = require('playwright');
if (!process.env.GATE_BYPASS_TOKEN) {
  const env = fs.readFileSync(path.join(W, 'conestruct/site/.env.local'), 'utf8');
  const m = env.match(/^GATE_BYPASS_TOKEN=(.*)$/m);
  if (m) process.env.GATE_BYPASS_TOKEN = m[1].trim().replace(/^"|"$/g, '');
}
const { newGatedContext, guardOutput } = require(path.join(W, 'scripts/gate.cjs'));
guardOutput();
const AXE = fs.readFileSync(path.join(W, 'conestruct/site/node_modules/axe-core/axe.min.js'), 'utf8');
const [OUT, PORT, SIZES] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
const sizes = (SIZES || '1440x900,1198x930,390x844').split(',').map((s) => s.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(path.join(W, 'validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json'), 'utf8'));
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
// The first pin, then (C) another address on the same road, so the pin moves.
const ADDR = (w) => (w <= 480 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');
const ADDR_MOVED = (w) => (w <= 480 ? '1550 E Colfax Ave, Denver' : '1600 E Colfax Ave, Denver');
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function read(p) {
  return p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return null; return { top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1), left: +r.left.toFixed(1), w: +r.width.toFixed(1) }; };
    const stack = q('.wq-stack');
    const wait = q('[data-testid=where-questions-wait]');
    return {
      y: Math.round(scrollY),
      // The frame's place in the band (its top less the band's), so a page
      // scroll doesn't read as a move.
      frameInBand: (() => { const f = q('[data-testid=band-aerial-frame]'), bd = q('[data-testid=band-where]'); if (!f || !bd) return null; const a = f.getBoundingClientRect(), c = bd.getBoundingClientRect(); return { dy: +(a.top - c.top).toFixed(1), left: +a.left.toFixed(1), w: +a.width.toFixed(1), h: +a.height.toFixed(1) }; })(),
      band: box(q('[data-testid=band-where]')), stack: box(stack), aerial: box(q('.wq-stack > .a-aerial')), frame: box(q('[data-testid=band-aerial-frame]')),
      side: box(q('.wq-side')), panel: box(q('[data-testid=where-edit-panel]')), wait: box(wait), card: box(q('[data-testid=where-questions]')),
      summary: box(q('[data-testid=where-summary]')),
      attrs: stack ? { card: stack.getAttribute('data-card'), edit: stack.hasAttribute('data-edit'), tap: stack.hasAttribute('data-tap') } : null,
      // The frame is pinned (the 390 strip) when its position is sticky.
      framePos: q('[data-testid=band-aerial-frame]') ? getComputedStyle(q('[data-testid=band-aerial-frame]')).position : null,
      waitText: wait?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      // Not a control: nothing focusable or clickable in or on it.
      waitIsControl: wait ? Boolean(wait.matches('button, a, [tabindex], [role=button]') || wait.querySelector('button, a, input, [tabindex], [role=button]')) : null,
      reasked: q('[data-testid=edit-reasked-note]')?.innerText ?? null,
      records: [...document.querySelectorAll('[data-testid=where-questions] .nyq-answered .nyq-row-text')].map((e) => e.innerText),
      q: (q('[data-testid=where-questions] .nyq-q')?.innerText ?? '').trim().slice(0, 44) || null,
      sideChecked: q('[data-testid=side-option]')?.checked ?? null,
      length: q('#band-worklen')?.value ?? null,
      open: q('[data-testid=band-stack]')?.getAttribute('data-open-band') ?? null,
    };
  });
}
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('[data-testid=band-where]') ?? document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  });
}
async function small(p) {
  return p.evaluate(() => {
    const band = document.querySelector('[data-testid=band-where]');
    if (!band) return [];
    const out = [];
    for (const e of band.querySelectorAll('button, a, input, label.nyq-answer')) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(e).visibility === 'hidden') continue;
      if (r.width < 44 || r.height < 44) out.push({ text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), testid: e.getAttribute('data-testid'), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
    }
    return out;
  });
}

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, steps: [], errors: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await newGatedContext(b, BASE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    return r.fulfill({ status: 200, contentType: 'application/json', body: det([cand(1547338997, { lat: asked.lat, lng: asked.lng }, COLFAX_WEST)]) });
  });
  const step = async (name) => {
    await p.waitForTimeout(900);
    const s = { name, ...(await read(p)) };
    s.axe = await axe(p);
    s.small = await small(p);
    s.shot = `${tag}-${nn()}-${name}.png`;
    await p.locator('[data-testid=band-where]').screenshot({ path: `${OUT}/${s.shot}` }).catch(() => p.screenshot({ path: `${OUT}/${s.shot}` }));
    out.steps.push(s);
    console.log(tag, name.padEnd(22), '| band h', s.band?.h, '| side h', s.side?.h, '| frame', s.frame ? `${s.frame.left},${s.frame.top} ${s.frame.w}x${s.frame.h} ${s.framePos}` : null,
      '| attrs', JSON.stringify(s.attrs), '| panel', s.panel?.h ?? '-', '| wait', s.wait?.h ?? '-', s.waitText ? `"${s.waitText}" control=${s.waitIsControl}` : '',
      '| card', s.card?.h ?? '-', '| reasked', s.reasked ? `"${s.reasked}"` : '-', '| records', s.records.length, '| q', s.q, '| len', s.length, '| axe', s.axe.length, 'small', s.small.length);
    return s;
  };
  const pick = async (testid) => { await p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click(); };
  const search = async (addr) => {
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(addr);
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
    if (await want.count()) await want.first().click().catch(() => {});
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[role=dialog]', { state: 'detached', timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);
  };
  const edit = async () => { await p.locator('[data-testid=where-edit]').click(); };
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await search(ADDR(w));
    await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
    await p.waitForSelector('[data-testid=band-aerial-img]', { timeout: 60000 });
    await pick('kind-chip-shoulder');
    await p.waitForTimeout(1500);
    await nextBtn(p).click();
    await p.waitForTimeout(1500);
    await pick('side-option');
    // A: Confirm on screen -> Edit -> Cancel.
    await step('A-questions-confirm');
    await edit();
    await step('A-edit-panel');
    await p.locator('[data-testid=where-edit-cancel]').click();
    await step('A-cancelled');
    // B: Edit -> the length -> Done.
    await edit();
    await p.locator('#band-worklen').fill('600');
    await p.locator('#band-worklen').press('Enter');
    await step('B-length-typed');
    await p.locator('[data-testid=where-edit-done]').click();
    await step('B-done-nothing-reasked');
    // C: Edit -> Move -> another address -> Done.
    await edit();
    await step('C-edit-panel');
    await p.locator('[data-testid=move-action-start]').click();
    await search(ADDR_MOVED(w));
    await step('C-moved-panel-holds');
    await p.locator('[data-testid=where-edit-done]').click();
    await step('C-done-side-reasked');
    // D: answer, Confirm, reopen WHERE, Edit, Cancel.
    await pick('side-option');
    await step('D-side-answered');
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForTimeout(2500);
    await p.locator('[data-testid=fact-link-where]').click();
    await step('D-reopened-after-confirm');
    await edit();
    await step('D-edit-after-confirm');
    await p.locator('[data-testid=where-edit-cancel]').click();
    await step('D-cancelled-after-confirm');
  } catch (e) {
    out.errors.push(`walk: ${String(e).split('\n')[0].slice(0, 300)}`);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 1));
  const hs = out.steps.map((s) => s.band?.h).filter((v) => v != null);
  const fr = out.steps.map((s) => s.frameInBand && `${s.frameInBand.left},${s.frameInBand.dy} ${s.frameInBand.w}x${s.frameInBand.h}`).filter(Boolean);
  console.log(tag, 'errors', out.errors.length, out.errors.join(' | ').slice(0, 300), '| band h min', Math.min(...hs), 'max', Math.max(...hs),
    '| frames', [...new Set(fr)].join(' / '), '| axe total', out.steps.reduce((a, s) => a + s.axe.length, 0), '| small total', out.steps.reduce((a, s) => a + s.small.length, 0));
}

for (const [w, h] of sizes) await run(w, h);
