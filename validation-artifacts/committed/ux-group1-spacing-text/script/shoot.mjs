// #435 (UX group 1) before/after evidence for the tool page's spacing and
// text rules.
// usage: node shoot.mjs <before|after> <outdir> <port>
// Local `next dev`: a git archive of d1c415f for "before", the ux-group1
// worktree for "after"; API calls go to the .env.local backend (no backend
// change on this branch).  Playwright Chromium at DPR 2, 1440x900 and
// 390x844.  /api/road-bearing is stubbed with three roads (the Option C
// artboard's), as earlier missions did.  The dev server runs with a
// local-only GATE_BYPASS_TOKEN (SHOT_TOKEN here); no real token is read
// or printed.
// Legs: (1) landing: gaps between strip / bands / footer line, band and
// header padding, every in-scope text node under 12.5 px that is not a
// short mono label, in-scope targets under 44 px, contrast per pair, axe;
// (2) the picker unpicked, its i details, then picked; (3) after a
// Generate: the three disclosure headers and the opened Checked body.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/ux-group1/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [phase, OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const NOTAGS = { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null };
const cand = (way, cls, name, bearing, d) => ({ way_id: way, highway_class: cls, name, ref: null, bearing, snap_distance_m: d,
  snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null, tags: { ...NOTAGS, oneway: 'yes', maxspeed: '30 mph', lanes: '2' } });
const THREE = JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: [
  cand('1547338992', 'primary', 'East Colfax Avenue', 271, 1.2),
  cand('628643782', 'primary', 'East Colfax Avenue', 91, 6.1),
  cand('596451653', 'residential', 'Pennsylvania Street', 359, 24.3),
] });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

