// Mission #466 production check (#465, #461, #459) on the live site.
// Adapted from #456's prod walk (d46199a0, ux-map-in-view/prod-check/script/
// walk-prod.mjs) and #461's local walk (issue-461/script/walk461.mjs).
// usage: node walk-prod.mjs <outdir> [sizes]
//   sizes: "1198x930,390x844,390x664" (default)
// Live https://www.conestruct.com/sandbox, live backend, live Overpass and
// road-bearing (no stubs).  Gate header via scripts/gate.cjs newGatedContext;
// the token comes from GATE_BYPASS_TOKEN, else read literally (no $ expansion)
// from conestruct/site/.env.local, never printed.  Chromium, DPR 1.
// What it reads, per step:
//   #459  the verdict strip: every [data-testid^=strip-] id and the first
//         .status-bar's text.
//   #461  walk461's measure: the cover is the nav or whatever is pinned under
//         it (the strip frame or the Show map row); the question heading's top
//         against the cover's bottom.
//   #465  on the tap question, a MutationObserver on the aerial frame logs the
//         bar's text, data-bar, is-armed and aria-busy on every change while a
//         zoom step's picture loads.  The browser's own /api/corridor-map
//         answer is held 4 s client-side (the site is not slowed), as #456's
//         prod walk did for its held step.  A tap is made mid-load and the
//         nearest-intersection / road-bearing POSTs it causes are counted.
import { createRequire } from 'module';
import fs from 'fs';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool';
const require = createRequire(`${W}/package.json`);
const { chromium } = require('playwright');
if (!process.env.GATE_BYPASS_TOKEN) {
  const line = fs.readFileSync(`${W}/conestruct/site/.env.local`, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GATE_BYPASS_TOKEN='));
  if (line) process.env.GATE_BYPASS_TOKEN = line.slice('GATE_BYPASS_TOKEN='.length).replace(/^["']|["']$/g, '');
}
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const [OUT, SIZES] = process.argv.slice(2);
const BASE = 'https://www.conestruct.com';
const sizes = (SIZES ?? '1198x930,390x844,390x664').split(',').map((s) => s.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });

const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
const rad = (d) => (d * Math.PI) / 180;
function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}
const ADDR = (w) => (w <= 480 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');
const ROAD = (w) => (w <= 480 ? 'Colfax Avenue' : 'Colfax Avenue, westbound');
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function read(p) {
  return p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const nav = q('.a-nav, nav');
    const navB = nav ? nav.getBoundingClientRect().bottom : 0;
    const stuck = (e) => {
      if (!e) return null;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.position !== 'sticky') return null;
      const b = e.getBoundingClientRect();
      return Math.abs(b.top - navB) <= 1 ? b.bottom : null;
    };
    const frame = q('[data-testid=band-aerial-frame]');
    const showrow = q('.a-aerial-showrow');
    const cover = Math.max(navB, stuck(frame) ?? 0, stuck(showrow) ?? 0);
    const h = q('[data-testid=where-questions] .nyq-q');
    const why = q('[data-testid=where-questions] .nyq-why');
    const hb = h?.getBoundingClientRect();
    const wb = why?.getBoundingClientRect();
    const lh = why ? parseFloat(getComputedStyle(why).lineHeight) || 20 : 0;
    const fb = frame?.getBoundingClientRect();
    const bar = q('[data-testid=band-aerial-bar]');
    return {
      y: Math.round(scrollY), navB: +navB.toFixed(1), cover: +cover.toFixed(1),
      q: t(h?.innerText).slice(0, 48) || null,
      qTop: hb ? +hb.top.toFixed(1) : null,
      whyTop: wb ? +wb.top.toFixed(1) : null,
      headingClear: hb ? hb.top >= cover - 0.5 && hb.bottom <= innerHeight + 0.5 : null,
      firstLineClear: wb ? wb.top >= cover - 0.5 && wb.top + lh <= innerHeight + 0.5 : null,
      frame: fb ? `${fb.top.toFixed(1)}..${fb.bottom.toFixed(1)}` : null,
      aerialWhole: fb ? fb.top >= navB - 1 && fb.bottom <= innerHeight + 1 : null,
      strips: [...document.querySelectorAll('[data-testid^=strip-]')].map((e) => e.getAttribute('data-testid')),
      stripText: t(q('.status-bar')?.innerText) || null,
      bar: bar ? { text: t(bar.innerText), kind: frame?.getAttribute('data-bar') ?? null } : null,
      armed: frame?.classList.contains('is-armed') ?? null,
      whereOpen: !!q('[data-testid=where-questions]'),
    };
  });
}

