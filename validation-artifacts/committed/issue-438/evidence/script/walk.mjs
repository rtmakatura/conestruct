// #438 results-after-apply walk (local), adapted from #439's WHERE walk
// (ux-group3-where/evidence/script/walk.mjs, the current flow to results) and
// #437 branch 3's NEEDS YOU walk (answer / Apply).
// usage: SHOT_TOKEN=<local token> node walk.mjs <outdir> <port>
// Local `next dev` on the issue-438 worktree (launch.ps1), MODAL_RENDER_URL at
// serve_replay.py replaying the recorded Overpass answer for the Denver Colfax
// pin.  /api/road-bearing is stubbed with #437 branch 3's three roads, the
// westbound Colfax candidate picked.  Shoulder work.
// Playwright Chromium, DPR 2, 1440x900 and 390x844.  States recorded:
// generated (questions open), staged (all answered, not applied), applied.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(new URL('../overpass-fixture/c74c32bdc5114bff.json', import.meta.url), 'utf8'));
const PIN = { lat: 39.739781, lng: -104.968249 };
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => { const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)); const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)); return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; };
const distM = (a) => Math.hypot((a.lat - PIN.lat) * 111320, (a.lon - PIN.lng) * 111320 * Math.cos(rad(PIN.lat)));
function candFromWay(id) {
  const w = FIX.elements.find((e) => e.type === 'way' && e.id === id);
  const g = w.geometry;
  let i = 0; g.forEach((n, k) => { if (distM(n) < distM(g[i])) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return { way_id: String(id), highway_class: w.tags.highway, name: w.tags.name, ref: s('ref'), bearing: +brg(a, b).toFixed(2),
    snap_distance_m: +distM(g[i]).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
    tags: { oneway: s('oneway'), maxspeed: s('maxspeed'), lanes: s('lanes'), lanes_forward: s('lanes:forward'), lanes_backward: s('lanes:backward'),
      lanes_both_ways: s('lanes:both_ways'), turn_lanes: s('turn:lanes'), turn_lanes_forward: s('turn:lanes:forward'), turn_lanes_backward: s('turn:lanes:backward') },
    geometry: g.map((n) => [n.lat, n.lon]) };
}
// Run 1 used candFromWay(1547338997) (real geometry): its corridor Overpass
// query was not in the recording and the live mirrors answered 403/502, so
// the plan declined (run1-1440-error.png).  The walk uses #437 branch 3's
// THREE stub instead (no geometry), whose Generate queries are recorded
// (4d0f…, fc0e…), picking the westbound Colfax candidate as #437 did.
void candFromWay;
const NOTAGS = { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null };
const cand = (way, cls, name, bearing, d) => ({ way_id: way, highway_class: cls, name, ref: null, bearing, snap_distance_m: d,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null, tags: { ...NOTAGS, oneway: 'yes', maxspeed: '30 mph', lanes: '2' } });
const STUB = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [
  cand('1547338992', 'primary', 'East Colfax Avenue', 271, 1.2),
  cand('628643782', 'primary', 'East Colfax Avenue', 91, 6.1),
  cand('596451653', 'residential', 'Pennsylvania Street', 359, 24.3),
] });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
async function shot(p, sel, file) {
  const l = p.locator(sel).first();
  if (!(await l.count()) || !(await l.isVisible())) return null;
  await park(p);
  await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } });
  await l.screenshot({ path: `${OUT}/${file}` });
  await p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } });
  return file;
}
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(' '), targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  });
}
// As #437's walk: targets under 44 in the results stack and the strip.
async function smallTargets(p) {
  return p.evaluate(() => {
    const els = [...document.querySelectorAll('.results-stack button, .results-stack a[href], .results-stack label.nyq-answer, .status-slot button')];
    return els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44); })
      .map((e) => { const r = e.getBoundingClientRect(); return { text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), w: +r.width.toFixed(1), h: +r.height.toFixed(1), cls: e.className.toString().slice(0, 60) }; });
  });
}
async function state(p) {
  return p.evaluate(() => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const st = (e) => { if (!e) return null; const c = getComputedStyle(e); return { text: t(e.innerText), display: c.display, fontFamily: c.fontFamily, fontSize: c.fontSize, letterSpacing: c.letterSpacing, textTransform: c.textTransform, color: c.color, fontWeight: c.fontWeight }; };
    const sc = document.querySelector('#site-corrections');
    const items = sc ? [...sc.querySelectorAll('.ny-items > li')] : [];
    const pend = [...document.querySelectorAll('.disc-head')].filter((h) => /Pending \/ not verified/.test(h.querySelector('.disc-name')?.textContent ?? ''));
    const pendRows = pend.map((h) => ({ inResults: !!h.closest('.results-stack'), visible: h.getBoundingClientRect().height > 0, name: t(h.querySelector('.disc-name')?.innerText), count: t(h.querySelector('.disc-count')?.innerText) }));
    const keyK = [...document.querySelectorAll('.hero-meta .k')];
    const totK = [...document.querySelectorAll('.hero-cell .k')];
    return {
      strip: t(document.querySelector('.status-slot')?.innerText),
      stripPill: !!document.querySelector('.status-slot .pill, .status-slot [class*=pill]'),
      currentQ: t(document.querySelector('.nyq-card .nyq-q')?.innerText) || null,
      nyItems: items.map((li) => ({ question: li.matches('.nyq-row') || !!li.querySelector('.nyq-card'), cls: li.className.toString().slice(0, 60), text: t(li.innerText).slice(0, 160) })),
      nyqRows: [...document.querySelectorAll('.nyq-row')].map((r) => t(r.innerText)),
      pendRows,
      keyDistancesK: keyK.map(st),
      totalDevicesK: totK.map(st),
      prov: [...document.querySelectorAll('#site-corrections .ny-prov, .ny-prov')].map((e) => ({ text: t(e.innerText).slice(0, 80), fontFamily: getComputedStyle(e).fontFamily, underNY: !!e.closest('#site-corrections') })),
      cite: [...document.querySelectorAll('.ny-cite')].map((e) => ({ text: t(e.innerText).slice(0, 60), fontFamily: getComputedStyle(e).fontFamily })),
      headings: [...document.querySelectorAll('h1, h2, h3, h4')].filter((h) => h.getClientRects().length > 0 || h.closest('[hidden]') === null).map((h) => ({ tag: h.tagName.toLowerCase(), id: h.id || null, text: t(h.innerText || h.textContent).slice(0, 70), visible: h.getClientRects().length > 0 })),
    };
  });
}

