// usage: node shoot.mjs <before|after> <outdir>
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium, webkit } = require('playwright');
const [phase, OUT] = process.argv.slice(2);
const TOK = fs.readFileSync(new URL('../l2tok.txt', import.meta.url), 'utf8').trim();
const BASE = 'http://localhost:3412';
fs.mkdirSync(OUT, { recursive: true });
const M = {};
const log = (...a) => console.log(phase, ...a);

async function ctxFor(engine, w, h) {
  const b = await (engine === 'webkit' ? webkit : chromium).launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2,
    extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  return { b, ctx, p };
}

async function measureHead(p) {
  return p.evaluate(() => {
    const h = document.querySelector('.a-open .a-head');
    const st = h?.querySelector('.tr-step');
    const sec = h?.querySelector('.tr-section');
    const prov = h?.querySelector('.a-prov');
    const r = (e) => e ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(e.getBoundingClientRect()) : null;
    const lh = st ? parseFloat(getComputedStyle(st).lineHeight) : null;
    return { stepText: st?.innerText, step: r(st), stepLineHeight: lh, stepLines: st ? Math.round(st.getBoundingClientRect().height / lh) : null,
      section: r(sec), prov: r(prov), provText: prov?.innerText, head: r(h),
      scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
  });
}

async function measureNav(p) {
  return p.evaluate(() => {
    const nav = document.querySelector('nav');
    const cells = [...nav.querySelectorAll('a, span, div, button')].filter(e => {
      const s = getComputedStyle(e); const r = e.getBoundingClientRect();
      return r.width > 0 && (parseFloat(s.borderRightWidth) > 0 || parseFloat(s.borderLeftWidth) > 0);
    }).map(e => ({ tag: e.tagName, text: e.innerText.trim().slice(0, 30), x: Math.round(e.getBoundingClientRect().x), w: Math.round(e.getBoundingClientRect().width),
      borderRight: getComputedStyle(e).borderRightWidth, borderLeft: getComputedStyle(e).borderLeftWidth }));
    return { navWidth: Math.round(nav.getBoundingClientRect().width), borderedCells: cells };
  });
}

async function stubRoad(p) {
  await p.route('**/api/road-bearing**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver',
    candidates: [{ way_id: '900001', highway_class: 'secondary', name: 'East Colfax Avenue', ref: null, bearing: 270, snap_distance_m: 6.1,
      snapped_lat: 39.74003, snapped_lng: -104.96555, signal_distance_m: null,
      tags: { oneway: null, maxspeed: '30 mph', lanes: '4', lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null } }] }) }));
}

async function sandbox(p) {
  await stubRoad(p);
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.waitForTimeout(800);
}

async function toKindChips(p) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill('East Colfax Avenue & Williams Street, Denver');
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 90000 }).catch(() => {});
  const d = p.getByRole('dialog');
  await d.getByRole('button', { name: /Colfax/i }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector('[data-testid=kind-chip-flagger_lane_closure]', { timeout: 60000 });
  await p.waitForTimeout(1500);
}

const TEXTC = `(el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, l = Infinity, r = -Infinity;
  while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) { l = Math.min(l, q.left); r = Math.max(r, q.right); } }
  return [l, r]; }`;
async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
async function pxShot(p, tag, name) { await p.screenshot({ path: `${OUT}/../px/${phase}-${tag}-${name}.png` }); }

async function chipShot(p, tag) {
  const chip = p.locator('[data-testid=kind-chip-flagger_lane_closure]');
  await chip.click();
  await p.waitForTimeout(600);
  const row = p.locator('.a-chips[aria-label="Kind of work"]');
  await row.scrollIntoViewIfNeeded();
  await park(p);
  const rects = await p.evaluate((TC) => { const textc = eval(TC); return [...document.querySelectorAll('[data-testid^=kind-chip-]')].map(c => {
    const f = c.querySelector('.tr-field').getBoundingClientRect(); const r = c.getBoundingClientRect();
    const [tl, tr] = textc(c.querySelector('.tr-field')); const cs = getComputedStyle(c);
    const after = getComputedStyle(c.querySelector('.tr-field'), '::after');
    return { id: c.dataset.testid, pressed: c.getAttribute('aria-pressed'), chip: [Math.round(r.width), Math.round(r.height)], label: [Math.round(f.x - r.x), Math.round(f.width), Math.round(f.height)], afterContent: after.content, afterVisibility: after.visibility, afterColor: after.color,
      labelTextLeftX: +(tl - r.x).toFixed(2), labelTextCentreX: +((tl + tr) / 2 - r.x).toFixed(2), borderColor: cs.borderTopColor,
      vrect: [r.x, r.y, r.width, r.height] };
  }); }, TEXTC);
  await pxShot(p, tag, 'chips');
  await row.screenshot({ path: `${OUT}/${tag}-w12-kind-chip-selected.png` });
  return rects;
}

