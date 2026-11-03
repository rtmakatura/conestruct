// #437 branch 3 pre-go walkthrough (local).
// usage: SHOT_TOKEN=<local token> node walk.mjs <outdir> <port>
// Local `next dev` on the ux-group2 worktree, MODAL_RENDER_URL at the
// local backend (serve_replay.py: the real Overpass answer for the Denver
// Colfax pin, recorded once and replayed).  /api/road-bearing is stubbed
// with the three roads earlier missions used.  Playwright Chromium, DPR 2,
// 1440x900 and 390x844.  Each step logs the NEEDS YOU text, the strip,
// the warning row, the download buttons' state and the render-request
// count; crops of the results stack go to <outdir>.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const NOTAGS = { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null };
const cand = (way, cls, name, bearing, d) => ({ way_id: way, highway_class: cls, name, ref: null, bearing, snap_distance_m: d,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null, tags: { ...NOTAGS, oneway: 'yes', maxspeed: '30 mph', lanes: '2' } });
const THREE = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [
  cand('1547338992', 'primary', 'East Colfax Avenue', 271, 1.2),
  cand('628643782', 'primary', 'East Colfax Avenue', 91, 6.1),
  cand('596451653', 'residential', 'Pennsylvania Street', 359, 24.3),
] });

const T = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
async function shot(p, sel, file) {
  const l = p.locator(sel).first();
  if (!(await l.count())) return null;
  await park(p);
  await l.screenshot({ path: `${OUT}/${file}` });
  return file;
}
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(' ') }));
  });
}
// Targets under 44 in the results stack and the strip.
async function smallTargets(p) {
  return p.evaluate(() => {
    const els = [...document.querySelectorAll('.results-stack button, .results-stack a[href], .results-stack label.nyq-answer, .status-slot button')];
    return els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); })
      .map((e) => { const r = e.getBoundingClientRect(); return { text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), w: +r.width.toFixed(1), h: +r.height.toFixed(1), cls: e.className.toString().slice(0, 60) }; });
  });
}
async function state(p, counts) {
  return p.evaluate((renders) => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const q = (s) => document.querySelector(s);
    const stack = q('.results-stack');
    const order = stack ? [...stack.children].filter((c) => c.getBoundingClientRect().height > 0).map((c) => t(c.innerText).slice(0, 70)) : [];
    const total = [...document.querySelectorAll('.results-stack *')].find((e) => e.children.length === 0 && /TOTAL DEVICES/.test(e.textContent));
    const totalCell = total?.parentElement ? t(total.parentElement.innerText) : null;
    const dl = q('[data-testid=downloads]');
    const dlButtons = dl ? [...dl.querySelectorAll('button, a[href]')].map((b) => ({ text: t(b.innerText).slice(0, 30), disabled: b.disabled === true || b.getAttribute('aria-disabled') === 'true' })) : [];
    return {
      strip: t(q('.status-slot')?.innerText).slice(0, 160),
      head: t(q('.ny-head')?.innerText),
      currentQ: t(q('.nyq-card .nyq-q')?.innerText),
      card: t(q('.nyq-card')?.innerText).slice(0, 700),
      rows: [...document.querySelectorAll('.nyq-row')].map((r) => t(r.innerText)),
      warn: t(q('[data-testid=dl-warn]')?.innerText) || null,
      setupLine: t(q('[data-testid=setup-line]')?.innerText),
      totalCell, dlButtons, order, renders,
      setupBoxH: q('[data-testid=fact-setup]')?.getBoundingClientRect().height ?? null,
      slotH: q('[data-testid=results-head-slot]')?.getBoundingClientRect().height ?? null,
      gap: (() => { const a = q('[data-testid=fact-setup]'); const yp = [...document.querySelectorAll('.results-stack *')].find((e) => e.children.length === 0 && /^YOUR PLAN$/.test(e.textContent.trim())); if (!a || !yp) return null; const top = a.getBoundingClientRect().bottom, bot = yp.getBoundingClientRect().top; const hits = [...document.querySelectorAll('.results-stack *')].filter((e) => { const r = e.getBoundingClientRect(); return r.top >= top - 1 && r.bottom <= bot + 1 && r.height > 40; }).map((e) => `${e.tagName}.${e.className.toString().slice(0, 50)} ${e.getAttribute('data-testid') ?? ''} h=${Math.round(e.getBoundingClientRect().height)}`); return { px: Math.round(bot - top), hits: hits.slice(0, 6) }; })(),
    };
  }, counts.render);
}

async function toResults(p) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => /PICK THE ROAD|Which road/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
  await p.waitForTimeout(800);
  await p.getByRole('dialog').locator('button', { hasText: /westbound/i }).first().click();
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  const side = p.locator('[data-testid=side-option]').filter({ hasText: /North side|Right/i });
  if (await side.count()) await side.first().click(); else await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector('[data-testid=kind-chip-shoulder]', { timeout: 60000 });
  await p.locator('[data-testid=kind-chip-shoulder]').click();
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
  const oneWay = p.getByRole('button', { name: /^One-way$/ });
  if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(4000); }
  const gen = p.getByRole('button', { name: 'Generate plan' });
  await gen.waitFor({ state: 'visible' });
  await p.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Generate plan'); return b && !b.disabled; }, null, { timeout: 90000 });
  await gen.click();
  await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
  await p.waitForTimeout(4000);
}

