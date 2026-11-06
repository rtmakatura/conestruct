// #443 reference-sections production check on eff48e0, adapted from the local
// walk (../../evidence/script/walk.mjs).
// usage: SHOT_TOKEN=<gate token> node walk-prod.mjs <outdir>
// The REAL site: no stubs (one route, which only adds the gate header).  Live Mapbox geocoding in the
// picker, live /api/road-bearing, live backend.  So the failed audit and its
// Retry can't be forced here and stay local evidence unless production really
// fails.  Playwright Chromium, DPR 2, 1440x900 and 390x844.  States: SearchIdle,
// OptionA (everything opened), the search states, SearchNone, the chip, four
// ways of clearing.  axe on each search state, every target measured, no
// request while searching, restore compared exactly.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = 'https://www.conestruct.com';
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });

const ROOT = '.ref-sections';
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function pin(p) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(ADDR);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  // Live detection answers after the dialog opens, so wait for the road itself.
  const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
  await want.first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(1000);
  await want.first().click();
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
}

async function toGenerated(p, out) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await pin(p);
  const chips = await p.locator('[data-testid^=kind-chip-]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
  out.kindChips = chips;
  const kind = chips.find((c) => /shoulder/.test(c)) ?? chips[0];
  out.kind = kind;
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
  out.ctaReason = await p.evaluate(() => document.querySelector('[data-testid=cta-reason]')?.innerText.trim() ?? null);
  await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
  await p.getByTestId('generate-plan').click();
  await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
  await p.waitForSelector(ROOT, { timeout: 60000 });
}

async function settleAudit(p) {
  await p.waitForFunction(() => /checks?,? |Checked/.test(document.querySelector('.ref-sections')?.innerText ?? ''), null, { timeout: 120000 });
  await p.waitForTimeout(5000);
}

const stateOf = (p) => p.evaluate((ROOT) => {
  const root = document.querySelector(ROOT);
  return {
    sections: [...root.querySelectorAll('[data-section]')].map((s) => ({ id: s.dataset.section, open: s.querySelector('.rs-head')?.getAttribute('aria-expanded') ?? null, summary: s.querySelector('.rs-summary')?.innerText.trim() })),
    rows: [...root.querySelectorAll('[data-row]')].map((r) => `${r.dataset.row}:${r.querySelector('.rr-head').getAttribute('aria-expanded')}`),
  };
}, ROOT);

const searchView = (p) => p.evaluate((ROOT) => {
  const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  const root = document.querySelector(ROOT);
  const marks = [...root.querySelectorAll('mark')];
  const cs = marks[0] ? getComputedStyle(marks[0]) : null;
  return {
    status: t(root.querySelector('.rs-status')?.innerText),
    sections: [...root.querySelectorAll('[data-section]')].map((s) => ({
      id: s.dataset.section, dim: s.classList.contains('is-dim'), summary: t(s.querySelector('.rs-summary')?.innerText),
      rows: [...s.querySelectorAll('[data-row]')].map((r) => ({ id: r.dataset.row, open: r.querySelector('.rr-head').getAttribute('aria-expanded'), head: t(r.querySelector('.rr-head').innerText).slice(0, 120) })),
    })),
    marks: marks.length, markStyle: cs ? { bg: cs.backgroundColor, shadow: cs.boxShadow } : null,
    none: t(root.querySelector('.rs-none')?.innerText) || null,
    chips: [...root.querySelectorAll('.rs-chip')].map((c) => t(c.innerText)),
  };
}, ROOT);

