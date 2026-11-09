// #470 walk (local): the Generate wait, measured.  The evidence harness
// (frames, crops, the answer leg).  The permanent CLS check (ruling 8) is
// scripts/verify-generate-cls.mjs; this walk measures the same number.  From the Generate press to
// the settled strip, it records every layout-shift entry (hadRecentInput
// false, the #452 measure), a frame of the results column at each change,
// and each section's box.  Then it answers the first NEEDS YOU question and
// measures the shift of the re-build too.
// usage: WALK_SECRETS_DIR=<dir> node walk470.mjs <outdir> <port> [sizes] [mode] [measure]
//   sizes: "1440x900,1198x930,390x844" (default)
//   mode:  "real" (no delay, the CLS number), "slow" (the audit held 14 s,
//          the slow step forced), "reduce" (prefers-reduced-motion, audit
//          held 3 s), "frames" (audit held 3 s, frames every 200 ms)
//   measure=1 runs axe and the 44 px measure on the settled results.
// Local `next dev` on the issue-470 worktree, MODAL_RENDER_URL at the local
// backend with Overpass STUBBED (serve_stub.py, replay of ux-group3-where's
// recorded answers); /api/road-bearing stubbed from the same fixture (as
// #469's walk).  Chromium, DPR 1.  The gate header rides only the site's own
// origin (scripts/gate.cjs newGatedContext).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-470';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
if (!process.env.GATE_BYPASS_TOKEN) {
  process.env.GATE_BYPASS_TOKEN = JSON.parse(fs.readFileSync(path.join(process.env.WALK_SECRETS_DIR, 'walk-secrets.json'), 'utf8')).gate;
}
const { newGatedContext, gateHeaders, isSiteRequest } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${W}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PORT, SIZES, MODE = 'real', MEASURE] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
const sizes = (SIZES || '1440x900,1198x930,390x844').split(',').map((s) => s.split('x').map(Number));
// real: 4 s, shorter than any measured warm production Generate (4.7-8.4 s,
// see evidence.md), a lower bound; a local answer lands in ~0.2 s, inside the 500 ms input
// window, where no shift would be counted at all.
const HOLD_MS = { real: 4000, slow: 15000, reduce: 4000, frames: 4000 }[MODE] ?? 4000;
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(`${W}/validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json`, 'utf8'));
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
// 1600 E Colfax at every width: the pin whose scan ux-site-map recorded.
const ADDR = () => '1600 E Colfax Ave, Denver';
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

