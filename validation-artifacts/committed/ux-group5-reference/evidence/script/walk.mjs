// #443 reference-sections walk (local), adapted from ux-group4's walk.mjs.
// usage: SHOT_TOKEN=<gate token> node walk.mjs <outdir> <port>
// Local `next dev` on the ux-group5 worktree, MODAL_RENDER_URL at the local
// backend (ux-group3's serve_replay.py with its recorded Overpass answers).
// /api/road-bearing is stubbed from the recorded fixture (live answers
// `unavailable` from this machine).  Playwright Chromium, DPR 2, 1440x900 and
// 390x844.  States: SearchIdle, OptionA (everything opened), SearchSidewalk,
// Search6B, cone, sign, $500, flagger, SearchNone, the chip, four ways of
// clearing, a failed audit and its Retry.  axe on the search states, every
// target measured, no request while searching, restore compared exactly.
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

const ROOT = '.ref-sections';
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

async function toGenerated(p, out) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await pin(p);
  // Shoulder, the mock's plan: kind, then the side, then Confirm.
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
  // The section counts arrive with the audit's answer.
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
    openedLines: (root.innerText.match(/Opened because the match is inside\./g) ?? []).length,
    showAll: [...root.querySelectorAll('button')].map((b) => t(b.innerText)).filter((x) => /^Show all/.test(x)),
    subCounts: (root.innerText.match(/\d+ of \d+ [a-z ]+ shown/g) ?? []),
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

// Every target in the sections, and the row and label rules.
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
  const label = root.querySelector('.rs-label');
  const ls = label ? getComputedStyle(label) : null;
  return {
    targets: n, small,
    rowMin: rowH.length ? Math.min(...rowH) : null,
    box: box ? +box.height.toFixed(1) : null,
    label: ls ? `${ls.fontFamily.split(',')[0]} ${ls.fontSize}` : null,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    rootOverflow: [...root.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > root.getBoundingClientRect().right + 0.5).slice(0, 5).map((e) => e.className || e.tagName),
  };
}, ROOT);

