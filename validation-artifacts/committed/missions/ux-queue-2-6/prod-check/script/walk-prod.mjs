// #458 production check on d360ce4 (#457, #448, #451, #449), adapted from
// ux-undo-links/evidence/script/walk.mjs (#457 local), ux-no-line-text's
// walk.mjs (#448 local), ux-bike-lane-crossing's walk.mjs (#449 local) and
// ux-group5-details/prod-check/script/walk-prod.mjs (#453's production check).
// usage: node walk-prod.mjs <outdir> <part: where|plan> <WxH>
// One browser, one viewport per run.  The REAL site, everything live:
// geocoding, /api/road-bearing (no stub), the tap's nearest-intersection read,
// the generate, the site scan, the NEEDS YOU map, the audit and the audit PDF.
// The gate header goes through scripts/gate.cjs newGatedContext (the site's
// own host only); the token is read from conestruct/site/.env.local, never
// printed or saved.  Nothing is saved on the site.
//   where: the CONFIRM card's Undo (kind answered), the cross street's row
//          (tap at Colfax & Franklin), focus after Move by keyboard, the cross
//          answered row.
//   plan:  Shoulder, one-way, Generate; the audit PDF through the page's own
//          button; then every NEEDS YOU question with its map's x-map-subject
//          header, answering the first option, until the bike lane question.
//          On the first question one extra state is induced: the map request's
//          flag is rewritten to school_zone (the #448 local walk's method), so
//          the production backend answers a real empty subject.  Labelled as
//          induced everywhere it is reported.
import { createRequire } from 'module';
import fs from 'fs';
const R = 'C:/Users/rtmak/Documents/traffic-control-tool';
const W = `${R}/.claude/worktrees/mission-458-prod-check`;
const require = createRequire(`${R}/package.json`);
const { chromium } = require('playwright');
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${R}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PART, SIZE] = process.argv.slice(2);
const [w, h] = SIZE.split('x').map(Number);
const SITE = 'https://www.conestruct.com';
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
fs.mkdirSync(OUT, { recursive: true });
if (!process.env.GATE_BYPASS_TOKEN) {
  const line = fs.readFileSync(`${R}/conestruct/site/.env.local`, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GATE_BYPASS_TOKEN='));
  const v = (line ?? '').slice('GATE_BYPASS_TOKEN='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
  if (v) process.env.GATE_BYPASS_TOKEN = v;
}
let lateRejections = 0;
process.on('unhandledRejection', () => { lateRejections += 1; });
const rad = (d) => (d * Math.PI) / 180;
function pixelOf(pt, pin, pw, ph) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + pw / 2, y: py - cy + ph / 2 };
}
const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

