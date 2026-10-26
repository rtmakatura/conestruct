// #407 production check: www.conestruct.com/sandbox, headless Chromium, DPR 2,
// 1440x900 and 390x844.  Nothing stubbed: real road detection and site scan.
// The gate token is read from conestruct/site/.env.local and sent as the
// x-conestruct-gate header; it is never printed or written.
// usage: node check.mjs <outdir>
import { createRequire } from 'module';
import fs from 'fs';
const ROOT = 'C:/Users/rtmak/Documents/traffic-control-tool';
const require = createRequire(`${ROOT}/package.json`);
const { chromium } = require('playwright');
const AXE = `${ROOT}/conestruct/site/node_modules/axe-core/axe.min.js`;
const OUT = process.argv[2];
const env = fs.readFileSync(`${ROOT}/conestruct/site/.env.local`, 'utf8');
const TOK = (env.match(/^GATE_BYPASS_TOKEN\s*=\s*"?([^"\r\n]+)"?/m) || [])[1] || '';
if (!TOK) throw new Error('no gate token found');
const BASE = 'https://www.conestruct.com';
fs.mkdirSync(OUT, { recursive: true });

async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(250); }
async function shot(p, sel, file) {
  await p.locator(sel).first().scrollIntoViewIfNeeded();
  await park(p);
  const box = await p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  const vw = p.viewportSize().width;
  await p.screenshot({ path: `${OUT}/${file}`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.w + 16, vw), height: box.h + 16 } });
  return file;
}

// The mark: its glyph, colour, composited ground and contrast; plus every
// text node and ::before/::after content inside the chosen control, so a ✓
// anywhere in it is caught.
async function measure(p, ctlSel, markSel, pseudo) {
  return p.evaluate(([cs0, ms, ps]) => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const ctl = document.querySelector(cs0);
    const el = document.querySelector(ms);
    if (!ctl || !el) return { missing: !ctl ? cs0 : ms };
    const glyphs = [];
    for (const e of [ctl, ...ctl.querySelectorAll('*')]) {
      for (const pp of ['::before', '::after']) { const c = getComputedStyle(e, pp).content; if (c && c !== 'none' && c !== 'normal' && c !== '""') glyphs.push(c); }
    }
    const text = ctl.innerText;
    const cs = getComputedStyle(el, ps || null);
    const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let g = { r: 255, g: 255, b: 255 };
    for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) g = { r: c.r * c.a + g.r * (1 - c.a), g: c.g * c.a + g.g * (1 - c.a), b: c.b * c.a + g.b * (1 - c.a) }; }
    const fg = parse(cs.color);
    const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const L1 = lum(fg), L2 = lum(g);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const glyph = ps ? cs.content : el.textContent;
    const all = text + ' ' + glyphs.join(' ');
    return {
      control: cs0, mark: ms + (ps || ''), glyph, visibility: cs.visibility, color: cs.color,
      ground: `rgb(${g.r.toFixed(1)}, ${g.g.toFixed(1)}, ${g.b.toFixed(1)})`,
      contrast: Math.round(ratio * 100) / 100,
      controlText: text, pseudoContents: glyphs,
      hasDot: all.includes('\u25CF'), hasCheck: all.includes('\u2713') || all.includes('\u2714'),
    };
  }, [ctlSel, markSel, pseudo]);
}

