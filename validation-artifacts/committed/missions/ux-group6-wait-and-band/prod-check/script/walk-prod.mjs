// #470 production check on 750660c: the Generate wait on www.conestruct.com,
// live data, no hold, nothing stubbed.  Adapted from issue-470/script/walk470.mjs.
// Per width: pin 1550 E Colfax Ave, Denver, pick East Colfax Avenue, shoulder
// work, the first side, confirm, press Generate.  Records layout shift from the
// press to "Plan ready" (hadRecentInput false, the #452 measure) with sources,
// crops of the results column while the outline + status line are up and once
// settled, axe on section.results and the 44 px measure on the settled
// results, console and page errors, then the answer leg (first answer of each
// NEEDS YOU question, Apply answers) and its shift.
// usage: node walk-prod.mjs <outdir> [sizes]
// The token is read from conestruct/site/.env.local into the env, never printed;
// the gate header rides only the site's own origin (scripts/gate.cjs newGatedContext).
import { createRequire } from 'module';
import fs from 'fs';
const W = 'C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/mission-471-prod-check';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
const { chromium } = require('playwright');
if (!process.env.GATE_BYPASS_TOKEN) {
  const line = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/.env.local', 'utf8').split(/\r?\n/).find((l) => l.startsWith('GATE_BYPASS_TOKEN='));
  if (line) process.env.GATE_BYPASS_TOKEN = line.slice('GATE_BYPASS_TOKEN='.length).replace(/^["']|["']$/g, '');
}
const { newGatedContext } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/node_modules/axe-core/axe.min.js', 'utf8');
const SITE = 'https://www.conestruct.com';
const [OUT, SIZES] = process.argv.slice(2);
const sizes = (SIZES || '1440x900,1198x930,390x844').split(',').map((s) => s.split('x').map(Number));
const ADDR = '1550 E Colfax Ave, Denver';
fs.mkdirSync(OUT, { recursive: true });

const clsSince = (p, t0) => p.evaluate((t0) => {
  const es = (window.__ls ?? []).filter((e) => e.t >= t0 && !e.r);
  return { cls: +es.reduce((s, e) => s + e.v, 0).toFixed(4), n: es.length, top: es.sort((a, b) => b.v - a.v).slice(0, 4).map((e) => ({ v: +e.v.toFixed(4), at: Math.round(e.t - t0), src: e.src })) };
}, t0);
async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('section.results') ?? document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
}
const small = (p) => p.evaluate(() => {
  const root = document.querySelector('section.results');
  if (!root) return null;
  const out = []; let n = 0;
  for (const e of root.querySelectorAll('button, a, label.nyq-answer, summary')) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (getComputedStyle(e).visibility === 'hidden') continue;
    n++;
    if (r.width < 44 || r.height < 44) out.push({ text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), cls: String(e.className).slice(0, 40), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
  }
  return { measured: n, under: out };
});
const read = (p) => p.evaluate(() => ({
  y: Math.round(scrollY),
  words: (document.querySelector('.status-slot')?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
  outline: !!document.querySelector('[data-testid=results-outline]'),
  waitLine: (document.querySelector('.wait-line')?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 100) || null,
}));
// A crop of the results column within the viewport (no scroll: a clip, not an element shot).
const crop = (p, file, w, h) => p.evaluate(() => {
  const r = (document.querySelector('section.results') ?? document.body).getBoundingClientRect();
  return { x: Math.max(0, r.left), w: r.width };
}).then(({ x, w: cw }) => p.screenshot({ path: file, clip: { x, y: 0, width: Math.min(cw, w - x), height: h } }));
const settled = (p) => p.waitForFunction(() => {
  const s = document.querySelector('.status-slot')?.innerText ?? '';
  const placeholder = document.querySelector('[data-testid=results-outline], [data-testid=results-placeholder]');
  return /Plan ready|VERIFIED|UNAVAILABLE|DECLINED/i.test(s) && document.querySelector('[data-testid=your-plan]') && document.querySelector('.ref-sections') && !placeholder;
}, null, { timeout: 240000 });

async function run(w, h) {
  const tag = `${w}x${h}`;
  const b = await chromium.launch();
  const out = { size: tag, addr: ADDR, frames: [], crops: [], errors: [], console: [] };
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      window.__ls = [];
      const desc = (n) => (n && n.nodeType === 1 ? `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.getAttribute('data-testid') ? '[' + n.getAttribute('data-testid') + ']' : ''}.${String(n.className).split(' ')[0]}` : String(n?.nodeName));
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, r: e.hadRecentInput, t: e.startTime, src: (e.sources ?? []).slice(0, 3).map((s) => `${desc(s.node)} ${Math.round(s.previousRect.top)}->${Math.round(s.currentRect.top)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`) }); }).observe({ type: 'layout-shift', buffered: true }); } catch {}
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 200)));
    p.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text().slice(0, 200)); });
    await p.goto(SITE + '/sandbox', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill(ADDR);
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); const s = [...(d?.querySelectorAll('button') ?? [])].find((x) => /Save & Close/.test(x.innerText)); return /PICK THE ROAD · \d+ FOUND|Which road/i.test(d?.innerText ?? '') || (s && !s.disabled); }, null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
    out.road = (await want.count()) ? (await want.first().innerText()).replace(/\s+/g, ' ').trim() : null;
    if (out.road) await want.first().click();
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.locator('label.nyq-answer:has([data-testid=kind-chip-shoulder])').click();
    await p.waitForTimeout(1200);
    await p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child').click();
    await p.waitForSelector('[data-testid=side-option]', { state: 'attached', timeout: 30000 });
    await p.waitForTimeout(1200);
    await p.locator('[data-testid=where-questions] label.nyq-answer').first().click();
    await p.waitForTimeout(1500);
    await p.locator('[data-testid=where-confirm]').click();
    await p.waitForSelector('[data-testid=cell-work-type]', { timeout: 90000 });
    await p.waitForTimeout(3000);
    const oneWay = p.getByRole('button', { name: /^One-way$/ });
    if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(3000); }
    const laneOk = p.getByRole('button', { name: 'Lane count is right' });
    if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(3000); }
    await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    const t0 = await p.evaluate(() => performance.now());
    const tStart = Date.now();
    await p.getByTestId('generate-plan').click();
    let done = false; let last = ''; let waitShots = 0;
    const SHOT_AT = [800, 2000, 3500]; // ms after the press, while the outline is up
    settled(p).then(() => { done = true; }, () => { done = true; });
    while (!done && Date.now() - tStart < 120000) {
      const r = await read(p);
      const key = `${r.words}|${r.outline}|${r.waitLine}`;
      const at = Date.now() - tStart;
      const timed = r.outline && waitShots < SHOT_AT.length && at >= SHOT_AT[waitShots];
      if (key !== last || timed) {
        last = key;
        const f = { at, ...r };
        if (timed) { f.shot = `${tag}-wait-${waitShots}-${f.at}ms.png`; await crop(p, `${OUT}/${f.shot}`, w, h); out.crops.push(f.shot); waitShots++; }
        out.frames.push(f);
      }
      await p.waitForTimeout(100);
    }
    await p.waitForTimeout(2500);
    out.settled = { at: Date.now() - tStart, ...(await read(p)) };
    out.generate = await clsSince(p, t0);
    const ss = `${tag}-plan-ready.png`; await crop(p, `${OUT}/${ss}`, w, h); out.crops.push(ss);
    out.axe = await axe(p);
    out.small = await small(p);
    // The answer leg (#474 tracks its shift): first answer of each question, then Apply answers.
    const ans = () => p.locator('section.needs-you .nyq-card label.nyq-answer').first();
    if (await ans().count()) {
      let t1 = null;
      for (let i = 0; i < 8 && t1 === null; i++) {
        if (await ans().count()) { await ans().click(); await p.waitForTimeout(700); }
        const foot = p.locator('section.needs-you .nyq-card .nyq-foot > button:last-child').first();
        if (!(await foot.count())) break;
        const label = (await foot.innerText()).trim();
        if (/Apply answers/.test(label)) t1 = await p.evaluate(() => performance.now());
        await foot.click();
        await p.waitForTimeout(700);
      }
      out.answerApplied = t1 !== null;
      if (t1 === null) t1 = await p.evaluate(() => performance.now());
      // The re-build takes seconds on production; settled() would match the
      // old "Plan ready" at once, so wait out the call first.
      await p.waitForTimeout(10000);
      await settled(p).catch(() => {});
      await p.waitForTimeout(2500);
      out.answer = await clsSince(p, t1);
      out.answerSettled = await read(p);
    }
  } catch (e) {
    out.errors.push(`walk: ${String(e).slice(0, 300)}`);
  } finally {
    await b.close();
  }
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 1));
  console.log(tag, '| road', out.road, '| generate CLS', out.generate?.cls, 'n', out.generate?.n, '| settled', out.settled?.at, 'ms', out.settled?.words, '| axe', out.axe?.length, '| 44px under', out.small?.under?.length, 'of', out.small?.measured, '| answer applied', out.answerApplied, 'CLS', out.answer?.cls, '| pageerrors', out.errors.length, 'console errors', out.console.length);
  for (const f of out.frames) console.log('   frame', f.at, 'ms outline', f.outline, '|', f.words, '| wait-line:', f.waitLine);
  for (const e of out.generate?.top ?? []) console.log('   gen shift', e.v, '@', e.at, 'ms', e.src.join(' ; '));
  for (const e of out.answer?.top ?? []) console.log('   ans shift', e.v, '@', e.at, 'ms', e.src.join(' ; '));
  for (const s of out.small?.under ?? []) console.log('   under 44:', JSON.stringify(s));
  for (const v of out.axe ?? []) console.log('   axe:', JSON.stringify(v));
  for (const c of [...out.errors, ...out.console]) console.log('   error:', c);
}
for (const [w, h] of sizes) await run(w, h);
