// Checks 4-8 (L2) on production: Chromium 1440, 390, 360 and WebKit 390. Live road detection.
// usage: node l2.mjs [tag]
import { open, park, sandbox, locate, save, clean, tileWatch, settle, SHOTS } from './lib.mjs';
const M = {};
const HEAD = () => {
  const h = document.querySelector('.a-open .a-head'); const st = h?.querySelector('.tr-step');
  const r = (e) => e ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(e.getBoundingClientRect()) : null;
  const lh = st ? parseFloat(getComputedStyle(st).lineHeight) : null;
  const rg = st ? document.createRange() : null; if (rg) rg.selectNodeContents(st);
  const tops = rg ? new Set([...rg.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size : null;
  return { stepText: st?.innerText, step: r(st), stepLineHeight: lh, stepLinesByHeight: st ? Math.round(st.getBoundingClientRect().height / lh) : null, stepLinesByRects: tops,
    head: r(h), scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
};
const NAV = () => {
  const nav = document.querySelector('nav');
  const cells = [...nav.querySelectorAll('a, span, div, button')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect();
    return r.width > 0 && (parseFloat(s.borderRightWidth) > 0 || parseFloat(s.borderLeftWidth) > 0); })
    .map(e => ({ tag: e.tagName, text: e.innerText.trim().slice(0, 30), x: Math.round(e.getBoundingClientRect().x), w: Math.round(e.getBoundingClientRect().width),
      borderRight: getComputedStyle(e).borderRightWidth, borderLeft: getComputedStyle(e).borderLeftWidth }));
  const wm = [...nav.querySelectorAll('a')].find(a => /conestruct/i.test(a.innerText));
  return { navWidth: Math.round(nav.getBoundingClientRect().width), borderedCells: cells,
    wordmark: wm ? { text: wm.innerText.trim(), borderRight: getComputedStyle(wm).borderRightWidth, w: Math.round(wm.getBoundingClientRect().width) } : null };
};
// Text-node client-rect centre minus the control's own centre (0 = centred; a shift shows as a change).
const CHIP = (id) => {
  const c = document.querySelector(`[data-testid=${id}]`); const f = c.querySelector('.tr-field'); const r = c.getBoundingClientRect();
  const w = document.createTreeWalker(f, NodeFilter.SHOW_TEXT); let n, l = Infinity, rr = -Infinity;
  while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) { l = Math.min(l, q.left); rr = Math.max(rr, q.right); } }
  const a = getComputedStyle(f, '::after');
  return { pressed: c.getAttribute('aria-pressed'), labelTextLeftX: +(l - r.x).toFixed(2), labelTextCentreX: +((l + rr) / 2 - r.x).toFixed(2), chipW: +r.width.toFixed(2),
    checkContent: a.content, checkVisibility: a.visibility, checkColor: a.color, borderColor: getComputedStyle(c).borderTopColor, vrect: [r.x, r.y, r.width, r.height] };
};
const SEG = (label) => {
  const b = [...document.querySelectorAll('.a-seg > button')].find(x => x.innerText.replace(/^✓\s*/, '').trim() === label);
  const r = b.getBoundingClientRect(); const lab = b.querySelector('.a-seg-label') || b;
  const w = document.createTreeWalker(lab, NodeFilter.SHOW_TEXT); let n, l = Infinity, rr = -Infinity;
  while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) { l = Math.min(l, q.left); rr = Math.max(rr, q.right); } }
  const a = getComputedStyle(lab, '::before');
  return { label, pressed: b.getAttribute('aria-pressed'), labelTextCentreX: +((l + rr) / 2 - r.x).toFixed(2), buttonCentreX: +(r.width / 2).toFixed(2),
    checkContent: a.content, checkPosition: a.position, checkColor: a.color, vrect: [r.x, r.y, r.width, r.height] };
};
const SELECTS = () => [...document.querySelectorAll('select.a-fld')].slice(0, 4).map(s => { const c = getComputedStyle(s); const r = s.getBoundingClientRect();
  return { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], label: s.getAttribute('aria-label') || s.id, value: s.options[s.selectedIndex]?.text, color: c.color, bg: c.backgroundColor, colorScheme: c.colorScheme }; });

