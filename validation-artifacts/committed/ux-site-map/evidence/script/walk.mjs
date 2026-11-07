// #447 site-map walk (local), adapted from ux-group5-reference's walk.mjs.
// usage: SHOT_TOKEN=<gate token> node walk.mjs <outdir> <port>
// Local `next dev` on the issue-447 worktree, MODAL_RENDER_URL at the local
// backend (ux-group3's serve_replay.py: Overpass recorded once, then replayed;
// Mapbox live).  /api/road-bearing is stubbed from the recorded fixture.
// Playwright Chromium, DPR 2, 1440x900 and 390x844.  States: every question's
// map, a question with no geometry, a failed image, the street-level URL, zoom, and the
// layout measured before and after each so a shift can't hide.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(new URL('../../../ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json', import.meta.url), 'utf8'));
const PIN0 = { lat: 39.739781, lng: -104.968249 };
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
function cand(id, at, chain) {
  const w = FIX.elements.find((e) => e.type === 'way' && e.id === id);
  const g = chainGeometry(chain);
  let i = 0; g.forEach((n, k) => { if (distM(n, at) < distM(g[i], at)) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return { way_id: String(id), highway_class: w.tags.highway, name: w.tags.name, ref: s('ref'), bearing: +brg(a, b).toFixed(2),
    snap_distance_m: +distM(g[i], at).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
    tags: { oneway: s('oneway'), maxspeed: s('maxspeed'), lanes: s('lanes'), lanes_forward: s('lanes:forward'), lanes_backward: s('lanes:backward'),
      lanes_both_ways: s('lanes:both_ways'), turn_lanes: s('turn:lanes'), turn_lanes_forward: s('turn:lanes:forward'), turn_lanes_backward: s('turn:lanes:backward') },
    geometry: g.map((n) => [n.lat, n.lon]) };
}
const det = (at) => JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [cand(1547338997, at, COLFAX_WEST)] });
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function pin(p) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(ADDR);
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
async function toGenerated(p) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await pin(p);
  const chips = await p.locator('[data-testid^=kind-chip-]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
  const kind = chips.find((c) => /shoulder/.test(c)) ?? chips[0];
  await p.locator(`label.nyq-answer:has([data-testid=${kind}])`).click();
  await p.waitForTimeout(800);
  await nextBtn(p).click();
  await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 30000 });
  await p.waitForTimeout(1200);
  await p.locator('[data-testid=where-questions] label.nyq-answer').first().click();
  await p.waitForTimeout(1500);
  await p.locator('[data-testid=where-confirm]').click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
  const oneWay = p.getByRole('button', { name: /^One-way$/ });
  if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(4000); }
  const laneOk = p.getByRole('button', { name: 'Lane count is right' });
  if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(3000); }
  await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
  await p.getByTestId('generate-plan').click();
  await p.waitForSelector('[data-testid=needs-you-map]', { timeout: 240000 });
}
const MAP = '[data-testid=needs-you-map]';
const read = (p) => p.evaluate(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), top: +(b.top + scrollY).toFixed(1) }; };
  const q = (s) => document.querySelector(s);
  const t = (s) => (q(s)?.innerText ?? '').replace(/\s+/g, ' ').trim() || null;
  const card = q('.nyq-card');
  const targets = {};
  for (const [k, e] of [['zoomIn', q('[aria-label="Zoom in"].nyq-map-zbtn')], ['zoomOut', q('[aria-label="Zoom out"].nyq-map-zbtn')], ['street', q('[data-testid=needs-you-map-street]')]]) targets[k] = r(e);
  const f = q('.nyq-map-frame')?.getBoundingClientRect();
  const place = (e) => { if (!e || !f) return null; const b = e.getBoundingClientRect(); return b.top >= f.bottom - 0.5 ? 'under' : b.bottom <= f.bottom + 0.5 && b.top >= f.top - 0.5 ? 'on' : 'across'; };
  return { question: t('.nyq-q'), place: { zoom: place(q('[data-testid=needs-you-map-zoom]')), label: place(q('[data-testid=needs-you-map-label]')), street: place(q('[data-testid=needs-you-map-street]')) }, label_box: r(q('[data-testid=needs-you-map-label]')), under: r(q('.nyq-map-under')), frame: r(q('.nyq-map-frame')), card: r(card), answers: r(q('.nyq-answers')), key: t('[data-testid=needs-you-map-key]'), keyBox: r(q('[data-testid=needs-you-map-key]')),
    label: t('[data-testid=needs-you-map-label]'), failed: t('[data-testid=needs-you-map-failed]'), step: q('[data-testid=needs-you-map-zoom]')?.getAttribute('data-step') ?? null,
    street: q('[data-testid=needs-you-map-street]')?.getAttribute('href') ?? null, streetTarget: q('[data-testid=needs-you-map-street]')?.getAttribute('target') ?? null, alt: q('[data-testid=needs-you-map-img]')?.alt ?? null, targets,
    imgNatural: q('[data-testid=needs-you-map-img]')?.naturalWidth ?? null, overflowX: document.documentElement.scrollWidth > innerWidth };
});
const axe = async (p) => { await p.addScriptTag({ content: AXE }); return p.evaluate(async () => (await window.axe.run(document.querySelector('.nyq-card'), { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))); };

async function run(w, h) {
  const b = await chromium.launch();
  const out = { width: w, steps: [], errors: [], mapRequests: [] };
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  let mode = 'live';
  p.on('response', (r) => { if (r.url().includes('/api/needs-you-map')) { const body = JSON.parse(r.request().postData() ?? '{}'); out.mapRequests.push({ flag: body.flag, width: body.width, height: body.height, zoom: body.zoom ?? 0, status: r.status(), subject: r.headers()['x-map-subject'] ?? null }); } });
  await p.route('**/api/road-bearing**', async (r) => { const asked = JSON.parse(r.request().postData() ?? 'null'); return r.fulfill({ status: 200, contentType: 'application/json', body: det(asked && typeof asked.lat === 'number' ? { lat: asked.lat, lng: asked.lng } : PIN0) }); });
  await p.route('**/api/needs-you-map**', async (r) => {
    if (mode === 'fail') return r.fulfill({ status: 502, contentType: 'application/json', body: '{"status":"unavailable"}' });
    // A genuine empty subject, not a rewritten header: the backend is asked
    // for a flag with nothing counted at this pin (no school), so it really
    // draws no line and really frames the work zone.
    if (mode === 'nogeom') return r.continue({ postData: JSON.stringify({ ...JSON.parse(r.request().postData() ?? '{}'), flag: 'school_zone' }) });
    return r.continue();
  });
  let n = 1;
  const step = async (name, { doAxe = true } = {}) => {
    const s = { name, ...(await read(p)) };
    await p.locator('.nyq-card').first().scrollIntoViewIfNeeded();
    const file = `${w}-${String(n++).padStart(2, '0')}-${name}.png`;
    await p.locator('.nyq-card').first().screenshot({ path: `${OUT}/${file}` });
    s.shot = file;
    if (doAxe) s.axe = await axe(p);
    out.steps.push(s);
    console.log(w, name, '|', s.question, '| label', s.label, '| axe', s.axe?.length ?? '-');
    return s;
  };
  const shown = () => p.waitForFunction(() => { const i = document.querySelector('[data-testid=needs-you-map-img]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 90000 });
  try {
    await toGenerated(p);
    await p.waitForTimeout(200);
    const loading = await read(p);
    out.loading = { frame: loading.frame, answers: loading.answers, key: loading.keyBox };
    await shown();
    const first = await step('q1-map');
    out.layoutShiftOnLoad = { answersMoved: +(first.answers.top - loading.answers.top).toFixed(1), frameH: [loading.frame.h, first.frame.h], keyH: [loading.keyBox.h, first.keyBox.h] };
    // Zoom, in and back.
    await p.locator('.nyq-map-zbtn[aria-label="Zoom in"]').click();
    await p.waitForFunction(() => document.querySelector('[data-testid=needs-you-map-zoom]')?.dataset.step === '1');
    await p.waitForTimeout(3500);
    await step('q1-zoom-in', { doAxe: false });
    await p.locator('.nyq-map-zbtn[aria-label="Zoom out"]').click();
    await p.waitForTimeout(800);
    // Every question in turn.
    let i = 2;
    for (;;) {
      await p.locator('.nyq-card label.nyq-answer').first().click();
      await p.waitForTimeout(300);
      const btn = p.locator('.nyq-card .nyq-foot > button:last-child');
      if ((await btn.innerText()).trim() !== 'Next question') break;
      await btn.click();
      await p.waitForTimeout(600);
      await shown();
      await p.waitForTimeout(600);
      await step(`q${i++}-map`);
    }
    // No geometry, then a failed image, on a fresh frame (a new size key).
    mode = 'nogeom';
    await p.getByRole('button', { name: 'Zoom out' }).first().click();
    await p.waitForFunction(() => !document.querySelector('[data-testid=needs-you-map-label]'), null, { timeout: 60000 });
    await p.waitForTimeout(2500);
    await step('no-geometry');
    const beforeFail = await read(p);
    mode = 'fail';
    await p.getByRole('button', { name: 'Zoom in' }).first().click();
    await p.waitForTimeout(100);
    await p.getByRole('button', { name: 'Zoom in' }).first().click();
    await p.waitForSelector('[data-testid=needs-you-map-failed]', { timeout: 30000 });
    const failed = await step('failed-image');
    out.layoutShiftOnFail = { answersMoved: +(failed.answers.top - beforeFail.answers.top).toFixed(1), frameH: [beforeFail.frame.h, failed.frame.h], keyH: [beforeFail.keyBox.h, failed.keyBox.h] };
  } catch (e) { out.errors.push('WALK: ' + String(e).slice(0, 300)); await p.screenshot({ path: `${OUT}/${w}-error.png` }).catch(() => {}); }
  await b.close();
  return out;
}
const results = [];
for (const w of WIDTHS) results.push(await run(w, w === 390 ? 844 : 900));
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(results, null, 1));
console.log('errors', results.map((r) => r.errors));
