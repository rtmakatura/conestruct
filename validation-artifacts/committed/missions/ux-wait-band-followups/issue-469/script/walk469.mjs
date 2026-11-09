// #469 resume (ux-wait-band-followups): copied from the parked walk
// (missions/ux-group6-wait-and-band/issue-469/script/walk469.mjs; its
// launch.cjs and serve_stub.py are used from there as they are).  The
// "details" mode now also walks 390, reads the floating panel's box, whether
// it is on top where it shows (not clipped or covered), and closes it once
// with Esc.
// #469 walk (local): is the WHERE band one height across every CONFIRM
// state at two-column widths?  Adapted from #461's walk461.mjs (same steps,
// same stubs) with the tap's found / none / failed states and the cross
// street's Undo added.  Each step reads the band's box, the aerial frame, the
// road row (the summary), the CONFIRM card and its action row.
// usage: WALK_SECRETS_DIR=<dir> node walk469.mjs <outdir> <port> [sizes] [measure]
//   sizes: "1440x900,1198x930,390x844" (default); measure=1 runs axe and the
//   44 px measure on every step.  A 5th argument "details" walks only the
//   kind question with its Details opened and closed (#469 repair 2).
// Local `next dev` on the issue-469 worktree, MODAL_RENDER_URL at the local
// backend with Overpass STUBBED (replay of ux-group3-where's recorded
// answers); /api/road-bearing stubbed from the same fixture.  Chromium, DPR 1.
// The gate header rides only the site's own origin (scripts/gate.cjs).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-469';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
if (!process.env.GATE_BYPASS_TOKEN) {
  process.env.GATE_BYPASS_TOKEN = JSON.parse(fs.readFileSync(path.join(process.env.WALK_SECRETS_DIR, 'walk-secrets.json'), 'utf8')).gate;
}
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${W}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PORT, SIZES, MEASURE, MODE] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
const sizes = (SIZES || '1440x900,1198x930,390x844').split(',').map((s) => s.split('x').map(Number));
const measure = MEASURE === '1';
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(`${W}/validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json`, 'utf8'));
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
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
const CROSS_STUB = det([cand(1547338997, CROSSING, COLFAX_WEST), cand(492215711, CROSSING)]);
function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}
const ADDR = (w) => (w <= 480 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function read(p) {
  return p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1), left: +r.left.toFixed(1), w: +r.width.toFixed(1) }; };
    const band = q('[data-testid=band-where]');
    const wq = q('[data-testid=where-questions]');
    const card = q('[data-testid=where-questions] .nyq-card');
    const foot = q('[data-testid=where-questions] .nyq-card .nyq-foot');
    const wqB = box(wq), footB = box(foot);
    // The card's own content, top to its last child, whatever it is stretched to.
    // (after the fix the CONFIRM card is stretched, so this is its content's
    // own height: the head, the question block and the rows, with the card's
    // borders and padding; the pinned action row's room is that padding.)
    let natural = null;
    if (wq) {
      const ws = getComputedStyle(wq);
      let sum = ['borderTopWidth', 'borderBottomWidth', 'paddingTop', 'paddingBottom'].reduce((a, k) => a + parseFloat(ws[k]), 0);
      for (const k of wq.children) sum += k.getBoundingClientRect().height;
      natural = +sum.toFixed(1);
    }
    return {
      y: Math.round(scrollY),
      q: (q('[data-testid=where-questions] .nyq-q')?.innerText ?? '').trim().slice(0, 44) || null,
      band: box(band), stack: box(q('.wq-stack')), aerial: box(q('.wq-stack > .a-aerial')), frame: box(q('[data-testid=band-aerial-frame]')),
      road: box(q('[data-testid=where-summary]')), side: box(q('.wq-side')), wq: wqB, card: box(card), foot: footB,
      footToWqBottom: wqB && footB ? +((wqB.top + wqB.h) - (footB.top + footB.h)).toFixed(1) : null,
      // #469 repair 1: the action row's offset from the card's bottom, past
      // the card's 1 px border and its own 24 px inset (0 = pinned there).
      footOffset: wqB && footB ? +((wqB.top + wqB.h) - (footB.top + footB.h) - parseFloat(getComputedStyle(wq).borderBottomWidth) - 24).toFixed(1) : null,
      cardNatural: natural,
      // Repair 2: the Details text (when open) and its toggle.
      details: (() => { const d = q('[data-testid=where-questions] .nyq-details'); return d && !d.hidden ? box(d) : null; })(),
      detailsBtn: box(q('[data-testid=where-questions] .nyq-details-btn')),
      // Resume: the floating panel.  `onTop` = the topmost element at five
      // points of its box (centre and 4 px inside each corner) is the panel
      // or inside it: nothing clips or covers it.
      panel: (() => {
        const d = q('[data-testid=where-questions] .nyq-details');
        if (!d || d.hidden) return null;
        // Bring it on screen first (elementFromPoint reads only the
        // viewport); page boxes above are read with scrollY, so they hold.
        d.scrollIntoView({ block: 'nearest' });
        const r = d.getBoundingClientRect();
        const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
        const onTop = pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && d.contains(e); });
        return { position: getComputedStyle(d).position, onTop, inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, w: +r.width.toFixed(1) };
      })(),
      rows: box(q('[data-testid=where-questions] .nyq-rows')),
      tap: q('.wq-stack')?.hasAttribute('data-tap') ?? null,
      cross: ['cross-finding', 'cross-row', 'cross-none', 'cross-failed'].filter((t) => q(`[data-testid=${t}]`)).join(',') || null,
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
// Every visible button/link/radio label in the band, under 44 px either way.
async function small(p) {
  return p.evaluate(() => {
    const band = document.querySelector('[data-testid=band-where]');
    if (!band) return [];
    const out = [];
    for (const e of band.querySelectorAll('button, a, label.nyq-answer')) {
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
  let crossMode = 'off';
  await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    if (crossMode === 'fail') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"walk: forced failure"}' });
    const body = crossMode === 'found' ? CROSS_STUB : det([cand(1547338997, { lat: asked.lat, lng: asked.lng }, COLFAX_WEST)]);
    return r.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const step = async (name) => {
    const s = { name, ...(await read(p)) };
    if (measure) { s.axe = await axe(p); s.small = await small(p); }
    s.shot = `${tag}-${nn()}-${name}.png`;
    const band = p.locator('[data-testid=band-where]');
    await band.screenshot({ path: `${OUT}/${s.shot}` }).catch(() => p.screenshot({ path: `${OUT}/${s.shot}` }));
    // Resume: with the panel open, a full-page crop from the band's top to
    // the panel's bottom (the band crop cuts the floating panel off).
    if (s.panel && s.band && s.details) {
      const bottom = Math.max(s.band.top + s.band.h, s.details.top + s.details.h) + 16;
      await p.screenshot({ path: `${OUT}/${tag}-${name}-page.png`, fullPage: true, clip: { x: 0, y: s.band.top, width: w, height: bottom - s.band.top } }).catch(() => {});
    }
    out.steps.push(s);
    console.log(tag, name.padEnd(20), '| band h', s.band?.h, '| stack h', s.stack?.h, '| frame', s.frame?.top, s.frame?.h, '| road', s.road?.top, s.road?.h, '| wq h', s.wq?.h, 'natural', s.cardNatural, '| foot->bottom', s.footToWqBottom, '| foot top', s.foot?.top, 'offset', s.footOffset, ...(MODE === 'details' ? ['| details', s.details ? `${s.details.top}+${s.details.h}` : null, '| toggle', s.detailsBtn ? `${s.detailsBtn.top}+${s.detailsBtn.h} w${s.detailsBtn.w}` : null, '| panel', s.panel ? `${s.panel.position} onTop=${s.panel.onTop} inView=${s.panel.inViewport} w${s.panel.w}` : null, '| rows top', s.rows?.top] : []), '| cross', s.cross, measure ? `| axe ${s.axe.length} small ${s.small.length}` : '');
    return s;
  };
  const pick = async (testid) => { await p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click(); };
  const pinAndSave = async () => {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(ADDR(w));
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
    if (await want.count()) await want.first().click().catch(() => {});
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
    await p.waitForSelector('[data-testid=band-aerial-img]', { timeout: 60000 });
    await p.waitForTimeout(2500);
  };
  const tapCrossing = async (mode) => {
    crossMode = mode;
    const img = p.locator('[data-testid=band-aerial-img]');
    const box = await img.boundingBox();
    const geo = { lat: 39.739781, lng: -104.968249 };
    const at = pixelOf(CROSSING, geo, box.width, box.height);
    await p.mouse.click(box.x + at.x, box.y + at.y);
    await p.waitForTimeout(3500);
    crossMode = 'off';
  };
  try {
    if (MODE === 'details') {
      // Repair 2: the kind question's Details opened and closed (the
      // operator's own disclosure), unanswered and with the tallest answer.
      const details = () => p.locator('[data-testid=where-questions] .nyq-details-btn').first().click();
      await pinAndSave();
      await step('kind-question');
      await details(); await p.waitForTimeout(800);
      await step('kind-details-open');
      await details(); await p.waitForTimeout(800);
      await step('kind-details-closed');
      await pick('kind-chip-near_intersection');
      await p.waitForTimeout(2500);
      await step('ni-kind-answered');
      await details(); await p.waitForTimeout(800);
      await step('ni-kind-details-open');
      await details(); await p.waitForTimeout(800);
      await step('ni-kind-details-closed');
      // Resume: opened again and closed with Esc (step 2's pattern, R101).
      await details(); await p.waitForTimeout(800);
      await step('ni-kind-details-open-2');
      await p.keyboard.press('Escape'); await p.waitForTimeout(800);
      out.escFocus = await p.evaluate(() => document.activeElement?.classList.contains('nyq-details-btn') ?? false);
      await step('ni-kind-details-esc');
    } else {
    await pinAndSave();
    await step('kind-question');
    // The trace: the kind question with each answer chosen (its notes
    // differ by answer), the card's and the right column's heights.
    out.trace = [];
    for (const id of await p.locator('[data-testid^=kind-chip-]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')))) {
      await pick(id);
      await p.waitForTimeout(2500);
      const r = await read(p);
      out.trace.push({ kind: id, wq: r.wq?.h, side: r.side?.h, stack: r.stack?.h, band: r.band?.h });
      console.log(tag, 'trace', id.padEnd(40), '| wq h', r.wq?.h, '| side h', r.side?.h, '| stack h', r.stack?.h, '| band h', r.band?.h);
    }
    await pick('kind-chip-flagger_lane_closure');
    await p.waitForTimeout(2500);
    await step('kind-answered');
    await pick('kind-chip-shoulder');
    await p.waitForTimeout(2500);
    await nextBtn(p).click();
    await p.waitForTimeout(2500);
    await step('side-question');
    await pick('side-option');
    await p.waitForTimeout(2500);
    await step('side-answered');
    await p.locator('.nyq-answered .nyq-row-btn', { hasText: /kind of work/ }).first().click();
    await p.waitForTimeout(1500);
    await step('kind-reopened');
    await p.locator('[data-testid=step-undo-side]').click();
    await p.waitForTimeout(2500);
    await step('side-undone');
    await pick('side-option');
    await p.waitForTimeout(2500);
    await step('side-again');

    // The intersection: kind, the tap question, its found / none / failed
    // states, the cross street's Undo, then Next to the side.
    await pinAndSave();
    await pick('kind-chip-near_intersection');
    await p.waitForTimeout(2500);
    await step('ni-kind-answered');
    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(1500);
    await step('cross-question');
    await tapCrossing('fail');
    await step('cross-failed');
    await tapCrossing('none');
    await step('cross-none');
    await tapCrossing('found');
    await step('cross-found');
    await p.locator('[data-testid=cross-undo]').click();
    await p.waitForTimeout(2000);
    await step('cross-undone');
    await tapCrossing('found');
    await step('cross-found-again');
    await nextBtn(p).click();
    await p.waitForTimeout(2500);
    await step('side-after-tap');
    await pick('side-option');
    await p.waitForTimeout(2500);
    await step('ni-side-answered');
    }
  } catch (e) {
    out.errors.push(`walk: ${String(e).slice(0, 300)}`);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 1));
  const hs = out.steps.map((s) => s.band?.h).filter((v) => v != null);
  console.log(tag, 'errors', out.errors.length, out.errors.join(' | ').slice(0, 300), '| band h min', Math.min(...hs), 'max', Math.max(...hs), 'spread', +(Math.max(...hs) - Math.min(...hs)).toFixed(1), ...(MODE === 'details' ? ['| Esc focus on toggle', out.escFocus] : []));
}

for (const [w, h] of sizes) await run(w, h);