const SECTIONS = {
  strip: '.status-slot', outline: '[data-testid=results-outline]', needs: 'section.needs-you', other: 'section.ny-other',
  setup: '[data-testid=results-head-slot]', plan: '[data-testid=your-plan]', downloads: '#downloads', refs: '.ref-sections',
  notice: '[data-testid=draft-notice]',
};
async function read(p) {
  return p.evaluate((SECTIONS) => {
    const out = { y: Math.round(scrollY), words: (document.querySelector('.status-slot')?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 90) };
    // The status line's parts (top offset in the line, height), to keep it
    // inside the strip's --status-h.
    const wl = document.querySelector('.wait-line');
    if (wl) { const r0 = wl.getBoundingClientRect(); out.waitParts = [...wl.children].map((c) => { const r = c.getBoundingClientRect(); return `${c.className.split(' ')[0]}@${Math.round(r.top - r0.top)}+${Math.round(r.height)}`; }).join(' '); }
    for (const [k, s] of Object.entries(SECTIONS)) {
      const e = document.querySelector(s);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      out[k] = [Math.round(r.top + scrollY), Math.round(r.height)];
    }
    return out;
  }, SECTIONS);
}
const clsSince = (p, t0) => p.evaluate((t0) => {
  const es = (window.__ls ?? []).filter((e) => e.t >= t0 && !e.r);
  return { cls: +es.reduce((s, e) => s + e.v, 0).toFixed(4), n: es.length, top: es.sort((a, b) => b.v - a.v).slice(0, 4).map((e) => ({ v: +e.v.toFixed(4), at: Math.round(e.t - t0), src: e.src })) };
}, t0);
// Rule 13: the rendered text colour against the nearest opaque ground
// behind it (the computed styles, not the token table).
const contrast = (p) => p.evaluate(() => {
  const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ground = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] === 1)) return c; } return [255, 255, 255]; };
  const one = (sel) => { const e = document.querySelector(sel); if (!e) return null; const fg = rgb(getComputedStyle(e).color); const bg = ground(e); const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return { fg: getComputedStyle(e).color, bg: `rgb(${bg.slice(0, 3).join(', ')})`, ratio: +((a + 0.05) / (b + 0.05)).toFixed(2) }; };
  return { label: one('.ro-label'), note: one('.ro-note'), count: one('.wait-line .wait-count'), step: one('.wait-line .wait-step') };
});
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('section.results') ?? document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
}
async function small(p) {
  return p.evaluate(() => {
    const root = document.querySelector('section.results');
    if (!root) return [];
    const out = [];
    for (const e of root.querySelectorAll('button, a, label.nyq-answer, summary')) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(e).visibility === 'hidden') continue;
      if (r.width < 44 || r.height < 44) out.push({ text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), cls: String(e.className).slice(0, 40), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
    }
    return out;
  });
}
const settled = (p) => p.waitForFunction(() => {
  const s = document.querySelector('.status-slot')?.innerText ?? '';
  const placeholder = document.querySelector('[data-testid=results-outline], [data-testid=results-placeholder]');
  return /Plan ready|VERIFIED|UNAVAILABLE|DECLINED/i.test(s) && document.querySelector('[data-testid=your-plan]') && document.querySelector('.ref-sections') && !placeholder;
}, null, { timeout: 120000 });

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, mode: MODE, frames: [], errors: [] };
  const ctx = await newGatedContext(b, BASE, { viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: MODE === 'reduce' ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(() => {
    window.__ls = [];
    const desc = (n) => (n && n.nodeType === 1 ? `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.getAttribute('data-testid') ? '[' + n.getAttribute('data-testid') + ']' : ''}.${String(n.className).split(' ')[0]}` : String(n?.nodeName));
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, r: e.hadRecentInput, t: e.startTime, src: (e.sources ?? []).slice(0, 3).map((s) => `${desc(s.node)} ${Math.round(s.previousRect.top)}->${Math.round(s.currentRect.top)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`) }); }).observe({ type: 'layout-shift', buffered: true }); } catch {}
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    return r.fulfill({ status: 200, contentType: 'application/json', body: det([cand(1547338997, { lat: asked.lat, lng: asked.lng }, COLFAX_WEST)]) });
  });
  let hold = 0;
  await p.route('**/api/render/audit', async (r) => {
    const ms = hold;
    if (ms === 0) return r.fallback();
    // The held audit is fetched here, so the gate header is added here, and
    // only when the request is bound for the site's own origin.
    const url = r.request().url();
    const own = isSiteRequest(url, BASE) ? gateHeaders(BASE) : {};
    const resp = await r.fetch({ headers: { ...r.request().headers(), ...own } });
    const body = await resp.body();
    if (ms > 0) await new Promise((res) => setTimeout(res, ms));
    return r.fulfill({ status: resp.status(), headers: resp.headers(), body });
  });
  const shot = async (name) => {
    const f = `${tag}-${MODE}-${name}.png`;
    await p.screenshot({ path: `${OUT}/${f}` });
    return f;
  };
  try {
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
    await p.waitForTimeout(2500);
    await p.locator('label.nyq-answer:has([data-testid=kind-chip-shoulder])').click();
    await p.waitForTimeout(1200);
    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 30000 });
    await p.waitForTimeout(1200);
    await p.locator('[data-testid=where-questions] label.nyq-answer').first().click();
    await p.waitForTimeout(1500);
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
    await p.waitForTimeout(3000);
    const oneWay = p.getByRole('button', { name: /^One-way$/ });
    if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(3000); }
    const laneOk = p.getByRole('button', { name: 'Lane count is right' });
    if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(3000); }
    await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    hold = HOLD_MS;
    const t0 = await p.evaluate(() => performance.now());
    const tStart = Date.now();
    await p.getByTestId('generate-plan').click();
    // Frames: one at each change of the read (and every 200 ms in "frames").
    let last = '';
    let done = false;
    settled(p).then(() => { done = true; }, () => { done = true; });
    while (!done && Date.now() - tStart < 60000) {
      const r = await read(p);
      const key = JSON.stringify({ ...r, y: 0 });
      if (key !== last || MODE === 'frames') {
        last = key;
        const at = Date.now() - tStart;
        const f = { at, ...r };
        const wordsChanged = out.frames.length === 0 || out.frames[out.frames.length - 1].words !== r.words;
        if (out.frames.length < 40 || wordsChanged) f.shot = await shot(`f${String(out.frames.length).padStart(2, '0')}-${at}ms`);
        // slow: the status line itself at each change of its words (an
        // element shot scrolls it into view; a scroll is not layout shift).
        if (MODE === 'slow' && wordsChanged) await p.locator('.status-slot').screenshot({ path: `${OUT}/${tag}-slow-strip-${at}ms.png` }).catch(() => {});
        if (MODE === 'slow' && wordsChanged) { out.contrast = out.contrast ?? []; out.contrast.push({ at, ...(await contrast(p)) }); }
        out.frames.push(f);
      }
      await p.waitForTimeout(MODE === 'frames' ? 200 : 120);
    }
    hold = 0;
    if (MODE === 'frames' || MODE === 'reduce') {
      for (const ms of [0, 150, 300, 600]) {
        if (ms) await p.waitForTimeout(150);
        out.frames.push({ at: Date.now() - tStart, after: true, ...(await read(p)), shot: await shot(`swap-${String(out.frames.length).padStart(2, '0')}-${Date.now() - tStart}ms`) });
      }
    }
    await p.waitForTimeout(2500);
    out.settled = { at: Date.now() - tStart, ...(await read(p)), shot: await shot('settled') };
    out.generate = await clsSince(p, t0);
    if (MEASURE === '1') { out.axe = await axe(p); out.small = await small(p); }
    // An answer: each NEEDS YOU question's first answer, then Apply answers
    // (the re-build is held like the Generate, so its shift counts too).
    const ans = () => p.locator('section.needs-you .nyq-card label.nyq-answer').first();
    if (await ans().count()) {
      const planBefore = p.locator('[data-testid=your-plan]');
      await planBefore.scrollIntoViewIfNeeded();
      out.planBefore = await planBefore.innerText().catch(() => null);
      await planBefore.screenshot({ path: `${OUT}/${tag}-${MODE}-plan-before.png` }).catch(() => {});
      let t1 = null;
      for (let i = 0; i < 6 && t1 === null; i++) {
        if (await ans().count()) { await ans().click(); await p.waitForTimeout(700); }
        const foot = p.locator('section.needs-you .nyq-card .nyq-foot > button:last-child').first();
        if (!(await foot.count())) break;
        const label = (await foot.innerText()).trim();
        if (/Apply answers/.test(label)) { hold = HOLD_MS; t1 = await p.evaluate(() => performance.now()); }
        await foot.click();
        await p.waitForTimeout(700);
      }
      if (t1 === null) t1 = await p.evaluate(() => performance.now());
      await p.waitForTimeout(600);
      out.answerFrames = [{ ...(await read(p)), shot: await shot('answer-inflight') }];
      await p.waitForTimeout(HOLD_MS + 1500);
      await settled(p).catch(() => {});
      hold = 0;
      await p.waitForTimeout(2500);
      out.answer = await clsSince(p, t1);
      const plan = p.locator('[data-testid=your-plan]');
      out.planAfter = await plan.innerText().catch(() => null);
      await plan.screenshot({ path: `${OUT}/${tag}-${MODE}-plan-after.png` }).catch(() => {});
      out.answerFrames.push({ ...(await read(p)), shot: await shot('answer-settled') });
    }
  } catch (e) {
    out.errors.push(`walk: ${String(e).slice(0, 300)}`);
    await p.screenshot({ path: `${OUT}/${tag}-${MODE}-error.png` }).catch(() => {});
  }
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}-${MODE}.json`, JSON.stringify(out, null, 1));
  console.log(tag, MODE, '| generate CLS', out.generate?.cls, 'n', out.generate?.n, '| answer CLS', out.answer?.cls, '| settled', out.settled?.at, 'ms | words', out.settled?.words, '| frames', out.frames.length, '| axe', out.axe?.length, 'small', out.small?.length, '| errors', out.errors.join(' | ').slice(0, 200));
  for (const e of out.generate?.top ?? []) console.log('   gen shift', e.v, '@', e.at, 'ms', e.src.join(' ; '));
  for (const e of out.answer?.top ?? []) console.log('   ans shift', e.v, '@', e.at, 'ms', e.src.join(' ; '));
}

for (const [w, h] of sizes) await run(w, h);
