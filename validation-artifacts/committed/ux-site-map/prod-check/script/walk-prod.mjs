// #447 production check, adapted from ../../evidence/script/walk.mjs.
// usage: SHOT_TOKEN=<gate token> [WIDTHS=1440,390] node walk-prod.mjs <outdir>
// The REAL site, everything live: geocoding, /api/road-bearing, the generate,
// /api/needs-you-map and its Overpass read and Mapbox picture.  Two answers
// can't be had on demand, so only for those steps, in the browser, the map
// request is changed: "no line" asks the live backend for a flag with nothing
// at this pin (the same picture a failed Overpass read gives: subject "none",
// work zone framed), and "failed image" answers 502.  A real failed Overpass
// shows up as x-map-subject "none" on a question that has a subject, and every
// map request's header is recorded so it can't pass unseen.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const SITE = 'https://www.conestruct.com';
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });

const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function pin(p) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(ADDR);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  // As #446's check: wait for the live candidate itself.  "Save & Close" is
  // always on the dialog, so waiting on the dialog's text races the lookup.
  const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
  await want.first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(1000);
  await want.first().click();
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
}
async function toGenerated(p) {
  await p.goto(SITE + '/sandbox', { waitUntil: 'load', timeout: 180000 });
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
const read = (p) => p.evaluate(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), top: +(b.top + scrollY).toFixed(1) }; };
  const q = (s) => document.querySelector(s);
  const t = (s) => (q(s)?.innerText ?? '').replace(/\s+/g, ' ').trim() || null;
  const targets = {};
  for (const [k, e] of [['zoomIn', q('[aria-label="Zoom in"].nyq-map-zbtn')], ['zoomOut', q('[aria-label="Zoom out"].nyq-map-zbtn')], ['street', q('[data-testid=needs-you-map-street]')]]) targets[k] = r(e);
  return { question: t('.nyq-q'), frame: r(q('.nyq-map-frame')), answers: r(q('.nyq-answers')), key: t('[data-testid=needs-you-map-key]'), keyBox: r(q('[data-testid=needs-you-map-key]')),
    label: t('[data-testid=needs-you-map-label]'), failed: t('[data-testid=needs-you-map-failed]'), step: q('[data-testid=needs-you-map-zoom]')?.getAttribute('data-step') ?? null,
    street: q('[data-testid=needs-you-map-street]')?.getAttribute('href') ?? null, alt: q('[data-testid=needs-you-map-img]')?.alt ?? null, targets,
    imgNatural: q('[data-testid=needs-you-map-img]')?.naturalWidth ?? null, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
const axe = async (p) => { await p.addScriptTag({ content: AXE }); return p.evaluate(async () => (await window.axe.run(document.querySelector('.nyq-card'), { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))); };

async function run(w, h) {
  const b = await chromium.launch();
  const out = { width: w, height: h, steps: [], errors: [], mapRequests: [] };
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  let mode = 'live';
  const sent = new Map();
  p.on('request', (r) => { if (r.url().includes('/api/needs-you-map')) sent.set(r, Date.now()); });
  p.on('response', (r) => {
    if (!r.url().includes('/api/needs-you-map')) return;
    const body = JSON.parse(r.request().postData() ?? '{}');
    out.mapRequests.push({ mode, flag: body.flag, width: body.width, height: body.height, zoom: body.zoom ?? 0, status: r.status(), subject: r.headers()['x-map-subject'] ?? null, ms: Date.now() - (sent.get(r.request()) ?? Date.now()) });
  });
  // The gate header goes to the site only (#443's check: anywhere else breaks Clerk).
  await p.route(`${SITE}/**`, async (r) => {
    const headers = { ...r.request().headers(), 'x-conestruct-gate': TOK };
    if (r.request().url().includes('/api/needs-you-map')) {
      if (mode === 'fail') return r.fulfill({ status: 502, contentType: 'application/json', body: '{"status":"unavailable"}' });
      if (mode === 'nogeom') return r.continue({ headers, postData: JSON.stringify({ ...JSON.parse(r.request().postData() ?? '{}'), flag: 'school_zone' }) });
    }
    return r.continue({ headers });
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
    await p.locator('.nyq-map-zbtn[aria-label="Zoom in"]').click();
    await p.waitForFunction(() => document.querySelector('[data-testid=needs-you-map-zoom]')?.dataset.step === '1');
    await p.waitForTimeout(3500);
    await step('q1-zoom-in', { doAxe: false });
    await p.locator('.nyq-map-zbtn[aria-label="Zoom out"]').click();
    await p.waitForTimeout(800);
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
    // No line, then a failed image, on a fresh frame (a new size key).
    mode = 'nogeom';
    await p.getByRole('button', { name: 'Zoom out' }).first().click();
    await p.waitForFunction(() => !document.querySelector('[data-testid=needs-you-map-label]'), null, { timeout: 60000 });
    await p.waitForTimeout(2500);
    await step('no-line');
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
fs.writeFileSync(`${OUT}/walk-${WIDTHS.join('-')}.json`, JSON.stringify(results, null, 1));
for (const r of results) {
  console.log(r.width, 'shift', JSON.stringify(r.layoutShiftOnLoad), JSON.stringify(r.layoutShiftOnFail));
  console.log(r.width, 'subjects', r.mapRequests.map((m) => `${m.mode}/${m.flag}/z${m.zoom}=${m.status}:${m.subject}:${m.ms}ms`).join(' '));
  console.log(r.width, 'errors', JSON.stringify(r.errors));
}
