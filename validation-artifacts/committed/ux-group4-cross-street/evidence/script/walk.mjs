// #440 cross-street walk (local), adapted from ux-group3-where's walk.mjs.
// usage: SHOT_TOKEN=<gate token> node walk.mjs <outdir> <port>
// Local `next dev` on the issue-440 worktree, MODAL_RENDER_URL at the local
// backend (ux-group3's serve_replay.py and its recorded Overpass answer for
// the Denver Colfax pin).  /api/road-bearing is stubbed (live answers
// `unavailable` from this machine): at the pin, East Colfax Avenue (way
// 1547338997, oneway=yes); at the tap, Colfax and Franklin Street (way
// 492215711, oneway=no), so the picker's own derivation picks Franklin.
// Everything else is live: the aerial (Mapbox through the backend), the
// tap's coordinate (POST /render/aerial-point), the nearest-intersection
// read, the geometry read.  Playwright Chromium, DPR 2, 1440x900, 390x844.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(new URL('../../../ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json', import.meta.url), 'utf8'));
const PIN0 = { lat: 39.739781, lng: -104.968249 };
// Franklin Street's south end on East Colfax Avenue (the fixture's way
// 492215711, first node): where the two streets cross.
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => { const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)); const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)); return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; };
const distM = (a, at) => Math.hypot((a.lat - at.lat) * 111320, (a.lon - at.lng) * 111320 * Math.cos(rad(at.lat)));
// Session 3: the live route extends a candidate's own-way geometry along
// the same road's next ways (route.ts trimChain, #140).  Way 1547338997
// ends at the work start's snap, and Franklin is 52 m past it, so a stub
// with own-way geometry only clamps the tap onto the line's end ("at where
// the work starts", then the corridor's decline).  `chain` gives the stub
// the westbound run the live route would send.
const COLFAX_WEST = [1547338997, 1547338998, 223788857, 600545918, 791808880];
function chainGeometry(ids) {
  const out = [];
  for (const id of ids) {
    const g = FIX.elements.find((e) => e.type === 'way' && e.id === id).geometry;
    for (const n of g) { const l = out[out.length - 1]; if (!l || l.lat !== n.lat || l.lon !== n.lon) out.push(n); }
  }
  return out;
}
function candFromWay(id, at, chain = null) {
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
const STUB = {
  pin: det([candFromWay(1547338997, PIN0, COLFAX_WEST)]),
  cross: det([candFromWay(1547338997, CROSSING, COLFAX_WEST), candFromWay(492215711, CROSSING)]),
};

// The pin picture's pixel for a coordinate (Web Mercator, 512 px tiles at
// PIN_ZOOM 17): only to aim the walk's click, the way a person aims by eye.
function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}

