// #439 WHERE band walk (local), adapted from #437 branch 3's walk.mjs.
// usage: SHOT_TOKEN=<local token> node walk.mjs <outdir> <port>
// Local `next dev` on the ux-group3-where worktree, MODAL_RENDER_URL at the
// local backend (serve_replay.py: the recorded Overpass answer for the
// Denver Colfax pin, replayed).  /api/road-bearing is stubbed: pin A with
// two-way Colfax candidates (oneway 'no'), pin B with #437's THREE stub
// (every candidate oneway 'yes').  Playwright Chromium, DPR 2, 1440x900 and
// 390x844.  Crops of the WHERE band go to <outdir>; the record to walk.json.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

// The stub candidates are built from the recorded Overpass answer at the
// pin (overpass-fixture/c74c32bdc5114bff.json), each with its way's real
// geometry and tags.  #437's stub carried no `geometry`, so no centerline
// was relayed and the backend offered its no-road headings (run 5, kept in
// walk-run5/).  Pin A: Franklin Street, way 492215711, oneway=no.  Pin B:
// East Colfax Avenue, way 1547338997, oneway=yes.
const FIX = JSON.parse(fs.readFileSync(new URL('../overpass-fixture/c74c32bdc5114bff.json', import.meta.url), 'utf8'));
const PIN = { lat: 39.739781, lng: -104.968249 };
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => { const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)); const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)); return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; };
const distM = (a) => Math.hypot((a.lat - PIN.lat) * 111320, (a.lon - PIN.lng) * 111320 * Math.cos(rad(PIN.lat)));
function candFromWay(id, cls) {
  const w = FIX.elements.find((e) => e.type === 'way' && e.id === id);
  const g = w.geometry;
  let i = 0; g.forEach((n, k) => { if (distM(n) < distM(g[i])) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return { way_id: String(id), highway_class: cls ?? w.tags.highway, name: w.tags.name, ref: s('ref'), bearing: +brg(a, b).toFixed(2),
    snap_distance_m: +distM(g[i]).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
    tags: { oneway: s('oneway'), maxspeed: s('maxspeed'), lanes: s('lanes'), lanes_forward: s('lanes:forward'), lanes_backward: s('lanes:backward'),
      lanes_both_ways: s('lanes:both_ways'), turn_lanes: s('turn:lanes'), turn_lanes_forward: s('turn:lanes:forward'), turn_lanes_backward: s('turn:lanes:backward') },
    geometry: g.map((n) => [n.lat, n.lon]) };
}
const stub = (c) => JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [c] });
const CANDS = { twoway: candFromWay(492215711), oneway: candFromWay(1547338997) };
const STUB = { twoway: stub(CANDS.twoway), oneway: stub(CANDS.oneway) };
const PICK = { twoway: /Franklin/i, oneway: /Colfax/i };

