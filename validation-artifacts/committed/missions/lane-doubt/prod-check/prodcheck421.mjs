// #421 production check (mission lane-doubt): #411 and #420 live.
// Drives the LIVE https://www.conestruct.com/sandbox with the real road lookup
// (no stub, no injected DOM; axe-core is added as a script to audit each state).
// usage: node prodcheck421.mjs <outdir>
// The gate token is read from conestruct/site/.env.local at run time and sent
// as x-conestruct-gate; it is never printed or written.
// Playwright Chromium, DPR 2, 1440x900 and 390x844.
import { createRequire } from 'module';
import fs from 'fs';
const ROOT = 'C:/Users/rtmak/Documents/traffic-control-tool';
const require = createRequire(ROOT + '/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync(ROOT + '/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT] = process.argv.slice(2);
const ENV = fs.readFileSync(ROOT + '/conestruct/site/.env.local', 'utf8');
const TOK = ((ENV.match(/^GATE_BYPASS_TOKEN=(.*)$/m) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
if (!TOK) { console.log('no token'); process.exit(2); }
const BASE = 'https://www.conestruct.com';
const ONLY = (process.env.SHOT_ONLY ?? '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const SITES = {
  // A one-lane one-way street (OSM way 44932808, Clarkson Street, oneway=yes,
  // lanes=1): the road facts leave shoulder work as the only kind, so the
  // backend proposes it (src/rules/kind_proposal.py).
  clarkson: { coords: '39.72547, -104.97757', pick: /Clarkson/i, kind: 'shoulder' },
  // Shoulder plan on E Colfax: a typed length (marker ✓), then the
  // near-intersection chip with no crossing marked (the side control's ⚠ line).
  colfax: { search: '1600 E Colfax Ave, Denver', pick: /Colfax/i, kind: 'shoulder' },
  // The same Colfax block as a typed pin (#411's stub coordinates), used when
  // the address search's live lookup keeps answering "unavailable".
  colfaxPin: { coords: '39.74003, -104.96555', pick: /Colfax/i, kind: 'shoulder' },
  // Near-intersection plan on Wadsworth at W 10th (#420's own reference).
  wadsworth: { search: 'Wadsworth Blvd & W 10th Ave, Lakewood, CO', pick: /Wadsworth/i, kind: 'near_intersection' },
};

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

// sel may start with "PARENT:" to shoot the match's parent element.
async function shotOf(p, tag, sel, file, extraSel) {
  const base = sel.replace(/^PARENT:/, '');
  const el = p.locator(base).first();
  await el.scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate(([s, x]) => {
    const q = (k) => (k.startsWith('PARENT:') ? document.querySelector(k.slice(7))?.parentElement : document.querySelector(k));
    const els = [q(s), x ? q(x) : null].filter(Boolean);
    const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
    const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
    const r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
    return { x: l, y: t, width: r - l, height: b - t, text: els.map(e => e.innerText).join(' | ') };
  }, [sel, extraSel ?? null]);
  const vw = p.viewportSize().width;
  const x = Math.max(0, box.x - 8);
  await p.screenshot({ path: `${OUT}/prod-${tag}-${file}.png`, clip: { x, y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, vw - x), height: box.height + 16 } });
  return box.text.replace(/\s+/g, ' ').trim();
}

// Computed colour of an element and its contrast against the painted ground
// (alpha-composited ancestor chain). q = { sel, has?, child? }: the first
// `sel` whose text includes `has`, then its first `child` match.
async function contrast(p, q) {
  return p.evaluate(({ sel, has, child }) => {
    let el = [...document.querySelectorAll(sel)].find((e) => !has || e.textContent.includes(has));
    if (el && child) el = el.querySelector(child);
    if (!el) return null;
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fg = parse(getComputedStyle(el).color);
    const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let g = { r: 255, g: 255, b: 255 };
    for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) g = { r: c.r * c.a + g.r * (1 - c.a), g: c.g * c.a + g.g * (1 - c.a), b: c.b * c.a + g.b * (1 - c.a) }; }
    const L1 = lum(fg), L2 = lum(g);
    return { text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 140), cls: el.className || null, color: getComputedStyle(el).color,
      ground: `rgb(${g.r.toFixed(1)}, ${g.g.toFixed(1)}, ${g.b.toFixed(1)})`, ratio: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100 };
  }, q);
}
const tokens = (p) => p.evaluate(() => { const s = getComputedStyle(document.querySelector('.workbench') || document.documentElement);
  return Object.fromEntries(['--pass', '--act', '--warn', '--none', '--ink-faint'].map((k) => [k, s.getPropertyValue(k).trim()])); });
const markerOf = async (p, id) => {
  const t = p.locator(`[data-testid=info-toggle-${id}]`).first();
  if (!(await t.count())) return null;
  return { text: (await t.textContent()).trim(), cls: await t.getAttribute('class'),
    glyphSpans: await t.locator('[class*="sym-"]').count(),
    glyph: await contrast(p, { sel: `[data-testid=info-toggle-${id}]`, child: '[class*="sym-"]' }),
    word: await contrast(p, { sel: `[data-testid=info-toggle-${id}]` }) };
};
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  });
}