const T = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const BAND = '[data-testid=band-where]';
async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
async function shot(p, sel, file) {
  const l = p.locator(sel).first();
  if (!(await l.count()) || !(await l.isVisible())) return null;
  await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } });
  await l.screenshot({ path: `${OUT}/${file}` });
  await p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } });
  return file;
}
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('[data-testid=band-where]') ?? document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  });
}
// Every new control at least 44 x 44 (ruling 8, P10).
async function targets(p) {
  return p.evaluate(() => {
    const ids = ['band-aerial-big-map', 'cross-move', 'cross-undo', 'cross-retry', 'cross-big-map', 'where-open-picker', 'where-confirm'];
    const out = {};
    for (const id of ids) {
      const e = document.querySelector(`[data-testid=band-where] [data-testid=${id}]`);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      out[id] = { w: +r.width.toFixed(1), h: +r.height.toFixed(1), ok: r.width >= 44 && r.height >= 44 };
    }
    return out;
  });
}
async function aerial(p) {
  return p.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), y: +b.top.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const q = (s) => document.querySelector(`[data-testid=band-aerial] ${s}`);
    const frame = q('.a-aerial-frame'), bar = q('[data-testid=band-aerial-bar]'), edit = q('[data-testid=where-open-picker]');
    const zoom = q('[data-testid=band-aerial-zoom]'), big = q('[data-testid=band-aerial-big-map]');
    const mark = q('[data-testid=band-aerial-mark]'), label = q('[data-testid=band-aerial-mark-label]');
    const over = (a, b) => { if (!a || !b) return null; const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top); };
    const cs = frame ? getComputedStyle(frame) : null;
    const after = frame ? getComputedStyle(frame, '::after') : null;
    const bs = bar ? getComputedStyle(bar) : null;
    return {
      stage: document.querySelector('[data-testid=band-aerial]')?.getAttribute('data-stage'),
      armed: frame?.classList.contains('is-armed') ?? false,
      cursor: cs?.cursor ?? null,
      outline: after ? { border: after.borderTopWidth + ' ' + after.borderTopStyle + ' ' + after.borderTopColor, content: after.content } : null,
      frame: r(frame), bar: r(bar), barText: bar ? bar.innerText.trim() : null,
      barStyle: bs ? { bg: bs.backgroundColor, color: bs.color, font: `${bs.fontFamily.split(',')[0]} ${bs.fontSize}/${bs.fontWeight}` } : null,
      edit: r(edit), zoom: r(zoom), big: r(big), bigText: big?.innerText.trim() ?? null,
      mark: r(mark), label: r(label), labelText: label?.innerText.trim() ?? null,
      overlaps: { barEdit: over(bar, edit), barZoom: over(bar, zoom), bigZoom: over(big, zoom), bigEdit: over(big, edit), editZoom: over(edit, zoom) },
      labelInside: label && frame ? (() => { const a = label.getBoundingClientRect(), f = frame.getBoundingClientRect(); return a.left >= f.left && a.right <= f.right && a.top >= f.top && a.bottom <= f.bottom; })() : null,
      alt: q('[data-testid=band-aerial-img]')?.getAttribute('alt') ?? null,
    };
  });
}
async function card(p) {
  return p.evaluate(() => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const c = document.querySelector('[data-testid=where-questions]');
    if (!c) return null;
    const cur = c.querySelector('.nyq-card');
    const row = c.querySelector('[data-testid=cross-row], [data-testid=cross-finding]');
    const rs = row ? getComputedStyle(row) : null;
    const name = c.querySelector('[data-testid=cross-row-name]');
    const line = c.querySelector('[data-testid=cross-row-line]');
    return {
      count: t(c.querySelector('.nyq-count')?.innerText),
      flag: cur?.getAttribute('data-flag') ?? null,
      question: t(cur?.querySelector('.nyq-q')?.innerText),
      why: t(cur?.querySelector('.nyq-why')?.innerText) || null,
      button: cur ? { text: t(cur.querySelector('.nyq-foot > button:last-child')?.innerText), disabled: cur.querySelector('.nyq-foot > button:last-child')?.disabled ?? null } : null,
      row: row ? { testid: row.getAttribute('data-testid'), text: t(row.innerText), h: +row.getBoundingClientRect().height.toFixed(1), bg: rs.backgroundColor } : null,
      name: name ? { text: t(name.innerText), font: `${getComputedStyle(name).fontSize}/${getComputedStyle(name).fontWeight}` } : null,
      line: line ? { text: t(line.innerText), font: getComputedStyle(line).fontSize, color: getComputedStyle(line).color } : null,
      none: t(c.querySelector('[data-testid=cross-none]')?.innerText) || null,
      failed: t(c.querySelector('[data-testid=cross-failed]')?.innerText) || null,
      move: t(c.querySelector('[data-testid=cross-move]')?.innerText) || null,
      rows: [...c.querySelectorAll('.nyq-row')].map((r) => t(r.innerText)),
      notMarkedLine: /Mark the cross street on the map/.test(document.querySelector('[data-testid=band-where]')?.innerText ?? ''),
      occupiedBlock: /Occupied side/.test(document.querySelector('[data-testid=band-where]')?.innerText ?? ''),
    };
  });
}

