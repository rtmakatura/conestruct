// #446 tap-feedback walk (local), adapted from ux-group4-cross-street's walk.mjs.
// usage: SHOT_TOKEN=<gate token> node walk.mjs <outdir> <port>
// Local `next dev` on the issue-446 worktree, MODAL_RENDER_URL at the local
// backend (ux-group3's serve_replay.py, Overpass replayed).  /api/road-bearing
// is stubbed from the recorded fixture; `mode` picks its answer.  Everything
// else is live: the aerial, the tap's coordinate, the nearest-intersection
// read, the geometry read.  Playwright Chromium, DPR 2, 1440x900 and 390x844,
// a reduced-motion run at each, and a Safari-sized phone (390x664) through the
// tap and the scroll.
//
// window.scrollBy is wrapped so the walk can read what the page asked for and
// hold the scroll long enough to photograph "found, before the scroll".
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const [OUT, PORT] = process.argv.slice(2);
const TOK = process.env.SHOT_TOKEN ?? '';
const BASE = `http://localhost:${PORT}`;
// The issue's 1550 E Colfax at 1440.  At 390 that pin puts Franklin at the
// picture's left edge, so that width walks from 1600 E Colfax, as #440's did.
const addrFor = (w) => process.env.ADDR ?? (w === 390 ? '1600 E Colfax Ave, Denver' : '1550 E Colfax Ave, Denver');
fs.mkdirSync(OUT, { recursive: true });

