// Production check of 1605c02 (mission walkthrough-round-4, #433).
// usage: node check.mjs <envfile> <outdir> <flow> <width>
// flows:
//   declined  #402 (Colfax & Williams, pick Colfax westbound: the picker's
//             side sentence on the map overlay and in the panel), then
//             #425's control: North side, flagger lane closure, PLAN
//             DECLINED live; the Jurisdiction cell on the pin's guess and
//             after the operator picks Parker ("◌ not checked").
//   failed    #425: the same plan with /api/render/audit answered 500 by a
//             browser route (a check that ran and failed; nothing reaches
//             the backend for that call); the cell on the pin's guess and
//             after picking Parker ("◌ check failed", gray).
//   len       #429 then #432 on a shoulder plan (Colfax eastbound): type
//             99999, then 512.5, in "Work zone length (ft)".
//   landing   #410: step 1 of HOW IT WORKS on /.
//   lanesA    #418 (a): shoulder on North Lincoln Street (live OSM
//             lanes=4 oneway=yes, 4 per side), Confirm, then "Edit on
//             map" and re-pick onto Acoma Street (live OSM, no lanes tag).
//   lanesB    #418 (b): near-intersection kind on Pearl Street at E 14th
//             Ave (live OSM lanes=2, 1 per side; the plan's count is 2).
// Live site https://www.conestruct.com, Playwright Chromium, DPR 2,
// 1440x900 or 390x844.  Nothing else is stubbed: road detection, geocode,
// audit (except "failed") and renders are live.  Read-only: nothing is
// saved.  The gate token is read from the env file into a request header
// and never printed.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const [envPath, OUT, FLOW, WIDTH] = process.argv.slice(2);
const TOK = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GATE_BYPASS_TOKEN='))
  .slice('GATE_BYPASS_TOKEN='.length).replace(/^"|"$/g, '');