// #465: log the bar's state on every change in the frame from now on.
const startBarLog = (p) => p.evaluate(() => {
  const t0 = performance.now();
  window.__bar = [];
  const snap = () => {
    const f = document.querySelector('[data-testid=band-aerial-frame]');
    const b = document.querySelector('[data-testid=band-aerial-bar]');
    const s = { text: b ? b.innerText.replace(/\s+/g, ' ').trim() : null, kind: f?.getAttribute('data-bar') ?? null, armed: f?.classList.contains('is-armed') ?? null, busy: f?.getAttribute('aria-busy') ?? null };
    const l = window.__bar[window.__bar.length - 1];
    if (!l || l.text !== s.text || l.kind !== s.kind || l.armed !== s.armed || l.busy !== s.busy) window.__bar.push({ at: Math.round(performance.now() - t0), ...s });
  };
  snap();
  window.__barObs?.disconnect();
  window.__barObs = new MutationObserver(snap);
  window.__barObs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
});
const stopBarLog = (p) => p.evaluate(() => { window.__barObs?.disconnect(); return window.__bar.slice(); });

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, steps: [], net: [], errors: [], console: [], held: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await newGatedContext(b, BASE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const t0 = Date.now();
  const now = () => Date.now() - t0;
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text().slice(0, 200)); });
  p.on('request', (r) => {
    if (r.method() !== 'POST') return;
    const u = r.url();
    const kind = u.includes('/api/corridor-map') ? 'aerial' : u.includes('/api/render/corridor-geometry') ? 'geometry' : u.includes('nearest-intersection') ? 'nearest' : u.includes('/api/road-bearing') ? 'road-bearing' : null;
    if (!kind) return;
    try { const m = JSON.parse(r.postData() ?? '{}').scenario?.meta; if (kind === 'geometry' && m) out.lastPin = { lat: m.lat, lng: m.lng }; } catch {}
    out.net.push({ kind, at: now() });
  });
  let slowMap = false;
  await p.route('**/api/corridor-map', async (r) => { if (slowMap) await new Promise((res) => setTimeout(res, 4000)); return r.fallback(); });
  const step = async (name, extra = {}, { shot = false, strip = false } = {}) => {
    const s = { name, ...extra, ...(await read(p)) };
    if (shot) { s.shot = `${tag}-${nn()}-${name}.png`; await p.screenshot({ path: `${OUT}/${s.shot}` }); }
    // #459: a picture of the strip itself (it sits below the band, out of
    // the window); taken after the read, and the scroll is put back.
    if (strip && await p.locator('.status-bar').count()) {
      s.stripShot = `${tag}-${nn()}-strip-${name}.png`;
      const y0 = await p.evaluate(() => scrollY);
      // Centre it first: an element screenshot alone leaves it under the
      // sticky nav.  The clip takes 40 px around it for context.
      const r = await p.evaluate(() => {
        const e = document.querySelector('.status-bar');
        e.scrollIntoView({ block: 'center', behavior: 'instant' });
        const b = e.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height, position: getComputedStyle(e).position };
      });
      await p.waitForTimeout(300);
      s.stripRect = r;
      const vw = p.viewportSize();
      const y = Math.max(0, r.y - 40);
      await p.screenshot({ path: `${OUT}/${s.stripShot}`, clip: { x: 0, y, width: vw.width, height: Math.min(vw.height - y, r.h + 80) } });
      await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y0);
      await p.waitForTimeout(300);
    }
    out.steps.push(s);
    console.log(tag, name.padEnd(22), 'strip', s.strips.join(',') || '-', '| cover', s.cover, 'q', s.qTop, 'clear', s.headingClear, '| whole', s.aerialWhole, '| bar', s.bar?.text ?? '-');
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
    const want = p.getByRole('dialog').locator('button', { hasText: new RegExp(ROAD(w)) });
    await want.first().waitFor({ timeout: 90000 }); await p.waitForTimeout(1000); await want.first().click();
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
    await p.waitForSelector('[data-testid=band-aerial-img]', { timeout: 60000 });
    await p.waitForTimeout(2500);
  };
  // One held load on the tap question: press a zoom button with the aerial
  // answer held, optionally tap mid-load, log the bar until it settles.
  const heldZoom = async (label, { tapMidLoad }) => {
    await startBarLog(p);
    const netFrom = out.net.length;
    slowMap = true;
    await p.locator(`[data-testid=band-aerial-zoom] [aria-label="${label}"]`).click();
    await p.waitForTimeout(700);
    const mid = await read(p);
    const focus = await p.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? null);
    let midShot = null;
    if (tapMidLoad) {
      midShot = `${tag}-${nn()}-held-${label === 'Zoom in' ? 'in' : 'out'}.png`;
      await p.screenshot({ path: `${OUT}/${midShot}` });
      const box = await p.locator('[data-testid=band-aerial-img]').boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await p.waitForTimeout(6000);
    slowMap = false;
    const log = await stopBarLog(p);
    const after = await read(p);
    const reqs = out.net.slice(netFrom);
    const rec = { label, tapMidLoad, mid: { bar: mid.bar, armed: mid.armed }, focusMid: focus, midShot, log,
      tapRequests: reqs.filter((e) => e.kind === 'nearest' || e.kind === 'road-bearing').length, aerialRequests: reqs.filter((e) => e.kind === 'aerial').length,
      after: { bar: after.bar, armed: after.armed } };
    out.held.push(rec);
    console.log(tag, 'held', label, '| mid', mid.bar?.text, mid.bar?.kind, 'armed', mid.armed, '| focus', focus, '| after', after.bar?.text, '| tapReqs', rec.tapRequests, '| log', log.map((e) => `${e.at}:${e.kind}`).join(' '));
    return rec;
  };
  try {
    // Walk A: a side-of-road kind, through the side question to Confirm.
    await pinAndSave();
    await step('01-kind-question', {}, { shot: true, strip: true });
    await pick('kind-chip-flagger_lane_closure');
    await p.waitForTimeout(2500);
    await step('02-kind-answered', {}, { strip: true });
    await pick('kind-chip-shoulder');
    await p.waitForTimeout(2500);
    await nextBtn(p).click();
    await p.waitForTimeout(2500);
    await step('03-side-question', {}, { shot: true });
    await pick('side-option');
    await p.waitForTimeout(2500);
    await step('04-side-answered', {}, { shot: w > 480, strip: true });
    await p.locator('.nyq-answered .nyq-row-btn', { hasText: /kind of work/ }).first().click();
    await p.waitForTimeout(1500);
    await step('05-kind-reopened');
    await p.locator('[data-testid=step-undo-side]').click();
    await p.waitForTimeout(2500);
    await step('06-side-undone');
    await pick('side-option');
    await p.waitForTimeout(2500);
    await step('07-side-again');
    if (await p.locator('[data-testid=band-aerial-hide]').count() && await p.locator('[data-testid=band-aerial-hide]').isVisible()) {
      await p.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
      await p.waitForTimeout(400);
      await step('08-scrolled-by-hand');
      await p.locator('[data-testid=band-aerial-hide]').click();
      await p.waitForTimeout(600);
      await step('09-map-hidden');
      await p.locator('.nyq-answered .nyq-row-btn', { hasText: /kind of work/ }).first().click();
      await p.waitForTimeout(800);
      await p.locator('[data-testid=step-undo-side]').click();
      await p.waitForTimeout(1500);
      await step('10-hidden-after-undo');
      await p.locator('[data-testid=band-aerial-show]').click();
      await p.waitForTimeout(1200);
      await step('11-map-shown', {}, { shot: true });
      await pick('side-option');
      await p.waitForTimeout(2500);
      await step('11b-side-answered');
    }
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForTimeout(3000);
    await step('12-confirmed', {}, { shot: true, strip: true });

    // Walk B: near intersection, the tap question, two held loads, the tap.
    await pinAndSave();
    await pick('kind-chip-near_intersection');
    await p.waitForTimeout(2500);
    await step('13-ni-kind-answered', {}, { shot: h < 700 });
    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(2000);
    await step('14-cross-question', {}, { shot: true });
    await heldZoom('Zoom in', { tapMidLoad: true });
    await step('15-zoomed-in-landed');
    await heldZoom('Zoom out', { tapMidLoad: false });
    await step('16-zoomed-back');
    const img = p.locator('[data-testid=band-aerial-img]');
    const box = await img.boundingBox();
    const geo = out.lastPin ?? { lat: 39.739781, lng: -104.968249 };
    const at = pixelOf(CROSSING, geo, box.width, box.height);
    await p.mouse.click(box.x + at.x, box.y + at.y);
    await p.waitForTimeout(4000);
    await step('17-cross-found');
    await nextBtn(p).click();
    await p.waitForTimeout(2500);
    await step('18-side-after-tap', {}, { shot: w <= 480 });
  } catch (e) {
    out.errors.push(`walk: ${String(e).slice(0, 300)}`);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 1));
  console.log(tag, 'pageerrors', out.errors.length, 'console errors', out.console.length);
}

for (const [w, h] of sizes) await run(w, h);
