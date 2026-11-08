// #453 walk (local), adapted from #450's walk.mjs (ux-group5-followup).
// usage: GATE_BYPASS_TOKEN=<the dev server's token> node walk.mjs <outdir> <port> <pdfdir>
// Local `next dev` on the issue-453 worktree, MODAL_RENDER_URL at the local
// backend (ux-group3's serve_replay.py, Overpass replayed from the recorded
// answers).  /api/road-bearing is stubbed from the recorded fixture.
// Chromium, DPR 2, 1440x900 and 390x844.  The gate header goes through the
// shared helper's newGatedContext (scripts/gate.cjs), so it reaches the local
// site's own host only.
// Captures: every row of "Checked and passed" and "Denver rules and site
// facts", opened one at a time (a crop each, and its detail as text with the
// font of each part); searches for "sidewalk" and "taper"; the audit PDF
// (1440 only).  axe and the 44 px sweep on each state.
import { createRequire } from 'module';
import fs from 'fs';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-453';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const { newGatedContext, gateHeaders } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${W}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PORT, PDFDIR] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
const TERMS = (process.env.TERMS ?? 'sidewalk,taper').split(',');
fs.mkdirSync(OUT, { recursive: true });
if (PDFDIR) fs.mkdirSync(PDFDIR, { recursive: true });

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

// An opened detail as text, each leaf text run with its font family, size
// and transform, so mono, size and caps are read off the page, not assumed.
const detailParts = (p, rowId) => p.evaluate((rowId) => {
  const d = document.querySelector(`[data-row="${CSS.escape(rowId)}"] .rr-detail`);
  if (!d) return null;
  const parts = [];
  const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent.replace(/\s+/g, ' ');
    if (!text.trim()) continue;
    const el = t.parentElement;
    const cs = getComputedStyle(el);
    const block = el.closest('p, dt, dd, li, button, a, .rr-line-sub, .rr-value') ?? el;
    const key = `${block.tagName}.${block.className}|${/mono/i.test(cs.fontFamily) ? 'mono' : 'sans'}|${cs.fontSize}|${cs.textTransform}`;
    if (last && last.key === key && last.node === block) { last.text += text; continue; }
    last = { key, node: block, text, tag: block.tagName.toLowerCase(), cls: String(block.className), mono: /mono/i.test(cs.fontFamily), size: cs.fontSize, caps: cs.textTransform === 'uppercase' };
    parts.push(last);
  }
  return parts.map(({ key, node, ...r }) => ({ ...r, text: r.text.trim() }));
}, rowId);

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = { rows: {}, searches: {}, errors: [] };
  const ctx = await newGatedContext(b, `${BASE}/sandbox`, { viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
  let auditBody = null;
  ctx.on('request', (r) => { if (r.url().includes('/api/render/audit') && r.method() === 'POST') auditBody = r.postData(); });
  await p.route('**/api/road-bearing**', async (r) => {
    const asked = JSON.parse(r.request().postData() ?? 'null');
    return r.fulfill({ status: 200, contentType: 'application/json', body: det(asked && typeof asked.lat === 'number' ? { lat: asked.lat, lng: asked.lng } : PIN0) });
  });
  const unstick = () => p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } document.querySelector('.workbench-frame')?.style.setProperty('display', 'none'); });
  const restick = () => p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } document.querySelector('.workbench-frame')?.style.removeProperty('display'); });
  const crop = async (name, loc) => { await unstick(); await loc.screenshot({ path: `${OUT}/${tag}-${name}.png` }); await restick(); };
  const safe = (s) => s.replace(/[^a-z0-9-]+/gi, '_').slice(0, 48);
  try {
    await toGenerated(p, out);
    for (const sec of ['checked', 'reference']) {
      const head = p.locator(`[data-section=${sec}] > button.rs-head`);
      if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
      await p.waitForTimeout(250);
      const more = p.locator(`[data-section=${sec}] .rr-more`);
      if (await more.count()) { await more.first().click(); await p.waitForTimeout(250); }
      const ids = await p.locator(`[data-section=${sec}] [data-row]`).evaluateAll((es) => es.map((e) => e.dataset.row));
      let k = 0;
      for (const id of ids) {
        k += 1;
        const row = p.locator(`[data-section=${sec}] [data-row="${id}"]`);
        const btn = row.locator('.rr-head');
        const title = (await btn.innerText()).replace(/\s+/g, ' ').replace(/ (Show|Hide)$/, '').trim();
        if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
        await p.waitForTimeout(200);
        const name = `${sec}-${String(k).padStart(2, '0')}-${safe(id)}`;
        out.rows[name] = { id, title, parts: await detailParts(p, id) };
        await crop(name, row);
        await btn.click();
        await p.waitForTimeout(120);
      }
      out[`${sec}Open`] = { axe: await axe(p, ROOT), m: await measure(p, ROOT) };
    }
    // Every row open at once, for axe and the 44 px sweep over all details.
    const flipAll = async (state) => {
      const loc = p.locator(`${ROOT} [data-row] .rr-head[aria-expanded=${state}]`);
      for (let guard = 0; guard < 80 && (await loc.count()) > 0; guard += 1) { await loc.first().click(); await p.waitForTimeout(60); }
    };
    await flipAll('false');
    await p.waitForTimeout(400);
    out.allOpen = { axe: await axe(p, ROOT), m: await measure(p, ROOT) };
    await flipAll('true');
    console.log(tag, 'rows', Object.keys(out.rows).length, '| all open axe', out.allOpen.axe.length, '| small', out.allOpen.m.small.length, '| overflowX', out.allOpen.m.overflowX);
    for (const term of TERMS) {
      await p.locator('#ref-search').fill('');
      await p.locator('#ref-search').pressSequentially(term, { delay: 25 });
      await p.waitForTimeout(500);
      const opened = await p.locator(`${ROOT} [data-row]:has(.rr-detail)`).evaluateAll((es) => es.map((e) => e.dataset.row));
      const rec = { status: (await p.locator('.rs-status').innerText()).replace(/\s+/g, ' ').trim(), opened: {}, axe: await axe(p, ROOT), m: await measure(p, ROOT) };
      for (const id of opened) rec.opened[id] = await detailParts(p, id);
      out.searches[term] = rec;
      await crop(`search-${safe(term)}`, p.locator(ROOT));
      console.log(tag, 'search', term, '|', rec.status, '| opened', opened.join(','), '| axe', rec.axe.length, '| small', rec.m.small.length);
    }
    await p.locator('#ref-search').fill('');
    if (auditBody && tag === '1440' && PDFDIR) {
      const body = JSON.parse(auditBody);
      for (const o of [body, body.scenario ?? {}]) { delete o.include_scan_token; delete o.include_breakdown; }
      fs.writeFileSync(`${PDFDIR}/audit-body.json`, JSON.stringify(body));
      const res = await p.request.post(`${BASE}/api/render/audit-pdf`, { data: body, headers: gateHeaders(BASE), timeout: 180000 });
      out.pdf = { status: res.status() };
      if (res.ok()) fs.writeFileSync(`${PDFDIR}/audit-${tag}.pdf`, await res.body());
      console.log(tag, 'audit pdf', res.status());
    }
  } catch (e) {
    out.error = String(e).slice(0, 600);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  return out;
}

const all = {};
for (const w of WIDTHS) all[w] = await run(w, w === 390 ? 844 : 900);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(all, null, 1));
for (const [k, v] of Object.entries(all)) console.log(k, '| error', v.error ? v.error.slice(0, 160) : null, '| page errors', v.errors.length);