// R141: a device or sign code doesn't break at its hyphen.
const hyphenBreaks = (p) => p.evaluate((ROOT) => {
  const CODE = /\b(?:[A-Z]{1,3}\d*[A-Z]?|\d+[A-Z])(?:-[\d.]+[A-Za-z]*)+\b/g;
  const out = { checked: 0, broken: [] };
  const w = document.createTreeWalker(document.querySelector(ROOT), NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    for (const m of n.nodeValue.matchAll(CODE)) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const tops = new Set([...r.getClientRects()].map((c) => Math.round(c.top)));
      out.checked += 1;
      if (tops.size > 1) out.broken.push({ code: m[0], cls: n.parentElement.className });
    }
  }
  return out;
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
  const out = { steps: {}, errors: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
  let requests = [];
  p.on('request', (r) => { if (r.url().includes('/api/')) requests.push(r.url().replace(BASE, '')); });
  await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    return r.fulfill({ status: 200, contentType: 'application/json', body: det(asked && typeof asked.lat === 'number' ? { lat: asked.lat, lng: asked.lng } : PIN0) });
  });
  const crop = async (name, sel = ROOT) => {
    // The fixed .workbench-frame overlay shows as a stray line in a crop taller
    // than the viewport (probed: it is not in the section); hidden for crops.
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
    if (process.env.PROBE === '1') {
      await openAll(p);
      out.probe = { body: await p.evaluate(() => [...document.querySelectorAll('[data-section]')].map((s) => {
        const body = s.querySelector('.rs-body');
        const top = s.getBoundingClientRect().top;
        return { id: s.dataset.section, head: s.querySelector('.rs-head').getBoundingClientRect().height, kids: [...body.children].slice(0, 3).map((k) => { const c = getComputedStyle(k); const b = k.getBoundingClientRect(); return { cls: k.className, top: +(b.top - top).toFixed(1), h: +b.height.toFixed(1), bt: c.borderTopWidth, mt: c.marginTop, firstKid: k.firstElementChild?.className ?? null }; }) };
      })) };
      await box.pressSequentially('sidewalk', { delay: 25 });
      await p.waitForTimeout(400);
      await box.scrollIntoViewIfNeeded();
      await p.evaluate(() => document.querySelector('.rs-search').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(600);
      out.probe.label = await p.evaluate(() => {
        const l = document.querySelector('.rs-search > .rs-label');
        const lb = l.getBoundingClientRect();
        const hits = [];
        for (const e of document.querySelectorAll('body *')) {
          if (e === l || e.contains(l) || l.contains(e)) continue;
          const b = e.getBoundingClientRect();
          if (b.bottom > lb.top && b.top < lb.bottom && b.right > lb.left && b.left < lb.right && b.width && b.height) hits.push({ cls: String(e.className).slice(0, 60), tag: e.tagName, top: +b.top.toFixed(1), h: +b.height.toFixed(1), pos: getComputedStyle(e).position });
        }
        return { rect: [lb.top, lb.bottom], parentStyle: getComputedStyle(l.parentElement).cssText ? 'x' : '', hits: hits.slice(0, 12) };
      });
      await p.screenshot({ path: `${OUT}/${tag}-probe-viewport.png` });
      console.log(JSON.stringify(out.probe));
      await ctx.close(); await b.close();
      return out;
    }
    // SearchIdle.
    out.steps.idle ={ state: await stateOf(p), m: await measure(p), axe: await axe(p) };
    await crop('search-idle');
    console.log(tag, 'idle', JSON.stringify(out.steps.idle.state.sections.map((s) => [s.id, s.open, s.summary])));
    // OptionA: everything open; rows counted against the section summaries.
    await openAll(p);
    out.steps.sectionsOpen = { state: await stateOf(p), m: await measure(p), axe: await axe(p) };
    await crop('option-a-sections-open');
    await openEveryRow(p);
    out.steps.allOpen = { state: await stateOf(p), m: await measure(p), axe: await axe(p), hyphen: await hyphenBreaks(p), nestedDetails: await p.locator(`${ROOT} .rr .rr, ${ROOT} .rr details`).count() };
    await crop('option-a-every-row-open');
    console.log(tag, 'all-open small', out.steps.allOpen.m.small.length, 'axe', out.steps.allOpen.axe.length, 'hyphen', JSON.stringify(out.steps.allOpen.hyphen), 'nested', out.steps.allOpen.nestedDetails);

    // A mixed state, to prove the restore: reload the row state by closing
    // all, then one section and one row open.
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
    if (none.view.chips.length) {
      requests = [];
      await p.locator(`${ROOT} .rs-chip`).first().click(); await p.waitForTimeout(350);
      out.steps.chip = { chip: none.view.chips[0], view: await searchView(p), requests: [...requests] };
      await crop('search-after-chip');
      await box.fill('zzqx'); await p.waitForTimeout(250);
    }
    await p.getByRole('button', { name: 'Clear search and show everything' }).click(); await p.waitForTimeout(250);
    await sameAsBefore('clear-button');
    out.steps.hyphenAtEnd = await hyphenBreaks(p);
  } catch (e) {
    out.error = String(e).slice(0, 600);
    await p.screenshot({ path: `${OUT}/${tag}-error.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();

  // A failed audit: a fresh page, the audit answering 500 until Retry.
  const ctx2 = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const q = await ctx2.newPage();
  q.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
  let failAudit = true;
  await q.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    return r.fulfill({ status: 200, contentType: 'application/json', body: det(asked && typeof asked.lat === 'number' ? { lat: asked.lat, lng: asked.lng } : PIN0) });
  });
  await q.route('**/api/render/audit**', (r) => (failAudit ? r.fulfill({ status: 500, contentType: 'text/plain', body: 'walk: audit down' }) : r.continue()));
  try {
    const o2 = {};
    await toGenerated(q, o2);
    await q.waitForSelector('.rs-banner', { timeout: 60000 });
    await q.waitForTimeout(800);
    const banner = await q.evaluate(() => { const s = document.querySelector('.rs-banner'); const sec = s?.closest('[data-section]'); return { text: s?.innerText.replace(/\s+/g, ' ').trim(), section: sec?.dataset.section, open: sec?.querySelector('.rs-head')?.getAttribute('aria-expanded') }; });
    const s3 = await stateOf(q);
    await q.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') e.style.position = 'relative'; } });
    await q.locator(ROOT).first().screenshot({ path: `${OUT}/${tag}-90-audit-failed.png` });
    out.steps.auditFailed = { banner, state: s3, axe: await axe(q), m: await measure(q) };
    failAudit = false;
    await q.locator('.rs-banner button', { hasText: 'Retry' }).click();
    await q.waitForFunction(() => !document.querySelector('.rs-banner'), null, { timeout: 120000 });
    // The banner leaves when Retry starts; the other sections return with the answer.
    out.steps.sectionsWhileRetrying = await q.locator('[data-section]').count();
    await q.waitForSelector('[data-section=checked]', { timeout: 120000 }).catch(() => {});
    await q.waitForTimeout(1500);
    out.steps.afterRetry = { state: await stateOf(q) };
    await q.locator(ROOT).first().screenshot({ path: `${OUT}/${tag}-91-after-retry.png` });
    console.log(tag, 'audit-failed', JSON.stringify(banner), '| small', out.steps.auditFailed.m.small.length, '| axe', out.steps.auditFailed.axe.length, '| after retry', JSON.stringify(out.steps.afterRetry.state.sections.map((s) => [s.id, s.summary])));
  } catch (e) {
    out.errorAudit = String(e).slice(0, 600);
    await q.screenshot({ path: `${OUT}/${tag}-audit-error.png`, fullPage: true }).catch(() => {});
  }
  await ctx2.close();
  await b.close();
  console.log(tag, out.error ?? 'ok', out.errorAudit ?? 'audit-ok', 'pageerrors', out.errors.length);
  return out;
}

const M = {};
for (const [w, h] of [[1440, 900], [390, 844]].filter(([x]) => WIDTHS.includes(x))) M[`${w}`] = await run(w, h);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(M, null, 1));