async function locate(p, site) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  if (site.coords) {
    const t = p.getByRole('button', { name: /enter coordinates manually/i });
    if (await t.count()) await t.click();
    await p.getByLabel('Latitude').fill(site.coords);
  } else {
    await p.getByLabel('Address or intersection search').fill(site.search);
    await p.getByRole('button', { name: 'SEARCH' }).click();
  }
  await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
  // The live detection service can answer "unavailable" (an upstream
  // timeout); retry with the picker's own Re-detect roads button.
  for (let i = 0; i < 4 && /DETECTION SERVICE UNAVAILABLE/i.test(await p.getByRole('dialog').innerText()); i++) {
    await p.waitForTimeout(8000);
    await p.getByRole('button', { name: /re-detect roads/i }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND|UNAVAILABLE/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(1000);
  }
  await p.waitForTimeout(1000);
  const dialogText = (await p.getByRole('dialog').innerText()).replace(/\s+/g, ' ');
  if (site.pick) await p.getByRole('dialog').getByRole('button', { name: site.pick }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=cell-worklen]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  return (dialogText.match(/[^.]*DETECTED[^.]*/i) || [''])[0].slice(0, 160);
}
async function side(p) {
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.locator('[data-testid=side-option]').first().click();
  await p.waitForTimeout(2500);
}
async function kind(p, k) {
  await p.waitForSelector(`[data-testid=kind-chip-${k}]`, { timeout: 60000 });
  await p.locator(`[data-testid=kind-chip-${k}]`).click();
  await p.waitForTimeout(1500);
}
async function typeLen(p, len) {
  const f = p.locator('#band-worklen');
  await f.fill(String(len));
  await f.press('Enter');
  await p.waitForTimeout(1000);
}
async function confirm(p) {
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
}
const guessMarkers = (p) => p.$$eval('[data-testid^=info-toggle-]', (es) => es.map((e) => e.textContent.trim()).filter((t) => t.startsWith('⚠')));
const headerText = (p) => p.locator('.a-open .a-head').first().innerText().then((s) => s.replace(/\s+/g, ' ').trim());
async function openInfo(p, id) {
  const t = p.locator(`[data-testid=info-toggle-${id}]`).first();
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
  await p.waitForTimeout(400);
}