const run = async (engine, w, h, tag) => {
  const { b, p, log } = await open(engine, w, h);
  const inflight = tileWatch(p);
  const o = { log };
  try {
    await sandbox(p); await park(p);
    o.head = await p.evaluate(HEAD); o.nav = await p.evaluate(NAV);
    await p.screenshot({ path: `${SHOTS}${tag}-w15-w21-step1-head.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, (o.head.head?.y ?? 300) + (o.head.head?.h ?? 60) + 20) } });
    await locate(p);
    await p.evaluate(() => window.scrollTo(0, 0)); await park(p);
    o.located_head = await p.evaluate(HEAD);
    // W12 kind chip: the same chip unpressed, then pressed.
    const id = 'kind-chip-flagger_lane_closure';
    await p.locator(`[data-testid=${id}]`).scrollIntoViewIfNeeded(); await park(p);
    o.chipUnpressed = await p.evaluate(CHIP, id);
    await p.locator(`[data-testid=${id}]`).click(); await p.waitForTimeout(600); await park(p);
    o.chipPressed = await p.evaluate(CHIP, id);
    o.chipCentreDelta = +(o.chipPressed.labelTextCentreX - o.chipUnpressed.labelTextCentreX).toFixed(2);
    o.settleChips = await settle(p, inflight);
    await p.locator('.a-chips[aria-label="Kind of work"]').screenshot({ path: `${SHOTS}${tag}-w12-kind-chip-pressed.png` });
    await p.screenshot({ path: `${SHOTS}px-${tag}-chips.png` });
    // Hover fold-in: pointer on the pressed chip, then on an unpressed one.
    const v = o.chipPressed.vrect; await p.mouse.move(v[0] + v[2] / 2, v[1] + v[3] / 2); await p.waitForTimeout(400);
    o.hoverPressed = await p.evaluate((id) => getComputedStyle(document.querySelector(`[data-testid=${id}]`)).borderTopColor, id);
    await p.locator('.a-chips[aria-label="Kind of work"]').screenshot({ path: `${SHOTS}${tag}-hover-pressed-chip.png` });
    const sh = await p.locator('[data-testid=kind-chip-shoulder]').boundingBox(); await p.mouse.move(sh.x + sh.width / 2, sh.y + sh.height / 2); await p.waitForTimeout(400);
    o.hoverUnpressed = await p.evaluate(() => ({ hovered: getComputedStyle(document.querySelector('[data-testid=kind-chip-shoulder]')).borderTopColor }));
    await park(p);
    o.restUnpressed = await p.evaluate(() => getComputedStyle(document.querySelector('[data-testid=kind-chip-shoulder]')).borderTopColor);
    // Step 2.
    await p.getByTestId('where-confirm').click();
    await p.waitForSelector('.a-seg', { timeout: 90000 }); await p.waitForTimeout(3000);
    await p.evaluate(() => window.scrollTo(0, 0)); await park(p);
    o.what_head = await p.evaluate(HEAD);
    // W12 toggle: "Night" unpressed, then pressed (and "Daytime" pressed, then unpressed).
    const seg = p.locator('.a-seg > button', { hasText: 'Night' }); await seg.scrollIntoViewIfNeeded(); await park(p);
    o.segBefore = { Daytime: await p.evaluate(SEG, 'Daytime'), Night: await p.evaluate(SEG, 'Night') };
    await seg.click(); await p.waitForTimeout(1500); await park(p);
    o.segAfter = { Daytime: await p.evaluate(SEG, 'Daytime'), Night: await p.evaluate(SEG, 'Night') };
    o.segCentreDelta = { Night: +(o.segAfter.Night.labelTextCentreX - o.segBefore.Night.labelTextCentreX).toFixed(2), Daytime: +(o.segAfter.Daytime.labelTextCentreX - o.segBefore.Daytime.labelTextCentreX).toFixed(2) };
    await p.screenshot({ path: `${SHOTS}px-${tag}-seg.png` });
    const box = await seg.evaluate(s => { const c = s.closest('.a-cell') || s.parentElement; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await p.screenshot({ path: `${SHOTS}${tag}-w12-toggle-pressed.png`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, w), height: box.height + 16 } });
    // W13 selects.
    await p.locator('select.a-fld').first().scrollIntoViewIfNeeded(); await park(p); await p.waitForTimeout(400);
    o.selects = await p.evaluate(SELECTS);
    await p.screenshot({ path: `${SHOTS}${tag}-w13-select.png` });
  } catch (e) { o.error = clean(e); await p.screenshot({ path: `${SHOTS}${tag}-l2-error.png` }).catch(() => {}); }
  await b.close(); M[tag] = o; console.log('L2', tag, o.error || 'ok');
};
const only = process.argv[2];
const RUNS = [['chromium', 1440, 900, '1440'], ['chromium', 390, 844, '390'], ['chromium', 360, 780, '360'], ['webkit', 390, 844, '390-webkit']];
for (const r of RUNS) if (!only || only === r[3]) await run(...r);
save(`measure-l2${only ? '-' + only : ''}.json`, M);