const FIX = JSON.parse(fs.readFileSync(new URL('../../../ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json', import.meta.url), 'utf8'));
const PIN0 = { lat: 39.739781, lng: -104.968249 };
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => { const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)); const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)); return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; };
const distM = (a, at) => Math.hypot((a.lat - at.lat) * 111320, (a.lon - at.lng) * 111320 * Math.cos(rad(at.lat)));
const COLFAX_WEST = [1547338997, 1547338998, 223788857, 600545918, 791808880];
function chainGeometry(ids) {
  const out = [];
  for (const id of ids) {
    const g = FIX.elements.find((e) => e.type === 'way' && e.id === id).geometry;
    for (const n of g) { const l = out[out.length - 1]; if (!l || l.lat !== n.lat || l.lon !== n.lon) out.push(n); }
  }
  return out;
}
function candFromWay(id, at, chain = null) {
  const w = FIX.elements.find((e) => e.type === 'way' && e.id === id);
  const g = chain ? chainGeometry(chain) : w.geometry;
  let i = 0; g.forEach((n, k) => { if (distM(n, at) < distM(g[i], at)) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return { way_id: String(id), highway_class: w.tags.highway, name: w.tags.name, ref: s('ref'), bearing: +brg(a, b).toFixed(2),
    snap_distance_m: +distM(g[i], at).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
    tags: { oneway: s('oneway'), maxspeed: s('maxspeed'), lanes: s('lanes'), lanes_forward: s('lanes:forward'), lanes_backward: s('lanes:backward'),
      lanes_both_ways: s('lanes:both_ways'), turn_lanes: s('turn:lanes'), turn_lanes_forward: s('turn:lanes:forward'), turn_lanes_backward: s('turn:lanes:backward') },
    geometry: g.map((n) => [n.lat, n.lon]) };
}
const det = (cands) => JSON.stringify({ scan_status: 'ok', primary_index: 0, isUrban: true, placeName: 'Denver', candidates: cands });
const STUB = {
  cross: det([candFromWay(1547338997, CROSSING, COLFAX_WEST), candFromWay(492215711, CROSSING)]),
  none: det([candFromWay(1547338997, CROSSING, COLFAX_WEST)]),
};
function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}

const BAND = '[data-testid=band-where]';
async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(150); }
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('[data-testid=band-where]') ?? document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  });
}
async function targets(p) {
  return p.evaluate(() => {
    const ids = ['band-aerial-big-map', 'band-aerial-retry', 'cross-move', 'cross-undo', 'cross-retry', 'cross-big-map', 'where-open-picker'];
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
async function read(p) {
  return p.evaluate(() => {
    const t = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const q = (id) => document.querySelector(`[data-testid=${id}]`);
    const frame = q('band-aerial-frame'), bar = q('band-aerial-bar'), ring = q('band-aerial-ring');
    const after = frame ? getComputedStyle(frame, '::after') : null;
    const bs = bar ? getComputedStyle(bar) : null;
    const rs = ring ? getComputedStyle(ring) : null;
    const a = document.activeElement;
    const next = document.querySelector('[data-testid=where-questions] .nyq-card .wq-next');
    const row = q('cross-row');
    const nav = document.querySelector('.a-nav, nav');
    return {
      scrollY: Math.round(window.scrollY),
      viewportH: window.innerHeight,
      bar: bar ? { kind: frame.getAttribute('data-bar'), text: t(bar.innerText), role: bar.getAttribute('role'), bg: bs.backgroundColor, color: bs.color, font: `${bs.fontSize}/${bs.fontWeight}`, rect: r(bar), scrollH: bar.scrollHeight, clientH: bar.clientHeight } : null,
      outline: after ? `${after.borderTopWidth} ${after.borderTopStyle} ${after.borderTopColor}` : null,
      armed: frame?.classList.contains('is-armed') ?? false,
      ring: ring ? { look: ring.getAttribute('data-look'), border: `${rs.borderTopWidth} ${rs.borderTopStyle} ${rs.borderTopColor}`, rect: r(ring) } : null,
      mark: r(q('band-aerial-mark')),
      label: t(q('band-aerial-mark-label')?.innerText) || null,
      frame: r(frame), edit: r(q('where-open-picker')), zoom: r(q('band-aerial-zoom')), big: r(q('band-aerial-big-map')),
      row: r(row), next: r(next), nextText: t(next?.innerText) || null, nav: r(nav),
      both_in_view: row && next ? row.getBoundingClientRect().top >= (nav?.getBoundingClientRect().bottom ?? 0) && next.getBoundingClientRect().bottom <= window.innerHeight : null,
      gapAerialToRow: row && frame ? +(row.getBoundingClientRect().top - frame.getBoundingClientRect().bottom).toFixed(1) : null,
      barClearOfNav: bar && nav ? bar.getBoundingClientRect().top >= nav.getBoundingClientRect().bottom : null,
      wordsTop: (() => { const w = bar?.querySelector('.a-aerial-bar-text'); return w ? +(w.getBoundingClientRect().top + parseFloat(getComputedStyle(w).paddingTop)).toFixed(1) : null; })(),
      wordsClearOfNav: (() => { const w = bar?.querySelector('.a-aerial-bar-text'); return w && nav ? w.getBoundingClientRect().top + parseFloat(getComputedStyle(w).paddingTop) >= nav.getBoundingClientRect().bottom : null; })(),
      retryInBar: !!q('band-aerial-retry'),
      inView: (() => {
        const top = nav?.getBoundingClientRect().bottom ?? 0;
        const whole = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.top >= top && b.bottom <= window.innerHeight; };
        return { box: whole(q('band-aerial-mark')), label: whole(q('band-aerial-mark-label')), row: whole(row), next: whole(next), heading: whole(q('cross-row-name')) };
      })(),
      aerialVisiblePx: frame ? Math.round(Math.max(0, Math.min(frame.getBoundingClientRect().bottom, window.innerHeight) - Math.max(frame.getBoundingClientRect().top, nav?.getBoundingClientRect().bottom ?? 0))) : null,
      focus: a ? { tag: a.tagName, testid: a.getAttribute('data-testid') } : null,
      focusVisibleOutline: a && a !== document.body ? getComputedStyle(a).outlineStyle : null,
      liveRegions: document.querySelectorAll('[data-testid=band-where] [role=status]').length,
      cardLine: t(q('cross-finding')?.innerText) || t(q('cross-none')?.innerText) || t(q('cross-failed')?.innerText) || null,
      rowName: t(q('cross-row-name')?.innerText) || null,
      rowLine: t(q('cross-row-line')?.innerText) || null,
      scrolls: window.__scrolls ?? [],
      docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

async function run(w, h, { reduced = false, short = false, fromY = null, failedRun = false, r4 = false } = {}) {
  const tag = r4 ? `r4-${w}x${h}${reduced ? '-reduced' : ''}` : short ? `${w}x${h}${fromY !== null ? `-y${fromY}` : ''}${failedRun ? '-failed' : ''}` : `${w}${reduced ? '-reduced' : ''}`;
  const b = await chromium.launch();
  const out = { steps: [], errors: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference', extraHTTPHeaders: { 'x-conestruct-gate': TOK } });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__scrolls = [];
    const real = window.scrollBy.bind(window);
    window.__realScrollBy = real;
    window.scrollBy = (arg) => {
      window.__scrolls.push(arg);
      if (window.__holdScroll) { window.__pending = arg; return; }
      real(arg);
    };
  });
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
  let mode = 'pin';
  const seen = { aerialPoint: 0, lastMeta: null };
  p.on('request', (r) => {
    if (r.method() !== 'POST') return;
    if (r.url().includes('/api/aerial-point')) seen.aerialPoint++;
    if (r.url().includes('/api/render/corridor-geometry')) {
      const m = JSON.parse(r.postData() ?? '{}').scenario?.meta;
      if (m) seen.lastMeta = { lat: m.lat, lng: m.lng };
    }
  });
  await p.route('**/api/road-bearing**', async (r) => {
    if (mode === 'fail') return r.fulfill({ status: 502, contentType: 'text/plain', body: 'down' });
    if (mode === 'slow') await new Promise((res) => setTimeout(res, 2500));
    const asked = JSON.parse(r.request().postData() ?? 'null');
    const body = mode === 'pin' ? det([candFromWay(1547338997, { lat: asked.lat, lng: asked.lng }, COLFAX_WEST)]) : mode === 'none' ? STUB.none : STUB.cross;
    return r.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const crop = async (sel, name) => {
    const l = p.locator(sel).first();
    if (!(await l.count()) || !(await l.isVisible())) return null;
    const file = `${tag}-${nn()}-${name}.png`;
    await l.screenshot({ path: `${OUT}/${file}` });
    return file;
  };
  const view = async (name) => { const file = `${tag}-${nn()}-${name}-viewport.png`; await p.screenshot({ path: `${OUT}/${file}` }); return file; };
  // A crop and a viewport with the frame clear of the sticky nav; the page's
  // scroll is read before this moves it.
  const frameClear = () => p.evaluate(() => {
    const f = document.querySelector('[data-testid=band-aerial-frame]').getBoundingClientRect();
    const n = document.querySelector('.a-nav, nav')?.getBoundingClientRect().bottom ?? 0;
    window.scrollBy({ top: f.top - n - 16, behavior: 'instant' });
  });
  const step = async (name, { measure = false, aerial = true, viewport = false, clear = false } = {}) => {
    const s = { name, ...(await read(p)) };
    if (clear) { await frameClear(); await p.waitForTimeout(200); }
    if (viewport) s.viewShot = await view(name);
    if (aerial) s.shot = await crop('[data-testid=band-aerial]', name);
    if (measure) { s.axe = await axe(p); s.targets = await targets(p); }
    out.steps.push(s);
    console.log(tag, name, '| bar:', s.bar?.kind, '| scrollY', s.scrollY, '| focus', s.focus?.testid ?? s.focus?.tag, '| axe', s.axe?.length ?? '-');
    return s;
  };
  const tapPoint = async () => {
    const img = p.locator('[data-testid=band-aerial-img]');
    const box = await img.boundingBox();
    const pin = seen.lastMeta ?? PIN0;
    return { img, at: pixelOf(CROSSING, pin, box.width, box.height) };
  };
  // A person's tap: the mouse at the crossing's pixel, so the walk's own
  // click never scrolls the page (locator.click would).
  const tap = async () => {
    const { img, at } = await tapPoint();
    const box = await img.boundingBox();
    await p.mouse.click(box.x + at.x, box.y + at.y);
  };
  // The same for a button: locator.click scrolls it to the middle first, and
  // these steps measure that nothing scrolls.
  const press = async (id) => {
    const box = await p.locator(`[data-testid=${id}]`).boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  // The issue's reproduction: the aerial on screen, the CONFIRM card off it.
  const cardOffScreen = async () => {
    await p.evaluate(() => {
      const f = document.querySelector('[data-testid=band-aerial-frame]').getBoundingClientRect();
      window.scrollBy({ top: f.bottom - (window.innerHeight - 8), behavior: 'instant' });
    });
    await p.waitForTimeout(200);
  };
  const settleScroll = async () => {
    let last = -1; const trail = [];
    for (let i = 0; i < 40; i++) {
      const y = await p.evaluate(() => Math.round(window.scrollY));
      trail.push(y);
      if (y === last && i > 6) break;
      last = y; await p.waitForTimeout(50);
    }
    return trail;
  };
  try {
    await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(addrFor(w));
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
    if (await want.count()) await want.first().click().catch(() => {});
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=kind-chip-near_intersection]', { state: 'attached', timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.locator('label.nyq-answer:has([data-testid=kind-chip-near_intersection])').click();
    await p.waitForTimeout(800);
    await p.locator('[data-testid=where-questions] .nyq-card .wq-next').click();
    await p.waitForSelector('[data-testid=band-aerial-bar]', { timeout: 30000 });
    await p.waitForTimeout(1500);
    await park(p);
    await step('01-armed', { measure: !reduced && !short && !r4, clear: true });

    // Round 4 (T24, T25): what Move, a failed tap and the card's Try again
    // ask of the page, read around each press, with a viewport shot of what
    // a person is left looking at.
    if (r4) {
      const rects = () => p.evaluate(() => {
        const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
        return {
          scrollY: Math.round(window.scrollY),
          innerHeight: window.innerHeight,
          nav: +(document.querySelector('.a-nav, nav')?.getBoundingClientRect().bottom ?? 0).toFixed(1),
          frame: box('[data-testid=band-aerial-frame]'),
          bar: box('[data-testid=band-aerial-bar]'),
          retry: box('[data-testid=band-aerial-retry]'),
          row: box('[data-testid=cross-row]'),
          asked: window.__scrolls,
          focus: document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName,
        };
      });
      const clearAsks = () => p.evaluate(() => { window.__scrolls = []; });
      // The page stopped with the bar's top `by` px under the nav.
      const barUnderNav = async (by) => {
        await p.evaluate((d) => {
          const b = document.querySelector('[data-testid=band-aerial-bar]').getBoundingClientRect();
          const n = document.querySelector('.a-nav, nav')?.getBoundingClientRect().bottom ?? 0;
          window.scrollBy({ top: b.top - n + d, behavior: 'instant' });
        }, by);
        await p.waitForTimeout(200);
      };
      const barIs = (kind) => p.waitForFunction((k) => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === k, kind, { timeout: 30000 });
      const pressCentred = async (id) => {
        await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }), `[data-testid=${id}]`);
        await p.waitForTimeout(200);
        await clearAsks();
        await press(id);
        await settleScroll();
        await p.waitForTimeout(300);
      };
      const m = (out.round4 = {});

      // A found tap, its scroll done.
      mode = 'cross';
      await cardOffScreen();
      await tap();
      await barIs('found');
      await p.waitForFunction(() => /of where the work starts/.test(document.querySelector('[data-testid=cross-row-line]')?.innerText ?? ''), null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(600);
      await settleScroll();
      await park(p);
      m.foundScrolled = await rects();
      await view('found-scrolled');

      // T24: Move from where that left the page.  The row is on screen there.
      const moveBox = await p.locator('[data-testid=cross-move]').boundingBox();
      await clearAsks();
      m.beforeMove = await rects();
      await p.mouse.click(moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2);
      await settleScroll();
      await p.waitForTimeout(300);
      await park(p);
      m.afterMove = await rects();
      m.barAfterMove = await p.locator('[data-testid=band-aerial-bar]').innerText();
      await view('after-move');
      await crop('[data-testid=band-aerial]', 'after-move-aerial');

      // Move's Cancel, then Move again with the picture already there if it can be.
      await pressCentred('cross-move');
      m.cancelAsked = await p.evaluate(() => window.__scrolls);
      await pressCentred('cross-undo');
      m.undoAsked = await p.evaluate(() => window.__scrolls);
      await barIs('armed');
      await p.waitForTimeout(1000);

      // T25: a failed tap with the bar's top 30 px under the nav.
      mode = 'fail';
      await barUnderNav(30);
      await clearAsks();
      m.beforeFailedHidden = await rects();
      await tap();
      await barIs('failed');
      await settleScroll();
      await p.waitForTimeout(300);
      await park(p);
      m.afterFailedHidden = await rects();
      await view('failed-was-hidden');

      // T25: the bar one px clear of the nav, already all there.
      await barUnderNav(-1);
      await clearAsks();
      m.beforeFailedVisible = await rects();
      await tap();
      await p.waitForTimeout(1200);
      await settleScroll();
      await park(p);
      m.afterFailedVisible = await rects();
      await view('failed-bar-in-view');

      // T25, T26: the card's Try again, with the bar off screen: no scroll, focus kept.
      await p.locator('[data-testid=cross-retry]').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await p.waitForTimeout(200);
      await clearAsks();
      m.beforeCardRetry = await rects();
      await p.locator('[data-testid=cross-retry]').focus();
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'cross-retry', null, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(800);
      await settleScroll();
      m.afterCardRetry = await rects();
      await view('card-retry-failed-again');

      // T26: the card's Try again answering "no street": focus stays at the card.
      mode = 'none';
      await clearAsks();
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'cross-none', null, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(500);
      m.afterCardRetryNone = await rects();
      m.afterCardRetryNone.noneLine = await p.locator('[data-testid=cross-none]').evaluate((e) => { const r = e.getBoundingClientRect(); return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) }; });
      await view('card-retry-no-street');

      // Back to a failed answer, so the next tap is armed from the same state.
      mode = 'fail';
      await p.waitForTimeout(100);

      // "No street there" with the bar hidden: ruling 4 stands, no scroll.
      mode = 'none';
      await barUnderNav(30);
      await clearAsks();
      await tap();
      await barIs('none');
      await p.waitForTimeout(600);
      await park(p);
      m.afterNoStreetHidden = await rects();
      await view('no-street-hidden');

      await ctx.close(); await b.close();
      console.log(tag, 'ok');
      return out;
    }

    // The tap, the lookup held 2.5 s; the first read comes straight after the click.
    mode = 'slow';
    await cardOffScreen();
    // T19: a person who scrolled back up and stopped with the bar under the nav.
    if (fromY !== null) { await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), fromY); await p.waitForTimeout(200); }
    await step('01b-card-off-screen', { aerial: false, viewport: true });
    // Review finding: a failed tap with the page stopped at y=260: the bar's
    // words and Try again sit where?  Ruling 4 doesn't scroll.
    if (failedRun) {
      mode = 'fail';
      await tap();
      await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === 'failed', null, { timeout: 20000 });
      await p.waitForTimeout(300); await park(p);
      await step('09-failed', { aerial: false, viewport: true });
      await ctx.close(); await b.close();
      console.log(tag, 'ok');
      return out;
    }
    await p.evaluate((held) => { window.__scrolls = []; window.__holdScroll = held; }, !reduced);
    await tap();
    const instant = await read(p);
    out.instant = { barKind: instant.bar?.kind, barText: instant.bar?.text, ring: instant.ring?.look ?? null, cardLine: instant.cardLine, liveRegions: instant.liveRegions };
    await park(p);
    await step('02-finding', { measure: !reduced && !short, viewport: !reduced });
    await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === 'found', null, { timeout: 30000 });
    // T15: the ask comes when the read has answered.
    await p.waitForFunction(() => /of where the work starts/.test(document.querySelector('[data-testid=cross-row-line]')?.innerText ?? ''), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(150);
    await park(p);
    // Under reduced motion the jump has already happened by this read.
    await step(reduced ? '03-found-after-jump' : '03-found-before-scroll', { viewport: true, aerial: !reduced });
    const pending = await p.evaluate(() => window.__pending ?? null);
    out.askedScroll = pending;
    out.askedAll = await p.evaluate(() => window.__scrolls);
    await p.evaluate(() => { window.__holdScroll = false; const a = window.__pending; window.__pending = null; if (a) window.__realScrollBy(a); });
    out.scrollTrail = await settleScroll();
    await p.waitForTimeout(600);
    await step('04-found-after-scroll', { measure: !reduced, viewport: !reduced, aerial: !reduced });
    if (!reduced) await crop('[data-testid=where-questions]', 'found-card');

    if (reduced || short) {
      await ctx.close(); await b.close();
      console.log(tag, 'ok');
      return out;
    }

    // A crop scrolls the page to its subject, so these three read scrollY
    // around the press itself, with the row in view first.
    const noScroll = async (label, id) => {
      await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }), `[data-testid=${id}]`);
      await p.waitForTimeout(200);
      const y0 = await p.evaluate(() => { window.__scrolls = []; return window.scrollY; });
      await press(id); await p.waitForTimeout(400);
      const r = await p.evaluate(() => ({ y: window.scrollY, asked: window.__scrolls.length }));
      (out.noScroll ??= {})[label] = { before: Math.round(y0), after: Math.round(r.y), asked: r.asked };
    };

    // Move: re-arms, and T24 brings the picture back (read here from the row
    // in view).  Cancel: back to found, no scroll.
    await noScroll('move', 'cross-move');
    await park(p);
    await step('05-move-rearmed', { measure: true, viewport: true, clear: true });
    await noScroll('cancel', 'cross-move');
    await step('06-cancel', { aerial: false });

    // Undo: clears the box, no scroll.
    await noScroll('undo', 'cross-undo'); await p.waitForTimeout(1000);
    await park(p);
    await step('07-undo', { clear: true });

    // "No street there".
    mode = 'none';
    await cardOffScreen();
    await p.evaluate(() => { window.__scrolls = []; });
    await tap();
    await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === 'none', null, { timeout: 20000 });
    await p.waitForTimeout(300); await park(p);
    await step('08-no-street', { measure: true });

    // Failed: Try again in the bar, the dashed ring, no scroll.
    mode = 'fail';
    await tap();
    await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === 'failed', null, { timeout: 20000 });
    await p.waitForTimeout(300); await park(p);
    await step('09-failed', { measure: true, viewport: true });

    // Try again by keyboard: fails again, focus comes back; then it answers.
    await p.locator('[data-testid=band-aerial-retry]').focus();
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-retry]') !== null && document.activeElement?.getAttribute('data-testid') === 'band-aerial-retry', null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(200);
    await step('10-retry-failed-again', { aerial: false });
    mode = 'cross';
    const pts = seen.aerialPoint;
    await p.locator('[data-testid=band-aerial-retry]').focus();
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === 'found', null, { timeout: 30000 });
    await p.waitForTimeout(1800);
    out.retryTrail = await settleScroll();
    await step('11-retried-found', { viewport: true });
    out.retrySamePoint = seen.aerialPoint === pts;

    // Both already in view: a tall viewport, no scroll; focus still lands.
    await p.locator('[data-testid=cross-undo]').click(); await p.waitForTimeout(1200);
    await p.setViewportSize({ width: w, height: 1800 });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(500);
    await p.evaluate(() => { window.__scrolls = []; });
    await tap();
    await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === 'found', null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await step('12-already-in-view', { aerial: false });

    // T20: a failed tap, then the big map, then its Save.
    await press('cross-undo'); await p.waitForTimeout(1200);
    await p.setViewportSize({ width: w, height: h });
    await p.waitForTimeout(300);
    mode = 'fail';
    await cardOffScreen();
    await tap();
    await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === 'failed', null, { timeout: 20000 });
    await p.waitForTimeout(300);
    await step('13-failed-before-big-map', { aerial: false });
    mode = 'cross';
    await p.locator('[data-testid=band-aerial-big-map]').click();
    await p.waitForSelector('[role=dialog]', { timeout: 30000 });
    await p.waitForTimeout(3000);
    const canvas = p.locator('[role=dialog] canvas.mapboxgl-canvas').first();
    const cb = await canvas.boundingBox();
    await canvas.click({ position: { x: cb.width / 2, y: cb.height / 2 - 60 } });
    await p.waitForTimeout(3500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForFunction(() => document.querySelector('[data-testid=band-aerial-frame]')?.getAttribute('data-bar') === 'found', null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await park(p);
    await step('14-after-big-map-save', { measure: true, viewport: true, clear: true });
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
if (process.env.R4_ONLY) {
  for (const [w, h, reduced] of [[1440, 900, false], [1440, 700, false], [390, 844, false], [390, 664, false], [390, 664, true]]) {
    M[`r4-${w}x${h}${reduced ? '-reduced' : ''}`] = await run(w, h, { r4: true, reduced });
  }
  fs.writeFileSync(`${OUT}/walk-r4.json`, JSON.stringify(M, null, 1));
  process.exit(0);
}
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
if (process.env.Y260_ONLY) M['390x664-y260'] = await run(390, 664, { short: true, fromY: 260 });
for (const [w, h] of process.env.SHORT_ONLY || process.env.Y260_ONLY ? [] : [[1440, 900], [390, 844]].filter(([x]) => WIDTHS.includes(x))) {
  M[`${w}`] = await run(w, h);
  M[`${w}-reduced`] = await run(w, h, { reduced: true });
}
if (!process.env.Y260_ONLY && WIDTHS.includes(390)) {
  M['390x664'] = await run(390, 664, { short: true });
  M['390x664-y260'] = await run(390, 664, { short: true, fromY: 260 });
  M['390x664-y260-failed'] = await run(390, 664, { short: true, fromY: 260, failedRun: true });
}
// At 1440x900 the card's button is already in view from the page's top, so a
// shorter window shows the scroll at this width.
if (!process.env.Y260_ONLY && WIDTHS.includes(1440)) M['1440x700'] = await run(1440, 700, { short: true });
fs.writeFileSync(`${OUT}/walk${process.env.SHORT_ONLY ? '-short' : process.env.Y260_ONLY ? '-y260' : ''}.json`, JSON.stringify(M, null, 1));
