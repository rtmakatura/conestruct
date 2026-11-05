// #440 cross-street production check on a978e73, adapted from the local walk
// (../../evidence/script/walk.mjs).
// usage: SHOT_TOKEN=<gate token> node walk-prod.mjs <outdir>
// The REAL site: no Playwright routes or stubs.  Live Mapbox geocoding in the
// picker, live /api/road-bearing, live backend.  So a failed lookup can't be
// forced here; the local walk's fail/Try again step is left to local evidence
// unless production really fails.  Playwright Chromium, DPR 2, 1440x900 and
// 390x844.  The address is the local PDF pass's: at 1600 E Colfax the backend
// declines (the crossing is inside the 1,000 ft work zone).
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = 'https://www.conestruct.com';
const ADDR = process.env.ADDR ?? '1550 E Colfax Ave, Denver';
fs.mkdirSync(OUT, { recursive: true });

// Franklin Street's south end on East Colfax Avenue: where the streets cross.
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
const rad = (d) => (d * Math.PI) / 180;
// The pin picture's pixel for a coordinate (Web Mercator, 512 px tiles at
// PIN_ZOOM 17): only to aim the walk's click, the way a person aims by eye.
function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}
// A signed site-scan token never gets committed (#371).
const redact = (k, v) => (k === 'token' && typeof v === 'string' ? '<redacted: signed site-scan token (#371)>' : v);

