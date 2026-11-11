// #488 production check (mission move-walk-side-line, 2026-11-10, main a5a4569).
// Adapted from issue-489/script/walk-485-move-prod.mjs (left as it was): the
// same gated context, the same search() with #489's own-road wait, the same
// box reads, axe on the band and the 44 px measure.  Changed for #488:
//   A. the CONFIRM questions answered (kind = Shoulder work, then the side).
//   B. "Edit on map" on the aerial's corner (.a-aerial-edit, not the Edit
//      panel) -> another address on E Colfax -> Save & Close.  Expect the side
//      unticked, exactly one edit-reasked-note with the line, the kind kept.
//   C. the side answered again: the line goes.
//   D. "Edit on map" again -> Save & Close with nothing changed: no line, the
//      side kept.
// Each step also counts the edit-reasked-note nodes and lists every small
// target with its parent class, so Mapbox's marks (#505) can be told apart.
// The last step also runs axe on the whole page.
// usage: SITE=https://www.conestruct.com GATE_BYPASS_TOKEN=... node walk-488-prod.mjs <outdir> [sizes]
// Chromium, DPR 1.  The gate header rides only the site's own origin
// (scripts/gate.cjs) and never prints.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');
const require = createRequire(path.join(W, '../../..', 'package.json'));
const { chromium } = require('playwright');
if (!process.env.GATE_BYPASS_TOKEN) throw new Error('GATE_BYPASS_TOKEN not set');
const { newGatedContext, guardOutput } = require(path.join(W, 'scripts/gate.cjs'));
guardOutput();
const AXE = fs.readFileSync(path.join(W, '../../..', 'conestruct/site/node_modules/axe-core/axe.min.js'), 'utf8');
const [OUT, SIZES] = process.argv.slice(2);
const BASE = process.env.SITE ?? 'https://www.conestruct.com';
const sizes = (SIZES || '1440x900,390x844').split(',').map((s) => s.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });

const LINE = 'Your edit changed the road or the work start, so this is asked again.';
const ADDR = (w) => (w <= 480 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');
const ADDR_MOVED = (w) => (w <= 480 ? '1550 E Colfax Ave, Denver' : '1600 E Colfax Ave, Denver');
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function read(p) {
  return p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return null; return { top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1), left: +r.left.toFixed(1), w: +r.width.toFixed(1) }; };
    return {
      frameInBand: (() => { const f = q('[data-testid=band-aerial-frame]'), bd = q('[data-testid=band-where]'); if (!f || !bd) return null; const a = f.getBoundingClientRect(), c = bd.getBoundingClientRect(); return { dy: +(a.top - c.top).toFixed(1), left: +a.left.toFixed(1), w: +a.width.toFixed(1), h: +a.height.toFixed(1) }; })(),
      band: box(q('[data-testid=band-where]')), side: box(q('.wq-side')), card: box(q('[data-testid=where-questions]')),
      framePos: q('[data-testid=band-aerial-frame]') ? getComputedStyle(q('[data-testid=band-aerial-frame]')).position : null,
      reaskedCount: document.querySelectorAll('[data-testid=edit-reasked-note]').length,
      reasked: [...document.querySelectorAll('[data-testid=edit-reasked-note]')].map((e) => e.innerText.trim()),
      records: [...document.querySelectorAll('[data-testid=where-questions] .nyq-answered .nyq-row-text')].map((e) => e.innerText),
      q: (q('[data-testid=where-questions] .nyq-q')?.innerText ?? '').trim().slice(0, 60) || null,
      sideChecked: q('[data-testid=side-option]')?.checked ?? null,
      panelOpen: Boolean(q('[data-testid=where-edit-panel]')),
      // The line's own box, margins included, and how many side options show.
      noteH: (() => { const e = q('[data-testid=edit-reasked-note]'); if (!e) return null; const cs = getComputedStyle(e); return +(e.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom)).toFixed(1); })(),
      sideOptions: document.querySelectorAll('[data-testid=side-option]').length,
    };
  });
}
async function axe(p, whole = false) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async (whole) => {
    const r = await window.axe.run(whole ? document : (document.querySelector('[data-testid=band-where]') ?? document), { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  }, whole);
}
async function small(p) {
  return p.evaluate(() => {
    const band = document.querySelector('[data-testid=band-where]');
    if (!band) return [];
    const out = [];
    for (const e of band.querySelectorAll('button, a, input, label.nyq-answer')) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(e).visibility === 'hidden') continue;
      if (r.width < 44 || r.height < 44) out.push({ tag: e.tagName.toLowerCase(), cls: (e.className?.baseVal ?? e.className ?? '').toString().slice(0, 60), parent: (e.parentElement?.className ?? '').toString().slice(0, 60), mapbox: Boolean(e.closest('[class*=mapbox]')) || /mapbox|openstreetmap/i.test(e.getAttribute('href') ?? ''), text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), testid: e.getAttribute('data-testid'), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
    }
    return out;
  });
}

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, steps: [], errors: [], console: [], pageAxe: null, checks: {} };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await newGatedContext(b, BASE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text().slice(0, 200)); });
  // The failing loads behind "Failed to load resource" (path only, no query).
  out.bad = [];
  p.on('response', (r) => { if (r.status() >= 400) { const u = new URL(r.url()); out.bad.push(`${r.status()} ${u.host}${u.pathname}`.slice(0, 160)); } });
  const step = async (name) => {
    await p.waitForTimeout(1200);
    const s = { name, ...(await read(p)) };
    s.axe = await axe(p);
    s.small = await small(p);
    s.shot = `${tag}-${nn()}-${name}.png`;
    await p.locator('[data-testid=band-where]').screenshot({ path: `${OUT}/${s.shot}` }).catch(() => p.screenshot({ path: `${OUT}/${s.shot}` }));
    out.steps.push(s);
    console.log(tag, name.padEnd(26), '| band h', s.band?.h, '| frame', s.frameInBand ? `${s.frameInBand.left},${s.frameInBand.dy} ${s.frameInBand.w}x${s.frameInBand.h} ${s.framePos}` : null,
      '| side h', s.side?.h, '| reasked', s.reaskedCount, s.reasked.join(' / '), '| side', s.sideChecked, '| records', JSON.stringify(s.records), '| axe', s.axe.length, 'small', s.small.length);
    return s;
  };
  const pick = async (testid) => { await p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click(); };
  const saveEnabled = () => p.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].some((x) => /Save & Close/.test(x.innerText) && !x.disabled), null, { timeout: 60000 });
  const closeDialog = async () => {
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[role=dialog]', { state: 'detached', timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);
  };
  const search = async (addr) => {
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(addr);
    const roads = p.waitForResponse((r) => r.url().includes('/api/road-bearing'), { timeout: 90000 });
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await roads;
    await p.waitForFunction(() => {
      const d = document.querySelector('[role=dialog]');
      const save = [...(d?.querySelectorAll('button') ?? [])].find((x) => /Save & Close/.test(x.innerText));
      return /PICK THE ROAD · \d+ FOUND|Which road/i.test(d?.innerText ?? '') || (save && !save.disabled);
    }, null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').getByRole('radio', { name: /Colfax/ });
    if (await want.count()) {
      await want.first().click();
      await p.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].some((x) => /Save & Close/.test(x.innerText) && !x.disabled), null, { timeout: 5000 })
        .catch(() => { throw new Error(`search ${addr}: the Colfax road row was clicked but Save & Close stayed disabled`); });
    }
    await p.waitForTimeout(2000);
    await closeDialog();
  };
  // The aerial's corner door, not the Edit panel's Move.
  const door = async () => {
    const d = p.locator('button.a-aerial-edit[data-testid=where-open-picker]');
    await d.scrollIntoViewIfNeeded();
    await d.click();
    await p.waitForSelector('[role=dialog]', { timeout: 30000 });
  };
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await search(ADDR(w));
    await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
    await p.waitForSelector('[data-testid=band-aerial-img]', { timeout: 60000 });
    await pick('kind-chip-shoulder');
    await p.waitForTimeout(1500);
    await nextBtn(p).click();
    await p.waitForTimeout(1500);
    // A0: the side question on screen, no line (the column with the same options, for the 1440 height).
    const A0 = await step('A0-side-question');
    await pick('side-option');
    const A = await step('A-questions-answered');
    await door();
    await search(ADDR_MOVED(w));
    const B = await step('B-edit-on-map-moved');
    await pick('side-option');
    const C = await step('C-side-answered-again');
    await door();
    await p.waitForTimeout(2500);
    // Live roads (run 1): the corner door reopens the picker with no road
    // ticked ("PICK A ROAD TO CONTINUE"), so "nothing changed" means ticking
    // the same road (East Colfax) again and saving: the pin and road unchanged.
    out.doorReopenSaveDisabled = await p.evaluate(() => { const s = [...document.querySelectorAll('[role=dialog] button')].find((x) => /Save & Close/.test(x.innerText)); return s ? s.disabled : null; });
    out.doorReopenRoadTicked = await p.evaluate(() => [...document.querySelectorAll('[role=dialog] [role=radio]')].filter((x) => x.getAttribute('aria-checked') === 'true' || x.checked).map((x) => (x.getAttribute('aria-label') || x.closest('label')?.innerText || '').trim().slice(0, 60)));
    if (out.doorReopenSaveDisabled) {
      await p.getByRole('dialog').getByRole('radio', { name: /Colfax/ }).first().click();
    }
    await saveEnabled();
    await closeDialog();
    const D = await step('D-edit-on-map-unchanged');
    out.pageAxe = await axe(p, true);
    const kind = (s) => s.records.some((r) => /Shoulder work/.test(r));
    out.checks = {
      A0_options_noteless: [A0.sideOptions, A0.band?.h, A0.side?.h],
      B_options_note: [B.sideOptions, B.noteH],
      A_answered: A.sideChecked === true && kind(A) && A.reaskedCount === 0,
      B_one_line: B.reaskedCount === 1 && B.reasked[0] === LINE,
      B_side_cleared: B.sideChecked === false,
      B_kind_kept: kind(B),
      C_line_gone: C.reaskedCount === 0 && C.sideChecked === true,
      D_no_line_side_kept: D.reaskedCount === 0 && D.sideChecked === true && kind(D),
      band_h_A_B: [A.band?.h, B.band?.h],
      frame_A_B: [A.frameInBand, B.frameInBand],
    };
  } catch (e) {
    out.errors.push(`walk: ${String(e).split('\n')[0].slice(0, 300)}`);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  await b.close();
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 1));
  console.log(tag, 'checks', JSON.stringify(out.checks));
  console.log(tag, 'door reopen: save disabled', out.doorReopenSaveDisabled, 'ticked', JSON.stringify(out.doorReopenRoadTicked), '| bad loads', JSON.stringify(out.bad));
  console.log(tag, 'console errors', out.console.length, out.console.join(' | ').slice(0, 400));
  console.log(tag, 'errors', out.errors.length, out.errors.join(' | ').slice(0, 300), '| axe band total', out.steps.reduce((a, s) => a + s.axe.length, 0),
    '| page axe', JSON.stringify(out.pageAxe), '| small per step', out.steps.map((s) => s.small.length).join(','));
}

for (const [w, h] of sizes) await run(w, h);
