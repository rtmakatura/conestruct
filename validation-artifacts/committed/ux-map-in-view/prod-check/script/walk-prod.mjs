// #456 walk (local): the WHERE map in view, no waiting between answers, the
// two status strings.  Adapted from #446's and #453's walks.
// usage: GATE_BYPASS_TOKEN=<the dev server's walk token> node walk.mjs <outdir> <port> [sizes]
//   sizes: "1440x900,1198x930,1024x768,390x844,390x664" (default)
// Local `next dev` on the issue-456 worktree, MODAL_RENDER_URL at the local
// backend with Overpass STUBBED (replay of ux-group3-where's recorded answers;
// an unrecorded ask fails, never goes live).  /api/road-bearing is stubbed from
// the same fixture.  Chromium, DPR 1 (repair 1 re-walk).  The gate header goes through the shared
// helper's newGatedContext (scripts/gate.cjs): the local site's own host only.
// Every POST to the aerial, the geometry read and the nearest-intersection read
// is logged with its start and end; the aerial's <img src> and the frame's
// wait note are watched by a MutationObserver from page load, so "time to new
// map" and "was the box ever blank" are read off the page, not guessed.
import { createRequire } from 'module';
import fs from 'fs';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${W}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PORT, SIZES] = process.argv.slice(2);
const BASE = 'https://www.conestruct.com'; // #456 prod check: live site, live data
const sizes = (SIZES ?? '1440x900,1198x930,1024x768,390x844,390x664').split(',').map((s) => s.split('x').map(Number));
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
async function measureNew(p) {
  return p.evaluate(() => {
    const out = {};
    for (const id of ['band-aerial-hide', 'band-aerial-show']) {
      const e = document.querySelector(`[data-testid=${id}]`);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      out[id] = { w: +r.width.toFixed(1), h: +r.height.toFixed(1), ok: r.width >= 44 && r.height >= 44 };
    }
    return out;
  });
}
async function read(p) {
  return p.evaluate(() => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const q = (s) => document.querySelector(s);
    const nav = q('.a-nav, nav');
    const navB = nav ? nav.getBoundingClientRect().bottom : 0;
    const frame = q('[data-testid=band-aerial-frame]');
    const img = q('[data-testid=band-aerial-img]');
    const card = q('[data-testid=where-questions] .nyq-card');
    const vis = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, navB))); };
    const stack = q('.wq-stack');
    return {
      scrollY: Math.round(scrollY), vw: innerWidth, vh: innerHeight, navBottom: +navB.toFixed(1),
      bandWidth: stack ? +stack.getBoundingClientRect().width.toFixed(1) : null,
      layout: stack?.getAttribute('data-layout') ?? null,
      frame: r(frame), img: r(img), card: r(card), cardQuestion: t(q('[data-testid=where-questions] .nyq-q')?.innerText) || null,
      frameVisiblePx: vis(frame), imgVisiblePx: vis(img), cardVisiblePx: vis(card),
      mapWhollyInView: frame ? frame.getBoundingClientRect().top >= navB - 1 && frame.getBoundingClientRect().bottom <= innerHeight + 1 : null,
      questionInView: (() => { const h = q('[data-testid=where-questions] .nyq-q'); if (!h) return null; const b = h.getBoundingClientRect(); return b.top >= navB - 1 && b.bottom <= innerHeight; })(),
      stage: q('[data-testid=band-aerial]')?.getAttribute('data-stage') ?? null,
      note: t(q('[data-testid=band-aerial-note]')?.innerText) || null,
      hideBtn: r(q('[data-testid=band-aerial-hide]')), showBtn: r(q('[data-testid=band-aerial-show]')),
      whatRow: t(q('[data-testid=fact-what]')?.innerText) || null,
      generateHint: t(q('[data-testid=generate-frame]')?.innerText) || null,
      docOverflowX: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, steps: [], net: [], errors: [], cls: null };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await newGatedContext(b, BASE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const t0 = Date.now();
  const now = () => Date.now() - t0;
  await p.addInitScript(() => {
    window.__img = []; window.__cls = [];
    const start = performance.now();
    const log = () => {
      const img = document.querySelector('[data-testid=band-aerial-img]');
      const note = document.querySelector('[data-testid=band-aerial-note]');
      const src = img ? img.getAttribute('src') : null;
      const noteText = note ? note.textContent : null;
      const last = window.__img[window.__img.length - 1];
      if (!last || last.src !== src || last.note !== noteText) window.__img.push({ at: Math.round(performance.now()), src, note: noteText });
    };
    new MutationObserver(log).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'], characterData: true });
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          window.__cls.push({ at: Math.round(e.startTime), value: e.value, recent: e.hadRecentInput,
            sources: (e.sources ?? []).map((s) => (s.node && s.node.closest ? (s.node.closest('[data-testid=band-where]') ? 'band' : (s.node.className && String(s.node.className).slice(0, 40)) || s.node.nodeName) : 'n/a')) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  const pending = new Map();
  p.on('request', (r) => {
    if (r.method() !== 'POST') return;
    const u = r.url();
    const kind = u.includes('/api/corridor-map') ? 'aerial' : u.includes('/api/render/corridor-geometry') ? 'geometry' : u.includes('nearest-intersection') ? 'nearest' : u.includes('/api/road-bearing') ? 'road-bearing' : null;
    if (!kind) return;
    let stage = null;
    try {
      const body = JSON.parse(r.postData() ?? '{}');
      stage = body.stage ?? null;
      const m = body.scenario?.meta;
      if (kind === 'geometry' && m) out.lastPin = { lat: m.lat, lng: m.lng };
    } catch {}
    pending.set(r, { kind, stage, start: now() });
  });
  p.on('requestfinished', async (r) => { const e = pending.get(r); if (!e) return; const res = await r.response(); out.net.push({ ...e, end: now(), status: res?.status() ?? null }); pending.delete(r); });
  p.on('requestfailed', (r) => { const e = pending.get(r); if (!e) return; out.net.push({ ...e, end: now(), status: 'failed' }); pending.delete(r); });
  let crossMode = false;
  let slowMap = false;
  // Repair 1: hold every aerial answer 4 s, so a held picture can be seen.
  await p.route('**/api/corridor-map', async (r) => { if (slowMap) await new Promise((res) => setTimeout(res, 4000)); return r.fallback(); });
  if (process.env.STUB_BEARING) await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    const body = crossMode ? CROSS_STUB : det([cand(1547338997, { lat: asked.lat, lng: asked.lng }, COLFAX_WEST)]);
    return r.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const view = async (name) => { const file = `${tag}-${nn()}-${name}.png`; await p.screenshot({ path: `${OUT}/${file}` }); return file; };
  const imgLog = () => p.evaluate(() => window.__img.slice());
  // Time from an action to the picture it asks for, read off the page's own
  // log: the first src change after the action, and whether the box went
  // blank (no img) or showed the wait note on the way.
  const timed = async (name, act, { settle = 4000 } = {}) => {
    const before = await imgLog();
    const tAct = await p.evaluate(() => performance.now());
    const netFrom = out.net.length;
    const startWall = now();
    await act();
    await p.waitForTimeout(settle);
    const after = (await imgLog()).slice(before.length);
    const srcBefore = before.length ? before[before.length - 1].src : null;
    const firstNew = after.find((e) => e.src && e.src !== srcBefore);
    const blank = after.some((e) => !e.src);
    const waitNote = after.some((e) => e.note && /Drawing the corridor/.test(e.note));
    const reqs = out.net.slice(netFrom).concat([...pending.values()].filter((e) => e.start >= startWall));
    const s = { name, timing: { msToNewMap: firstNew ? Math.round(firstNew.at - tAct) : null, srcChanged: !!firstNew, blankSeen: blank, waitNoteSeen: waitNote,
      aerialRequests: reqs.filter((e) => e.kind === 'aerial').length, geometryRequests: reqs.filter((e) => e.kind === 'geometry').length, nearestRequests: reqs.filter((e) => e.kind === 'nearest').length,
      trail: after.map((e) => ({ at: Math.round(e.at - tAct), src: e.src ? 'img' : null, note: e.note })) } };
    return s;
  };
  const step = async (name, extra = {}, { shot = true, measure = false } = {}) => {
    const s = { name, ...extra, ...(await read(p)) };
    if (shot) s.shot = await view(name);
    if (measure) { s.axe = await axe(p); s.small = await small(p); s.newTargets = await measureNew(p); }
    out.steps.push(s);
    console.log(tag, name, '| layout', s.layout, '| band', s.bandWidth, '| frameVis', s.frameVisiblePx, '| q', s.cardQuestion?.slice(0, 30), '| t', s.timing?.msToNewMap ?? '-', s.timing?.blankSeen ?? '', '| axe', s.axe?.length ?? '-');
    return s;
  };
  const pick = async (testid) => { await p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click(); };
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await step('00-before-pin', {}, { shot: false });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(ADDR(w));
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').locator('button', { hasText: new RegExp(process.env.ROAD ?? 'Colfax Avenue, westbound') });
    await want.first().waitFor({ timeout: 90000 }); await p.waitForTimeout(1000); await want.first().click();
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
    await p.waitForSelector('[data-testid=band-aerial-img]', { timeout: 60000 });
    await p.waitForTimeout(2500);
    await step('01-kind-question', {}, { measure: true });

    // A kind: Shoulder is the scenario's starting kind, so picking it changes
    // nothing on the wire.  Flagger changes the scenario; Shoulder again goes
    // back to a state already shown.
    const sKind = await timed('kind-flagger', () => pick('kind-chip-flagger_lane_closure'));
    await step('02-kind-answered', sKind);
    const sKind2 = await timed('kind-shoulder', () => pick('kind-chip-shoulder'));
    await step('02b-kind-back', sKind2, { shot: false });
    await nextBtn(p).click();
    await p.waitForTimeout(2500);
    await step('03-side-question', {}, { measure: true });
    // A side: the answer's picture.
    const sSide = await timed('side', () => pick('side-option'));
    await step('04-side-answered', sSide);
    // Back to the kind's row, where the side's record has its Undo; Undo the
    // side: back to a state already shown.
    await p.locator('.nyq-answered .nyq-row-btn', { hasText: /kind of work/ }).first().click();
    await p.waitForTimeout(800);
    const sUndo = await timed('undo-side', () => p.locator('[data-testid=step-undo-side]').click());
    await step('05-side-undone', sUndo);
    // The side again (a state already shown): from cache.
    const sSide2 = await timed('side-again', () => pick('side-option'));
    await step('06-side-again', sSide2);

    // Hide map / Show map, where offered.
    if (await p.locator('[data-testid=band-aerial-hide]').count() && await p.locator('[data-testid=band-aerial-hide]').isVisible()) {
      await p.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
      await p.waitForTimeout(300);
      await step('07-strip-pinned-scrolled', {});
      await p.locator('[data-testid=band-aerial-hide]').click();
      await p.waitForTimeout(400);
      await step('08-map-hidden', {}, { measure: true });
      // The choice holds through an answer and a question change.
      await p.locator('.nyq-answered .nyq-row-btn', { hasText: /kind of work/ }).first().click();
      await p.waitForTimeout(600);
      await p.locator('[data-testid=step-undo-side]').click();
      await p.waitForTimeout(1200);
      await step('09-hidden-after-undo', {});
      await p.locator('[data-testid=band-aerial-show]').click();
      await p.waitForTimeout(600);
      await step('10-map-shown', {});
      await pick('side-option');
      await p.waitForTimeout(1500);
    }

    // The two strings with the kind chosen and WHERE not confirmed.
    await step('11-strings-kind-picked', {}, { shot: false });
    // Confirm: the card closes, WHERE collapses, WHAT opens.
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForTimeout(2500);
    await step('12-confirmed', {}, { shot: true });

    // The intersection tap: a fresh page, near_intersection.
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(ADDR(w));
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want2 = p.getByRole('dialog').locator('button', { hasText: new RegExp(process.env.ROAD ?? 'Colfax Avenue, westbound') });
    await want2.first().waitFor({ timeout: 90000 }); await p.waitForTimeout(1000); await want2.first().click();
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=kind-chip-near_intersection]', { state: 'attached', timeout: 60000 });
    await p.waitForTimeout(2500);
    const sNi = await timed('kind-ni', () => pick('kind-chip-near_intersection'));
    await step('13-ni-kind', sNi, { shot: false });
    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(1500);
    await step('14-cross-question-armed', {}, { measure: true });
    crossMode = true;
    const img = p.locator('[data-testid=band-aerial-img]');
    const box = await img.boundingBox();
    const geo = out.lastPin ?? { lat: 39.739781, lng: -104.968249 };
    const at = pixelOf(CROSSING, geo, box.width, box.height);
    const scrollBefore = await p.evaluate(() => scrollY);
    await p.mouse.click(box.x + at.x, box.y + at.y);
    await p.waitForTimeout(3500);
    const scrollAfter = await p.evaluate(() => scrollY);
    await step('15-cross-found', { scrollBefore, scrollAfter }, { measure: true });
    crossMode = false;
    // Repair 1 (M9): a picture not yet drawn, the old one held with its line.
    slowMap = true;
    await nextBtn(p).click();
    await p.waitForTimeout(400);
    await pick('side-option');
    await p.waitForTimeout(900);
    await step('16-held', { held: await p.evaluate(() => { const e = document.querySelector('[data-testid=band-aerial-held]'); if (!e) return null; const b = e.getBoundingClientRect(); return { text: e.textContent, visible: b.width > 0 && getComputedStyle(e).display !== 'none', top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), h: +b.height.toFixed(1) }; }) }, { measure: true });
    await p.waitForTimeout(5000);
    slowMap = false;
  } catch (e) {
    out.errors.push(`walk: ${String(e).slice(0, 300)}`);
    await view('error').catch(() => {});
  }
  out.cls = await p.evaluate(() => window.__cls.slice()).catch(() => null);
  out.imgLog = await imgLog().catch(() => null);
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 1));
  return out;
}

for (const [w, h] of sizes) await run(w, h);