const undos = (p) => p.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('button, a')) {
    const text = (e.innerText ?? '').replace(/\s+/g, ' ').trim();
    if (!/^undo\b/i.test(text)) continue;
    const b = e.getBoundingClientRect();
    if (!b.width) continue;
    const cs = getComputedStyle(e);
    out.push({ testid: e.getAttribute('data-testid'), cls: String(e.className), text, tag: e.tagName, w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      font: `${/mono/i.test(cs.fontFamily) ? 'mono' : cs.fontFamily.split(',')[0].replace(/"/g, '')} ${cs.fontSize}/${cs.fontWeight}`,
      color: cs.color, border: `${cs.borderTopWidth} ${cs.borderTopStyle}`, transform: cs.textTransform, decoration: cs.textDecorationLine,
      padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}` });
  }
  return out;
});
const axe = async (p, sel) => {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return 'no root';
    return (await window.axe.run(root, { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
  }, sel);
};
const focusRead = (p) => p.evaluate(() => {
  const a = document.activeElement;
  const r = a?.getBoundingClientRect();
  return { testid: a?.getAttribute('data-testid') ?? null, tag: a?.tagName, text: (a?.innerText ?? '').trim().slice(0, 40),
    top: r ? +r.top.toFixed(1) : null, bottom: r ? +r.bottom.toFixed(1) : null, onScreen: r ? r.top >= 0 && r.bottom <= window.innerHeight : null, scrollY: Math.round(window.scrollY) };
});

async function pin(p) {
  await p.goto(SITE + '/sandbox', { waitUntil: 'load', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(ADDR);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  const want = p.getByRole('dialog').locator('button', { hasText: new RegExp(process.env.ROAD ?? 'Colfax') });
  await want.first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(1000);
  await want.first().click();
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
}

const b = await chromium.launch();
const out = { size: SIZE, part: PART, addr: ADDR, errors: [], steps: {}, roadBearing: [], mapRequests: [], questions: [] };
const ctx = await newGatedContext(b, `${SITE}/sandbox`, { viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true });
const p = await ctx.newPage();
p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
let lastMeta = null;
p.on('request', (r) => {
  if (r.method() === 'POST' && r.url().includes('/api/render/corridor-geometry')) {
    try { const m = JSON.parse(r.postData() ?? '{}').scenario?.meta; if (m) lastMeta = { lat: m.lat, lng: m.lng }; } catch {}
  }
});
p.on('response', async (r) => {
  const u = r.url();
  if (u.includes('/api/road-bearing')) { let s = null; try { const j = await r.json(); s = { status: j.scan_status, candidates: (j.candidates ?? []).length }; } catch {} out.roadBearing.push({ http: r.status(), ...s }); }
  if (u.includes('/api/needs-you-map')) {
    let body = {}; try { body = JSON.parse(r.request().postData() ?? '{}'); } catch {}
    out.mapRequests.push({ flag: body.flag ?? null, zoom: body.zoom ?? 0, status: r.status(), subject: r.headers()['x-map-subject'] ?? null, induced: mapMode === 'nogeom' });
  }
});
let mapMode = 'live';
await p.route('**/api/needs-you-map**', async (r) => {
  if (mapMode === 'nogeom') return r.fallback({ postData: JSON.stringify({ ...JSON.parse(r.request().postData() ?? '{}'), flag: 'school_zone' }) });
  return r.fallback();
});
const unstick = () => p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const s = getComputedStyle(e).position; if (s === 'sticky' || s === 'fixed') { e.dataset.walkSticky = '1'; e.style.position = 'static'; } } document.querySelector('.workbench-frame')?.style.setProperty('display', 'none'); });
const restick = () => p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } document.querySelector('.workbench-frame')?.style.removeProperty('display'); });
const crop = async (name, loc) => {
  if (!(await loc.count())) return null;
  await p.mouse.move(w - 3, h - 3);
  await unstick();
  await loc.first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  const file = `${PART}-${SIZE}-${name}.png`;
  await loc.first().screenshot({ path: `${OUT}/${file}`, scale: 'css' });
  await restick();
  return file;
};
const record = async (name, sel, root) => {
  const s = { shot: await crop(name, p.locator(sel)), undos: await undos(p), axe: await axe(p, root) };
  out.steps[name] = s;
  console.log(SIZE, name, '| undos', JSON.stringify(s.undos.map((u) => `${u.cls}:${u.text}:${u.decoration}:${u.w}x${u.h}`)), '| axe', Array.isArray(s.axe) ? s.axe.length : s.axe);
};

try {
  await pin(p);
  if (PART === 'where') {
    const focusOnly = h === 664;
    await p.locator('label.nyq-answer:has([data-testid=kind-chip-near_intersection])').click();
    await p.waitForTimeout(800);
    await p.locator('[data-testid=where-questions] .nyq-card .wq-next').click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(2500);
    if (!focusOnly) await record('01-confirm-kind-answered', '[data-testid=where-questions]', '[data-testid=band-where]');
    const img = p.locator('[data-testid=band-aerial-img]');
    await p.waitForFunction(() => { const i = document.querySelector('[data-testid=band-aerial-img]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 60000 });
    await p.evaluate(() => document.querySelector('[data-testid=band-aerial-frame]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(600);
    const box = await img.boundingBox();
    out.tapCentre = lastMeta;
    const at = pixelOf(CROSSING, lastMeta ?? { lat: 39.739781, lng: -104.968249 }, box.width, box.height);
    await p.mouse.click(box.x + at.x, box.y + at.y);
    await p.waitForSelector('[data-testid=cross-row]', { timeout: 90000 });
    await p.waitForFunction(() => /of where the work starts/.test(document.querySelector('[data-testid=cross-row-line]')?.innerText ?? ''), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500);
    out.crossRowText = t(await p.locator('[data-testid=cross-row]').innerText());
    if (!focusOnly) await record('02-cross-row', '[data-testid=cross-row]', '[data-testid=band-where]');
    await p.locator('[data-testid=cross-move]').focus();
    await p.keyboard.press('Shift+Tab');
    await p.keyboard.press('Tab');
    out.steps.beforeMove = await focusRead(p);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(1500);
    out.steps.afterMove = await focusRead(p);
    console.log(SIZE, 'before Move', JSON.stringify(out.steps.beforeMove), '\n', SIZE, 'after Move', JSON.stringify(out.steps.afterMove));
    out.steps.afterMove.shot = `${PART}-${SIZE}-03-after-move-viewport.png`;
    await p.screenshot({ path: `${OUT}/${out.steps.afterMove.shot}`, scale: 'css' });
    const fb = await p.locator(':focus').boundingBox();
    if (fb) {
      const file = `${PART}-${SIZE}-03b-after-move-focus-crop.png`;
      const clip = { x: Math.max(0, fb.x - 24), y: Math.max(0, fb.y - 24), width: Math.min(w - Math.max(0, fb.x - 24), fb.width + 48), height: Math.min(h - Math.max(0, fb.y - 24), fb.height + 48) };
      await p.screenshot({ path: `${OUT}/${file}`, clip, scale: 'css' });
      out.steps.afterMove.focusCrop = file;
    }
    if (!focusOnly) {
      await p.locator('[data-testid=cross-move]').click();
      await p.waitForTimeout(800);
      await p.locator('[data-testid=where-questions] .nyq-card .wq-next').click();
      await p.waitForTimeout(1500);
      await record('04-confirm-cross-answered', '[data-testid=where-questions]', '[data-testid=band-where]');
    }
  } else {
    const chips = await p.locator('[data-testid^=kind-chip-]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
    const kind = chips.find((c) => /shoulder/.test(c)) ?? chips[0];
    out.kind = kind;
    await p.locator(`label.nyq-answer:has([data-testid=${kind}])`).click();
    await p.waitForTimeout(800);
    await p.locator('[data-testid=where-questions] .nyq-card .wq-next').click();
    await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 30000 });
    await p.waitForTimeout(1200);
    await p.locator('[data-testid=where-questions] label.nyq-answer').first().click();
    await p.waitForTimeout(1500);
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
    await p.waitForTimeout(3000);
    const oneWay = p.getByRole('button', { name: /^One-way$/ });
    if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(4000); }
    const laneOk = p.getByRole('button', { name: 'Lane count is right' });
    if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(3000); }
    await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
    await p.getByTestId('generate-plan').click();
    await p.waitForSelector('[data-testid=downloads]', { timeout: 240000 });
    await p.waitForTimeout(6000);
    // The audit PDF, through the page's own button, before any answer.
    const files = p.locator('button.dl-files');
    if (await files.isVisible().catch(() => false)) { await files.click(); await p.waitForTimeout(400); }
    const btn = p.getByRole('button', { name: 'Download audit trail PDF' });
    await btn.scrollIntoViewIfNeeded();
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), btn.click()]);
    const pdf = `${process.env.PDFDIR ?? OUT}/audit-${SIZE}.pdf`;
    await dl.saveAs(pdf);
    out.pdf = { suggested: dl.suggestedFilename(), file: pdf, bytes: fs.statSync(pdf).size };
    console.log(SIZE, 'pdf', JSON.stringify(out.pdf));
    // The page's own "not checked" count, for comparison with the PDF.
    out.pageNotChecked = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /not checked/i.test(e.textContent ?? '')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 12));
    // NEEDS YOU.
    const card = () => p.locator('.needs-you .nyq-card').first();
    const settle = async () => {
      await p.waitForFunction(() => {
        const i = document.querySelector('.needs-you [data-testid=needs-you-map-img]');
        return document.querySelector('.needs-you [data-testid=needs-you-map-failed]') || !document.querySelector('.needs-you [data-testid=needs-you-map]') || (i && i.complete && i.naturalWidth > 0);
      }, null, { timeout: 90000 }).catch(() => {});
      await p.waitForTimeout(2500);
    };
    const readQ = () => p.evaluate(() => {
      const c = document.querySelector('.needs-you .nyq-card');
      const why = c?.querySelector('.nyq-why');
      return { q: (c?.querySelector('.nyq-q')?.innerText ?? '').trim(), why: (why?.innerText ?? '').replace(/\s+/g, ' ').trim(),
        label: c?.querySelector('[data-testid=needs-you-map-label]')?.innerText ?? null, failed: c?.querySelector('[data-testid=needs-you-map-failed]')?.innerText ?? null,
        hasMap: Boolean(c?.querySelector('[data-testid=needs-you-map]')),
        next: ((document.querySelector('.needs-you')?.innerText ?? '').match(/Next: [^\n]*/) ?? [null])[0] };
    });
    await p.waitForSelector('.needs-you .nyq-card .nyq-q', { timeout: 120000 });
    for (let i = 0; i < 10; i += 1) {
      await settle();
      const q = await readQ();
      if (!q.q) break;
      q.subject = out.mapRequests.filter((m) => !m.induced).at(-1) ?? null;
      q.shot = await crop(`q${i + 1}`, card());
      out.questions.push(q);
      console.log(SIZE, `q${i + 1}`, JSON.stringify(q));
      if (i === 0 && q.hasMap) {
        mapMode = 'nogeom';
        await card().locator('.nyq-map-zbtn[aria-label="Zoom out"]').first().click();
        await p.waitForFunction(() => !document.querySelector('.needs-you .nyq-card [data-testid=needs-you-map-label]'), null, { timeout: 60000 }).catch(() => {});
        await settle();
        const nq = await readQ();
        nq.subject = out.mapRequests.at(-1) ?? null;
        nq.shot = await crop('q1-induced-no-line', card());
        out.inducedNoLine = nq;
        console.log(SIZE, 'induced no-line', JSON.stringify(nq));
        mapMode = 'live';
        await card().locator('.nyq-map-zbtn[aria-label="Zoom in"]').first().click();
        await settle();
        out.afterInduced = await readQ();
      }
      if (/bike lane/i.test(q.q)) {
        out.bike = { q: q.q, why: q.why, shot: q.shot };
        out.bikeAxe = await axe(p, '.needs-you');
        const head = card().locator('.nyq-q').first();
        out.bike.headCrop = await crop('bike-heading', head);
        // ALL=1: keep stepping, to read every question's x-map-subject.
        if (!process.env.ALL) break;
      }
      await card().locator('label.nyq-answer').first().click();
      await p.waitForTimeout(600);
      const nb = card().locator('.nyq-next-btn');
      if (!(await nb.count()) || /Apply/i.test(await nb.first().innerText())) { out.stoppedAt = 'no next button'; break; }
      await nb.first().click();
      await p.waitForTimeout(1200);
      if (i === 0) await record('05-needs-you-answered', '.needs-you .nyq-answered', '.needs-you');
    }
  }
  out.overflowX = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
} catch (e) {
  out.errors.push('WALK: ' + String(e).slice(0, 500));
  console.log(SIZE, 'ERROR', String(e).slice(0, 500));
  await p.screenshot({ path: `${OUT}/${PART}-${SIZE}-error.png`, scale: 'css' }).catch(() => {});
}
await ctx.close().catch(() => {});
await b.close();
out.lateRejections = lateRejections;
fs.writeFileSync(`${OUT}/${PART}-${SIZE}.json`, JSON.stringify(out, null, 1));
console.log(SIZE, 'done | errors', JSON.stringify(out.errors), '| road-bearing', JSON.stringify(out.roadBearing));
