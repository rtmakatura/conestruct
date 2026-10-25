// Check 9 (L3 W14) on production: the picker at 1440, 390, 360 (Chromium) and 390 (WebKit).
// Live road detection, no stub: the "Detecting road" state is measured while the live call runs.
// usage: node l3.mjs [tag]
import { open, park, sandbox, save, clean, tileWatch, settle, SHOTS, SITE } from './lib.mjs';
const M = {};
// Stacking: the frame is pointer-events:none, so it is switched on for the probe only (L3's probe).
const FRAME = () => {
  const f = document.querySelector('.workbench-frame'); const d = document.querySelector('[role=dialog]');
  if (!f || !d) return { frame: !!f };
  const fr = f.getBoundingClientRect(); const dr = d.getBoundingClientRect(); const prev = f.style.pointerEvents; f.style.pointerEvents = 'auto';
  const vw = innerWidth, vh = innerHeight; const probes = [];
  for (const [side, x, y] of [['left', fr.left + 0.5, vh * 0.25], ['left', fr.left + 0.5, vh * 0.6], ['right', fr.right - 0.5, vh * 0.25], ['right', fr.right - 0.5, vh * 0.6], ['top', vw * 0.3, fr.top + 0.5], ['top', vw * 0.6, fr.top + 0.5]]) {
    const e = document.elementFromPoint(x, y);
    probes.push({ side, x: +x.toFixed(1), y: +y.toFixed(1), frameOnTop: e === f, insideDialog: x > dr.left + 1 && x < dr.right - 1 && y > dr.top + 1 && y < dr.bottom - 1 });
  }
  f.style.pointerEvents = prev;
  return { frame: true, frameRect: { x: fr.left, y: fr.top, right: fr.right }, zFrame: getComputedStyle(f).zIndex, zPicker: getComputedStyle(d.parentElement).zIndex, probes,
    frameOnTopInsideDialog: probes.filter(q => q.frameOnTop && q.insideDialog).length };
};
const MEASURE = () => {
  const d = document.querySelector('[role=dialog]');
  const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { x: +q.x.toFixed(2), y: +q.y.toFixed(2), w: +q.width.toFixed(2), h: +q.height.toFixed(2), bottom: +q.bottom.toFixed(2) }; };
  const lines = (e) => { if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e); const tops = new Set(); for (const q of rg.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top)); return tops.size; };
  const footer = d.lastElementChild;
  const save = [...footer.querySelectorAll('button')].find(b => b.innerText.trim() === 'Save & Close');
  const vw = innerWidth, vh = innerHeight; const dr = d.getBoundingClientRect();
  return { viewport: [vw, vh], dialog: r(d), dialogGap: { top: +dr.top.toFixed(2), bottom: +(vh - dr.bottom).toFixed(2), left: +dr.left.toFixed(2), right: +(vw - dr.right).toFixed(2) },
    header: r(d.firstElementChild), footer: r(footer), footerText: footer.innerText.replace(/\s+/g, ' ').trim().slice(0, 120),
    save: { rect: r(save), lines: lines(save), whiteSpace: save && getComputedStyle(save).whiteSpace },
    docScroll: { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw } };
};
const run = async (engine, w, h, tag) => {
  const { b, p, log } = await open(engine, w, h);
  const inflight = tileWatch(p);
  const o = { log, settle: {} };
  try {
    await sandbox(p);
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForSelector('[role=dialog]', { timeout: 60000 }); await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(SITE);
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => /Detecting road/i.test(document.querySelector('[role=dialog]')?.lastElementChild?.innerText || ''), null, { timeout: 60000 });
    o.settle.detecting = await settle(p, inflight);
    o.detectingStillShown = await p.evaluate(() => /Detecting road/i.test(document.querySelector('[role=dialog]')?.lastElementChild?.innerText || ''));
    o.detecting = await p.evaluate(MEASURE); o.frameDetecting = await p.evaluate(FRAME);
    await p.screenshot({ path: `${SHOTS}${tag}-w14-picker-detecting.png` });
    await p.waitForFunction(() => /ROAD DETECTED|Which road/i.test(document.querySelector('[role=dialog]')?.innerText || ''), null, { timeout: 120000 });
    o.settle.roads = await settle(p, inflight);
    o.roads = await p.evaluate(MEASURE); o.frameRoads = await p.evaluate(FRAME);
    await p.screenshot({ path: `${SHOTS}${tag}-w14-picker-roads.png` });
  } catch (e) { o.error = clean(e); await p.screenshot({ path: `${SHOTS}${tag}-l3-error.png` }).catch(() => {}); }
  await b.close(); M[tag] = o; console.log('L3', tag, o.error || 'ok');
};
const only = process.argv[2];
const RUNS = [['chromium', 1440, 900, '1440'], ['chromium', 390, 844, '390'], ['chromium', 360, 780, '360'], ['webkit', 390, 844, '390-webkit']];
for (const r of RUNS) if (!only || only === r[3]) await run(...r);
save(`measure-l3${only ? '-' + only : ''}.json`, M);
