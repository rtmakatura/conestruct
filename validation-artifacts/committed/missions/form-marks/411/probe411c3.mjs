// #411 — before/after shots and contrast of the changed marks.
// usage: node probe411c3.mjs <before|after> <outdir> <port>  (cycle 3: before = 04b76f5, after = the branch)
// Token: never printed.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
// the token as Next's own env loader expands it (tok411.txt, written by @next/env)
const { loadEnvConfig } = require('C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-411/conestruct/site/node_modules/@next/env');
const TOK = loadEnvConfig('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site', true, { info() {}, error() {} }).combinedEnv.GATE_BYPASS_TOKEN;
fs.mkdirSync(OUT, { recursive: true });
const CAND = { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', ref: null, bearing: 90, snap_distance_m: 5,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null,
  tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null,
    oneway: 'yes', maxspeed: '30 mph', lanes: '3' } };
const STUB = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [CAND] });
// CHOSEN for the shot: the backend's #284 basis wording shape; the proposal is injected into the
// live corridor-geometry answer because a real one needs a one-lane one-way street.
const BASIS = 'One lane each way leaves shoulder work as the only kind this road can take.';

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

async function shot(p, sel, name) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await park(p);
  const r = await el.boundingBox();
  const vw = p.viewportSize().width;
  const x = Math.max(0, r.x - 8);
  const clip = { x, y: Math.max(0, r.y - 8), width: Math.min(r.width + 16, vw - x), height: r.height + 16 };
  await p.screenshot({ path: `${OUT}/${phase}-${CUR}-${name}.png`, clip });
}

// contrast of an element's computed colour against its painted ground (alpha-composited chain)
async function contrast(p, sel) {
  return p.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fg = parse(getComputedStyle(el).color);
    const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let g = { r: 255, g: 255, b: 255 };
    for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) g = { r: c.r * c.a + g.r * (1 - c.a), g: c.g * c.a + g.g * (1 - c.a), b: c.b * c.a + g.b * (1 - c.a) }; }
    const L1 = lum(fg), L2 = lum(g);
    return { text: el.textContent, color: getComputedStyle(el).color, ground: `rgb(${g.r.toFixed(1)}, ${g.g.toFixed(1)}, ${g.b.toFixed(1)})`, ratio: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100 };
  }, sel);
}
// the glyph of a marker: after = its .sym-* span; before = the trigger itself (one span, faint ink)
const glyphSel = (testid) => phase === 'after'
  ? `[data-testid=info-toggle-${testid}] [class*="sym-"]`
  : `[data-testid=info-toggle-${testid}]`;

// x of the first non-space character of the word after the glyph (the text that follows ⚠/✓),
// relative to the container's left edge; and the glyph's own left edge.
async function xAfterGlyph(p, sel, word) {
  return p.evaluate(([s, wd]) => {
    const host = document.querySelector(s);
    if (!host) return null;
    const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const box = host.getBoundingClientRect();
    let glyphLeft = null, wordLeft = null;
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const t = n.textContent;
      const gi = t.search(/[✓⚠]/);
      if (gi >= 0 && glyphLeft === null) { const rg = document.createRange(); rg.setStart(n, gi); rg.setEnd(n, gi + 1); glyphLeft = rg.getBoundingClientRect().left - box.left; }
      const wi = t.indexOf(wd);
      if (wi >= 0 && wordLeft === null && glyphLeft !== null) { const rg = document.createRange(); rg.setStart(n, wi); rg.setEnd(n, wi + 1); wordLeft = rg.getBoundingClientRect().left - box.left; }
    }
    const rd = (v) => (v == null ? null : Math.round(v * 100) / 100);
    return { glyphLeftPx: rd(glyphLeft), wordLeftPx: rd(wordLeft) };
  }, [sel, word]);
}

