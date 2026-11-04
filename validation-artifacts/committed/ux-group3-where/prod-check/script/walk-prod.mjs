// #439 WHERE band production check on 6231697, adapted from the local walk
// (../../evidence/script/walk.mjs).
// usage: SHOT_TOKEN=<gate token> node walk-prod.mjs <outdir> https://www.conestruct.com
// The REAL site: no Playwright routes or stubs.  Live Mapbox geocoding in the
// picker, live /api/road-bearing, live backend.  Both pins are placed through
// the picker ("1600 E Colfax Ave, Denver"); pin A picks Franklin Street
// (two-way) from the live road list, pin B picks East Colfax Avenue (one-way).
// Playwright Chromium, DPR 2, 1440x900 and 390x844.  Crops of the WHERE band
// go to <outdir>; the record to walk.json.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = /^https?:/.test(PORT) ? PORT : `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const PICK = { twoway: /Franklin/i, oneway: /Colfax/i };
const roadLists = [];
const roadBearing = [];

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
  // The dialog's subtitle says "pick the road" from the start, so wait for the road's own button.
  const reS = (oneway ? PICK.oneway : PICK.twoway).source;
  const hasRoad = () => p.waitForFunction((re) => [...document.querySelectorAll('[role=dialog] button')].some((b) => new RegExp(re, 'i').test(b.innerText)), reS, { timeout: 60000 }).then(() => true).catch(() => false);
  // Live Overpass can answer "unavailable"; retry with the picker's own Re-detect button.
  let found = await hasRoad();
  for (let k = 0; !found && k < 2; k++) {
    const re = p.getByRole('dialog').locator('button', { hasText: /RE-DETECT/i });
    if (!(await re.count())) break;
    await p.waitForTimeout(15000); await re.first().click(); found = await hasRoad();
  }
  if (!found && process.env.NOROAD) {
    // No road from the live scan: save the pin as it stands and walk what production shows.
    roadLists.push({ oneway, noRoad: true, buttons: (await p.getByRole('dialog').locator('button').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean) });
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 60000 });
    await p.waitForTimeout(2500);
    return;
  }
  await p.waitForTimeout(800);
  const dlg = p.getByRole('dialog');
  // `oneway`: true = pin B (Colfax), false = pin A (Franklin), picked from the live road list.
  roadLists.push({ oneway, buttons: (await dlg.locator('button').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean) });
  const want = dlg.locator('button', { hasText: PICK[oneway ? 'oneway' : 'twoway'] });
  if (await want.count()) await want.first().click(); else throw new Error(`no ${oneway ? 'Colfax' : 'Franklin'} road in the live picker list`);
  roadLists.at(-1).picked = (await want.first().innerText()).replace(/\s+/g, ' ').trim();
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
    p.on('request', (r) => { if (/\/api\/render\/audit(\?|$)/.test(r.url())) counts.audit += 1; });
    p.on('response', async (r) => { if (/\/api\/road-bearing/.test(r.url())) { try { const j = await r.json(); roadBearing.push({ which, width: w, status: r.status(), scan_status: j.scan_status, candidates: (j.candidates ?? []).map((c) => ({ way_id: c.way_id, name: c.name, oneway: c.tags?.oneway ?? null, bearing: c.bearing })) }); } catch { roadBearing.push({ which, width: w, status: r.status() }); } } });
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

const M = { base: BASE, roadLists, roadBearing };
for (const [w, h] of [[1440, 900], [390, 844]]) M[`${w}`] = await run(w, h);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(M, null, 1));