// Shoot the union of the visible elements matching the selectors, padded 8.
async function shotOf(p, sels, file) {
  // Inside the picker the row can sit below the dialog's own scroll fold.
  await p.locator(sels[0]).first().scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(200);
  const box = await p.evaluate((ss) => {
    const vis = (q) => [...document.querySelectorAll(q)].filter((x) => x.getBoundingClientRect().width > 0);
    const rs = ss.flatMap(vis).map((x) => x.getBoundingClientRect());
    if (!rs.length) return null;
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    const rr = Math.max(...rs.map((r) => r.right)), bb = Math.max(...rs.map((r) => r.bottom));
    return { x: l, y: t + window.scrollY, width: rr - l, height: bb - t };
  }, sels);
  if (!box) return null;
  await park(p);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${file}`, fullPage: true, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, vw), height: box.height + 16 } });
  return { width: +box.width.toFixed(2), height: +box.height.toFixed(2) };
}

// Everything measured in the page: gaps, padding, small text, targets,
// contrast.  `scope` is the list of in-scope roots.
async function measure(p, scope, targetSel) {
  return p.evaluate(([scope, targetSel]) => {
    const R = (e) => e.getBoundingClientRect();
    const cs = (e) => getComputedStyle(e);
    const vis = (e) => e && R(e).width > 0 && R(e).height > 0;
    const out = {};
    // Gaps down the column: strip, each band, the footer line.
    const seq = [document.querySelector('.status-slot'), ...document.querySelectorAll('.band-stack > *'), document.querySelector('.draft-notice')].filter(vis);
    out.gaps = seq.slice(1).map((e, i) => ({ from: seq[i].className.split(' ')[0] || seq[i].tagName, to: e.className.split(' ')[0] || e.tagName,
      px: +(R(e).top - R(seq[i]).bottom).toFixed(2) }));
    const pad = (q) => { const e = [...document.querySelectorAll(q)].find(vis); if (!e) return null; const s = cs(e); return `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`; };
    out.padding = { head: pad('.a-open .a-head'), body: pad('.a-open .a-body'), genframe: pad('.a-genframe'), fact: pad('.a-fact'), strip: pad('.status-bar'),
      discHead: pad('.disc-head'), discPanel: pad('.disc-panel'), pickHead: pad('.road-pick-head'), picked: pad('.road-picked') };
    // Small text: a text node under 12.5 px that is not a short mono caps
    // label (four words or fewer).
    const roots = scope.flatMap((q) => [...document.querySelectorAll(q)]).filter(vis);
    const small = [];
    for (const root of roots) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.textContent.replace(/\s+/g, ' ').trim();
        const el = n.parentElement;
        if (!t || !vis(el) || el.closest('[hidden],[aria-hidden="true"]') && !/^[✓⚠◌i▲×]$/.test(t)) continue;
        const s = cs(el);
        const size = parseFloat(s.fontSize);
        const mono = /mono/i.test(s.fontFamily);
        const shortLabel = mono && t.split(' ').filter((x) => /\w/.test(x)).length <= 4;
        const glyph = /^[✓⚠◌i▲×›]$/.test(t);
        if (size < 12.5 && !shortLabel && !glyph) small.push({ text: t.slice(0, 80), size, family: s.fontFamily.split(',')[0] });
      }
    }
    out.smallText = small;
    // Targets.
    out.targets = [...document.querySelectorAll(targetSel)].filter(vis).map((e) => ({
      name: (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 50),
      w: +R(e).width.toFixed(2), h: +R(e).height.toFixed(2) }));
    // Contrast per pair: text ink against the nearest painted ground.
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ground = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(cs(x).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c; } return [20, 32, 46]; };
    const ratio = (e, prop = 'color') => { const a = lum(rgb(cs(e)[prop])), b = lum(ground(e.parentElement || e)); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); };
    const pairs = { strip: '.status-bar span:last-child', help: '.a-question-prov', factNote: '[data-testid=fact-what] .a-fact-prov', reason: '[data-testid=cta-reason]', footer: '.draft-notice',
      pickTitle: '.road-pick-head .tr-step', pickName: '.road-pick-row .road-pick-name', pickSub: '.road-pick-sub', pickedLabel: '.road-picked .tr-step', change: '.road-pick-change', discCount: '.disc-count', discProv: '.disc-prov' };
    out.contrast = {};
    for (const [k, q] of Object.entries(pairs)) { const e = [...document.querySelectorAll(q)].find(vis); if (e) out.contrast[k] = { ratio: ratio(e), ink: cs(e).color, size: cs(e).fontSize, family: cs(e).fontFamily.split(',')[0] }; }
    const mark = [...document.querySelectorAll('.road-pick-row:not(.is-picked) .road-pick-mark')].find(vis);
    if (mark) out.contrast.markOutline = { ratio: ratio(mark, 'borderTopColor'), ink: cs(mark).borderTopColor, note: 'non-text, 3:1 floor' };
    return out;
  }, [scope, targetSel]);
}

async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(' ') }));
  });
}

const SCOPE = ['.status-slot', '.band-stack', '.draft-notice'];
const TARGETS = '.band-stack input, .band-stack button, .a-findrow .a-pri';
const PICK_SCOPE = ['[role=dialog] .road-pick-panel', '[role=dialog] .road-picked'];
const PICK_TARGETS = '.road-pick-row, .road-pick-change, .road-pick-head .a-info-toggle, .road-picked .a-info-toggle';

async function pickerLeg(p, out, tag) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => /PICK THE ROAD|Which road/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
  await p.waitForTimeout(800);
  const panelSel = phase === 'after' ? ['[data-testid=road-pick-panel]'] : ['[role=dialog] [class*="--warn-soft"]'];
  await p.locator(panelSel[0]).first().scrollIntoViewIfNeeded();
  out.pickerUnpicked = await shotOf(p, panelSel, `${phase}-${tag}-picker-unpicked.png`);
  out.pickerText = (await p.locator(panelSel[0]).first().innerText()).replace(/\s+/g, ' ').trim();
  out.pickerMeasure = await measure(p, phase === 'after' ? PICK_SCOPE : ['[role=dialog] [class*="--warn-soft"]'], phase === 'after' ? PICK_TARGETS : '[role=dialog] [class*="--warn-soft"] button');
  out.pickerAxe = await axe(p);
  if (phase === 'after') {
    await p.getByTestId('info-toggle-road-pick').click();
    await p.waitForTimeout(400);
    out.pickerDetails = await shotOf(p, ['[data-testid=road-pick-panel]', '[data-testid=info-road-pick]'], `${phase}-${tag}-picker-details.png`);
    out.pickerDetailsText = (await p.getByTestId('info-road-pick').innerText()).replace(/\s+/g, ' ').trim();
    await p.keyboard.press('Escape');
    out.dialogOpenAfterEscape = await p.locator('[role=dialog]').isVisible();
  }
  await p.getByRole('dialog').locator('button', { hasText: /westbound/i }).first().click();
  await p.waitForTimeout(2000);
  const pickedSel = phase === 'after' ? ['[data-testid=road-picked]'] : ['[role=dialog] div.py-2:has(> div.flex > button.tap-44)'];
  // An element shot: the row sits in the fixed dialog, past a page clip.
  const pickedLoc = p.locator(pickedSel[0]).first();
  await pickedLoc.scrollIntoViewIfNeeded();
  await park(p);
  await pickedLoc.screenshot({ path: `${OUT}/${phase}-${tag}-picker-picked.png` });
  const pb = await pickedLoc.boundingBox();
  out.picked = pb && { width: +pb.width.toFixed(2), height: +pb.height.toFixed(2) };
  out.pickedText = (await p.locator(pickedSel[0]).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  if (phase === 'after') out.pickedMeasure = await measure(p, PICK_SCOPE, PICK_TARGETS);
  await p.getByRole('button', { name: 'Save & Close' }).click();
}

async function discLeg(p, out, tag) {
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  const side = p.locator('[data-testid=side-option]').filter({ hasText: /North side|Right/i });
  if (await side.count()) await side.first().click(); else await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector('[data-testid=kind-chip-shoulder]', { timeout: 60000 });
  await p.locator('[data-testid=kind-chip-shoulder]').click();
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
  // The stubbed road leaves the carriageway to the operator ("the map
  // couldn't tell"); answer it as the tags say: one-way.
  const oneWay = p.getByRole('button', { name: /^One-way$/ });
  if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(4000); }
  const gen = p.getByRole('button', { name: 'Generate plan' });
  await gen.waitFor({ state: 'visible' });
  await p.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Generate plan'); return b && !b.disabled; }, null, { timeout: 90000 });
  await gen.click();
  await p.waitForSelector('.results-disc .disc', { timeout: 180000 });
  await p.waitForTimeout(3000);
  await p.locator('.results-disc').scrollIntoViewIfNeeded();
  out.discHeads = await p.evaluate(() => [...document.querySelectorAll('.results-disc .disc')].map((d) => d.querySelector('.disc-head').innerText.replace(/\s+/g, ' ').trim()));
  out.discClosed = await shotOf(p, ['.results-disc'], `${phase}-${tag}-disclosures-closed.png`);
  await p.locator('.disc-head', { hasText: 'Checked & passed' }).click();
  await p.waitForTimeout(800);
  out.checkedOpen = await shotOf(p, ['.results-disc .disc.is-open'], `${phase}-${tag}-checked-open.png`);
  await p.locator('.disc-head', { hasText: 'Checked & passed' }).click();
  await p.locator('.disc-head', { hasText: 'Reference' }).click();
  await p.waitForTimeout(800);
  out.referenceOpenTop = await p.evaluate(() => { const panel = document.querySelector('.disc.is-open .disc-panel'); if (!panel) return null; const first = panel.firstElementChild; return { panelPadTop: getComputedStyle(panel).paddingTop, firstChildOffset: first ? +(first.getBoundingClientRect().top - panel.getBoundingClientRect().top).toFixed(2) : null }; });
  out.referenceOpen = await shotOf(p, ['.results-disc .disc.is-open .disc-head'], `${phase}-${tag}-reference-head.png`);
  out.discMeasure = await measure(p, ['.results-disc .disc-head'], '.results-disc .disc-head');
  out.discAxe = await axe(p);
  out.footerGap = await p.evaluate(() => { const d = document.querySelector('.draft-notice'); const prev = document.querySelector('.results-disc'); return d && prev ? +(d.getBoundingClientRect().top - prev.getBoundingClientRect().bottom).toFixed(2) : null; });
}

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const out = {};
  try {
    await p.route('**/api/road-bearing**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: THREE }));
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.waitForTimeout(1500);
    out.landing = await shotOf(p, SCOPE, `${phase}-${tag}-landing.png`);
    out.landingMeasure = await measure(p, SCOPE, TARGETS);
    out.landingAxe = await axe(p);
    await pickerLeg(p, out, tag);
    await discLeg(p, out, tag);
  } catch (e) {
    out.error = String(e).slice(0, 400);
    await p.screenshot({ path: `${OUT}/${phase}-${tag}-error.png` }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  console.log(phase, tag, out.error ?? 'ok');
  return out;
}

const M = {};
M['1440'] = await run(1440, 900);
M['390'] = await run(390, 844);
fs.writeFileSync(`${OUT}/text-${phase}.json`, JSON.stringify(M, null, 1));
