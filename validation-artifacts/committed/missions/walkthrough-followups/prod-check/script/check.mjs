// Production check of 0de3917 (mission walkthrough-followups, #423).
// usage: node check.mjs <envfile> <outdir> <scratchdir> <flow> <width>
// flows: detect (#405, live road detection timed in the picker), gen (#398 cue,
//   #401 zip/names/quote, #409 audit on the untouched 1,000 ft), north (#401
//   same plan, other side), typed (#409, a typed length), declined (#398
//   windows line), ni (#399 refusal + forward move), neg (#403).
// Live site https://www.conestruct.com/sandbox, Playwright Chromium, DPR 2,
// 1440x900 or 390x844.  Read-only: nothing is saved to an account.  Every
// flow but "detect" stubs /api/road-bearing with one candidate (as the
// items' own shot scripts did), so the flow doesn't wait on Overpass; the
// stub snaps to the request's latitude so a moved pin moves.  The gate
// token is read from the env file into a request header and never printed.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const JSZip = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/package.json')('jszip');
const [envPath, OUT, SCRATCH, FLOW, WIDTH] = process.argv.slice(2);
const TOK = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GATE_BYPASS_TOKEN='))
  .slice('GATE_BYPASS_TOKEN='.length).replace(/^"|"$/g, '');
const BASE = 'https://www.conestruct.com';
const w = Number(WIDTH); const h = w >= 1000 ? 900 : 844;
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const DL = path.join(SCRATCH, `dl-${FLOW}-${w}`);
fs.mkdirSync(DL, { recursive: true });

const COLFAX_S = { search: '1600 E Colfax Ave, Denver', pick: /Colfax/i, side: /South side/i, kind: 'shoulder',
  cand: { way_id: '600545936', highway_class: 'primary', name: 'East Colfax Avenue', bearing: 90, snapped_lat: 39.74003, snapped_lng: -104.96555, tags: { oneway: 'yes', maxspeed: '30 mph', lanes: '3' } } };
const SITES = {
  gen: COLFAX_S,
  typed: COLFAX_S,
  neg: COLFAX_S,
  north: { ...COLFAX_S, side: /North side/i },
  declined: { search: 'Colfax & Williams, Denver', pick: /Colfax/i, side: /North side/i, kind: 'flagger_lane_closure',
    cand: { way_id: '600545937', highway_class: 'primary', name: 'East Colfax Avenue', bearing: 270, snapped_lat: 39.74030, snapped_lng: -104.96555, tags: { oneway: 'yes', maxspeed: '30 mph', lanes: '3' } } },
  ni: { search: 'Wadsworth Blvd & W 10th Ave, Lakewood, CO', pick: /Wadsworth/i, side: null, kind: 'near_intersection', followLat: true,
    cand: { way_id: '427683596', highway_class: 'primary', name: 'Wadsworth Boulevard', bearing: 0, snapped_lat: 39.73296, snapped_lng: -105.08131, tags: { maxspeed: '45 mph', lanes: '4' } } },
};
const DETECT_SEARCHES = ['1600 E Colfax Ave, Denver', 'Colfax & Williams, Denver', 'Wadsworth Blvd & W 10th Ave, Lakewood, CO', '1600 E Colfax Ave, Denver', '1600 E Colfax Ave, Denver'];

