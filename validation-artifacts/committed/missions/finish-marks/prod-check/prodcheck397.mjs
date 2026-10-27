// #397 production check (mission finish-marks, #417).
// PROD CHECK copy of ../../form-marks/397/script/shoot.mjs: drives the LIVE
// https://www.conestruct.com/sandbox with the real road lookup (no stub, no
// injected DOM). usage: node prodcheck397.mjs <outdir>
// The gate token is read from conestruct/site/.env.local at run time and sent
// as x-conestruct-gate; it is never printed or written.
// Playwright Chromium, DPR 2, 1440x900 and 390x844.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [OUT] = process.argv.slice(2);
const ENV = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/.env.local', 'utf8');
const TOK = ((ENV.match(/^GATE_BYPASS_TOKEN=(.*)$/m) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
if (!TOK) { console.log('no token'); process.exit(2); }
const BASE = 'https://www.conestruct.com';
const ONLY = (process.env.SHOT_ONLY ?? '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const SITES = {
  // Shoulder plan on E Colfax: untouched length and work type, then a typed length.
  colfax: { search: '1600 E Colfax Ave, Denver', pick: /Colfax/i, kind: 'shoulder' },
  // Near-intersection plan on Wadsworth at W 10th (#397's own reference).
  wadsworth: { search: 'Wadsworth Blvd & W 10th Ave, Lakewood, CO', pick: /Wadsworth/i, kind: 'near_intersection' },
  // No road within 30 m: a typed pin in the middle of Sloan's Lake, Denver.
  none: { coords: '39.7495, -105.0475', pick: null, kind: 'shoulder' },
};

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }

async function shotOf(p, tag, sel, file, extraSel) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate(([s, x]) => {
    const els = [document.querySelector(s), x ? document.querySelector(x) : null].filter(Boolean);
    const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
    const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
    const r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
    return { x: l, y: t, width: r - l, height: b - t, text: els.map(e => e.innerText).join(' | ') };
  }, [sel, extraSel ?? null]);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/prod-${tag}-${file}.png`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, vw), height: box.height + 16 } });
  return box.text.replace(/\s+/g, ' ').trim();
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
  await p.waitForTimeout(1000);
  const dialogText = (await p.getByRole('dialog').innerText()).replace(/\s+/g, ' ');
  if (site.pick) await p.getByRole('dialog').getByRole('button', { name: site.pick }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=cell-worklen]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  return /No road detected/i.test(dialogText) ? 'No road detected' : (dialogText.match(/[^.]*DETECTED[^.]*/i) || [''])[0].slice(0, 120);
}

async function sideAndKind(p, site) {
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector(`[data-testid=kind-chip-${site.kind}]`, { timeout: 60000 });
  await p.locator(`[data-testid=kind-chip-${site.kind}]`).click();
  await p.waitForTimeout(800);
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
// Opens every row's details, then returns the page text (to scan for
// "✓ yours" / "operator-set" on untouched values), optionally minus one cell.
async function pageText(p, exceptSel) {
  const toggles = p.locator('[data-testid^=info-toggle-]');
  const n = await toggles.count();
  for (let i = 0; i < n; i++) {
    const t = toggles.nth(i);
    if ((await t.getAttribute('aria-expanded')) === 'false') { await t.click().catch(() => {}); await p.waitForTimeout(150); }
  }
  return p.evaluate((x) => {
    const root = document.querySelector('main') || document.body;
    const c = root.cloneNode(true);
    if (x) c.querySelectorAll(x).forEach((e) => e.remove());
    document.body.appendChild(c); c.style.position = 'absolute'; c.style.left = '-99999px';
    const s = c.innerText; c.remove();
    return s.replace(/\s+/g, ' ');
  }, exceptSel ?? null);
}
const ctxOf = (s, re) => [...s.matchAll(re)].map((m) => s.slice(Math.max(0, m.index - 160), m.index + 60));
const claims = (s) => ({ yours: (s.match(/✓ yours/g) || []).length, operatorSet: (s.match(/operator-set/g) || []).length, typed: (s.match(/· typed/g) || []).length,
  where: [...ctxOf(s, /✓ yours/g), ...ctxOf(s, /operator-set/g), ...ctxOf(s, /· typed/g)] });
const guessMarkers = (p) => p.$$eval('[data-testid^=info-toggle-]', (es) => es.map((e) => e.textContent).filter((t) => t.startsWith('⚠')));

const M = {};
async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const out = {};
  for (const [name, site] of Object.entries(SITES)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
    const p = await ctx.newPage();
    const o = (out[name] = {});
    try {
      o.picker = await locate(p, site);
      if (name === 'colfax') {
        await sideAndKind(p, site);
        o.ledgerUntouched = await shotOf(p, tag, '[data-testid=move-ledger]', 'a1-ledger-untouched');
        o.worklenUntouched = await shotOf(p, tag, '[data-testid=cell-worklen]', 'a1-length-untouched');
        o.step1ClaimsUntouched = claims(await pageText(p));
        await typeLen(p, 800);
        o.ledgerTyped = await shotOf(p, tag, '[data-testid=move-ledger]', 'a1-ledger-typed');
        o.worklenTyped = await shotOf(p, tag, '[data-testid=cell-worklen]', 'a1-length-typed');
        // Work type on a fresh, untouched plan (a second session, no length typed).
        await ctx.close();
        const ctx2 = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
        const p2 = await ctx2.newPage();
        await locate(p2, site);
        await sideAndKind(p2, site);
        await confirm(p2);
        o.workType = await shotOf(p2, tag, '[data-testid=cell-work-type]', 'a2-work-type-untouched');
        o.step2Header = await shotOf(p2, tag, '.a-open .a-head', 'a5-colfax-what-header');
        o.step2ClaimsUntouched = claims(await pageText(p2));
        await ctx2.close();
        continue;
      } else if (name === 'wadsworth') {
        await sideAndKind(p, site);
        await typeLen(p, 500); // as #397's evidence did; only the length is touched
        await confirm(p);
        o.guessMarkers = await guessMarkers(p);
        o.whatHeader = await shotOf(p, tag, '.a-open .a-head', 'a3-what-header-near-intersection');
        const lt = p.locator('[data-testid=info-toggle-lanes]');
        o.lanesMarker = (await lt.textContent()).trim();
        if ((await lt.getAttribute('aria-expanded')) !== 'true') await lt.click();
        await p.waitForTimeout(400);
        o.lanes = await shotOf(p, tag, '[data-testid=cell-lanes]', 'a3-lanes-near-intersection', '[data-testid=info-lanes]');
        o.claimsExceptLength = claims(await pageText(p, '[data-testid=cell-worklen]'));
      } else {
        await sideAndKind(p, site);
        await confirm(p);
        // As #397: the pin's jurisdiction guess is the one ⚠ here; the
        // operator re-selects its value so the header can show its
        // nothing-guessed line.
        o.guessMarkersBefore = await guessMarkers(p);
        o.headerBefore = await shotOf(p, tag, '.a-open .a-head', 'a4-what-header-no-detection-before-confirm');
        const j = p.locator('#what-jurisdiction');
        const jv = await j.inputValue().catch(() => '');
        if (jv) { await j.selectOption(jv); await p.waitForTimeout(1500); }
        o.guessMarkers = await guessMarkers(p);
        o.whatHeader = await shotOf(p, tag, '.a-open .a-head', 'a4-what-header-no-detection');
        const lt = p.locator('[data-testid=info-toggle-lanes]');
        o.lanesMarker = (await lt.textContent()).trim();
        if ((await lt.getAttribute('aria-expanded')) !== 'true') await lt.click();
        await p.waitForTimeout(400);
        o.lanes = await shotOf(p, tag, '[data-testid=cell-lanes]', 'a4-lanes-no-detection', '[data-testid=info-lanes]');
        o.claimsUntouched = claims(await pageText(p));
      }
    } catch (e) {
      o.error = String(e).slice(0, 300);
      await p.screenshot({ path: `${OUT}/prod-${tag}-${name}-error.png` }).catch(() => {});
    }
    await ctx.close().catch(() => {});
  }
  await b.close();
  M[tag] = out;
  console.log(tag, JSON.stringify(out, null, 1));
}

await run(1440, 900);
await run(390, 844);
fs.writeFileSync(`${OUT}/text-prod.json`, JSON.stringify(M, null, 1));
