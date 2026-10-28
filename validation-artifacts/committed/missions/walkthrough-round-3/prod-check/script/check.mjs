// Production check of 372f710 (mission walkthrough-round-3, #431).
// usage: node check.mjs <envfile> <outdir> <scratchdir> <flow> <width>
// flows:
//   declined  #402 (Enter in the WHERE address field on a pinless plan opens
//             the picker and searches the typed text; the Which-road head
//             and picked line after a pick) then #425/#406 (Colfax & Williams,
//             Colfax westbound, North side, flagger lane closure, PLAN
//             DECLINED, the Jurisdiction cell).
//   gen       #426 (the working band while the zip renders, zip time) then
//             #430 (reopen the picker, move the pin ~27 ft east, the
//             Corridor extent panel and every corridor-geometry answer).
//   zero      #428 (type 0 in the work-zone length, then clear the box).
// Live site https://www.conestruct.com/sandbox, Playwright Chromium, DPR 2,
// 1440x900 or 390x844.  Nothing is stubbed: road detection, geocode, audit,
// renders and bundle are live.  Read-only: nothing is saved to an account.
// The gate token is read from the env file into a request header and never
// printed.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [envPath, OUT, SCRATCH, FLOW, WIDTH] = process.argv.slice(2);
const TOK = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GATE_BYPASS_TOKEN='))
  .slice('GATE_BYPASS_TOKEN='.length).replace(/^"|"$/g, '');
const BASE = 'https://www.conestruct.com';
const w = Number(WIDTH); const h = w >= 1000 ? 900 : 844;
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const DL = path.join(SCRATCH, `dl-${FLOW}-${w}`);
fs.mkdirSync(DL, { recursive: true });
const ADDRESS = 'E Colfax Ave & N Williams St, Denver, CO';

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
  await p.screenshot({ path: path.join(SHOTS, file), clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, w), height: Math.min(box.height + 16, h) } });
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
const doneRe = /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND|UNAVAILABLE/i;
async function waitDetect(p) {
  await p.waitForFunction((src) => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && new RegExp(src, 'i').test(d.innerText); }, doneRe.source, { timeout: 90000 });
}

// The Which-road card (#402's own reader): the head whose words end in
// "detected", its frame, and the picked road line.
async function card(p, file) {
  const box = await p.evaluate(() => {
    const head = [...document.querySelectorAll('[role=dialog] div')].find((d) =>
      /^(⚠|✓)\s*(Which road\?|Road picked) · \d+ detected$/i.test(d.textContent.trim()) && d.children.length <= 1);
    if (!head) return null;
    const frame = head.parentElement;
    frame.scrollIntoView({ block: 'center' });
    const r = frame.getBoundingClientRect();
    const line = frame.querySelector('span.min-w-0');
    const lr = line ? line.getBoundingClientRect() : null;
    const lh = line ? parseFloat(getComputedStyle(line).lineHeight) : null;
    const cs = getComputedStyle(frame);
    return { x: r.left, y: r.top, width: r.width, height: r.height, head: head.innerText,
      headColor: getComputedStyle(head).color, glyph: head.querySelector('span')?.textContent ?? null,
      glyphColor: head.querySelector('span') ? getComputedStyle(head.querySelector('span')).color : null,
      frameBorder: cs.borderTopColor, frameBg: cs.backgroundColor,
      line: line ? line.textContent : null, lineRendered: line ? line.innerText : null,
      lineClass: line ? line.className : null,
      lineBox: lr ? { width: +lr.width.toFixed(2), height: +lr.height.toFixed(2) } : null,
      lineScroll: line ? { scrollWidth: line.scrollWidth, clientWidth: line.clientWidth, scrollHeight: line.scrollHeight, clientHeight: line.clientHeight } : null,
      lineLines: lr && lh ? Math.round(lr.height / lh) : null,
      lineClipped: line ? (line.scrollWidth > line.clientWidth || line.scrollHeight > line.clientHeight) : null,
      text: frame.innerText };
  });
  if (!box) return { error: 'no Which-road card' };
  await park(p);
  const r2 = await p.evaluate(() => {
    const head = [...document.querySelectorAll('[role=dialog] div')].find((d) =>
      /^(⚠|✓)\s*(Which road\?|Road picked) · \d+ detected$/i.test(d.textContent.trim()) && d.children.length <= 1);
    const r = head.parentElement.getBoundingClientRect(); return { x: r.left, y: r.top };
  });
  await p.screenshot({ path: path.join(SHOTS, file), clip: { x: Math.max(0, r2.x - 8), y: Math.max(0, r2.y - 8), width: Math.min(box.width + 16, w), height: box.height + 16 } });
  const { x, y, ...rest } = box;
  return { ...rest, width: +box.width.toFixed(2), height: +box.height.toFixed(2), text: clean(box.text), shot: `shots/${file}` };
}