function stub(c, lat) {
  return JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver',
    candidates: [{ way_id: c.way_id, highway_class: c.highway_class, name: c.name, ref: null, bearing: c.bearing, snap_distance_m: 0,
      snapped_lat: lat ?? c.snapped_lat, snapped_lng: c.snapped_lng, signal_distance_m: null,
      tags: { lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null, ...c.tags } }] });
}
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
async function shotOf(p, sel, file) {
  await p.locator(sel).first().scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0);
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, text: e.innerText };
  }, sel);
  await p.screenshot({ path: path.join(SHOTS, file), clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, w), height: box.height + 16 } });
  return { text: clean(box.text), width: +box.width.toFixed(2), height: +box.height.toFixed(2), shot: `shots/${file}` };
}
function track(p) {
  const open = new Set();
  p.on('request', (r) => { if (r.url().includes('/api/')) open.add(r); });
  p.on('requestfinished', (r) => open.delete(r));
  p.on('requestfailed', (r) => open.delete(r));
  return () => [...open].map((r) => new URL(r.url()).pathname);
}
async function settle(p, openNow, maxS = 180) { for (let i = 0; i < maxS && openNow().length; i += 1) await p.waitForTimeout(1000); }
async function grab(p, click, timeout = 120000) {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout }), click()]);
  return dl;
}
function pdfText(file) {
  return execFileSync('uv', ['run', '--quiet', 'python', '-I', '-c',
    'import sys,fitz;d=fitz.open(sys.argv[1]);print("\\n".join(pg.get_text() for pg in d))', file],
  { cwd: 'C:/Users/rtmak/Documents/traffic-control-tool', encoding: 'utf8' });
}
function auditFacts(txt) {
  const one = clean(txt);
  const m = one.match(/Work zone length: 1,000 ft\. Defaulted[^]*?on site\./);
  return { hasDefaultedHeading: /Defaulted inputs/.test(txt), hasGuessedAndDefaulted: /Guessed and defaulted inputs/.test(txt),
    defaultedLine: m ? m[0] : null, anyWorkLengthDefault: /Defaulted to the tool's starting length/.test(one) };
}
async function openSearch(p, q) {
  await p.getByLabel('Address or intersection search').fill(q);
  await p.getByRole('button', { name: 'SEARCH' }).click();
}
const doneRe = /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND|UNAVAILABLE/i;
async function locate(p, site) {
  await p.route('**/api/road-bearing**', (r) => {
    let lat = null;
    try { lat = site.followLat ? JSON.parse(r.request().postData()).lat : null; } catch {}
    return r.fulfill({ status: 200, contentType: 'application/json', body: stub(site.cand, lat) });
  });
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await openSearch(p, site.search);
  await p.waitForFunction((src) => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && new RegExp(src, 'i').test(d.innerText); }, doneRe.source, { timeout: 90000 }).catch(() => {});
  await p.getByRole('dialog').getByRole('button', { name: site.pick }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  const side = site.side ? p.locator('[data-testid=side-option]').filter({ hasText: site.side }) : null;
  if (side && await side.count()) await side.first().click(); else await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector(`[data-testid=kind-chip-${site.kind}]`, { timeout: 60000 });
  await p.locator(`[data-testid=kind-chip-${site.kind}]`).click();
}
async function lengthField(p) {
  if (!(await p.locator('#band-worklen').isVisible().catch(() => false))) await p.locator('[data-testid=fact-link-where]').first().click();
  await p.waitForSelector('#band-worklen', { state: 'visible', timeout: 60000 });
  return p.locator('#band-worklen');
}
async function confirmAndGenerate(p, openNow, typed) {
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.getByRole('button', { name: 'One-way', exact: true }).first().click();
  await p.waitForTimeout(4000);
  // The typed length goes in after the carriageway answer: opening WHERE's
  // length field folds the band that holds "One-way".
  if (typed) { const f = await lengthField(p); await f.fill(String(typed)); await p.keyboard.press('Tab'); await p.waitForTimeout(3000); }
  await p.getByRole('button', { name: /Generate plan/ }).first().click();
  await p.waitForSelector('.dl-all', { timeout: 180000 });
  await settle(p, openNow);
  await p.waitForTimeout(10000);
}
async function cards(p, out) {
  if (w < 1000) { const f = p.locator('.dl-files'); if (await f.isVisible().catch(() => false)) { await f.click(); await p.waitForTimeout(500); } }
  out.cardNames = [];
  const n = await p.locator('#dl-cards .dl-btn').count();
  for (let i = 0; i < n; i += 1) {
    const btn = p.locator('#dl-cards .dl-btn').nth(i);
    if (await btn.isDisabled()) { out.cardNames.push('(disabled)'); continue; }
    const d = await grab(p, () => btn.click());
    const name = d.suggestedFilename();
    out.cardNames.push(name);
    await d.saveAs(path.join(DL, name));
    await p.waitForTimeout(1000);
  }
  const audit = out.cardNames.find((x) => x.endsWith('.audit.pdf'));
  if (audit) out.auditCard = auditFacts(pdfText(path.join(DL, audit)));
}

async function flow(p, openNow) {
  const out = {};
  if (FLOW === 'detect') {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(2500);
    out.lookups = [];
    const rb = [];
    p.on('response', async (r) => { if (r.url().includes('/api/road-bearing')) rb.push({ status: r.status(), at: Date.now() }); });
    for (const [i, q] of DETECT_SEARCHES.entries()) {
      const before = rb.length;
      await p.getByLabel('Address or intersection search').fill('');
      const t0 = Date.now();
      await openSearch(p, q);
      // Wait for this search's road-bearing answer, then for the dialog to show its result.
      let ok = true;
      await p.waitForFunction((n) => window.__rbCount === undefined || true, before).catch(() => {});
      for (let s = 0; s < 1200 && rb.length === before; s += 1) await p.waitForTimeout(50);
      if (rb.length === before) ok = false;
      await p.waitForFunction((src) => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && new RegExp(src, 'i').test(d.innerText); }, doneRe.source, { timeout: 30000 }).catch(() => { ok = false; });
      const ms = Date.now() - t0;
      const txt = await p.getByRole('dialog').innerText();
      const roadButtons = await p.getByRole('dialog').getByRole('button', { name: /Avenue|Ave|Boulevard|Blvd|Street|St\b|Road|Drive/i }).count();
      out.lookups.push({ search: q, ms, ok, roadBearingStatus: rb[rb.length - 1]?.status ?? null, candidateButtons: roadButtons,
        unavailable: /Detection service unavailable/i.test(txt), result: clean(txt.match(/[^\n]*(DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND|UNAVAILABLE)[^\n]*/i)?.[0]) });
      if (i === 0) out.firstResult = await shotOf(p, '[role=dialog]', `detect-${w}-first.png`).catch(() => null);
      await p.waitForTimeout(3000);
    }
    const s = out.lookups.map((l) => l.ms).sort((a, b) => a - b);
    out.medianMs = s[Math.floor(s.length / 2)];
    return out;
  }
  const site = SITES[FLOW];
  await locate(p, site);
  if (FLOW === 'neg') {
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
    await p.waitForTimeout(3000);
    const f = await lengthField(p);
    const read = async (tag) => {
      await p.waitForTimeout(2500);
      const cell = await shotOf(p, '.a-col:has(#band-worklen)', `neg-${w}-${tag}-cell.png`);
      const gen = await shotOf(p, '[data-testid=generate-frame]', `neg-${w}-${tag}-generate.png`).catch(() => null);
      return { fieldValue: await f.inputValue(), marker: clean(await p.getByTestId('info-toggle-worklen').innerText()),
        provenance: clean(await p.getByTestId('prov-worklen').textContent().catch(() => null)), cellText: cell.text, cell,
        ctaReason: clean(await p.locator('[data-testid=cta-reason]').first().textContent().catch(() => null)),
        generateEnabled: await p.getByRole('button', { name: /Generate plan/ }).first().isEnabled().catch(() => null), generate: gen };
    };
    await f.fill('-5'); await p.keyboard.press('Tab'); out.minus5 = await read('minus5');
    await f.fill(''); await p.keyboard.press('Tab'); out.cleared = await read('cleared');
    await f.fill('99999'); await p.keyboard.press('Tab'); out.over = await read('99999');
    return out;
  }
  if (FLOW === 'declined') {
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForFunction(() => /PLAN DECLINED/i.test(document.body.innerText), null, { timeout: 120000 });
    await settle(p, openNow, 60);
    await p.waitForTimeout(5000);
    out.windowsLine = await shotOf(p, '[data-testid=what-windows-line]', `declined-${w}-windows-line.png`);
    return out;
  }
  if (FLOW === 'ni') {
    const f = p.locator('#band-worklen');
    await f.fill('500'); await f.press('Enter'); await p.waitForTimeout(800);
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForTimeout(3000);
    await p.getByRole('button', { name: /Mark on map/i }).first().click();
    await p.waitForSelector('[role=dialog] canvas.mapboxgl-canvas', { timeout: 90000 });
    await p.waitForSelector('[role=dialog] .mapboxgl-marker', { timeout: 90000 });
    await p.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(4000);
    await p.addStyleTag({ content: '.mapboxgl-marker{pointer-events:none !important}' });
    await p.locator('[role=dialog] .mapboxgl-marker').first().scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    const pin = await p.evaluate(() => { const r = document.querySelector('[role=dialog] .mapboxgl-marker').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    out.pinCentre = pin;
    out.markClick = { x: pin.x, y: pin.y - 6 };
    await p.mouse.click(out.markClick.x, out.markClick.y);
    await p.waitForFunction(() => /two-way|one-way|signal|no cross/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(1500);
    out.pickerLine = clean((await p.getByRole('dialog').innerText()).match(/West 10th[^\n]*/i)?.[0]);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForTimeout(2000);
    const lc = p.getByText('Lane count is right').first();
    if (await lc.count()) { await lc.click(); await p.waitForTimeout(500); }
    const sp = p.locator('select#ni-cross-speed');
    if (await sp.count()) { await sp.selectOption({ index: 1 }).catch(() => {}); await p.waitForTimeout(1500); }
    const gen = p.getByRole('button', { name: 'Generate plan' });
    if (await gen.isEnabled().catch(() => false)) await gen.click();
    await p.waitForSelector('.status-bar.fail', { timeout: 120000 });
    await p.waitForTimeout(1500);
    out.banner = await shotOf(p, '.status-bar.fail', `ni-${w}-declined-banner.png`);
    const fwd = out.banner.text.match(/more than (\d+) ft with traffic/i);
    out.forwardFt = fwd ? Number(fwd[1]) : null;
    if (!out.forwardFt) return out;
    // Follow the forward move: open the picker and click the map ahead of
    // the pin, with traffic (north on this northbound plan, as the mark was).
    // Map scale at the picker's PIN_ZOOM 16 (LocationPickerModal.tsx:175),
    // 512 px tiles: 40075016.686 * cos(lat) / (512 * 2^16) m per CSS px.
    const moveFt = out.forwardFt + 15;
    const mPerPx = 40075016.686 * Math.cos(39.733 * Math.PI / 180) / (512 * 65536);
    out.moveFt = moveFt;
    const open = p.locator('[data-testid=where-open-picker]');
    if (!(await open.isVisible().catch(() => false))) await p.locator('[data-testid=fact-link-where]').first().click().catch(() => {});
    await p.locator('[data-testid=where-open-picker]').first().click();
    await p.waitForSelector('[role=dialog] canvas.mapboxgl-canvas', { timeout: 90000 });
    await p.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(4000);
    out.zoom = await p.evaluate(() => null);
    const pin2 = await p.evaluate(() => { const r = document.querySelector('[role=dialog] .mapboxgl-marker').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const dy = Math.round(moveFt * 0.3048 / mPerPx);
    out.moveClick = { x: pin2.x, y: pin2.y - dy, dyPx: dy };
    await p.mouse.click(out.moveClick.x, out.moveClick.y);
    await p.waitForTimeout(4000);
    await p.screenshot({ path: path.join(SHOTS, `ni-${w}-move-picker.png`) });
    out.pickerAfterMove = clean(await p.getByRole('dialog').innerText()).slice(0, 600);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForTimeout(3000);
    out.ctaAfterMove = clean(await p.locator('[data-testid=cta-reason]').first().textContent().catch(() => null));
    // A moved pin asks the side again (as a new pin does); answer it as before.
    const so = p.locator('[data-testid=side-option]');
    if (await so.first().isVisible().catch(() => false)) { await so.first().click(); await p.waitForTimeout(1500); out.sideReanswered = true; }
    const kc = p.locator(`[data-testid=kind-chip-${site.kind}]`);
    if (await kc.isVisible().catch(() => false)) { await kc.click(); await p.waitForTimeout(800); }
    const cf = p.getByRole('button', { name: /^Confirm/ });
    if (await cf.isVisible().catch(() => false)) { await cf.click(); await p.waitForTimeout(3000); }
    const lc2 = p.getByText('Lane count is right').first();
    if (await lc2.isVisible().catch(() => false)) { await lc2.click(); await p.waitForTimeout(500); }
    const sp2 = p.locator('select#ni-cross-speed');
    if (await sp2.isVisible().catch(() => false)) { const v = await sp2.inputValue(); if (!v) { await sp2.selectOption({ index: 1 }).catch(() => {}); await p.waitForTimeout(1500); } }
    out.ctaBeforeGenerate = clean(await p.locator('[data-testid=cta-reason]').first().textContent().catch(() => null));
    await p.screenshot({ path: path.join(SHOTS, `ni-${w}-after-move-page.png`), fullPage: true });
    const gen2 = p.getByRole('button', { name: 'Generate plan' });
    out.generateEnabledAfterMove = await gen2.isEnabled().catch(() => null);
    if (out.generateEnabledAfterMove) await gen2.click();
    const res = await Promise.race([
      p.waitForSelector('.dl-all', { timeout: 60000 }).then(() => "generated"),
      p.waitForSelector('.status-bar.fail', { timeout: 60000 }).then(() => "declined"),
    ]).catch((e) => `timeout: ${String(e).slice(0, 80)}`);
    out.afterMove = res;
    await p.waitForTimeout(2000);
    if (res === 'declined') out.afterMoveBanner = await shotOf(p, '.status-bar.fail', `ni-${w}-after-move-banner.png`);
    else if (res === 'generated') out.afterMoveStatus = await shotOf(p, '.status-bar', `ni-${w}-after-move-status.png`).catch(() => null);
    return out;
  }
  // gen / north / typed
  await confirmAndGenerate(p, openNow, FLOW === 'typed' ? 1200 : null);
  if (FLOW === 'gen') {
    out.openRequests = openNow();
    out.cue = await p.locator('.tier-cue').first().innerText().then(clean).catch(() => '(no .tier-cue element)');
    out.cueShot = await shotOf(p, '.tier-cue', `gen-${w}-cue-slot.png`).catch(() => null);
    await p.evaluate(() => { document.querySelector('.tier-cue')?.parentElement?.setAttribute('data-shot', 'cue-block'); });
    out.tierStack = await shotOf(p, '[data-shot=cue-block]', `gen-${w}-tier-stack.png`).catch(() => null);
    out.jurisdictionText = clean(await p.evaluate(() => [...document.querySelectorAll('[data-testid]')].find((e) => /jurisdiction/i.test(e.getAttribute('data-testid')) && e.getBoundingClientRect().width > 0)?.innerText ?? null));
    out.refreshingVisible = /refreshing/i.test(await p.locator('body').innerText());
    out.zipRow = await shotOf(p, '.dl-all', `gen-${w}-zip-row.png`);
    if (w < 1000) out.filesLine = await shotOf(p, '.dl-files', `gen-${w}-files-line.png`).catch(() => null);
    const t0 = Date.now();
    let bundleStatus = null;
    p.on('response', (r) => { if (r.url().includes('/api/render/bundle')) bundleStatus = r.status(); });
    const zdl = await grab(p, () => p.locator('.dl-all button').click(), 90000);
    out.zipMs = Date.now() - t0;
    out.bundleStatus = bundleStatus;
    out.zipName = zdl.suggestedFilename();
    const zpath = path.join(DL, out.zipName);
    await zdl.saveAs(zpath);
    const z = await JSZip.loadAsync(fs.readFileSync(zpath));
    out.zipEntries = Object.keys(z.files);
    const ap = path.join(DL, 'zip-audit_trail.pdf');
    const ae = out.zipEntries.find((x) => /audit/.test(x) && x.endsWith('.pdf'));
    if (ae) { fs.writeFileSync(ap, await z.file(ae).async('nodebuffer')); out.auditZip = auditFacts(pdfText(ap)); }
    await p.waitForTimeout(1500);
    await cards(p, out);
    const qb = p.getByRole('button', { name: /Download Quote \(XLSX\)/ });
    if (!(await qb.count())) { const pc = p.getByText(/Pricing|Quote/).first(); await pc.click().catch(() => {}); await p.waitForTimeout(1000); }
    if (await qb.count()) {
      await qb.first().scrollIntoViewIfNeeded();
      const qd = await grab(p, () => qb.first().click());
      out.quoteName = qd.suggestedFilename();
    } else out.quoteName = '(no Download Quote button found)';
  } else {
    await cards(p, out);
  }
  return out;
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
const p = await ctx.newPage();
const openNow = track(p);
let out;
const started = new Date().toISOString();
try { out = await flow(p, openNow); } catch (e) {
  out = { error: String(e).slice(0, 400) };
  await p.screenshot({ path: path.join(SHOTS, `${FLOW}-${w}-error.png`) }).catch(() => {});
}
out = { flow: FLOW, width: w, started, ...out };
await ctx.close();
await b.close();
fs.writeFileSync(path.join(OUT, `${FLOW}-${w}.json`), JSON.stringify(out, null, 1));
console.log(FLOW, w, JSON.stringify(out).slice(0, 1500));