const M = {};
async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const out = {};
  for (const [name, site] of Object.entries(SITES)) {
    if (ONLY.length ? !ONLY.includes(name) : name === 'colfaxPin') continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
    const p = await ctx.newPage();
    const o = (out[name] = { axe: {} });
    try {
      o.picker = await locate(p, site);
      o.tokens = await tokens(p);
      await side(p);
      if (name === 'clarkson') {
        const hasMark = await p.waitForSelector('[data-testid=kind-proposed-mark]', { timeout: 30000 }).then(() => true).catch(() => false);
        o.proposalShown = hasMark;
        if (hasMark) {
          o.chipUnpressed = await shotOf(p, tag, '[data-testid=kind-chip-shoulder]', 'b2-kind-proposed-chip');
          o.note = await shotOf(p, tag, '[data-testid=kind-proposal-note]', 'b2-kind-proposal-note');
          o.markGlyph = await contrast(p, { sel: '[data-testid=kind-proposed-mark]', child: '[class*="sym-"]' });
          o.noteGlyph = await contrast(p, { sel: '[data-testid=kind-proposal-note]', child: '[class*="sym-"]' });
          // the words after the glyph keep their line's own ink
          o.markWord = await contrast(p, { sel: '[data-testid=kind-proposed-mark]' });
          o.noteWord = await contrast(p, { sel: '[data-testid=kind-proposal-note]' });
          o.axe.proposalUnpressed = await axe(p);
          await p.locator('[data-testid=kind-chip-shoulder]').click();
          await p.waitForTimeout(1500);
          o.chipPressed = await shotOf(p, tag, '[data-testid=kind-chip-shoulder]', 'b2-kind-proposed-chip-pressed');
          o.kindBlockPressed = await shotOf(p, tag, 'PARENT:[role=group][aria-label="Kind of work"]', 'b2-kind-block-pressed');
          o.pressedChipAriaPressed = await p.locator('[data-testid=kind-chip-shoulder]').getAttribute('aria-pressed');
          o.pressedMarkCount = await p.locator('[data-testid=kind-proposed-mark]').count();
          o.pressedNoteCount = await p.locator('[data-testid=kind-proposal-note]').count();
          o.axe.proposalPressed = await axe(p);
        } else {
          await kind(p, site.kind);
        }
        await confirm(p);
        o.header = await headerText(p);
        o.hours = await shotOf(p, tag, '[data-testid=cell-night]', 'b1-hours');
        o.reduction = await shotOf(p, tag, '[data-testid=cell-reduction]', 'b1-reduction');
        o.markerHours = await markerOf(p, 'night');
        o.markerReduction = await markerOf(p, 'reduction');
        o.allMarkers = await p.$$eval('[data-testid^=info-toggle-]', (es) => es.map((e) => `${e.dataset.testid.replace('info-toggle-', '')}: ${e.textContent.trim()}`));
        o.axe.step2 = await axe(p);
      } else if (name === 'colfax' || name === 'colfaxPin') {
        await kind(p, site.kind);
        await typeLen(p, 800);
        o.worklen = await shotOf(p, tag, '[data-testid=cell-worklen]', 'b3-length-typed-marker-check');
        o.markerWorklen = await markerOf(p, 'worklen');
        o.axe.typedLength = await axe(p);
        await kind(p, 'near_intersection');
        await p.waitForSelector('[data-testid=side-control-not-marked]', { timeout: 60000 }).catch(() => {});
        if (await p.locator('[data-testid=side-control-not-marked]').count()) {
          o.sideNotMarked = await shotOf(p, tag, '[data-testid=side-control-not-marked]', 'b4-side-warn-not-marked');
          o.sideNotMarkedGlyph = await contrast(p, { sel: '[data-testid=side-control-not-marked]', child: '[class*="sym-"]' });
          o.sideNotMarkedLine = await contrast(p, { sel: '[data-testid=side-control-not-marked]' });
          o.axe.sideNotMarked = await axe(p);
        }
        o.sideStaleCount = await p.locator('[data-testid=side-control-stale]').count();
      } else {
        await kind(p, site.kind);
        await typeLen(p, 500); // as #397's and #420's evidence did; only the length is touched
        await confirm(p);
        o.guessMarkers = await guessMarkers(p);
        o.whatHeader = await shotOf(p, tag, '.a-open .a-head', 'c1-what-header-untouched');
        // a guess-tone marker: glyph and word amber
        const gid = await p.$$eval('[data-testid^=info-toggle-]', (es) => (es.find((e) => e.textContent.trim().startsWith('⚠')) || {}).dataset?.testid?.replace('info-toggle-', ''));
        o.guessMarker = gid ? { id: gid, ...(await markerOf(p, gid)) } : null;
        o.lanesMarker = await markerOf(p, 'lanes');
        await openInfo(p, 'lanes');
        o.lanes = await shotOf(p, tag, '[data-testid=cell-lanes]', 'c2-lanes-details', '[data-testid=info-lanes]');
        o.doubtGlyph = await contrast(p, { sel: '[data-testid=info-lanes] *', has: 'not confirmed', child: '[class*="sym-"]' });
        o.doubtLine = await contrast(p, { sel: '[data-testid=info-lanes] *:not(:has(*:not(span)))', has: 'not confirmed' });
        o.axe.untouched = await axe(p);
        // edit the lane count: pick another value
        const sel = p.locator('#what-lanes');
        o.lanesBefore = await sel.inputValue();
        const opts = await sel.locator('option').evaluateAll((os) => os.map((x) => x.value));
        const next = opts.find((v) => v !== o.lanesBefore);
        await sel.selectOption(next);
        await p.waitForTimeout(2500);
        o.lanesAfter = await sel.inputValue();
        o.guessMarkersEdited = await guessMarkers(p);
        o.whatHeaderEdited = await shotOf(p, tag, '.a-open .a-head', 'c3-what-header-lanes-edited');
        o.lanesMarkerEdited = (await p.locator('[data-testid=info-toggle-lanes]').first().textContent()).trim();
        await openInfo(p, 'lanes');
        o.lanesEdited = await shotOf(p, tag, '[data-testid=cell-lanes]', 'c3-lanes-details-edited', '[data-testid=info-lanes]');
        o.axe.edited = await axe(p);
      }
    } catch (e) {
      o.error = String(e).slice(0, 300);
      await p.screenshot({ path: `${OUT}/prod-${tag}-${name}-error.png` }).catch(() => {});
    }
    await ctx.close().catch(() => {});
  }
  await b.close();
  M[tag] = out;
}

// WIDTHS=1440 / SHOT_ONLY=colfax re-run one cell after a live-lookup outage;
// its results replace that cell's in an existing text-prod.json.
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',');
if (WIDTHS.includes('1440')) await run(1440, 900);
if (WIDTHS.includes('390')) await run(390, 844);
const F = `${OUT}/text-prod.json`;
const prev = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};
for (const [w, o] of Object.entries(M)) prev[w] = { ...(prev[w] ?? {}), ...o };
fs.writeFileSync(F, JSON.stringify(prev, null, 1) + '\n');
for (const [w, o] of Object.entries(M)) for (const [n, v] of Object.entries(o)) console.log(w, n, v.error ? 'ERROR ' + v.error : 'ok');