async function readJurisdiction(p) {
  return p.evaluate(() => {
    const cell = document.querySelector('[data-testid=cell-jurisdiction]');
    if (!cell) return { error: 'no cell-jurisdiction' };
    const line = document.querySelector('[data-testid=prov-jurisdiction]');
    const mark = cell.querySelector('.a-mark');
    const glyph = mark ? mark.querySelector('span span') : null;
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return null; };
    const r = cell.getBoundingClientRect();
    return {
      state: document.getElementById('what-jurisdiction')?.getAttribute('data-jurisdiction-state') ?? null,
      cellBox: { width: +r.width.toFixed(2), height: +r.height.toFixed(2) },
      cellText: cell.innerText.replace(/\s+/g, ' ').trim(),
      line: line ? line.textContent.replace(/\s+/g, ' ').trim() : null,
      lineClass: line ? line.className : null,
      lineOnShow: line ? !line.closest('[hidden]') : null,
      lineColor: line ? getComputedStyle(line).color : null,
      marker: mark ? mark.textContent.replace(/\s+/g, ' ').trim() : null,
      markerClass: mark ? mark.className : null,
      markerWordColor: mark ? getComputedStyle(mark).color : null,
      glyphColor: glyph ? getComputedStyle(glyph).color : null,
      markerBg: mark ? bgOf(mark) : null,
      didntAnswerAnywhere: /didn.t answer/i.test(document.body.innerText),
      windowsLine: document.querySelector('[data-testid=what-windows-line]')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    };
  });
}
async function lengthField(p) {
  if (!(await p.locator('#band-worklen').isVisible().catch(() => false))) await p.locator('[data-testid=fact-link-where]').first().click();
  await p.waitForSelector('#band-worklen', { state: 'visible', timeout: 60000 });
  return p.locator('#band-worklen');
}
async function pickerLocate(p, pick, side, kind) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(ADDRESS);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await waitDetect(p);
  await p.getByRole('dialog').getByRole('button', { name: pick }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await afterSave(p, side, kind);
}
async function afterSave(p, side, kind) {
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  const s = side ? p.locator('[data-testid=side-option]').filter({ hasText: side }) : null;
  if (s && await s.count()) await s.first().click(); else await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector(`[data-testid=kind-chip-${kind}]`, { timeout: 60000 });
  await p.locator(`[data-testid=kind-chip-${kind}]`).click();
}