const M = {};
let CUR = 0;
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const out = {}; CUR = w;
  try {
    await p.route('**/api/road-bearing**', (q) => q.fulfill({ status: 200, contentType: 'application/json', body: STUB }));
    await p.route('**/api/render/corridor-geometry**', async (q) => {
      const r = await q.fetch();
      let j; try { j = await r.json(); } catch { return q.fulfill({ response: r }); }
      j.kind_proposal = { kind: 'shoulder', basis: BASIS };
      await q.fulfill({ response: r, body: JSON.stringify(j), headers: { ...r.headers(), 'content-type': 'application/json' } });
    });
    await p.goto(`http://localhost:${PORT}/sandbox`, { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
    await p.getByRole('dialog').getByRole('button', { name: /Colfax/i }).first().click();
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
    await p.locator('[data-testid=side-option]').first().click();
    await p.waitForSelector('[data-testid=kind-proposed-mark]', { timeout: 60000 });
    await p.evaluate(() => document.fonts.ready);
    // 1. the proposed kind, unpressed: chip + note
    await shot(p, '[data-testid=kind-chip-shoulder]', 'kind-proposed-chip');
    await shot(p, '[data-testid=kind-proposal-note]', 'kind-proposal-note');
    const pm = phase === 'after' ? '[data-testid=kind-proposed-mark] .sym-warn' : '[data-testid=kind-proposed-mark]';
    const pn = phase === 'after' ? '[data-testid=kind-proposal-note] .sym-warn' : '[data-testid=kind-proposal-note]';
    out.proposedMarkUnpressed = await contrast(p, pm);
    out.proposalNote = await contrast(p, pn);
    out.xProposedMark = await xAfterGlyph(p, '[data-testid=kind-proposed-mark]', 'proposed');
    out.xProposalNote = await xAfterGlyph(p, '[data-testid=kind-proposal-note]', 'proposed');
    // 2. the side control's ⚠ line (a copy injected into the real control: the two real
    //    lines need a backend refusal or an unmarked crossing; markup is WhereBand's own)
    await p.evaluate((ph) => {
      const host = document.querySelector('[data-testid=side-control]');
      const d = document.createElement('div');
      d.className = 'tr-prov mt-1'; d.id = 'probe411-side';
      d.innerHTML = `<span${ph === 'after' ? ' class="sym-warn"' : ''} aria-hidden="true">⚠ </span>This curb isn't a shoulder here; pick the built curb.`;
      host.appendChild(d);
    }, phase);
    await shot(p, '#probe411-side', 'side-warn-line');
    out.sideWarnLine = await contrast(p, '#probe411-side > span');
    await p.evaluate(() => document.getElementById('probe411-side')?.remove());
    // 3. choose the proposed kind (cycle 3: Ryan 2026-10-26, the mark and the note go once picked)
    const kindBox = async () => p.evaluate(() => {
      const g = document.querySelector('[role=group][aria-label="Kind of work"]');
      const host = g?.parentElement;
      const gate = document.querySelector('[data-testid=kind-gate-note]');
      const note = document.querySelector('[data-testid=kind-proposal-note]');
      const rd = (v) => Math.round(v * 100) / 100;
      const hb = host?.getBoundingClientRect();
      return { hostHeight: hb ? rd(hb.height) : null, gateNoteTopFromHost: gate && hb ? rd(gate.getBoundingClientRect().top - hb.top) : null,
        noteHeight: note ? rd(note.getBoundingClientRect().height) : null, noteMarginTop: note ? getComputedStyle(note).marginTop : null };
    });
    out.kindBlockUnpressed = await kindBox();
    await p.locator('[data-testid=kind-chip-shoulder]').click();
    await p.waitForTimeout(800);
    await shot(p, '[data-testid=kind-chip-shoulder]', 'kind-proposed-chip-pressed');
    await shot(p, '[role=group][aria-label="Kind of work"] >> xpath=..', 'kind-block-pressed');
    out.proposedMarkPressed = await contrast(p, pm);
    out.kindChipPressedText = await p.locator('[data-testid=kind-chip-shoulder]').textContent();
    out.kindPressedHasMark = await p.locator('[data-testid=kind-proposed-mark]').count();
    out.kindPressedHasNote = await p.locator('[data-testid=kind-proposal-note]').count();
    out.kindBlockPressed = await kindBox();
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-night]', { timeout: 90000 });
    await p.waitForTimeout(2500);
    // 4. WHAT rows: the markers
    for (const id of ['speed', 'night', 'reduction', 'divided', 'lanes', 'road-type', 'street-class', 'class']) {
      if (await p.locator(`[data-testid=cell-${id}]`).count()) {
        // cycle 3, finding 1: the word's left edge inside the trigger, after the glyph
        out[`marker-${id}-wordx`] = await p.evaluate((tid) => {
          const host = document.querySelector(`[data-testid=info-toggle-${tid}]`);
          if (!host) return null;
          const box = host.getBoundingClientRect();
          const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
          let seenGlyph = false;
          for (let n = tw.nextNode(); n; n = tw.nextNode()) {
            const t = n.textContent;
            for (let i = 0; i < t.length; i++) {
              if (/[✓⚠◌i]/.test(t[i]) && !seenGlyph && (t.length === 1 || t[i + 1] === ' ')) { seenGlyph = true; continue; }
              if (seenGlyph && /[A-Za-z]/.test(t[i])) {
                const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
                const rr = rg.getBoundingClientRect();
                return { text: host.textContent, wordLeftPx: Math.round((rr.left - box.left) * 1000) / 1000, triggerWidthPx: Math.round(box.width * 1000) / 1000 };
              }
            }
          }
          return { text: host.textContent, wordLeftPx: null };
        }, id);
        await shot(p, `[data-testid=cell-${id}]`, `cell-${id}`);
        out[`marker-${id}`] = await contrast(p, glyphSel(id));
        out[`marker-${id}`] && (out[`marker-${id}`].trigger = await p.locator(`[data-testid=info-toggle-${id}]`).textContent().catch(() => null));
        // the trigger itself: its word's ink (the word-only "default" has no glyph span)
        out[`marker-${id}-word`] = await contrast(p, `[data-testid=info-toggle-${id}]`);
        out[`marker-${id}-word`] && (out[`marker-${id}-word`].box = await p.locator(`[data-testid=info-toggle-${id}]`).boundingBox().then((q) => q && { x: Math.round(q.x * 100) / 100, w: Math.round(q.width * 100) / 100 }));
      }
    }
    // cycle 3, finding 4: "i about" measured live. No row shows it, so a copy of a real
    // trigger (FieldCell's markup, the same cell and ground) is given the marker's i span.
    out.markerAbout = await p.evaluate((ph) => {
      const src = document.querySelector('[data-testid=info-toggle-speed]');
      if (!src) return null;
      const c = src.cloneNode(true); c.id = 'probe411-about'; c.removeAttribute('data-testid');
      c.innerHTML = ph === 'after' ? '<span aria-hidden="true"><span class="sym-info">i</span> about</span>' : '<span aria-hidden="true">i about</span>';
      src.parentElement.appendChild(c); return true;
    }, phase);
    if (out.markerAbout) {
      await shot(p, '#probe411-about', 'marker-about');
      out.markerAbout = await contrast(p, phase === 'after' ? '#probe411-about .sym-info' : '#probe411-about');
    }
  } catch (e) { out.error = String(e).slice(0, 400); await p.screenshot({ path: `${OUT}/${phase}-${w}-error.png` }).catch(() => {}); }
  M[w] = out;
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/measurements-${phase}.json`, JSON.stringify(M, null, 1) + String.fromCharCode(10), { encoding: 'utf8' });
for (const [w, o] of Object.entries(M)) console.log(phase, w, o.error ?? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v ? `${v.trigger ?? v.text} ${v.ratio}` : null])));