async function toWhat(p) {
  await p.getByRole('button', { name: /^Confirm/ }).click();
  await p.waitForSelector('.a-seg', { timeout: 90000 });
  await p.waitForTimeout(3000);
}

async function segShot(p, tag) {
  const seg = p.locator('.a-seg').first();
  await seg.scrollIntoViewIfNeeded();
  await park(p);
  const info = await p.evaluate((TC) => { const textc = eval(TC); return [...document.querySelectorAll('.a-seg')].map(s => ({ name: s.getAttribute('aria-label'),
    opts: [...s.querySelectorAll('button')].map(b => { const lab = b.querySelector('.a-seg-label'); const a = getComputedStyle(lab || b, '::before'); const r = b.getBoundingClientRect();
      const [tl, tr] = textc(b);
      return { t: b.innerText.replace(/^✓ /, ''), pressed: b.getAttribute('aria-pressed'), w: Math.round(r.width), h: Math.round(r.height), checkContent: a.content, checkPosition: a.position,
        labelTextCentreX: +((tl + tr) / 2 - r.x).toFixed(2), buttonCentreX: +(r.width / 2).toFixed(2), vrect: [r.x, r.y, r.width, r.height] }; }) })); }, TEXTC);
  await pxShot(p, tag, 'seg');
  const box = await seg.evaluate(s => { const c = s.closest('.a-cell') || s.parentElement; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await p.screenshot({ path: `${OUT}/${tag}-w12-toggle-pressed.png`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, (await p.viewportSize()).width), height: box.height + 16 } });
  return info;
}

async function selectShot(p, tag) {
  const sel = p.locator('select.a-fld').first();
  await sel.scrollIntoViewIfNeeded();
  await park(p);
  await p.waitForTimeout(400);
  const cs = await p.evaluate(() => [...document.querySelectorAll('select.a-fld')].slice(0, 4).map(s => { const c = getComputedStyle(s); const r = s.getBoundingClientRect(); return { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], label: s.getAttribute('aria-label') || s.id, value: s.options[s.selectedIndex]?.text, color: c.color, bg: c.backgroundColor, colorScheme: c.colorScheme, appearance: c.appearance || c.webkitAppearance }; }));
  await p.screenshot({ path: `${OUT}/${tag}-w13-select.png` });
  return cs;
}

const run = async (engine, w, h, tag, flow) => {
  const { b, p } = await ctxFor(engine, w, h);
  const out = { consoleErrors: [], pageErrors: [], devOverlay: [] };
  p.on('console', m => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 400)); });
  out.failedHosts = {}; p.on('requestfailed', r => { const h = new URL(r.url()).host + ' ' + (r.failure()?.errorText || ''); out.failedHosts[h] = (out.failedHosts[h] || 0) + 1; });
  out.httpErrors = {}; p.on('response', r => { if (r.status() >= 400) { const u = new URL(r.url()); const k = r.status() + ' ' + u.host + u.pathname; out.httpErrors[k] = (out.httpErrors[k] || 0) + 1; } });
  p.on('pageerror', e => out.pageErrors.push(String(e).slice(0, 400)));
  const overlay = async (where) => out.devOverlay.push([where, await p.evaluate(() => { const h = document.querySelector('nextjs-portal'); return h ? (h.shadowRoot?.textContent || '').replace(/\s+/g, ' ').slice(0, 300) : null; })]);
  try {
    await sandbox(p);
    await park(p);
    out.head = await measureHead(p);
    out.nav = await measureNav(p);
    await p.screenshot({ path: `${OUT}/${tag}-w15-w21-step1-head.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, (out.head.head?.y ?? 300) + (out.head.head?.h ?? 60) + 20) } });
    if (flow) {
      await toKindChips(p);
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(300);
      await park(p);
      out.located_head = await measureHead(p);
      const hb = out.located_head.head;
      await p.screenshot({ path: `${OUT}/${tag}-w15-step1-head-located.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, hb.y + hb.h + 20) } });
      out.chips = await chipShot(p, tag);
      await toWhat(p);
      out.what_head = await measureHead(p);
      out.seg = await segShot(p, tag);
      out.selects = await selectShot(p, tag);
      await overlay('after selects');
    }
  } catch (e) { out.error = String(e).slice(0, 300); await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {}); }
  await b.close();
  M[tag] = out;
  log(tag, out.error || 'ok');
};

const which = process.argv[4] || 'all';
if (which === 'all' || which === 'c') {
  await run('chromium', 1440, 900, '1440', true);
  await run('chromium', 390, 844, '390', true);
  await run('chromium', 360, 780, '360', true);
}
if (which === 'all' || which === 'w') {
  await run('webkit', 390, 844, '390-webkit', true);
}
fs.writeFileSync(`${OUT}/../measure-${phase}-${which}.json`, JSON.stringify(M, null, 1));
