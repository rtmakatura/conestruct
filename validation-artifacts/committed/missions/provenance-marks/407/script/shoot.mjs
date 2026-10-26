// #407 before/after shots and mark measurements.
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev` of the issue worktree (base sources for "before", the fix
// for "after"); Playwright Chromium at DPR 2, 1440x900 and 390x844.
// /api/road-bearing is stubbed with one candidate (as L2 and #397 did, so the
// shots don't hang on Overpass); everything else is live.  The dev server
// runs with a local-only GATE_BYPASS_TOKEN passed here as SHOT_TOKEN; no real
// token is read or printed.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const CAND = { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', ref: null, bearing: 90, snap_distance_m: 5,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null,
  tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null,
    oneway: 'yes', maxspeed: '30 mph', lanes: '3' } };
const STUB = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [CAND] });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

async function shot(p, sel, file) {
  await p.locator(sel).first().scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${phase}-${file}`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.w + 16, vw), height: box.h + 16 } });
}

// The mark's computed colour, its glyph, and the ground it sits on: every
// ancestor's background composited from the page ground up (rgba washes).
async function measure(p, markSel, pseudo, labelSel) {
  return p.evaluate(([ms, ps, ls]) => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const el = document.querySelector(ms);
    if (!el) return { missing: ms };
    const cs = getComputedStyle(el, ps || null);
    const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let g = { r: 255, g: 255, b: 255 };
    for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) g = { r: c.r * c.a + g.r * (1 - c.a), g: c.g * c.a + g.g * (1 - c.a), b: c.b * c.a + g.b * (1 - c.a) }; }
    const fg = parse(cs.color);
    const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const L1 = lum(fg), L2 = lum(g);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const lab = ls ? document.querySelector(ls) : null;
    const lr = lab ? lab.getBoundingClientRect() : null;
    // Where the label's own words start: the last text node's first glyph.
    let textLeft = null;
    if (lab) {
      const tw = document.createTreeWalker(lab, NodeFilter.SHOW_TEXT);
      let last = null; for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.textContent.trim()) last = n;
      if (last) { const rg = document.createRange(); const i = last.textContent.search(/\S/); rg.setStart(last, i); rg.setEnd(last, i + 1); textLeft = Math.round(rg.getBoundingClientRect().left * 100) / 100; }
    }
    return {
      glyph: ps ? cs.content : el.textContent,
      visibility: cs.visibility,
      color: cs.color,
      ground: `rgb(${g.r.toFixed(1)}, ${g.g.toFixed(1)}, ${g.b.toFixed(1)})`,
      contrast: Math.round(ratio * 100) / 100,
      label: lr ? { left: Math.round(lr.left * 100) / 100, width: Math.round(lr.width * 100) / 100, textLeft, text: lab.textContent } : null,
    };
  }, [markSel, pseudo, labelSel]);
}

const M = {};
async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const out = {};
  try {
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: STUB }));
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
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
    await p.waitForSelector('[data-testid=kind-chip-shoulder]', { timeout: 60000 });
    // The side was the last WHERE answer owed only once the kind is set;
    // here the kind is still open, so WHERE stays open with both visible.
    await p.locator('[data-testid=kind-chip-shoulder]').click();
    await p.waitForTimeout(800);
    await park(p);
    const sideSel = '[data-testid=side-option][aria-checked="true"]';
    out.side = await measure(p, `${sideSel} .tr-field > span`, null, `${sideSel} .tr-field`);
    await shot(p, '.a-chips-side', `${tag}-side-chip.png`);
    const kindSel = '[data-testid=kind-chip-shoulder]';
    out.kind = await measure(p, `${kindSel} > .tr-field`, '::after', `${kindSel} > .tr-field`);
    await p.evaluate((s) => document.querySelector(s).parentElement.setAttribute('data-shot', 'kind-row'), kindSel);
    await shot(p, '[data-shot=kind-row]', `${tag}-kind-chip.png`);
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-night]', { timeout: 90000 });
    await p.waitForTimeout(2500);
    await park(p);
    const segSel = '[data-testid=cell-night] button[aria-pressed="true"] > .a-seg-label';
    out.segmented = await measure(p, segSel, '::before', segSel);
    await shot(p, '[data-testid=cell-night]', `${tag}-segmented.png`);
  } catch (e) {
    out.error = String(e).slice(0, 300);
    await p.screenshot({ path: `${OUT}/${phase}-${tag}-error.png` }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  M[tag] = out;
  console.log(phase, tag, JSON.stringify(out));
}

await run(1440, 900);
await run(390, 844);
fs.writeFileSync(`${OUT}/measurements-${phase}.json`, JSON.stringify(M, null, 1));