const T = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const BAND = '[data-testid=band-where]';
async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
async function shot(p, sel, file) {
  const l = p.locator(sel).first();
  if (!(await l.count()) || !(await l.isVisible())) return null;
  await park(p);
  // The page's sticky top bar overlaps an element crop once the page is
  // scrolled to it; unpin sticky elements for the crop only (measurements
  // are taken before, with the page as served).
  await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } });
  await l.screenshot({ path: `${OUT}/${file}` });
  await p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } });
  return file;
}
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  });
}
// Ruling-9 check: targets under 44 inside the open WHERE band.
async function smallTargets(p) {
  return p.evaluate(() => {
    const root = document.querySelector('[data-testid=band-stack] [data-testid=band-where]') ?? document.querySelector('[data-testid=band-where]');
    if (!root) return [];
    const els = [...root.querySelectorAll('button, a[href], label.nyq-answer')];
    return els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44); })
      .map((e) => { const r = e.getBoundingClientRect(); return { text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), testid: e.getAttribute('data-testid'), w: +r.width.toFixed(1), h: +r.height.toFixed(1), cls: e.className.toString().slice(0, 50) }; });
  });
}
async function card(p) {
  return p.evaluate(() => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const c = document.querySelector('[data-testid=where-questions]');
    if (!c) return null;
    const cur = c.querySelector('.nyq-card');
    return {
      count: t(c.querySelector('.nyq-count')?.innerText),
      heading: t(c.querySelector('h3')?.innerText),
      flag: cur?.getAttribute('data-flag') ?? null,
      question: t(cur?.querySelector('.nyq-q')?.innerText),
      why: t(cur?.querySelector('.nyq-why')?.innerText) || null,
      options: [...(cur?.querySelectorAll('label.nyq-answer') ?? [])].map((l) => ({
        line1: t(l.querySelector('.nyq-label')?.innerText), line2: t(l.querySelector('.nyq-consequence')?.innerText) || null,
        checked: l.querySelector('input')?.checked ?? null, testid: l.querySelector('input')?.getAttribute('data-testid') })),
      button: cur ? { text: t(cur.querySelector('.nyq-foot > button:last-child')?.innerText), testid: cur.querySelector('.nyq-foot > button:last-child')?.getAttribute('data-testid'), disabled: cur.querySelector('.nyq-foot > button:last-child')?.disabled ?? null } : null,
      whereConfirmCount: document.querySelectorAll('[data-testid=where-confirm]').length,
      gate: t(document.querySelector('[data-testid=kind-gate-note]')?.innerText) || null,
      details: (() => { const d = cur?.querySelector('.nyq-details'); return d ? { hidden: d.hidden, text: t(d.innerText) } : null; })(),
      rows: [...c.querySelectorAll('.nyq-row')].map((r) => t(r.innerText)),
    };
  });
}
// Ruling 1: the band's visible blocks, top to bottom.
async function order(p) {
  return p.evaluate((BAND) => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const b = document.querySelector(BAND);
    if (!b) return null;
    const name = (e) => {
      const id = e.getAttribute('data-testid');
      if (e.matches('.a-head')) return `header "${t(e.innerText)}"`;
      if (e.matches('.a-question')) return `question "${t(e.innerText)}"`;
      if (id === 'band-aerial') return 'aerial';
      if (e.matches('.wq-sum-wrap')) return 'summary row';
      if (id === 'where-edit-fold') return 'edit fold';
      if (id === 'where-questions') return 'CONFIRM card';
      return `${e.tagName.toLowerCase()}.${e.className.toString().slice(0, 40)} ${id ?? ''} "${t(e.innerText).slice(0, 50)}"`;
    };
    const blocks = [b.querySelector('.a-head'), ...b.querySelector('.a-body').children];
    const flat = [];
    for (const e of blocks) {
      if (!e) continue;
      if (e.matches('.wq-stack')) flat.push(...e.children); else flat.push(e);
    }
    return flat.filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && !e.hidden; })
      .map((e) => ({ name: name(e), top: Math.round(e.getBoundingClientRect().top + window.scrollY), h: Math.round(e.getBoundingClientRect().height) }));
  }, BAND);
}
async function aerialGeom(p) {
  return p.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), y: +(b.top + window.scrollY).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const frame = document.querySelector('[data-testid=band-aerial] .a-aerial-frame');
    const edit = document.querySelector('[data-testid=band-aerial] [data-testid=where-open-picker]');
    const legend = document.querySelector('[data-testid=band-aerial-legend]');
    const zoom = document.querySelector('[data-testid=band-aerial-zoom]');
    const lg = legend ? getComputedStyle(legend) : null;
    const rows = legend ? [...legend.querySelectorAll('.a-aerial-row')].map((x) => ({ text: x.innerText.trim(), ...r(x) })) : [];
    return {
      stage: document.querySelector('[data-testid=band-aerial]')?.getAttribute('data-stage'),
      frame: r(frame), edit: r(edit), editText: edit?.innerText.trim() ?? null, legend: r(legend), zoom: r(zoom),
      legendStyle: lg ? { position: lg.position, display: lg.display, cols: lg.gridTemplateColumns, bg: lg.backgroundColor, border: lg.border } : null,
      legendRows: rows,
      legendInsideFrame: legend && frame ? (() => { const a = legend.getBoundingClientRect(), f = frame.getBoundingClientRect(); return a.top >= f.top && a.bottom <= f.bottom && a.left >= f.left && a.right <= f.right; })() : null,
    };
  });
}