const BAND = '[data-testid=band-where]';
async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
async function shot(p, sel, file) {
  const l = p.locator(sel).first();
  if (!(await l.count()) || !(await l.isVisible())) return null;
  await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } });
  await l.screenshot({ path: `${OUT}/${file}` });
  await p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } });
  return file;
}
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('[data-testid=band-where]') ?? document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  });
}
async function targets(p) {
  return p.evaluate(() => {
    const ids = ['band-aerial-big-map', 'cross-move', 'cross-undo', 'cross-retry', 'cross-big-map', 'where-open-picker', 'where-confirm'];
    const out = {};
    for (const id of ids) {
      const e = document.querySelector(`[data-testid=band-where] [data-testid=${id}]`);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      out[id] = { w: +r.width.toFixed(1), h: +r.height.toFixed(1), ok: r.width >= 44 && r.height >= 44 };
    }
    return out;
  });
}
async function aerial(p) {
  return p.evaluate(() => {
    const q = (s) => document.querySelector(`[data-testid=band-aerial] ${s}`);
    const frame = q('.a-aerial-frame'), bar = q('[data-testid=band-aerial-bar]'), big = q('[data-testid=band-aerial-big-map]'), label = q('[data-testid=band-aerial-mark-label]');
    const root = document.querySelector('[data-testid=band-aerial]');
    return {
      stage: root?.getAttribute('data-stage') ?? null,
      armed: frame?.classList.contains('is-armed') ?? false,
      barText: bar ? bar.innerText.trim() : null,
      bigText: big?.innerText.trim() ?? null,
      labelText: label?.innerText.trim() ?? null,
      hasMark: !!q('[data-testid=band-aerial-mark]'),
      text: root ? root.innerText.replace(/\s+/g, ' ').trim() : null,
      alt: q('[data-testid=band-aerial-img]')?.getAttribute('alt') ?? null,
    };
  });
}
async function card(p) {
  return p.evaluate(() => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const c = document.querySelector('[data-testid=where-questions]');
    if (!c) return null;
    const cur = c.querySelector('.nyq-card');
    const row = c.querySelector('[data-testid=cross-row], [data-testid=cross-finding]');
    return {
      count: t(c.querySelector('.nyq-count')?.innerText),
      flag: cur?.getAttribute('data-flag') ?? null,
      question: t(cur?.querySelector('.nyq-q')?.innerText),
      why: t(cur?.querySelector('.nyq-why')?.innerText) || null,
      button: cur ? { text: t(cur.querySelector('.nyq-foot > button:last-child')?.innerText), disabled: cur.querySelector('.nyq-foot > button:last-child')?.disabled ?? null } : null,
      row: row ? { testid: row.getAttribute('data-testid'), text: t(row.innerText) } : null,
      line: t(c.querySelector('[data-testid=cross-row-line]')?.innerText) || null,
      none: t(c.querySelector('[data-testid=cross-none]')?.innerText) || null,
      failed: t(c.querySelector('[data-testid=cross-failed]')?.innerText) || null,
      move: t(c.querySelector('[data-testid=cross-move]')?.innerText) || null,
      rows: [...c.querySelectorAll('.nyq-row')].map((r) => t(r.innerText)),
      text: t(c.innerText),
    };
  });
}
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function run(w, h) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = { steps: [], roadBearing: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true, extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  const seen = { lastScenario: null, aerialPoint: 0 };
  p.on('request', (r) => {
    if (r.method() !== 'POST') return;
    if (r.url().includes('/api/aerial-point')) seen.aerialPoint++;
    if (r.url().includes('/api/render/corridor-geometry')) seen.lastScenario = JSON.parse(r.postData() ?? '{}').scenario ?? null;
  });
  p.on('response', async (r) => {
    if (!r.url().includes('/api/road-bearing')) return;
    try { const j = await r.json(); out.roadBearing.push({ status: r.status(), scan_status: j.scan_status, names: (j.candidates ?? []).map((c) => c.name) }); } catch { out.roadBearing.push({ status: r.status() }); }
  });
  const step = async (name, opts = {}) => {
    const s = { name, card: await card(p), aerial: await aerial(p) };
    if (opts.measure) { s.axe = await axe(p); s.targets = await targets(p); }
    if (opts.shot !== false) s.shot = await shot(p, opts.sel ?? BAND, `${tag}-${nn()}-${name}.png`);
    out.steps.push(s);
    console.log(tag, name, '|', s.card?.count, s.card?.flag, '| row:', s.card?.row?.text ?? '-', '| armed:', s.aerial.armed);
    return s;
  };
  const tapCrossing = async () => {
    const img = p.locator('[data-testid=band-aerial-img]');
    const box = await img.boundingBox();
    const pin = seen.lastScenario?.meta ?? null;
    if (!pin?.lat) throw new Error('no pin in the last scenario to aim the tap');
    const at = pixelOf(CROSSING, { lat: pin.lat, lng: pin.lng }, box.width, box.height);
    out.tap = { at, box, pin: { lat: pin.lat, lng: pin.lng } };
    await img.click({ position: { x: at.x, y: at.y } });
  };
  const waitMarked = async () => {
    await p.waitForSelector('[data-testid=cross-row]', { timeout: 60000 });
    await p.waitForFunction(() => /of where the work starts/.test(document.querySelector('[data-testid=cross-row-line]')?.innerText ?? ''), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(800);
  };
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    if (process.env.PIN) {
      // The PDF pass: the picker's manual coordinates, on Colfax past Franklin.
      const [la, ln] = process.env.PIN.split(',');
      await p.getByText(/enter coordinates manually/i).click();
      await p.getByLabel('Latitude').fill(la);
      await p.getByLabel('Longitude').fill(ln);
      await p.getByLabel('Longitude').press('Enter');
      await p.getByLabel('Longitude').blur();
    } else {
      await p.getByLabel('Address or intersection search').fill(ADDR);
      await p.getByRole('button', { name: 'SEARCH' }).click();
    }
    const dlg = p.getByRole('dialog');
    const want = dlg.locator('button', { hasText: /Colfax/ });
    await want.first().waitFor({ timeout: 90000 });
    await p.waitForTimeout(1500);
    out.roadButtons = (await want.allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim());
    await want.nth(Number(process.env.ROAD_INDEX ?? 0)).click();
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=kind-chip-near_intersection]', { state: 'attached', timeout: 60000 });
    await p.waitForTimeout(2500);
    await step('00-opens-on-kind', { sel: '[data-testid=where-questions]' });

    await p.locator('label.nyq-answer:has([data-testid=kind-chip-near_intersection])').click(); await p.waitForTimeout(800);
    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(1500);
    await park(p);
    await step('01-armed', { measure: true });
    await shot(p, '[data-testid=band-aerial]', `${tag}-${nn()}-aerial-armed.png`);

    await tapCrossing();
    await waitMarked();
    await park(p);
    await step('02-marked', { measure: true });
    await shot(p, '[data-testid=band-aerial]', `${tag}-${nn()}-aerial-marked.png`);
    out.markedScenario = { intersection: seen.lastScenario?.meta?.intersection ?? null, approaches: seen.lastScenario?.approaches ?? null };

    await p.locator('[data-testid=cross-move]').click(); await p.waitForTimeout(500);
    await step('03-move', { shot: false });
    await p.locator('[data-testid=cross-move]').click(); await p.waitForTimeout(500);
    await step('04-move-cancelled', { shot: false });

    await p.locator('[data-testid=cross-undo]').click(); await p.waitForTimeout(1500);
    await step('05-undone', { shot: false });
    out.afterUndo = { intersection: seen.lastScenario?.meta?.intersection ?? null };

    // Ruling 4: the big map, armed on its cross-street control.
    await p.locator('[data-testid=band-aerial-big-map]').click();
    await p.waitForSelector('[role=dialog]', { timeout: 30000 });
    await p.waitForTimeout(3000);
    const pickerText = await p.evaluate(() => (document.querySelector('[role=dialog]')?.innerText ?? '').replace(/\s+/g, ' '));
    out.pickerArmed = /Click the intersection on the map/.test(pickerText);
    const canvas = p.locator('[role=dialog] canvas.mapboxgl-canvas').first();
    const cb = await canvas.boundingBox();
    await canvas.click({ position: { x: cb.width / 2, y: cb.height / 2 - 60 } });
    await p.waitForTimeout(4000);
    out.pickerAfterClick = await p.evaluate(() => (document.querySelector('[role=dialog]')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 800));
    out.pickerDetectedParagraph = /places it along the road|confirm the details in the form/i.test(out.pickerAfterClick);
    await p.screenshot({ path: `${OUT}/${tag}-${nn()}-picker-after-click.png` });
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=cross-row]', { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2000);
    await step('06-after-big-map', { shot: false });

    // The picker click only proves the round trip: Undo, and tap the crossing
    // on the aerial again so the plan carries Franklin's own point.
    if (await p.locator('[data-testid=cross-undo]').count()) { await p.locator('[data-testid=cross-undo]').click(); await p.waitForTimeout(1500); }
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await tapCrossing();
    await waitMarked();
    await step('07-retapped', { shot: false });

    await nextBtn(p).click();
    await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 30000 });
    await p.waitForTimeout(1200);
    await park(p);
    await step('08-side', { measure: true });
    await p.locator('[data-testid=where-questions] label.nyq-answer').first().click(); await p.waitForTimeout(1500);
    await step('09-side-answered', { sel: '[data-testid=where-questions]' });

    // Ruling 2 revised: changing the kind clears a side whose options changed.
    // Only read here, on the record the card keeps: not forced in production.

    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForTimeout(3000);
    out.afterConfirm = await p.evaluate(() => ({ whereOpen: !!document.querySelector('.a-open[data-testid=band-where]'), openBand: document.querySelector('.a-open')?.getAttribute('data-testid') ?? null }));

    if (w === 1440) {
      out.pdf = {};
      await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
      await p.waitForTimeout(3000);
      const oneWay = p.getByRole('button', { name: /^One-way$/ });
      if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(4000); out.pdf.saidOneWay = true; }
      const laneOk = p.getByRole('button', { name: 'Lane count is right' });
      if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(3000); out.pdf.saidLaneCount = true; }
      out.pdf.ctaReason = await p.evaluate(() => document.querySelector('[data-testid=cta-reason]')?.innerText.trim() ?? null);
      await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
      await p.getByTestId('generate-plan').click();
      await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
      await p.waitForTimeout(4000);
      await p.screenshot({ path: `${OUT}/${tag}-${nn()}-generated.png`, fullPage: true });
      let pdfBody = null;
      p.on('request', (r) => { if (r.method() === 'POST' && /\/api\/render\/pdf(\?|$)/.test(r.url()) && !pdfBody) pdfBody = r.postData(); });
      for (const bt of await p.locator('[data-testid=downloads] button').all()) {
        const label = ((await bt.getAttribute('aria-label')) || (await bt.innerText())).replace(/\s+/g, ' ').trim();
        if (/plan/i.test(label) && /pdf/i.test(label) && !/crew|audit|zip/i.test(label)) {
          out.pdf.button = label;
          const respP = p.waitForResponse((r) => /\/api\/render\/pdf(\?|$)/.test(r.url()), { timeout: 180000 }).catch(() => null);
          const dlP = p.waitForEvent('download', { timeout: 180000 }).catch(() => null);
          await bt.click();
          const [resp, dl] = await Promise.all([respP, dlP]);
          out.pdf.status = resp?.status() ?? null;
          if (dl) { await dl.saveAs(`${OUT}/${tag}-plan.pdf`); out.pdf.file = `${tag}-plan.pdf`; out.pdf.bytes = fs.statSync(`${OUT}/${tag}-plan.pdf`).size; }
          break;
        }
      }
      if (pdfBody) { const sc = JSON.parse(pdfBody).scenario ?? JSON.parse(pdfBody); out.pdf.sentIntersection = sc?.meta?.intersection ?? null; out.pdf.sentApproaches = sc?.approaches ?? null; }
      console.log(tag, 'pdf', JSON.stringify({ button: out.pdf.button, status: out.pdf.status, bytes: out.pdf.bytes }));
    }
  } catch (e) {
    out.error = String(e).slice(0, 600);
    await p.screenshot({ path: `${OUT}/${tag}-error.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  console.log(tag, out.error ?? 'ok');
  return out;
}

const M = {};
// WIDTHS=1440 ADDR="1700 E Colfax Ave, Denver": the PDF pass.  Live Colfax reads
// eastbound here, so a pin at 1550 runs the work zone through Franklin and the
// backend declines (kept as evidence); 1700 is past Franklin, with traffic.
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
for (const [w, h] of [[1440, 900], [390, 844]].filter(([x]) => WIDTHS.includes(x))) M[`${w}`] = await run(w, h);
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(M, redact, 1));