const BASE = 'https://www.conestruct.com';
const w = Number(WIDTH); const h = w >= 1000 ? 900 : 844;
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const COLFAX = 'E Colfax Ave & N Williams St, Denver, CO';

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
// Shot of the first visible `sel`, unioned with `also` (a details
// popover drawn below it), page coordinates, padded 8 px.
async function shotOf(p, sel, file, also = null) {
  await p.locator(sel).first().scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate(([s, a]) => {
    const vis = (q) => [...document.querySelectorAll(q)].find((x) => x.getBoundingClientRect().width > 0);
    const e = vis(s);
    const rs = [e, a && vis(a)].filter(Boolean).map((x) => x.getBoundingClientRect());
    const r0 = rs[0];
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    const rr = Math.max(...rs.map((r) => r.right)), bb = Math.max(...rs.map((r) => r.bottom));
    return { x: l + window.scrollX, y: t + window.scrollY, cw: rr - l, ch: bb - t, width: r0.width, height: r0.height, text: e.innerText };
  }, [sel, also]);
  const vw = p.viewportSize().width;
  const x = Math.max(0, box.x - 8);
  await p.screenshot({ path: path.join(SHOTS, file), fullPage: true, clip: { x, y: Math.max(0, box.y - 8), width: Math.min(box.cw + 16, vw - x), height: box.ch + 16 } });
  return { text: clean(box.text), width: +box.width.toFixed(2), height: +box.height.toFixed(2), shot: `shots/${file}` };
}
const doneRe = /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND|UNAVAILABLE/i;
async function waitDetect(p) {
  await p.waitForFunction((src) => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && new RegExp(src, 'i').test(d.innerText); }, doneRe.source, { timeout: 90000 });
}
async function search(p, address, pick) {
  const box = p.getByLabel('Address or intersection search');
  await box.fill(address);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await waitDetect(p);
  // Live detection can come back empty when the Overpass mirrors are busy
  // ("unavailable"); wait for the wanted road's button, and re-detect (the
  // picker's own "Re-detect roads") up to three times if it never shows.
  const b = p.getByRole('dialog').getByRole('button', { name: pick });
  out.redetects = 0;
  for (let i = 0; i < 4; i += 1) {
    if (await b.first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) break;
    if (i === 3) break;
    const re = p.getByRole('dialog').getByRole('button', { name: /RE-DETECT ROADS/i });
    if (!(await re.count())) { await p.getByRole('button', { name: 'SEARCH' }).click(); } else { await re.first().click(); }
    out.redetects += 1;
    await p.waitForTimeout(2000);
    await waitDetect(p).catch(() => {});
  }
  out.detected = clean(await p.getByRole('dialog').innerText()).match(/(WHICH ROAD|ROAD PICKED)[^]*?DETECTED/i)?.[0] ?? null;
  out.pickButtons = await p.getByRole('dialog').getByRole('button').evaluateAll((es) => es.map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((t) => /street|avenue|road|boulevard/i.test(t)).slice(0, 10));

  if (await b.count()) { out.pickedRoad = clean(await b.first().innerText()); await b.first().click(); }
  await p.waitForTimeout(2500);
}
async function openPicker(p) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForSelector('[role=dialog] .mapboxgl-canvas', { timeout: 60000 });
  await p.waitForTimeout(1500);
}
async function afterSave(p, side, kind) {
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  const s = side ? p.locator('[data-testid=side-option]').filter({ hasText: side }) : null;
  if (s && await s.count()) await s.first().click(); else await p.locator('[data-testid=side-option]').first().click();
  out.side = clean(await p.locator('[data-testid=side-option][aria-pressed=true], [data-testid=side-option][aria-checked=true]').first().innerText().catch(() => null));
  await p.waitForSelector(`[data-testid=kind-chip-${kind}]`, { timeout: 60000 });
  await p.locator(`[data-testid=kind-chip-${kind}]`).click();
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
  await p.waitForTimeout(3000);
}
async function sideSentence(p, tag) {
  const one = async (testid, file) => {
    const el = p.getByTestId(testid);
    if (!(await el.count())) return { shown: false };
    await el.scrollIntoViewIfNeeded();
    await park(p);
    const bb = await el.boundingBox();
    const pad = 24;
    await p.screenshot({ path: path.join(SHOTS, file), clip: { x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad), width: Math.min(bb.width + 2 * pad, w - Math.max(0, bb.x - pad)), height: bb.height + 2 * pad } });
    const info = await el.evaluate((e) => ({ text: e.textContent, rendered: e.innerText, color: getComputedStyle(e).color }));
    return { shown: true, ...info, width: +bb.width.toFixed(2), height: +bb.height.toFixed(2), shot: `shots/${file}` };
  };
  await p.getByTestId('picker-side-sentence').waitFor({ timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await park(p);
  await p.screenshot({ path: path.join(SHOTS, `${tag}-picker.png`) });
  return { overlay: await one('picker-side-sentence', `${tag}-overlay.png`), panel: await one('picker-corridor-note', `${tag}-panel.png`) };
}
async function readJurisdiction(p, file) {
  const o = await p.evaluate(() => {
    const cell = document.querySelector('[data-testid=cell-jurisdiction]');
    if (!cell) return { error: 'no cell-jurisdiction' };
    const line = document.querySelector('[data-testid=prov-jurisdiction]');
    const mark = cell.querySelector('.a-mark');
    const glyph = mark ? mark.querySelector('span span') : null;
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return null; };
    return {
      state: document.getElementById('what-jurisdiction')?.getAttribute('data-jurisdiction-state') ?? null,
      value: document.getElementById('what-jurisdiction')?.value ?? null,
      line: line ? line.textContent.replace(/\s+/g, ' ').trim() : null,
      lineClass: line ? line.className : null,
      lineOnShow: line ? !line.closest('[hidden]') : null,
      lineColor: line ? getComputedStyle(line).color : null,
      marker: mark ? mark.textContent.replace(/\s+/g, ' ').trim() : null,
      markerClass: mark ? mark.className : null,
      markerWordColor: mark ? getComputedStyle(mark).color : null,
      glyphColor: glyph ? getComputedStyle(glyph).color : null,
      markerBg: mark ? bgOf(mark) : null,
      redAnywhereInCell: [...cell.querySelectorAll('*')].some((e) => getComputedStyle(e).color === 'rgb(255, 122, 122)'),
      didntAnswerOnShow: /didn.t answer/i.test(document.body.innerText),
      windowsLine: document.querySelector('[data-testid=what-windows-line]')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      planDeclined: /PLAN DECLINED/i.test(document.body.innerText),
    };
  });
  o.shot = await shotOf(p, '[data-testid=cell-jurisdiction]', file);
  const t = p.locator('[data-testid=info-toggle-jurisdiction]');
  if (await t.count()) {
    await t.click(); await p.waitForTimeout(500);
    o.details = clean(await p.locator('[data-testid=info-jurisdiction]').innerText().catch(() => null));
    o.openShot = await shotOf(p, '[data-testid=cell-jurisdiction]', file.replace('.png', '-open.png'), '[data-testid=info-jurisdiction]');
    await t.click(); await p.waitForTimeout(300);
  }
  return o;
}
async function settleJur(p) {
  await p.waitForFunction(() => { const s = document.getElementById('what-jurisdiction')?.getAttribute('data-jurisdiction-state'); return s && s !== 'evaluating'; }, null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(5000);
}
async function lanesRow(p, file) {
  const o = {};
  if (!(await p.locator('[data-testid=cell-lanes]').isVisible().catch(() => false))) await p.locator('[data-testid=fact-link-what]').first().click();
  await p.waitForSelector('[data-testid=cell-lanes]', { state: 'visible', timeout: 60000 });
  await p.waitForTimeout(1500);
  o.value = await p.locator('#what-lanes').inputValue().catch(() => null);
  o.marker = clean(await p.getByTestId('info-toggle-lanes').innerText());
  o.markerClass = await p.locator('[data-testid=cell-lanes] .a-mark').first().getAttribute('class').catch(() => null);
  o.markerColor = await p.locator('[data-testid=cell-lanes] .a-mark').first().evaluate((e) => getComputedStyle(e).color).catch(() => null);
  o.header = await p.evaluate(() => { const m = document.body.innerText.match(/\d+ guess(es)? marked ⚠[^\n]*|prefilled from the road|nothing detected[^\n]*/i); return m ? m[0] : null; });
  o.closed = await shotOf(p, '[data-testid=cell-lanes]', `${file}-closed.png`);
  await p.getByTestId('info-toggle-lanes').click();
  await p.waitForTimeout(500);
  o.provenance = clean(await p.getByTestId('prov-lanes').textContent().catch(() => null));
  o.provClass = await p.getByTestId('prov-lanes').getAttribute('class').catch(() => null);
  o.provColor = await p.getByTestId('prov-lanes').evaluate((e) => getComputedStyle(e).color).catch(() => null);
  o.doubt = clean(await p.locator('[data-testid=detect-lanes-doubt]').textContent().catch(() => null)) || null;
  o.details = clean(await p.locator('[data-testid=info-lanes]').innerText().catch(() => null));
  o.open = await shotOf(p, '[data-testid=cell-lanes]', `${file}-open.png`, '[data-testid=info-lanes]');
  return o;
}

const out = {};
async function flow(p) {
  if (FLOW === 'landing') {
    await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForTimeout(2000);
    const sel = await p.evaluate(() => {
      const ps = [...document.querySelectorAll('p')].filter((e) => /Drop a pin where the work starts/.test(e.textContent));
      if (!ps.length) return null;
      ps[0].setAttribute('data-check', 'step1-body');
      const step = ps[0].closest('.rv') ?? ps[0].parentElement;
      step.setAttribute('data-check', 'step1');
      return true;
    });
    if (!sel) return { error: 'no step 1 paragraph' };
    await p.locator('[data-check=step1]').scrollIntoViewIfNeeded();
    await p.waitForTimeout(3000); // reveal animations
    out.body = clean(await p.locator('[data-check=step1-body]').textContent());
    out.extentAnywhere = /extent/i.test(await p.locator('[data-check=step1]').innerText());
    out.step = await shotOf(p, '[data-check=step1]', `landing-${w}-step1.png`);
    return out;
  }
  if (FLOW === 'declined' || FLOW === 'failed') {
    out.auditAnswers = [];
    if (FLOW === 'failed') {
      await p.route('**/api/render/audit**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'prod check: audit answered 500 in the browser' }) }));
    }
    p.on('response', (r) => { if (r.url().includes('/api/render/audit')) out.auditAnswers.push(r.status()); });
    await openPicker(p);
    await search(p, COLFAX, /East Colfax Avenue westbound/i);
    if (FLOW === 'declined') out.sentence = await sideSentence(p, `side-${w}`);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await afterSave(p, /North side/i, 'flagger_lane_closure');
    await settleJur(p);
    out.guess = await readJurisdiction(p, `${FLOW}-${w}-guess-cell.png`);
    await p.locator('#what-jurisdiction').selectOption('parker');
    await p.waitForTimeout(1500);
    await settleJur(p);
    out.picked = await readJurisdiction(p, `${FLOW}-${w}-picked-cell.png`);
    return out;
  }
  if (FLOW === 'len') {
    await openPicker(p);
    await search(p, COLFAX, /East Colfax Avenue eastbound/i);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await afterSave(p, null, 'shoulder');
    if (!(await p.locator('#band-worklen').isVisible().catch(() => false))) await p.locator('[data-testid=fact-link-where]').first().click();
    await p.waitForSelector('#band-worklen', { state: 'visible', timeout: 60000 });
    const f = p.locator('#band-worklen');
    const read = async (tag) => {
      await p.waitForTimeout(2500);
      const cell = await shotOf(p, '.a-col:has(#band-worklen)', `len-${w}-${tag}-cell.png`);
      const gen = await shotOf(p, '[data-testid=generate-frame]', `len-${w}-${tag}-generate.png`).catch(() => null);
      return { fieldValue: await f.inputValue(),
        marker: clean(await p.getByTestId('info-toggle-worklen').innerText()),
        markerClass: await p.locator('.a-col:has(#band-worklen) .a-mark').first().getAttribute('class').catch(() => null),
        fieldError: clean(await p.locator('.a-col:has(#band-worklen) [role=alert]').first().innerText().catch(() => null)) || null,
        ctaReason: clean(await p.locator('[data-testid=cta-reason]').first().textContent().catch(() => null)) || null,
        generateEnabled: await p.getByRole('button', { name: /Generate plan/ }).first().isEnabled().catch(() => null),
        cell, generate: gen };
    };
    await f.fill('99999'); await p.keyboard.press('Tab'); out.overCap = await read('99999');
    await f.fill('512.5'); await p.keyboard.press('Tab'); out.decimal = await read('512-5');
    return out;
  }
  if (FLOW === 'lanesA') {
    out.detections = [];
    p.on('response', async (r) => {
      if (!r.url().includes('/api/road-bearing')) return;
      try { const j = await r.json(); out.detections.push((j.candidates ?? []).map((c) => `${c.name}|w${c.way_id}|oneway=${c.tags?.oneway}|lanes=${c.tags?.lanes}`)); } catch {}
    });
    await openPicker(p);
    await search(p, '1100 N Lincoln St, Denver, CO', /Lincoln Street/i);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await afterSave(p, null, 'shoulder');
    out.firstRoad = out.pickedRoad; out.first = await lanesRow(p, `lanesA-${w}-first-lanes`);
    await p.getByTestId('info-toggle-lanes').click().catch(() => {});
    await p.locator('[data-testid=fact-link-where]').first().click().catch(() => {});
    await p.getByRole('button', { name: 'Edit on map' }).click();
    await p.waitForSelector('[role=dialog] .mapboxgl-canvas', { timeout: 60000 });
    await p.waitForTimeout(1500);
    await search(p, '1100 Acoma St, Denver, CO', /Acoma Street/i);
    out.repickDetected = out.detected; out.repickRoad = out.pickedRoad;
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForTimeout(3000);
    const sideNow = p.locator('[data-testid=side-option]');
    if (await sideNow.first().isVisible().catch(() => false) && !(await p.locator('[data-testid=side-option][aria-pressed=true], [data-testid=side-option][aria-checked=true]').count())) {
      await sideNow.first().click(); out.reansweredSide = true; await p.waitForTimeout(1500);
    }
    const confirm = p.getByRole('button', { name: /^Confirm/ });
    if (await confirm.first().isVisible().catch(() => false)) { await confirm.first().click(); out.reconfirmed = true; await p.waitForTimeout(3000); }
    out.after = await lanesRow(p, `lanesA-${w}-repick-lanes`);
    return out;
  }
  if (FLOW === 'lanesB') {
    out.detections = [];
    p.on('response', async (r) => {
      if (!r.url().includes('/api/road-bearing')) return;
      try { const j = await r.json(); out.detections.push((j.candidates ?? []).map((c) => `${c.name}|w${c.way_id}|oneway=${c.tags?.oneway}|lanes=${c.tags?.lanes}|lf=${c.tags?.lanes_forward}|lb=${c.tags?.lanes_backward}`)); } catch {}
    });
    await openPicker(p);
    await search(p, 'E 14th Ave & Pearl St, Denver, CO', /Pearl Street/i);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await afterSave(p, null, 'near_intersection');
    out.lanes = await lanesRow(p, `lanesB-${w}-lanes`);
    return out;
  }
  return { error: 'unknown flow' };
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
const p = await ctx.newPage();
let res;
const started = new Date().toISOString();
try { res = await flow(p); } catch (e) {
  res = { ...out, error: String(e).slice(0, 400) };
  await p.screenshot({ path: path.join(SHOTS, `${FLOW}-${w}-error.png`) }).catch(() => {});
}
res = { flow: FLOW, width: w, started, ...res };
await ctx.close();
await b.close();
fs.writeFileSync(path.join(OUT, `${FLOW}-${w}.json`), JSON.stringify(res, null, 1));
console.log(FLOW, w, JSON.stringify(res).slice(0, 2500));