const axe = async (p) => {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async (ROOT) => {
    const r = await window.axe.run(document.querySelector(ROOT), { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  }, ROOT);
};

const measure = (p) => p.evaluate((ROOT) => {
  const root = document.querySelector(ROOT);
  const small = [];
  let n = 0;
  for (const e of root.querySelectorAll('button, a, input')) {
    const b = e.getBoundingClientRect();
    if (!b.width) continue;
    n += 1;
    if (b.width < 44 || b.height < 44) small.push({ tag: e.tagName, cls: e.className, text: (e.innerText ?? '').slice(0, 40), w: +b.width.toFixed(1), h: +b.height.toFixed(1) });
  }
  const rowH = [...root.querySelectorAll('.rr-head')].map((e) => e.getBoundingClientRect().height);
  const box = root.querySelector('.rs-input')?.getBoundingClientRect();
  return { targets: n, small, rowMin: rowH.length ? Math.min(...rowH) : null, box: box ? +box.height.toFixed(1) : null, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
}, ROOT);

async function openAll(p) {
  for (const id of ['checked', 'pending', 'reference']) {
    const h = p.locator(`[data-section=${id}] > button.rs-head`);
    if ((await h.getAttribute('aria-expanded')) === 'false') await h.click();
  }
  await p.waitForTimeout(200);
  const more = p.locator(`${ROOT} .rr-more`);
  if (await more.count()) await more.first().click();
  await p.waitForTimeout(200);
}
async function openEveryRow(p) {
  const heads = p.locator(`${ROOT} .rr-head[aria-expanded=false]`);
  for (let guard = 0; guard < 80 && (await heads.count()); guard += 1) { await heads.first().click(); }
  await p.waitForTimeout(300);
}

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = { steps: {}, errors: [], roadBearing: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  // The gate header goes to the site only: on every origin it turns the Clerk
  // and Sentry requests into failing CORS preflights ("Failed to load Clerk",
  // run 2 here and the provenance-marks check).  This route stubs nothing.
  await ctx.route('https://www.conestruct.com/**', (r) => r.continue({ headers: { ...r.request().headers(), 'x-conestruct-gate': TOK } }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
  let requests = [];
  p.on('request', (r) => { if (r.url().includes('/api/')) requests.push(new URL(r.url()).pathname); });
  p.on('response', async (r) => {
    if (!r.url().includes('/api/road-bearing')) return;
    const j = await r.json().catch(() => null);
    out.roadBearing.push({ status: r.status(), scan_status: j?.scan_status ?? null, candidates: j?.candidates?.length ?? null });
  });
  const crop = async (name, sel = ROOT) => {
    await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } document.querySelector('.workbench-frame')?.style.setProperty('display', 'none'); });
    await p.locator(sel).first().screenshot({ path: `${OUT}/${tag}-${nn()}-${name}.png` });
    await p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } document.querySelector('.workbench-frame')?.style.removeProperty('display'); });
  };
  const box = p.locator(`${ROOT} #ref-search`);
  const search = async (name, term) => {
    requests = [];
    await box.fill('');
    await box.pressSequentially(term, { delay: 25 });
    await p.waitForTimeout(350);
    const s = { term, view: await searchView(p), axe: await axe(p), m: await measure(p), requests: [...requests] };
    out.steps[name] = s;
    await crop(name);
    console.log(tag, name, '|', s.view.status, '| marks', s.view.marks, '| axe', s.axe.length, '| small', s.m.small.length, '| req', s.requests.length);
    return s;
  };
  try {
    await toGenerated(p, out);
    await settleAudit(p);
    out.steps.idle = { state: await stateOf(p), m: await measure(p), axe: await axe(p) };
    await crop('search-idle');
    console.log(tag, 'idle', JSON.stringify(out.steps.idle.state.sections.map((s) => [s.id, s.open, s.summary])), '| small', out.steps.idle.m.small.length, '| axe', out.steps.idle.axe.length);
    await openAll(p);
    out.steps.sectionsOpen = { state: await stateOf(p), m: await measure(p), axe: await axe(p) };
    await crop('option-a-sections-open');
    console.log(tag, 'sections-open small', out.steps.sectionsOpen.m.small.length, 'axe', out.steps.sectionsOpen.axe.length);
    await openEveryRow(p);
    out.steps.allOpen = { state: await stateOf(p), m: await measure(p), axe: await axe(p), nestedDetails: await p.locator(`${ROOT} .rr .rr, ${ROOT} .rr details`).count() };
    await crop('option-a-every-row-open');
    console.log(tag, 'all-open small', out.steps.allOpen.m.small.length, 'axe', out.steps.allOpen.axe.length, 'rowMin', out.steps.allOpen.m.rowMin, 'overflowX', out.steps.allOpen.m.overflowX, 'nested', out.steps.allOpen.nestedDetails);

    for (let guard = 0; guard < 80; guard += 1) { const o = p.locator(`${ROOT} .rr-head[aria-expanded=true]`); if (!(await o.count())) break; await o.first().click(); }
    await p.locator('[data-section=pending] > button.rs-head').click();
    await p.locator(`[data-section=checked] .rr-head`).first().click();
    await p.waitForTimeout(200);
    const before = await stateOf(p);
    out.steps.mixedBefore = before;
    const sameAsBefore = async (how) => { const now = await stateOf(p); const ok = JSON.stringify(now) === JSON.stringify(before); out.steps[`restore-${how}`] = { ok }; console.log(tag, 'restore', how, ok); };

    await search('search-sidewalk', 'sidewalk');
    await search('search-6B', '6B');
    await search('search-cone', 'cone');
    await search('search-sign', 'sign');
    await search('search-500', '$500');
    await search('search-flagger', 'flagger');
    await search('search-taper', 'taper');
    await p.locator(`${ROOT} .rs-clear`).click(); await p.waitForTimeout(250);
    await sameAsBefore('x');
    out.steps.focusAfterX = await p.evaluate(() => document.activeElement?.id ?? null);

    await search('search-for-escape', 'sidewalk');
    await box.press('Escape'); await p.waitForTimeout(250);
    await sameAsBefore('escape');

    await search('search-for-emptied', 'sidewalk');
    await box.fill(''); await p.waitForTimeout(250);
    await sameAsBefore('emptied');

    const none = await search('search-none', 'zzqx');
    console.log(tag, 'none', none.view.none, '| chips', JSON.stringify(none.view.chips));
    if (none.view.chips.length) {
      requests = [];
      await p.locator(`${ROOT} .rs-chip`).first().click(); await p.waitForTimeout(350);
      out.steps.chip = { chip: none.view.chips[0], view: await searchView(p), requests: [...requests] };
      await crop('search-after-chip');
      console.log(tag, 'chip', none.view.chips[0], '|', out.steps.chip.view.status, '| req', out.steps.chip.requests.length);
      await box.fill('zzqx'); await p.waitForTimeout(250);
    }
    await p.getByRole('button', { name: 'Clear search and show everything' }).click(); await p.waitForTimeout(250);
    await sameAsBefore('clear-button');
  } catch (e) {
    out.error = String(e).slice(0, 600);
    await p.screenshot({ path: `${OUT}/${tag}-error.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  console.log(tag, out.error ?? 'ok', '| pageerrors', out.errors.length, '| road-bearing', JSON.stringify(out.roadBearing));
  return out;
}

const M = {};
for (const [w, h] of [[1440, 900], [390, 844]].filter(([x]) => WIDTHS.includes(x))) M[`${w}`] = await run(w, h);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(M, null, 1));