async function pin(p) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(ADDR);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const dlg = p.getByRole('dialog');
  const want = dlg.locator('button', { hasText: /Colfax/ });
  if (await want.count()) await want.first().click().catch(() => {});
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  // #440 ruling 2: the card opens on the kind.
  await p.waitForSelector('[data-testid=kind-chip-near_intersection]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
}
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = { steps: [], fails: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  let mode = 'pin';
  const seen = { aerialPoint: [], roadBearing: [], lastScenario: null };
  p.on('request', (r) => {
    if (r.method() !== 'POST') return;
    if (r.url().includes('/api/aerial-point')) seen.aerialPoint.push(JSON.parse(r.postData() ?? 'null'));
    if (r.url().includes('/api/render/corridor-geometry')) seen.lastScenario = JSON.parse(r.postData() ?? '{}').scenario ?? null;
  });
  await p.route('**/api/road-bearing**', async (r) => {
    seen.roadBearing.push({ mode, body: JSON.parse(r.request().postData() ?? 'null') });
    if (mode === 'fail') return r.fulfill({ status: 502, contentType: 'text/plain', body: 'down' });
    if (mode === 'cross-slow') await new Promise((res) => setTimeout(res, 2500));
    // The pin's answer snaps at the point asked for (session 3: the PDF
    // pass drops its pin elsewhere on Colfax); the cross answer stays.
    const asked = JSON.parse(r.request().postData() ?? 'null');
    const pinBody = asked && typeof asked.lat === 'number' ? det([candFromWay(1547338997, { lat: asked.lat, lng: asked.lng }, COLFAX_WEST)]) : STUB.pin;
    return r.fulfill({ status: 200, contentType: 'application/json', body: mode === 'pin' ? pinBody : STUB.cross });
  });
  const step = async (name, opts = {}) => {
    const s = { name, card: await card(p), aerial: await aerial(p) };
    if (opts.measure) { s.axe = await axe(p); s.targets = await targets(p); }
    if (opts.shot !== false) s.shot = await shot(p, opts.sel ?? BAND, `${tag}-${nn()}-${name}.png`);
    out.steps.push(s);
    console.log(tag, name, '|', s.card?.count, s.card?.flag, '| row:', s.card?.row?.text ?? '-', '| armed:', s.aerial.armed);
    return s;
  };
  const tapCrossing = async () => {
    const img = p.locator('[data-testid=band-aerial-img]');
    const box = await img.boundingBox();
    const pin = seen.lastScenario?.meta ?? PIN0;
    const at = pixelOf(CROSSING, { lat: pin.lat, lng: pin.lng }, box.width, box.height);
    out[`tap_${tag}`] = { at, box, pin: { lat: pin.lat, lng: pin.lng } };
    await img.click({ position: { x: at.x, y: at.y } });
  };
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await pin(p);
    // Ruling 2: the kind first, Next: the cross street (question 2 of 3).
    await p.locator('label.nyq-answer:has([data-testid=kind-chip-near_intersection])').click(); await p.waitForTimeout(800);
    await step('00-kind', { sel: '[data-testid=where-questions]' });
    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(1500);
    await park(p);
    await step('01-armed', { measure: true });
    await shot(p, '[data-testid=band-aerial]', `${tag}-${nn()}-aerial-armed.png`);

    // The tap, the lookup held 2.5 s so "Finding the street name…" is seen.
    mode = 'cross-slow';
    await tapCrossing();
    await p.waitForSelector('[data-testid=cross-finding]', { timeout: 10000 });
    await step('02-finding', { sel: '[data-testid=where-questions]' });
    await p.waitForSelector('[data-testid=cross-row]', { timeout: 30000 });
    await p.waitForFunction(() => /of where the work starts/.test(document.querySelector('[data-testid=cross-row-line]')?.innerText ?? ''), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(800);
    await park(p);
    const marked = await step('03-marked', { measure: true });
    await shot(p, '[data-testid=band-aerial]', `${tag}-${nn()}-aerial-marked.png`);
    out.markedScenario = { intersection: seen.lastScenario?.meta?.intersection ?? null, approaches: seen.lastScenario?.approaches ?? null };

    // Move → Cancel (X11).
    await p.locator('[data-testid=cross-move]').click(); await p.waitForTimeout(500);
    await step('04-move', { shot: false });
    await p.locator('[data-testid=cross-move]').click(); await p.waitForTimeout(500);
    await step('05-cancel', { shot: false });

    // Undo (X7).
    await p.locator('[data-testid=cross-undo]').click(); await p.waitForTimeout(1500);
    await step('06-undone', { shot: false });
    out.afterUndo = { intersection: seen.lastScenario?.meta?.intersection ?? null };

    // A failed lookup, then Try again (X8).
    mode = 'fail';
    await tapCrossing();
    await p.waitForSelector('[data-testid=cross-failed]', { timeout: 10000 });
    await park(p);
    await step('07-failed', { sel: '[data-testid=where-questions]', measure: true });
    mode = 'cross';
    const apBefore = seen.aerialPoint.length;
    await p.locator('[data-testid=cross-retry]').click();
    await p.waitForSelector('[data-testid=cross-row]', { timeout: 30000 });
    await p.waitForTimeout(800);
    await step('08-retried', { shot: false });
    out.retrySamePoint = seen.aerialPoint.length === apBefore;

    // Use the big map instead (ruling 4): Undo, then the button; the picker
    // opens on its cross-street control, armed.
    await p.locator('[data-testid=cross-undo]').click(); await p.waitForTimeout(1500);
    await p.locator('[data-testid=band-aerial-big-map]').click();
    await p.waitForSelector('[role=dialog]', { timeout: 30000 });
    await p.waitForTimeout(3000);
    out.picker = await p.evaluate(() => ({ text: (document.querySelector('[role=dialog]')?.innerText ?? '').replace(/\s+/g, ' ') }));
    out.pickerArmed = /Click the intersection on the map/.test(out.picker.text);
    // Click the map at the crossing (the picker's own click handler).
    const canvas = p.locator('[role=dialog] canvas.mapboxgl-canvas').first();
    if (await canvas.count()) {
      const cb = await canvas.boundingBox();
      // Off the work-pin marker at the centre (it takes the click); the
      // stubbed road-bearing answers Franklin for any point.
      await canvas.click({ position: { x: cb.width / 2, y: cb.height / 2 - 60 } });
      await p.waitForTimeout(3500);
      out.pickerAfterClick = (await p.evaluate(() => (document.querySelector('[role=dialog]')?.innerText ?? '').replace(/\s+/g, ' ')));
      await p.screenshot({ path: `${OUT}/${tag}-${nn()}-picker-after-click.png` });
      out.pickerDetectedParagraph = /places it along the road|confirm the details in the form/i.test(out.pickerAfterClick);
      await p.getByRole('button', { name: 'Save & Close' }).click();
      await p.waitForSelector('[data-testid=cross-row]', { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(1500);
      await step('09-after-picker', { shot: false });
      // Session 3: the picker click is 60 px off the pin, not the
      // crossing; Undo it and tap the crossing on the aerial again, so the
      // plan carries Franklin's own point.
      await p.locator('[data-testid=cross-undo]').click(); await p.waitForTimeout(1500);
      await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
      await tapCrossing();
      await p.waitForSelector('[data-testid=cross-row]', { timeout: 30000 });
      await p.waitForFunction(() => /of where the work starts/.test(document.querySelector('[data-testid=cross-row-line]')?.innerText ?? ''), null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(800);
      await step('09b-retapped', { shot: false });
    } else {
      out.fails.push({ label: 'no map canvas in the picker' });
      await p.keyboard.press('Escape');
    }

    // Ruling 2 / X20: Next asks the side last (question 3 of 3, Confirm).
    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 30000 });
    await p.waitForTimeout(1200);
    await park(p);
    await step('10-side', { measure: true });
    await p.locator('[data-testid=where-questions] label.nyq-answer').first().click(); await p.waitForTimeout(1500);
    await step('11-side-answered', { sel: '[data-testid=where-questions]' });

    // Confirm (X9 as amended by X20).
    out.scenarioAtConfirm = seen.lastScenario;
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForTimeout(3000);
    out.afterConfirm = await p.evaluate(() => ({ whereOpen: !!document.querySelector('.a-open[data-testid=band-where]'), openBand: document.querySelector('.a-open')?.getAttribute('data-testid') ?? null }));
    out.marked = marked.card;

    // Session 3 (Ryan, 2026-11-04): the PDF through the page, 1440 only.
    // Generate plan (the page's own button), then the downloads' PDF
    // button; the render request the page sends is kept as sent.
    if (w === 1440 && process.env.PDF === '1') {
      out.pdf = {};
      await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
      await p.waitForTimeout(3000);
      // As #437/#438's walks: the map can't tell a one-way street from
      // one side of a divided road; say One-way.
      const oneWay = p.getByRole('button', { name: /^One-way$/ });
      if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(4000); out.pdf.saidOneWay = true; }
      // The operator's own lane-count check (Generate names it until then).
      const laneOk = p.getByRole('button', { name: 'Lane count is right' });
      if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(3000); out.pdf.saidLaneCount = true; }
      out.pdf.ctaReason = await p.evaluate(() => document.querySelector('[data-testid=cta-reason]')?.innerText.trim() ?? null);
      await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
      await p.getByTestId('generate-plan').click();
      await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
      await p.waitForTimeout(4000);
      out.pdf.banner = await p.evaluate(() => document.querySelector('.status-slot')?.innerText.replace(/\s+/g, ' ').trim() ?? null);
      await p.screenshot({ path: `${OUT}/${tag}-${nn()}-generated.png`, fullPage: true });
      const pdfReq = [];
      p.on('request', (r) => { if (r.method() === 'POST' && /\/api\/render\/pdf(\?|$)/.test(r.url())) pdfReq.push(r.postData() ?? ''); });
      const btns = await p.locator('[data-testid=downloads] button').all();
      let clicked = null;
      for (const bt of btns) {
        const label = ((await bt.getAttribute('aria-label')) || (await bt.innerText())).replace(/\s+/g, ' ').trim();
        if (/plan/i.test(label) && /pdf/i.test(label) && !/crew|audit|zip/i.test(label)) { clicked = label;
          const respP = p.waitForResponse((r) => /\/api\/render\/pdf(\?|$)/.test(r.url()), { timeout: 180000 }).catch(() => null);
          const dlP = p.waitForEvent('download', { timeout: 180000 }).catch(() => null);
          await bt.click();
          const [resp, dl] = await Promise.all([respP, dlP]);
          out.pdf.status = resp?.status() ?? null;
          if (dl) { await dl.saveAs(`${OUT}/${tag}-plan.pdf`); out.pdf.file = `${tag}-plan.pdf`; out.pdf.bytes = fs.statSync(`${OUT}/${tag}-plan.pdf`).size; }
          break;
        }
      }
      out.pdf.button = clicked;
      out.pdf.labels = await p.evaluate(() => [...document.querySelectorAll('[data-testid=downloads] button')].map((b) => (b.getAttribute('aria-label') || b.innerText).replace(/\s+/g, ' ').trim()));
      if (pdfReq.length) {
        const body = JSON.parse(pdfReq[0]);
        const sc = body.scenario ?? body;
        out.pdf.sentIntersection = sc?.meta?.intersection ?? null;
        out.pdf.sentApproaches = sc?.approaches ?? null;
        // A signed site-scan token never gets committed (#371,
        // tests/test_no_committed_scan_tokens.py): redacted on write.
        fs.writeFileSync(`${OUT}/${tag}-pdf-request.json`, JSON.stringify(body, (k, v) => (k === 'token' && typeof v === 'string' ? '<redacted: signed site-scan token (#371)>' : v), 1));
      }
      console.log(tag, 'pdf', JSON.stringify({ button: clicked, status: out.pdf.status, bytes: out.pdf.bytes }));
    }
  } catch (e) {
    out.error = String(e).slice(0, 600);
    await p.screenshot({ path: `${OUT}/${tag}-error.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  console.log(tag, out.error ?? 'ok');
  return out;
}

const M = {};
// WIDTHS=1440 ADDR="1550 E Colfax Ave, Denver": the session-3 PDF pass.
// At 1600 E Colfax the pin sits 57 ft east of Franklin on a westbound
// one-way, so the backend declines (the crossing is inside the 1,000 ft
// work zone; it names "more than 69 ft with traffic" as one way out).
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
for (const [w, h] of [[1440, 900], [390, 844]].filter(([w]) => WIDTHS.includes(w))) M[`${w}`] = await run(w, h);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(M, null, 1));