async function toResults(p) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => /PICK THE ROAD|Which road/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
  await p.waitForTimeout(800);
  const dlg = p.getByRole('dialog');
  const want = dlg.locator('button', { hasText: /westbound/i });
  if (await want.count()) await want.first().click(); else await dlg.locator('button').filter({ hasText: /Street|Avenue/ }).first().click();
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
  // CONFIRM card (#439): side, Next, kind = shoulder, Confirm.
  await p.locator('[data-testid=where-questions] label.nyq-answer').first().click(); await p.waitForTimeout(1500);
  await p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child').click(); await p.waitForTimeout(800);
  await p.locator('label.nyq-answer:has([data-testid=kind-chip-shoulder])').click(); await p.waitForTimeout(1500);
  const conf = p.locator('[data-testid=where-confirm]');
  if (!(await conf.count())) { await p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child').click(); await p.waitForTimeout(800); }
  await p.locator('[data-testid=where-confirm]').click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
  // The map can't tell one-way street from one side of a divided road: say One-way (as #437's walk).
  const oneWay = p.getByRole('button', { name: /^One-way$/ });
  if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(4000); }
  const gen =p.getByRole('button', { name: 'Generate plan' });
  await gen.waitFor({ state: 'visible' });
  await p.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Generate plan'); return b && !b.disabled; }, null, { timeout: 90000 });
  await gen.click();
  await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
  await p.waitForTimeout(4000);
}

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const counts = { render: 0 };
  const out = { steps: [], answers: [] };
  p.on('request', (r) => { if (r.method() === 'POST' && /\/api\/render\/audit(\?|$)/.test(r.url())) counts.render += 1; });
  const step = async (name, opts = {}) => {
    const s = { name, renders: counts.render, ...(await state(p)) };
    if (opts.measure) { s.axe = await axe(p); s.small = await smallTargets(p); }
    if (opts.shot) {
      s.shotStrip = await shot(p, '.status-slot', `${tag}-${name}-strip.png`);
      s.shotStack = await shot(p, '.results-stack', `${tag}-${name}-results.png`);
    }
    out.steps.push(s);
    console.log(tag, name, '| strip:', s.strip, '| q:', s.currentQ);
  };
  try {
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: STUB }));
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await toResults(p);
    await step('generated', { measure: true, shot: true });
    // Answer every open question (first option each), Next until Apply.
    for (let i = 0; i < 12; i++) {
      const q = (await p.locator('.nyq-card .nyq-q').first().innerText({ timeout: 2000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
      if (!q) break;
      const opt = p.locator('.nyq-card .nyq-answer').first();
      out.answers.push({ q, a: (await opt.innerText()).replace(/\s+/g, ' ').trim().slice(0, 60) });
      await opt.click(); await p.waitForTimeout(400);
      const next = p.locator('.nyq-card .nyq-next-btn');
      const label = (await next.count()) ? (await next.first().innerText()).trim() : '';
      if (/Apply/i.test(label)) break;
      if (await next.count()) { await next.first().click(); await p.waitForTimeout(600); } else break;
    }
    await step('staged', { measure: true, shot: true });
    const before = counts.render;
    await p.getByRole('button', { name: 'Apply answers' }).first().click();
    await p.waitForTimeout(3000);
    await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
    await p.waitForFunction(() => !/Generating|Updating/i.test(document.querySelector('.status-slot')?.innerText ?? ''), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(6000);
    out.rendersForApply = counts.render - before;
    await step('applied', { measure: true, shot: true });
    await p.screenshot({ path: `${OUT}/${tag}-full-applied.png`, fullPage: true });
  } catch (e) {
    out.error = String(e).slice(0, 500);
    await p.screenshot({ path: `${OUT}/${tag}-error.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  console.log(tag, out.error ?? 'ok', '| renders for apply', out.rendersForApply);
  return out;
}

const M = {};
for (const [w, h] of [[1440, 900], [390, 844]]) M[`${w}`] = await run(w, h);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(M, null, 1));
