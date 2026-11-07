// #450 walk (local), adapted from #443's walk.mjs (ux-group5-reference).
// usage: GATE_BYPASS_TOKEN=<the dev server's token> node walk.mjs <outdir> <port> <pdfdir>
// Local `next dev` on the issue-450 worktree, MODAL_RENDER_URL at the local
// backend (ux-group3's serve_replay.py, Overpass replayed from the recorded
// answers).  /api/road-bearing is stubbed from the recorded fixture.
// Chromium, DPR 2, 1440x900 and 390x844.  The gate header goes through the
// shared helper's newGatedContext (scripts/gate.cjs), so it reaches the local
// site's own host only (the walk-script rule, rulings.md X11).
// Captures: the strip; "Checked and passed" with every rule-check row closed,
// then one opened; the placeholder; a search for words only a detail holds;
// the audit PDF for this plan (page 1 is rasterized by pdf_page1.py).  axe
// and the 44 px sweep on each state.
import { createRequire } from 'module';
import fs from 'fs';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-450';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const { newGatedContext, gateHeaders, isSiteRequest } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${W}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PORT, PDFDIR] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PDFDIR, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(`${W}/validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json`, 'utf8'));
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
  const chips = await p.locator('[data-testid^=kind-chip-]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
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
  await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
  await p.getByTestId('generate-plan').click();
  await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
  await p.waitForSelector(ROOT, { timeout: 60000 });
  await p.waitForFunction(() => /checks?,? |Checked/.test(document.querySelector('.ref-sections')?.innerText ?? ''), null, { timeout: 120000 });
  await p.waitForTimeout(5000);
}