async function pin(p, oneway) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => /PICK THE ROAD|Which road/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
  await p.waitForTimeout(800);
  const dlg = p.getByRole('dialog');
  // `oneway` names the stub: true = pin B (Colfax), false = pin A (Franklin).
  const want = dlg.locator('button', { hasText: PICK[oneway ? 'oneway' : 'twoway'] });
  if (await want.count()) await want.first().click(); else await dlg.locator('button').filter({ hasText: /Street|Avenue/ }).first().click();
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
}
const chooseSide = async (p, re) => {
  const l = p.locator('[data-testid=where-questions] label.nyq-answer').filter({ hasText: re });
  if (await l.count()) await l.first().click(); else await p.locator('[data-testid=where-questions] label.nyq-answer').first().click();
  await p.waitForTimeout(1500);
};
const chooseKind = async (p, k) => { await p.locator(`label.nyq-answer:has([data-testid=kind-chip-${k}])`).click(); await p.waitForTimeout(800); };
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = { steps: [], fails: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const counts = { audit: 0 };
  const fresh = async (which) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
    const p = await ctx.newPage();
    p.on('request', (r) => { if (r.method() === 'POST' && /\/api\/render\/audit(\?|$)/.test(r.url())) counts.audit += 1; });
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: STUB[which] }));
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    return { ctx, p };
  };
  const step = async (p, name, opts = {}) => {
    const s = { name, card: await card(p) };
    if (opts.order) s.order = await order(p);
    if (opts.aerial) s.aerial = await aerialGeom(p);
    if (opts.extra) Object.assign(s, await opts.extra());
    if (opts.measure) { s.axe = await axe(p); s.small = await smallTargets(p); }
    if (opts.shot !== false) s.shot = await shot(p, opts.sel ?? BAND, `${tag}-${nn()}-${name}.png`);
    out.steps.push(s);
    console.log(tag, name, '| card:', s.card?.count, s.card?.flag, '| btn:', s.card?.button?.text);
  };
  const ck = (label, ok, value) => { if (!ok) out.fails.push({ label, value }); return ok; };
  let ctx, p;
  try {
    // ── Pin A: two-way Colfax ─────────────────────────────────────────
    ({ ctx, p } = await fresh('twoway'));
    out.prePin = await p.evaluate(() => {
      const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
      const b = document.querySelector('[data-testid=band-where]');
      const r = (sel) => { const e = b?.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top) : null; };
      return { head: t(b?.querySelector('.a-head')?.innerText), question: t(b?.querySelector('.a-question')?.innerText),
        helper: t(b?.querySelector('.a-question-prov')?.innerText), field: !!b?.querySelector('.a-findrow input'),
        button: t(b?.querySelector('.a-findrow button')?.innerText), tops: { head: r('.a-head'), question: r('.a-question'), findrow: r('.a-findrow') } };
    });
    await step(p, 'pre-pin', { order: true, shot: true });
    await pin(p, false);
    out.auditAfterPinA = counts.audit;
    await step(p, 'pinned', { order: true, aerial: true, measure: true });
    out.pinA = { sideOptions: out.steps.at(-1).card.options };
    await shot(p, '[data-testid=band-aerial]', `${tag}-${nn()}-aerial-pinned.png`);
    // CONFIRM card, Q1 side open, nothing chosen.
    await step(p, 'q1-side-open', { sel: '[data-testid=where-questions]' });
    // W7: open the kind first by its Next: row; choose a kind; no where-confirm while side open.
    await p.locator('[data-testid=step-next-kind]').click(); await p.waitForTimeout(400);
    await chooseKind(p, 'shoulder');
    await step(p, 'w7-kind-first', { sel: '[data-testid=where-questions]' });
    out.w7 = { flag: out.steps.at(-1).card.flag, whereConfirmCount: out.steps.at(-1).card.whereConfirmCount, button: out.steps.at(-1).card.button };
    // Next question → back to side; the kind's record shows with Undo.
    await nextBtn(p).click(); await p.waitForTimeout(400);
    out.afterW7Next = await card(p);
    // Undo kind from its record.
    await p.locator('[data-testid=step-undo-kind]').click(); await p.waitForTimeout(600);
    await step(p, 'kind-undone', { sel: '[data-testid=where-questions]' });
    out.kindUndo = { flag: out.steps.at(-1).card.flag, anyChecked: out.steps.at(-1).card.options.some((o) => o.checked) };
    // Back to side, choose it, Next → Q2 kind.
    await p.locator('[data-testid=step-next-side]').click(); await p.waitForTimeout(400);
    await chooseSide(p, /North side/);
    await step(p, 'side-chosen', { sel: '[data-testid=where-questions]' });
    await nextBtn(p).click(); await p.waitForTimeout(800);
    await step(p, 'q2-kind-open', { sel: '[data-testid=where-questions]', order: true, measure: true });
    // Aerial with the side set (stage work: the key on it).
    await p.waitForTimeout(2500);
    out.aerialWork = await aerialGeom(p);
    await shot(p, '[data-testid=band-aerial]', `${tag}-${nn()}-aerial-side-set.png`);
    // Details on the kind card.
    await p.locator('[data-testid=where-questions] .nyq-details-btn').first().click(); await p.waitForTimeout(300);
    await step(p, 'q2-details-open', { sel: '[data-testid=where-questions]' });
    await p.locator('[data-testid=where-questions] .nyq-details-btn').first().click();
    await chooseKind(p, 'shoulder');
    await step(p, 'q2-kind-chosen', { sel: '[data-testid=where-questions]' });
    // Undo side from its record.
    await p.locator('[data-testid=step-undo-side]').click(); await p.waitForTimeout(1200);
    await step(p, 'side-undone', { sel: '[data-testid=where-questions]' });
    out.sideUndo = { flag: out.steps.at(-1).card.flag, anyChecked: out.steps.at(-1).card.options.some((o) => o.checked) };
    await chooseSide(p, /North side/);
    // The side is now the last open question: its button is already Confirm.
    out.sideRechosenCard = await card(p);
    // The kind is answered: its row is the record; clicking it opens the kind.
    await p.locator('[data-testid=where-questions] .nyq-answered .nyq-row-btn').filter({ hasText: /kind of work/ }).click(); await p.waitForTimeout(1500);
    out.readyCard = await card(p);
    // Summary row closed, Details open, Edit open.
    const sumExtra = async () => ({ summary: await p.evaluate(() => ({
      text: (document.querySelector('[data-testid=where-summary]')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      sumText: (document.querySelector('[data-testid=where-summary-text]')?.innerText ?? '').trim(),
      editExpanded: document.querySelector('[data-testid=where-edit]')?.getAttribute('aria-expanded'),
      foldHidden: document.querySelector('[data-testid=where-edit-fold]')?.hidden ?? null,
      prov: (() => { const e = document.querySelector('[data-testid=where-provenance]'); return e ? { hidden: e.hidden, text: e.innerText.trim() } : null; })(),
      fold: (() => { const f = document.querySelector('[data-testid=where-edit-fold]'); if (!f || f.hidden) return null; return { address: !!f.querySelector('input[aria-label="Address or cross streets"]'), rows: [...f.querySelectorAll('[data-testid^=move-]:not([data-testid^=move-action]):not([data-testid=move-ledger])')].map((r) => r.getAttribute('data-testid') + ': ' + r.innerText.replace(/\s+/g, ' ').trim().slice(0, 90)), worklen: !!f.querySelector('#band-worklen') }; })(),
    })) });
    // If the fold opened by itself (length unset), record it, then close for the closed crop.
    const pre = await sumExtra();
    out.foldOpenedByItself = pre.summary.editExpanded === 'true';
    if (out.foldOpenedByItself) { await p.locator('[data-testid=where-edit]').click(); await p.waitForTimeout(300); }
    await step(p, 'summary-closed', { sel: '.wq-sum-wrap', extra: sumExtra });
    await p.locator('[data-testid=where-details]').click(); await p.waitForTimeout(300);
    await step(p, 'summary-details', { sel: '.wq-sum-wrap', extra: sumExtra });
    await p.locator('[data-testid=where-details]').click();
    await p.locator('[data-testid=where-edit]').click(); await p.waitForTimeout(400);
    await step(p, 'summary-edit-open', { extra: sumExtra, measure: true });
    await p.locator('[data-testid=where-edit]').click(); await p.waitForTimeout(300);
    // Confirm.
    out.auditBeforeConfirm = counts.audit;
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForTimeout(4000);
    out.afterConfirm = await p.evaluate(() => ({
      openBand: document.querySelector('[data-testid=band-stack] .a-open')?.getAttribute('data-testid') ?? document.querySelector('.a-open')?.getAttribute('data-testid'),
      whereOpen: !!document.querySelector('.a-open[data-testid=band-where]'),
    }));
    out.auditAfterConfirm = counts.audit;
    await p.screenshot({ path: `${OUT}/${tag}-${nn()}-confirmed.png` });
    await ctx.close();

    // ── Pin B: one-way (THREE stub, oneway 'yes') ──────────────────────
    ({ ctx, p } = await fresh('oneway'));
    await pin(p, true);
    await step(p, 'oneway-pinned', { sel: '[data-testid=where-questions]' });
    out.pinB = { sideOptions: out.steps.at(-1).card.options };
    // With shoulder chosen (left_side_built), the options may grow.
    await p.locator('[data-testid=step-next-kind]').click(); await p.waitForTimeout(400);
    await chooseKind(p, 'shoulder'); await p.waitForTimeout(2500);
    await p.locator('[data-testid=step-next-side]').click(); await p.waitForTimeout(400);
    await step(p, 'oneway-shoulder', { sel: '[data-testid=where-questions]' });
    out.pinB.sideOptionsWithShoulder = out.steps.at(-1).card.options;
    await ctx.close();
  } catch (e) {
    out.error = String(e).slice(0, 500);
    if (p) await p.screenshot({ path: `${OUT}/${tag}-error.png`, fullPage: true }).catch(() => {});
    if (ctx) await ctx.close().catch(() => {});
  }
  await b.close();
  console.log(tag, out.error ?? 'ok', '| audit before confirm', out.auditBeforeConfirm);
  return out;
}

const M = {};
for (const [w, h] of [[1440, 900], [390, 844]]) M[`${w}`] = await run(w, h);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(M, null, 1));
