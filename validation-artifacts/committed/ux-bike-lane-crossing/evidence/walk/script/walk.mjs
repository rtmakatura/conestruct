// #449 walk (local), the flow to Generate from #453's walk.mjs
// (ux-group5-details/evidence/script/walk.mjs). Steps through NEEDS YOU,
// answering the first option, until the bike lane question is current.
// Records each question's heading and Next line; crops the bike lane
// question card at DPR 1; axe and the 44 px sweep on that state.
// usage: GATE_BYPASS_TOKEN=<token> WIDTH=1440 HEIGHT=900 node walk.mjs <outdir> <port>
import { createRequire } from 'module';
import fs from 'fs';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-449';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${W}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const BASE = `http://localhost:${PORT}`;
const WIDTH = Number(process.env.WIDTH), HEIGHT = Number(process.env.HEIGHT);
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
const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

const out = { width: WIDTH, questions: [] };
const b = await chromium.launch();
try {
  const ctx = await newGatedContext(b, `${BASE}/sandbox`, { viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route('**/api/road-bearing**', (r) => {
    const u = new URL(r.request().url());
    const at = { lat: Number(u.searchParams.get('lat')) || 39.739781, lng: Number(u.searchParams.get('lng') ?? u.searchParams.get('lon')) || -104.968249 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: det(at) });
  });
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
  if (await want.count()) await want.first().click().catch(() => {});
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
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
  await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
  await p.waitForTimeout(5000);
  const card = () => p.locator('#site-corrections .nyq-card, .needs-you .nyq-card').first();
  for (let i = 0; i < 8; i++) {
    const q = t(await card().locator('.nyq-q').first().innerText({ timeout: 5000 }).catch(() => ''));
    if (!q) break;
    const page = t(await p.locator('.needs-you').first().innerText().catch(() => ''));
    const nextLine = (page.match(/Next: [^◌✓]*?(?= ◌| ✓|$)/) ?? [null])[0];
    out.questions.push({ q, next: nextLine });
    if (/bike lane/i.test(q)) {
      await p.mouse.move(WIDTH - 3, HEIGHT - 3);
      await card().scrollIntoViewIfNeeded();
      await p.waitForTimeout(800);
      // As #438's walk: sticky bars set static for the crop only.
      await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const s = getComputedStyle(e).position; if (s === 'sticky' || s === 'fixed') { e.dataset.walkSticky = '1'; e.style.position = 'static'; } } });
      await card().scrollIntoViewIfNeeded();
      await p.waitForTimeout(500);
      await card().screenshot({ path: `${OUT}/${WIDTH}-bike-question.png` });
      await p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } });
      await p.addScriptTag({ content: AXE });
      out.axe = await p.evaluate(async () => (await window.axe.run(document.querySelector('.needs-you'), { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, nodes: v.nodes.length })));
      out.small = await p.evaluate(() => [...document.querySelectorAll('.needs-you button, .needs-you a[href], .needs-you label.nyq-answer')]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); })
        .map((e) => ({ text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
      out.overflowX = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      break;
    }
    await card().locator('.nyq-answer').first().click(); await p.waitForTimeout(500);
    const nb = card().locator('.nyq-next-btn');
    if (!(await nb.count()) || /Apply/i.test(await nb.first().innerText())) break;
    await nb.first().click(); await p.waitForTimeout(800);
  }
  await ctx.close();
} catch (e) {
  out.error = String(e).slice(0, 400);
}
await b.close();
fs.writeFileSync(`${OUT}/walk-${WIDTH}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