const out = {};
async function flow(p, openNow) {
  if (FLOW === 'declined') {
    out.geocodeBodies = [];
    p.on('request', (rq) => { if (rq.url().includes('/api/geocode')) out.geocodeBodies.push(rq.postData() ?? rq.url()); });
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    // #402: Enter in the band's address field, on a plan with no pin.
    const field = p.getByLabel('Address or cross streets');
    await field.fill(ADDRESS);
    out.dialogBeforeEnter = await p.getByRole('dialog').isVisible().catch(() => false);
    await field.press('Enter');
    await p.waitForSelector('[role=dialog]', { timeout: 15000 }).catch(() => {});
    out.dialogAfterEnter = await p.getByRole('dialog').isVisible().catch(() => false);
    out.searchBox = await p.getByLabel('Address or intersection search').inputValue().catch(() => null);
    const t0 = Date.now();
    await waitDetect(p).catch(() => { out.detectTimeout = true; });
    out.enterToResultMs = Date.now() - t0;
    out.geocodeAfterEnter = out.geocodeBodies.slice();
    await park(p);
    await p.screenshot({ path: path.join(SHOTS, `enter-${w}-picker.png`) });
    out.unpicked = await card(p, `card-${w}-unpicked.png`);
    await p.getByRole('dialog').getByRole('button', { name: /East Colfax Avenue westbound/i }).first().click();
    await p.waitForTimeout(2500);
    out.picked = await card(p, `card-${w}-picked.png`);
    // #425/#406: the same plan through to PLAN DECLINED.
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await afterSave(p, /North side/i, 'flagger_lane_closure');
    out.sideAnswer = clean(await p.locator('[data-testid=side-option][aria-pressed=true], [data-testid=side-option][aria-checked=true]').first().innerText().catch(() => null));
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForFunction(() => /PLAN DECLINED/i.test(document.body.innerText), null, { timeout: 120000 });
    await p.waitForFunction(() => { const s = document.getElementById('what-jurisdiction')?.getAttribute('data-jurisdiction-state'); return s && s !== 'evaluating'; }, null, { timeout: 120000 }).catch(() => {});
    await settle(p, openNow, 60);
    await p.waitForTimeout(4000);
    out.planDeclined = /PLAN DECLINED/i.test(await p.locator('body').innerText());
    out.jurisdiction = await readJurisdiction(p);
    out.jurisdictionShot = await shotOf(p, '[data-testid=cell-jurisdiction]', `declined-${w}-jurisdiction-cell.png`);
    return out;
  }
  if (FLOW === 'zero') {
    await pickerLocate(p, /East Colfax Avenue/i, null, 'shoulder');
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
    await p.waitForTimeout(3000);
    const f = await lengthField(p);
    const read = async (tag) => {
      await p.waitForTimeout(2500);
      const cell = await shotOf(p, '.a-col:has(#band-worklen)', `zero-${w}-${tag}-cell.png`);
      const gen = await shotOf(p, '[data-testid=generate-frame]', `zero-${w}-${tag}-generate.png`).catch(() => null);
      return { fieldValue: await f.inputValue(), marker: clean(await p.getByTestId('info-toggle-worklen').innerText()),
        provenance: clean(await p.getByTestId('prov-worklen').textContent().catch(() => null)), cellText: cell.text, cell,
        ctaReason: clean(await p.locator('[data-testid=cta-reason]').first().textContent().catch(() => null)),
        generateEnabled: await p.getByRole('button', { name: /Generate plan/ }).first().isEnabled().catch(() => null), generate: gen };
    };
    await f.fill('0'); await p.keyboard.press('Tab'); out.typed0 = await read('typed0');
    await f.fill(''); await p.keyboard.press('Tab'); out.cleared = await read('cleared');
    return out;
  }
  // gen: #426 then #430.
  out.corridorAnswers = [];
  p.on('response', async (r) => {
    if (!r.url().includes('/api/render/corridor-geometry')) return;
    let body = null; let meta = null;
    try { const j = JSON.parse(r.request().postData()); meta = { lat: j?.meta?.lat ?? j?.scenario?.meta?.lat ?? null, lng: j?.meta?.lng ?? j?.scenario?.meta?.lng ?? null }; } catch {}
    if (r.status() !== 200) { try { body = (await r.text()).slice(0, 400); } catch {} }
    out.corridorAnswers.push({ at: Date.now(), status: r.status(), meta, body });
  });
  await pickerLocate(p, /East Colfax Avenue/i, null, 'shoulder');
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
  const ow = p.getByRole('button', { name: 'One-way', exact: true });
  if (await ow.first().isVisible().catch(() => false)) { await ow.first().click(); await p.waitForTimeout(3000); out.answeredOneWay = true; }
  await p.getByRole('button', { name: /Generate plan/ }).first().click();
  await p.waitForSelector('.dl-all', { timeout: 180000 });
  await settle(p, openNow);
  await p.waitForTimeout(5000);
  out.status = clean(await p.locator('.status-bar').first().innerText().catch(() => null));
  // #426: the working band while the zip renders.
  let bundleStatus = null;
  p.on('response', (r) => { if (r.url().includes('/api/render/bundle')) bundleStatus = r.status(); });
  await p.locator('.dl-all button').scrollIntoViewIfNeeded();
  const t0 = Date.now();
  const dlP = p.waitForEvent('download', { timeout: 90000 });
  await p.locator('.dl-all button').click();
  const seen = new Set();
  let shot = null;
  for (let i = 0; i < 600; i += 1) {
    const t = await p.locator('.working-band .wb-row').first().innerText().catch(() => null);
    if (t) {
      seen.add(clean(t));
      if (!shot) {
        shot = await p.evaluate(() => { const r = document.querySelector('.working-band').getBoundingClientRect(); return { y: r.top, height: r.height }; }).catch(() => null);
        if (shot) await p.screenshot({ path: path.join(SHOTS, `zip-${w}-working-band.png`), clip: { x: 0, y: Math.max(0, shot.y - 8), width: w, height: Math.min(shot.height + 16, h - Math.max(0, shot.y - 8)) } }).catch(() => {});
        out.bandObject = clean(await p.locator('.working-band .wb-object').first().innerText().catch(() => null));
        out.bandBox = shot;
      }
    }
    const done = await Promise.race([dlP.then(() => true), p.waitForTimeout(50).then(() => false)]);
    if (done) break;
  }
  const zdl = await dlP;
  out.zipMs = Date.now() - t0;
  out.bundleStatus = bundleStatus;
  out.zipName = zdl.suggestedFilename();
  out.bandTexts = [...seen];
  await zdl.saveAs(path.join(DL, out.zipName));
  await p.waitForTimeout(2000);
  // #430: reopen the picker and move the pin ~27 ft east.
  // After Generate the bands fold to facts; open the fact links in turn
  // until the WHERE band's "Pick on map" button shows.
  const open = p.locator('[data-testid=where-open-picker]');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(800);
  out.buttonsAfterGenerate = await p.locator('button:visible').evaluateAll((es) => es.map((e) => (e.getAttribute('data-testid') ?? '') + '|' + e.innerText.replace(/\s+/g, ' ').trim()).filter((x) => x.length > 1).slice(0, 60));
  await p.screenshot({ path: path.join(SHOTS, `gen-${w}-top.png`) });
  if (!(await open.first().isVisible().catch(() => false))) { await p.locator('[data-testid=setup-link-location]').first().click(); await p.waitForTimeout(2000); out.openedVia = 'setup-link-location'; }
  out.factLinks = await p.locator('[data-testid^=fact-link-]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
  for (const id of out.factLinks) {
    if (await open.first().isVisible().catch(() => false)) break;
    await p.locator(`[data-testid=${id}]`).first().click().catch(() => {});
    await p.waitForTimeout(1500);
    out.openedVia = id;
  }
  await open.first().scrollIntoViewIfNeeded();
  await open.first().click();
  await p.waitForSelector('[role=dialog] canvas.mapboxgl-canvas', { timeout: 90000 });
  await p.waitForSelector('[role=dialog] .mapboxgl-marker', { timeout: 90000 });
  await p.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const panel = async () => clean(await p.getByRole('dialog').locator('div:has(> div:text-is("Corridor extent"))').first().innerText().catch(() => null));
  out.panelBeforeMove = await panel();
  const nBefore = out.corridorAnswers.length;
  await p.addStyleTag({ content: '.mapboxgl-marker{pointer-events:none !important}' });
  await p.locator('[role=dialog] .mapboxgl-marker').first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  const pin = await p.evaluate(() => { const r = document.querySelector('[role=dialog] .mapboxgl-marker').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  // Map scale at the picker's PIN_ZOOM 16 (LocationPickerModal.tsx:177),
  // 512 px tiles; the real move is read back from the request's meta.
  const mPerPx = 40075016.686 * Math.cos(39.740 * Math.PI / 180) / (512 * 65536);
  const dx = Math.round(27 * 0.3048 / mPerPx);
  out.moveClick = { x: pin.x + dx, y: pin.y, dxPx: dx, pinCentre: pin };
  await p.mouse.click(pin.x + dx, pin.y);
  // The moved pin re-detects the roads and asks which road again; pick the
  // plan's road (Colfax eastbound) as the operator would.
  await p.waitForTimeout(1500);
  await waitDetect(p).catch(() => { out.redetectTimeout = true; });
  out.afterMoveCard = clean(await p.getByRole('dialog').innerText()).match(/(WHICH ROAD|ROAD PICKED)[^]*?DETECTED/i)?.[0] ?? null;
  const rp = p.getByRole('dialog').getByRole('button', { name: /East Colfax Avenue eastbound/i });
  if (await rp.count()) { await rp.first().click(); out.repicked = 'East Colfax Avenue eastbound'; }
  for (let i = 0; i < 60; i += 1) {
    await p.waitForTimeout(1000);
    const t = await panel();
    if (out.corridorAnswers.length > nBefore && !/Computing corridor/i.test(t)) break;
  }
  await p.waitForTimeout(2000);
  out.panelAfterMove = await panel();
  out.answersAfterMove = out.corridorAnswers.slice(nBefore);
  const prev = out.corridorAnswers.slice(0, nBefore).filter((a) => a.meta?.lat != null).pop();
  const last = out.answersAfterMove.filter((a) => a.meta?.lat != null).pop();
  if (prev && last) {
    const R = 6371008.8; const rad = Math.PI / 180;
    const dLat = (last.meta.lat - prev.meta.lat) * rad; const dLng = (last.meta.lng - prev.meta.lng) * rad;
    out.movedFt = +(R * Math.hypot(dLat, dLng * Math.cos(prev.meta.lat * rad)) / 0.3048).toFixed(1);
  }
  out.couldntReach = /Couldn.t reach the layout service/i.test(await p.getByRole('dialog').innerText());
  out.declinedLine = clean(await p.getByTestId('picker-corridor-declined').textContent().catch(() => null)) || null;
  out.refusedLine = clean(await p.getByTestId('picker-corridor-refused').textContent().catch(() => null)) || null;
  await park(p);
  await p.screenshot({ path: path.join(SHOTS, `move-${w}-picker.png`) });
  out.panelShot = await shotOf(p, '[role=dialog] div:has(> div:text-is("Corridor extent"))', `move-${w}-corridor-panel.png`).catch(() => null);
  return out;
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
const p = await ctx.newPage();
const openNow = track(p);
let res;
const started = new Date().toISOString();
try { res = await flow(p, openNow); } catch (e) {
  res = { ...out, error: String(e).slice(0, 400) };
  await p.screenshot({ path: path.join(SHOTS, `${FLOW}-${w}-error.png`) }).catch(() => {});
}
res = { flow: FLOW, width: w, started, ...res };
await ctx.close();
await b.close();
fs.writeFileSync(path.join(OUT, `${FLOW}-${w}.json`), JSON.stringify(res, null, 1));
console.log(FLOW, w, JSON.stringify(res).slice(0, 3000));
