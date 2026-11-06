// #446 production check, adapted from ../../evidence/script/walk.mjs.
// usage: SHOT_TOKEN=<gate token> node walk-prod.mjs <outdir>
// The REAL site.  The found tap is live end to end: geocoding, /api/road-bearing,
// /api/aerial-point, the nearest-intersection read.  Two answers can't be had on
// demand, so only for those two taps, in the browser, /api/road-bearing is
// changed: "failed" answers 502, and "no street" takes the live answer and
// keeps only the Colfax candidates.  Everything else stays live.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const SITE = 'https://www.conestruct.com';
const addrFor = (w) => (w === 390 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
const rad = (d) => (d * Math.PI) / 180;
fs.mkdirSync(OUT, { recursive: true });

function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { errors: [], roadBearing: [], steps: {} };
  let n = 1;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__scrolls = [];
    const real = window.scrollBy.bind(window);
    window.scrollBy = (arg) => { window.__scrolls.push({ ...arg, at: performance.now() }); real(arg); };
  });
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  let mode = 'live';
  let lastMeta = null;
  const reads = [];
  const sent = new Map();
  p.on('request', (r) => {
    if (r.method() !== 'POST') return;
    if (r.url().includes('/api/render/nearest-intersection')) sent.set(r, Date.now());
    if (r.url().includes('/api/render/corridor-geometry')) {
      const m = JSON.parse(r.postData() ?? '{}').scenario?.meta;
      if (m) lastMeta = { lat: m.lat, lng: m.lng };
    }
  });
  p.on('response', (r) => {
    if (sent.has(r.request())) reads.push({ status: r.status(), ms: Date.now() - sent.get(r.request()) });
    if (r.url().includes('/api/road-bearing')) out.roadBearing.push({ mode, status: r.status() });
  });
  // The gate header goes to the site only (#443's check: anywhere else breaks Clerk).
  await p.route(`${SITE}/**`, async (r) => {
    const headers = { ...r.request().headers(), 'x-conestruct-gate': TOK };
    if (r.request().url().includes('/api/road-bearing')) {
      if (mode === 'fail') return r.fulfill({ status: 502, contentType: 'text/plain', body: 'down' });
      if (mode === 'none') {
        const live = await r.fetch({ headers });
        const j = await live.json();
        j.candidates = (j.candidates ?? []).filter((c) => /Colfax/.test(c.name ?? ''));
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
      }
    }
    return r.continue({ headers });
  });
  const view = async (name) => { const f = `${tag}-${String(n++).padStart(2, '0')}-${name}.png`; await p.screenshot({ path: `${OUT}/${f}` }); return f; };
  const park = async () => { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(150); };
  const rects = () => p.evaluate(() => {
    const box = (id) => { const e = document.querySelector(`[data-testid=${id}]`); if (!e) return null; const r = e.getBoundingClientRect(); return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
    const nextEl = document.querySelector('[data-testid=where-questions] .nyq-card .wq-next');
    const nr = nextEl?.getBoundingClientRect();
    return {
      scrollY: Math.round(window.scrollY), innerHeight: window.innerHeight,
      nav: +(document.querySelector('.a-nav, nav')?.getBoundingClientRect().bottom ?? 0).toFixed(1),
      bar: document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') ?? null,
      barText: document.querySelector('[data-testid=band-aerial-bar]')?.innerText ?? null,
      barBox: box('band-aerial-bar'), frame: box('band-aerial-frame'), row: box('cross-row'),
      next: nr ? { top: +nr.top.toFixed(1), bottom: +nr.bottom.toFixed(1) } : null,
      moveLabel: document.querySelector('[data-testid=cross-move]')?.innerText ?? null,
      ring: document.querySelector('[data-testid=band-aerial-ring]')?.getAttribute('data-look') ?? null,
      markBox: !!document.querySelector('[data-testid=band-aerial-mark]'),
      asked: window.__scrolls.map(({ top, behavior }) => ({ top, behavior })),
      focus: document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const axe = async () => {
    await p.addScriptTag({ content: AXE });
    return p.evaluate(async () => {
      const r = await window.axe.run(document.querySelector('[data-testid=band-where]') ?? document, { resultTypes: ['violations'] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    });
  };
  const targets = () => p.evaluate(() => {
    const o = {};
    for (const id of ['band-aerial-big-map', 'band-aerial-retry', 'cross-move', 'cross-undo', 'cross-retry', 'cross-big-map', 'where-open-picker']) {
      const e = document.querySelector(`[data-testid=band-where] [data-testid=${id}]`);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      o[id] = { w: +r.width.toFixed(1), h: +r.height.toFixed(1), ok: r.width >= 44 && r.height >= 44 };
    }
    return o;
  });
  const clearAsks = () => p.evaluate(() => { window.__scrolls = []; });
  const barIs = (k, timeout = 45000) => p.waitForFunction((x) => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === x, k, { timeout });
  const tap = async () => {
    const img = p.locator('[data-testid=band-aerial-img]');
    const box = await img.boundingBox();
    const at = pixelOf(CROSSING, lastMeta, box.width, box.height);
    await p.mouse.click(box.x + at.x, box.y + at.y);
  };
  const press = async (id) => { const box = await p.locator(`[data-testid=${id}]`).boundingBox(); await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); };
  const settle = async () => { let last = -1; for (let i = 0; i < 40; i++) { const y = await p.evaluate(() => Math.round(window.scrollY)); if (y === last && i > 6) break; last = y; await p.waitForTimeout(50); } };
  const barUnderNav = async (by) => {
    await p.evaluate((d) => {
      const r = document.querySelector('[data-testid=band-aerial-bar]').getBoundingClientRect();
      const nav = document.querySelector('.a-nav, nav')?.getBoundingClientRect().bottom ?? 0;
      window.scrollBy({ top: r.top - nav + d, behavior: 'instant' });
    }, by);
    await p.waitForTimeout(200);
  };
  const record = async (name, { shot = true, measure = false } = {}) => {
    const s = await rects();
    if (measure) { s.axe = await axe(); s.targets = await targets(); }
    if (shot) s.shot = await view(name);
    out.steps[name] = s;
    console.log(tag, name, '| bar', s.bar, '| y', s.scrollY, '| asked', JSON.stringify(s.asked), '| focus', s.focus, '| axe', s.axe?.length ?? '-');
    return s;
  };
  try {
    await p.goto(`${SITE}/sandbox`, { waitUntil: 'load', timeout: 120000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 60000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(addrFor(w));
    await p.getByRole('button', { name: 'SEARCH' }).click();
    const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
    await want.first().waitFor({ timeout: 90000 });
    await p.waitForTimeout(1000);
    await want.first().click();
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=kind-chip-near_intersection]', { state: 'attached', timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.locator('label.nyq-answer:has([data-testid=kind-chip-near_intersection])').click();
    await p.waitForTimeout(800);
    await p.locator('[data-testid=where-questions] .nyq-card .wq-next').click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(2000);
    await park();
    await record('armed', { measure: true });

    // The found tap, live, with the card off screen, timed.
    await p.evaluate(() => {
      const f = document.querySelector('[data-testid=band-aerial-frame]').getBoundingClientRect();
      window.scrollBy({ top: f.bottom - (window.innerHeight - 8), behavior: 'instant' });
    });
    await p.waitForTimeout(300);
    await clearAsks();
    reads.length = 0;
    const t0 = Date.now();
    await tap();
    await barIs('found');
    const tFound = Date.now();
    await p.waitForFunction(() => window.__scrolls.length > 0, null, { timeout: 5000 }).catch(() => {});
    const tScroll = Date.now();
    await settle();
    await p.waitForTimeout(500);
    await park();
    out.timing = { tapToFoundMs: tFound - t0, foundToScrollMs: tScroll - tFound, nearestReads: [...reads] };
    await record('found-after-scroll', { measure: true });

    // Move, from where that left the page.
    await clearAsks();
    await press('cross-move');
    await settle();
    await p.waitForTimeout(400);
    await park();
    await record('after-move', { measure: true });

    // Cancel, then Undo: neither scrolls.
    await p.evaluate(() => document.querySelector('[data-testid=cross-move]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(200);
    await clearAsks();
    await press('cross-move');
    await settle();
    out.cancelAsked = await p.evaluate(() => window.__scrolls.length);
    await press('cross-undo');
    await barIs('armed');
    await settle();
    out.undoAsked = await p.evaluate(() => window.__scrolls.length);
    await p.waitForTimeout(1500);

    // A failed tap with its bar 30 px under the nav.
    mode = 'fail';
    await barUnderNav(30);
    await clearAsks();
    out.steps['failed-before'] = await rects();
    await tap();
    await barIs('failed');
    await p.waitForTimeout(500);
    await settle();
    await p.waitForTimeout(300);
    await park();
    await record('failed-was-hidden', { measure: true });

    // "No street there" with its bar 30 px under the nav.
    mode = 'none';
    await barUnderNav(30);
    await clearAsks();
    out.steps['none-before'] = await rects();
    await tap();
    await barIs('none');
    await p.waitForTimeout(800);
    await settle();
    await p.waitForTimeout(300);
    await park();
    await record('no-street-was-hidden', { measure: true });

    // The same with its bar clear of the nav: nothing moves.
    await barUnderNav(-1);
    await clearAsks();
    await tap();
    await barIs('none');
    await p.waitForTimeout(800);
    await settle();
    await park();
    await record('no-street-bar-in-view');

    // T27: the big map's crossing, live, then Move.
    mode = 'live';
    await p.locator('[data-testid=band-aerial-big-map]').click();
    await p.waitForSelector('[role=dialog]', { timeout: 30000 });
    await p.waitForTimeout(3000);
    const canvas = p.locator('[role=dialog] canvas.mapboxgl-canvas').first();
    const cb = await canvas.boundingBox();
    await canvas.click({ position: { x: cb.width / 2, y: cb.height / 2 - 60 } });
    await p.waitForTimeout(6000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await barIs('found');
    await p.waitForTimeout(2000);
    await park();
    await record('after-big-map', { measure: true });
    await clearAsks();
    await p.locator('[data-testid=cross-move]').evaluate((e) => e.click());
    await settle();
    await p.waitForTimeout(600);
    await park();
    await record('move-after-big-map');
  } catch (e) {
    out.error = String(e).slice(0, 600);
    console.log(tag, 'ERROR', out.error);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  return out;
}

// A size that stopped on the live road service runs again alone: SIZES=1440x900,390x844.
// Runs already in walk.json are kept, so the file holds each size's last run.
const file = `${OUT}/walk.json`;
const M = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
for (const s of (process.env.SIZES ?? '1440x900,390x844,390x664').split(',')) {
  const [w, h] = s.split('x').map(Number);
  M[s] = await run(w, h);
  fs.writeFileSync(file, JSON.stringify(M, null, 1));
}