const curQ = async (p) => T(await p.locator('.nyq-card .nyq-q').first().innerText({ timeout: 2000 }).catch(() => ''));
async function answer(p, which) {
  const label = which === 'yes' ? /^\s*Yes/ : /^\s*No/;
  await p.locator('.nyq-card .nyq-answer').filter({ hasText: label }).first().click();
  await p.waitForTimeout(300);
}
// Open the question whose title starts like `title`, by its row.
async function open(p, title) {
  if ((await curQ(p)) === title) return;
  await p.locator('.nyq-row .nyq-row-btn').filter({ hasText: title.slice(0, 14) }).first().click();
  await p.waitForTimeout(400);
}

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK }, acceptDownloads: true });
  const p = await ctx.newPage();
  const counts = { render: 0 };
  const out = { steps: [] };
  p.on('request', (r) => { if (r.method() === 'POST' && /\/api\/render\/audit(\?|$)/.test(r.url())) counts.render += 1; });
  const step = async (name, opts = {}) => {
    const s = { name, ...(await state(p, counts)) };
    if (opts.shot !== false) s.shot = await shot(p, '.results-stack', `${tag}-${String(out.steps.length).padStart(2, '0')}-${name}.png`);
    if (opts.measure) { s.axe = await axe(p); s.small = await smallTargets(p); }
    out.steps.push(s);
    console.log(tag, name, '| renders', counts.render, '| q:', s.currentQ, '| warn:', !!s.warn);
  };
  const download = async () => {
    // Phone: the cards sit behind the "N files" fold; open it first.
    const fold = p.locator('[data-testid=downloads] button:visible', { hasText: /files, quote included/ });
    const vis = p.locator('[data-testid=downloads] button:visible', { hasText: /^\s*Download\s*↓\s*$/ });
    if (!(await vis.count()) && (await fold.count())) { await fold.first().click(); await p.waitForTimeout(500); }
    const btn = p.locator('[data-testid=downloads] button:visible', { hasText: /^\s*Download\s*↓\s*$/ }).first();
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }).catch(() => null), btn.click()]);
    return d ? d.suggestedFilename() : null;
  };
  try {
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: THREE }));
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await toResults(p);
    await step('generated', { measure: true });
    const q1 = out.steps[0].currentQ;
    out.questionsAtLoad = [q1, ...out.steps[0].rows];
    if (process.env.MEASURE_ONLY) throw new Error('measure-only stop');
    out.downloadBeforeAnswers = await download();
    // Details, one click.
    await p.locator('.nyq-card .nyq-details-btn').first().click();
    await p.waitForTimeout(300);
    await step('q1-details-open');
    await p.locator('.nyq-card .nyq-details-btn').first().click();
    // Q1 each way, then Next.
    await answer(p, 'yes'); await step('q1-yes');
    await answer(p, 'no'); await step('q1-no');
    const N = out.questionsAtLoad.length;
    out.N = N;
    const titles = [q1];
    for (let i = 2; i <= N; i++) {
      await p.locator('.nyq-card .nyq-next-btn').click();
      await p.waitForTimeout(500);
      titles.push(await curQ(p));
      await step(`q${i}-open`, { measure: i === 2 });
      await answer(p, 'no'); await step(`q${i}-no`);
      await answer(p, 'yes'); await step(`q${i}-yes`);
    }
    out.titles = titles;
    // Undo Q1 from its collapsed record, reopen it by its row, answer Yes.
    await p.locator('.nyq-answered').filter({ hasText: q1.slice(0, 14) }).locator('.nyq-undo').first().click().catch(() => {});
    await p.waitForTimeout(500);
    await step('q1-undone');
    await open(p, q1).catch(() => {});
    out.reopenedQ1 = (await curQ(p)) === q1;
    await answer(p, 'yes');
    await step('q1-yes-again');
    // Undo Q2 the same way, reopen it, answer No.
    const q2 = titles[1];
    await p.locator('.nyq-answered').filter({ hasText: q2.slice(0, 14) }).locator('.nyq-undo').first().click().catch(() => {});
    await p.waitForTimeout(500);
    await step('q2-undone');
    await open(p, q2).catch(() => {});
    out.reopenedQ2 = (await curQ(p)) === q2;
    await answer(p, 'no');
    await step('q2-no-again');
    // Reach Apply: the last question's button, or the ready row.
    if (!(await p.getByRole('button', { name: 'Apply answers' }).count())) await open(p, titles.at(-1)).catch(() => {});
    await step('ready-to-apply', { measure: true });
    out.totalBefore = out.steps.at(-1).totalCell;
    const before = counts.render;
    await p.getByRole('button', { name: 'Apply answers' }).first().click();
    await p.waitForFunction((n) => true, null).catch(() => {});
    await p.waitForTimeout(3000);
    await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
    await p.waitForTimeout(5000);
    out.rendersForApply = counts.render - before;
    await step('applied', { measure: true });
    out.totalAfter = out.steps.at(-1).totalCell;
    out.downloadAfterApply = await download();
    await p.screenshot({ path: `${OUT}/${tag}-full-applied.png`, fullPage: true });
  } catch (e) {
    out.error = String(e).slice(0, 400);
    await p.screenshot({ path: `${OUT}/${tag}-error.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  console.log(tag, out.error ?? 'ok', '| renders total', counts.render, '| per apply', out.rendersForApply);
  return out;
}

const M = {};
for (const [w, h] of [[1440, 900], [390, 844]]) M[`${w}`] = await run(w, h);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(M, null, 1));