const axe = async (p, sel) => {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async (sel) => {
    const r = await window.axe.run(document.querySelector(sel), { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  }, sel);
};

// Every target under `sel` measured against 44 px.
const measure = (p, sel) => p.evaluate((sel) => {
  const root = document.querySelector(sel);
  const small = [];
  let n = 0;
  for (const e of root.querySelectorAll('button, a, input')) {
    const b = e.getBoundingClientRect();
    if (!b.width) continue;
    n += 1;
    if (b.width < 44 || b.height < 44) small.push({ tag: e.tagName, cls: String(e.className), text: (e.innerText ?? '').slice(0, 40), w: +b.width.toFixed(1), h: +b.height.toFixed(1) });
  }
  return { targets: n, small, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
}, sel);

// The RULE CHECKS rows of "Checked and passed": head text, and how many lines
// the title line takes (distinct line tops of its text).
const ruleRows = (p) => p.evaluate(() => {
  const sec = document.querySelector('[data-section=checked]');
  const group = [...sec.querySelectorAll('.rs-group, .rs-body > div')].find((g) => /RULE CHECKS/.test(g.innerText));
  const rows = [...(group ?? sec).querySelectorAll('[data-row]')].filter((r) => !/^calc-/.test(r.dataset.row));
  return rows.map((r) => {
    const line = r.querySelector('.rr-title-line');
    const range = document.createRange(); range.selectNodeContents(line);
    const tops = new Set([...range.getClientRects()].filter((c) => c.width > 0).map((c) => Math.round(c.top)));
    return { id: r.dataset.row, open: r.querySelector('.rr-head').getAttribute('aria-expanded'), head: line.innerText.replace(/\s+/g, ' ').trim(), lines: tops.size };
  });
});

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = { steps: {}, errors: [], hostsSeen: new Set() };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await newGatedContext(b, `${BASE}/sandbox`, { viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
  // The origins the page itself requested.  A redirect hop the helper
  // follows inside route.fetch never reaches this listener, so this is not
  // a list of hops.  `gatedHosts` below is the helper's isSiteRequest
  // predicate applied to these origins, not a measurement of the header on
  // the wire; the hop-level proof is tests/gate-helper.test.ts (X11).  And
  // the plan's scenario, from the audit request.
  let auditBody = null;
  ctx.on('request', (r) => {
    out.hostsSeen.add(new URL(r.url()).origin);
    if (r.url().includes('/api/render/audit') && r.method() === 'POST') auditBody = r.postData();
  });
  await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    return r.fulfill({ status: 200, contentType: 'application/json', body: det(asked && typeof asked.lat === 'number' ? { lat: asked.lat, lng: asked.lng } : PIN0) });
  });
  const crop = async (name, sel = ROOT) => {
    await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } document.querySelector('.workbench-frame')?.style.setProperty('display', 'none'); });
    await p.locator(sel).first().screenshot({ path: `${OUT}/${tag}-${nn()}-${name}.png` });
    await p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } document.querySelector('.workbench-frame')?.style.removeProperty('display'); });
  };
  try {
    await toGenerated(p, out);
    // The strip.
    const strip = p.locator('.status-bar').first();
    out.steps.strip = { text: (await strip.innerText()).replace(/\s+/g, ' ').trim(), axe: await axe(p, '.status-bar'), m: await measure(p, '.status-bar') };
    await crop('strip', '.status-bar');
    console.log(tag, 'strip |', out.steps.strip.text);
    // The placeholder.
    out.steps.placeholder = await p.evaluate(() => { const i = document.querySelector('#ref-search'); return { text: i.placeholder, fits: i.scrollWidth <= i.clientWidth, w: i.clientWidth }; });
    await crop('placeholder', '.rs-search');
    console.log(tag, 'placeholder |', JSON.stringify(out.steps.placeholder));
    // "Checked and passed", every rule-check row closed.
    await p.locator('[data-section=checked] > button.rs-head').click();
    await p.waitForTimeout(250);
    const more = p.locator(`[data-section=checked] .rr-more`);
    if (await more.count()) await more.first().click();
    await p.waitForTimeout(250);
    out.steps.closed = { rows: await ruleRows(p), axe: await axe(p, ROOT), m: await measure(p, ROOT) };
    await crop('checked-rows-closed', '[data-section=checked]');
    console.log(tag, 'closed rows', out.steps.closed.rows.map((r) => `${r.lines}L ${r.head}`).join(' || '), '| axe', out.steps.closed.axe.length, '| small', out.steps.closed.m.small.length);
    // One opened: the both-sides row.
    const both = p.locator('[data-section=checked] [data-row]', { hasText: 'Signs on both sides' }).first();
    await both.locator('.rr-head').click();
    await p.waitForTimeout(300);
    out.steps.opened = { detail: (await both.locator('.rr-detail').innerText()).replace(/\s+/g, ' ').trim(), axe: await axe(p, ROOT), m: await measure(p, ROOT) };
    await crop('checked-one-row-open', '[data-section=checked]');
    console.log(tag, 'opened |', out.steps.opened.detail);
    await both.locator('.rr-head').click();
    await p.waitForTimeout(250);
    // A search for words only the detail holds now.
    const term = process.env.TERM_INSIDE ?? 'Signs placed';
    await p.locator('#ref-search').pressSequentially(term, { delay: 25 });
    await p.waitForTimeout(400);
    out.steps.search = {
      term,
      status: (await p.locator('.rs-status').innerText()).replace(/\s+/g, ' ').trim(),
      opened: await p.evaluate(() => (document.querySelector('.ref-sections').innerText.match(/Opened because the match is inside\./g) ?? []).length),
      marks: await p.evaluate(() => [...document.querySelectorAll('.ref-sections .rr-detail mark')].map((m) => m.textContent)),
      axe: await axe(p, ROOT), m: await measure(p, ROOT),
    };
    await crop('search-inside-detail');
    console.log(tag, 'search |', JSON.stringify({ ...out.steps.search, axe: out.steps.search.axe.length, m: out.steps.search.m.small.length }));
    // The audit PDF for this plan, through the site's own route.
    if (auditBody && tag === '1440') {
      // The audit's own body, less the two flags only /render/audit accepts.
      const body = JSON.parse(auditBody);
      delete body.include_scan_token;
      for (const o of [body, body.scenario ?? {}]) { delete o.include_scan_token; delete o.include_breakdown; }
      const res = await p.request.post(`${BASE}/api/render/audit-pdf`, { data: body, headers: gateHeaders(BASE), timeout: 180000 });
      out.steps.pdf = { status: res.status(), body: res.ok() ? null : (await res.text()).slice(0, 200) };
      if (res.ok()) fs.writeFileSync(`${PDFDIR}/audit-${tag}.pdf`, await res.body());
      console.log(tag, 'audit pdf', res.status(), out.steps.pdf.body ?? '');
    }
    // The strip once no question is open: answer each NEEDS YOU question with
    // its first option (recorded), then read the strip again.
    await p.locator('#ref-search').fill('');
    out.steps.answers = [];
    for (let guard = 0; guard < 8; guard += 1) {
      const card = p.locator('.nyq-card:not([data-testid=where-questions] .nyq-card)').first();
      if (!(await card.count()) || !(await card.isVisible())) break;
      const q = (await card.locator('.nyq-q').innerText()).trim();
      const a = card.locator('label.nyq-answer').first();
      out.steps.answers.push({ q, a: (await a.innerText()).replace(/\s+/g, ' ').trim().slice(0, 80) });
      await a.click();
      await p.waitForTimeout(500);
      const foot = card.locator('.nyq-foot > button:last-child');
      if (await foot.count()) await foot.click();
      await p.waitForTimeout(4000);
    }
    await p.waitForTimeout(6000);
    out.steps.stripAfter = { text: (await strip.innerText()).replace(/\s+/g, ' ').trim(), axe: await axe(p, '.status-bar'), m: await measure(p, '.status-bar') };
    await crop('strip-no-question-open', '.status-bar');
    console.log(tag, 'answers', out.steps.answers.length, '| strip after |', out.steps.stripAfter.text);
  } catch (e) {
    out.error = String(e).slice(0, 600);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  out.hostsSeen = [...out.hostsSeen].sort();
  out.gatedHosts = out.hostsSeen.filter((o) => isSiteRequest(`${o}/`, `${BASE}/sandbox`));
  return out;
}

const all = {};
for (const w of WIDTHS) all[w] = await run(w, w === 390 ? 844 : 900);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(all, null, 1));
for (const [k, v] of Object.entries(all)) console.log(k, 'hosts seen', v.hostsSeen.length, '| gated', JSON.stringify(v.gatedHosts), '| error', v.error ? v.error.slice(0, 120) : null);