const M = {};
async function run(w, h) {
  const tag = String(w);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  // The gate header goes to www.conestruct.com only: sent to every origin
  // (extraHTTPHeaders), it turns Clerk's and Sentry's cross-origin requests
  // into failing CORS preflights (first run: "Failed to load Clerk").
  await ctx.route('https://www.conestruct.com/**', (r) => r.continue({ headers: { ...r.request().headers(), 'x-conestruct-gate': TOK } }));
  const p = await ctx.newPage();
  const out = { pageErrors: [], consoleErrors: [], shots: [] };
  p.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 200)); });
  out.failedRequests = [];
  p.on('requestfailed', (r) => { const u = new URL(r.url()); out.failedRequests.push(`${u.origin}${u.pathname.slice(0, 60)} ${r.failure()?.errorText ?? ''}`); });
  const t0 = Date.now();
  try {
    const r = await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
    out.status = r.status();
    await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
    await p.getByRole('button', { name: 'Pick on map' }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel('Address or intersection search').fill('1600 E Colfax Ave, Denver');
    await p.getByRole('button', { name: 'SEARCH' }).click();
    await p.waitForFunction(() => { const d = document.querySelector('[role=dialog]'); return d && !/DETECTING ROAD/i.test(d.innerText) && /DETECTED|NO ROAD|FAIL|COULDN|ERROR|NOT FOUND/i.test(d.innerText); }, null, { timeout: 120000 }).catch(() => {});
    await p.getByRole('dialog').getByRole('button', { name: /East Colfax Avenue Eastbound/i }).first().click();
    out.road = 'East Colfax Avenue Eastbound';
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: 'Save & Close' }).click();
    await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
    await p.locator('[data-testid=side-option]').first().click();
    await p.waitForSelector('[data-testid=kind-chip-shoulder]', { timeout: 60000 });
    await p.locator('[data-testid=kind-chip-shoulder]').click();
    await p.waitForTimeout(800);
    await park(p);
    const sideSel = '[data-testid=side-option][aria-checked="true"]';
    out.side = await measure(p, sideSel, `${sideSel} .tr-field > span`, null);
    out.shots.push(await shot(p, '.a-chips-side', `${tag}-side-chip.png`));
    const kindSel = '[data-testid=kind-chip-shoulder]';
    out.kind = await measure(p, kindSel, `${kindSel} > .tr-field`, '::after');
    out.kind.ariaPressed = await p.getAttribute(kindSel, 'aria-pressed');
    await p.evaluate((s) => document.querySelector(s).parentElement.setAttribute('data-shot', 'kind-row'), kindSel);
    out.shots.push(await shot(p, '[data-shot=kind-row]', `${tag}-kind-chip.png`));
    await p.getByRole('button', { name: /^Confirm/ }).click();
    await p.waitForSelector('[data-testid=cell-night]', { timeout: 90000 });
    await p.waitForTimeout(2500);
    await park(p);
    const segCtl = '[data-testid=cell-night] button[aria-pressed="true"]';
    out.segmented = await measure(p, segCtl, `${segCtl} > .a-seg-label`, '::before');
    out.shots.push(await shot(p, '[data-testid=cell-night]', `${tag}-segmented.png`));
    await p.addScriptTag({ path: AXE });
    out.axe = await p.evaluate(async () => {
      const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
      return { violations: r.violations.length, nodes: r.violations.reduce((s, v) => s + v.nodes.length, 0), passes: r.passes.length, incomplete: r.incomplete.length,
        list: r.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`) };
    });
    // Site scan: the scan rides the audit, so it needs "Generate plan" (a
    // sandbox render; nothing is saved).  Wait up to 150 s for the results,
    // then look for a NEEDS YOU condition offering Dismiss.  Choosing a
    // reason is local state only (Apply writes; it is never pressed).
    await p.getByRole('button', { name: 'Generate plan' }).click();
    out.generated = await p.waitForFunction(() => document.querySelector('.needs-you') || /memoised/i.test(document.body.innerText), null, { timeout: 150000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(4000);
    out.siteScanFooter = await p.evaluate(() => { const m = document.body.innerText.match(/[^\n]*memoised[^\n]*/i); return m ? m[0].slice(0, 200) : null; });
    const dismiss = p.locator('.needs-you button', { hasText: /^Dismiss$/ });
    out.dismissButtons = await dismiss.count();
    out.siteScanText = await p.evaluate(() => { const n = document.querySelector('.needs-you'); return n ? n.innerText.slice(0, 600) : null; });
    if (out.dismissButtons > 0) {
      await dismiss.first().click();
      await p.locator('.reason-chip').first().click();
      await p.waitForTimeout(500);
      out.reason = await measure(p, '.reason-chip.chosen', '.reason-chip.chosen .reason-glyph', null);
      out.shots.push(await shot(p, '.site-correction-reasons', `${tag}-reason-chip.png`));
    }
  } catch (e) {
    out.error = String(e).slice(0, 300);
    await p.screenshot({ path: `${OUT}/${tag}-error.png` }).catch(() => {});
  }
  out.seconds = Math.round((Date.now() - t0) / 1000);
  await ctx.close();
  await b.close();
  M[tag] = out;
  console.log(tag, out.error ? 'ERROR ' + out.error : 'ok', 'side', out.side?.glyph, out.side?.contrast, 'kind', out.kind?.glyph, out.kind?.contrast, 'seg', out.segmented?.glyph, out.segmented?.contrast, 'dismiss', out.dismissButtons, 'axe', out.axe?.violations, 'pageErrors', out.pageErrors.length);
}

await run(1440, 900);
await run(390, 844);
fs.writeFileSync(`${OUT}/measurements.json`, JSON.stringify({ site: BASE + '/sandbox', checkedAt: new Date().toISOString(), widths: M }, null, 1));
