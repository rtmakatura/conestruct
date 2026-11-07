// #450 production check, adapted from ../../evidence/script/walk.mjs (the
// local walk) and ux-site-map/prod-check/script/walk-prod.mjs.
// usage: [WIDTHS=1440,390] node walk-prod.mjs <outdir> <pdfdir>
// The REAL site, everything live: geocoding, /api/road-bearing (no stub, no
// Overpass replay), the generate, the audit and the audit PDF.  The one
// Playwright route is the shared helper's (scripts/gate.cjs newGatedContext),
// which only adds the gate header on the site's own hops.
// The token: GATE_BYPASS_TOKEN from the environment, else read from
// conestruct/site/.env.local as the earlier production walks did.  Never
// printed, never written.
// What reached which host: the helper's route is wrapped (a proxy on the
// browser's newContext, the helper itself untouched) so every route.fetch
// hop records its host and whether the gate header was on it (presence only).
// Requests the route doesn't match go straight from the browser, which never
// holds the header.
import { createRequire } from 'module';
import fs from 'fs';
const R = 'C:/Users/rtmak/Documents/traffic-control-tool';
const W = `${R}/.claude/worktrees/issue-450-prod-check`;
const require = createRequire(`${R}/package.json`);
const { chromium } = require('playwright');
const { newGatedContext, GATE_HEADER } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${R}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PDFDIR] = process.argv.slice(2);
const SITE = 'https://www.conestruct.com';
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
const TRIES = Number(process.env.TRIES ?? 3);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PDFDIR, { recursive: true });

if (!process.env.GATE_BYPASS_TOKEN) {
  const line = fs.readFileSync(`${R}/conestruct/site/.env.local`, 'utf8').split(/\r?\n/).find((l) => l.startsWith('GATE_BYPASS_TOKEN='));
  const v = (line ?? '').slice('GATE_BYPASS_TOKEN='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
  if (v) process.env.GATE_BYPASS_TOKEN = v;
}

const ROOT = '.ref-sections';
const nextBtn = (p) => p.locator('[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child');

async function pin(p) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(ADDR);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  // Wait for the live candidate itself (#446/#447's checks).
  const want = p.getByRole('dialog').locator('button', { hasText: /Colfax/ });
  await want.first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(1000);
  await want.first().click();
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid^=kind-chip-]', { state: 'attached', timeout: 60000 });
  await p.waitForTimeout(2500);
}

async function toGenerated(p, out) {
  await p.goto(SITE + '/sandbox', { waitUntil: 'load', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  // Clerk: the SDK object on the page, loaded.
  await p.waitForFunction(() => window.Clerk && window.Clerk.loaded, null, { timeout: 30000 }).catch(() => {});
  out.clerk = await p.evaluate(() => ({ present: Boolean(window.Clerk), loaded: Boolean(window.Clerk && window.Clerk.loaded) }));
  await pin(p);
  const chips = await p.locator('[data-testid^=kind-chip-]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
  const kind = chips.find((c) => /shoulder/.test(c)) ?? chips[0];
  out.kind = kind;
  await p.locator(`label.nyq-answer:has([data-testid=${kind}])`).click();
  await p.waitForTimeout(800);
  await nextBtn(p).click();
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
  await p.waitForSelector(ROOT, { timeout: 60000 });
  await p.waitForFunction(() => /checks?,? |Checked/.test(document.querySelector('.ref-sections')?.innerText ?? ''), null, { timeout: 120000 });
  await p.waitForTimeout(5000);
}

const axe = async (p, sel) => {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async (sel) => {
    const r = await window.axe.run(document.querySelector(sel), { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')) }));
  }, sel);
};

const measure = (p, sel) => p.evaluate((sel) => {
  const root = document.querySelector(sel);
  const small = [];
  let n = 0;
  for (const e of root.querySelectorAll('button, a, input')) {
    const b = e.getBoundingClientRect();
    if (!b.width) continue;
    n += 1;
    if (b.width < 44 || b.height < 44) small.push({ tag: e.tagName, cls: String(e.className), text: (e.innerText ?? '').slice(0, 40), w: +b.width.toFixed(1), h: +b.height.toFixed(1) });
  }
  return { targets: n, small, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
}, sel);

const ruleRows = (p) => p.evaluate(() => {
  const sec = document.querySelector('[data-section=checked]');
  const group = [...sec.querySelectorAll('.rs-group, .rs-body > div')].find((g) => /RULE CHECKS/.test(g.innerText));
  const rows = [...(group ?? sec).querySelectorAll('[data-row]')].filter((r) => !/^calc-/.test(r.dataset.row));
  return rows.map((r) => {
    const line = r.querySelector('.rr-title-line');
    const range = document.createRange(); range.selectNodeContents(line);
    const tops = new Set([...range.getClientRects()].filter((c) => c.width > 0).map((c) => Math.round(c.top)));
    return { id: r.dataset.row, open: r.querySelector('.rr-head').getAttribute('aria-expanded'), head: line.innerText.replace(/\s+/g, ' ').trim(), lines: tops.size };
  });
});

// Layout shift (no recent input), summed so far.
const cls = (p) => p.evaluate(() => +(window.__ls ?? []).filter((e) => !e.r).reduce((s, e) => s + e.v, 0).toFixed(4));

async function runOnce(w, h, attempt) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = { width: w, height: h, attempt, steps: {}, errors: [], hostsSeen: new Set(), routeHops: [], roadBearing: [], clerkResponses: [] };
  let n = 1;
  const nn = () => String(n++).padStart(2, '0');
  // A browser whose contexts' route handlers record each route.fetch hop.
  const spy = {
    newContext: async (o) => {
      const c = await b.newContext(o);
      const orig = c.route.bind(c);
      c.route = (m, handler) => orig(m, (route) => handler(new Proxy(route, {
        get(t, k) {
          if (k === 'fetch') return (opts = {}) => {
            const hdrs = opts.headers ?? {};
            out.routeHops.push({ host: new URL(opts.url ?? t.request().url()).host, gate: Object.keys(hdrs).some((x) => x.toLowerCase() === GATE_HEADER) });
            return t.fetch(opts);
          };
          const v = t[k];
          return typeof v === 'function' ? v.bind(t) : v;
        },
      })));
      return c;
    },
  };
  const ctx = await newGatedContext(spy, `${SITE}/sandbox`, { viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true });
  await ctx.addInitScript(() => {
    window.__ls = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, r: e.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: true }); } catch {}
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => out.errors.push(String(e).slice(0, 300)));
  p.on('console', (m) => { if (m.type() === 'error' && /clerk/i.test(m.text())) out.errors.push('console: ' + m.text().slice(0, 200)); });
  ctx.on('request', (r) => out.hostsSeen.add(new URL(r.url()).host));
  ctx.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/api/road-bearing')) {
      let scan = null; try { const j = await r.json(); scan = { status: j.scan_status, candidates: (j.candidates ?? []).length }; } catch {}
      out.roadBearing.push({ status: r.status(), ...scan });
    }
    if (/clerk/i.test(new URL(u).host)) out.clerkResponses.push({ host: new URL(u).host, status: r.status() });
  });
  const crop = async (name, sel = ROOT) => {
    await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } document.querySelector('.workbench-frame')?.style.setProperty('display', 'none'); });
    await p.locator(sel).first().screenshot({ path: `${OUT}/${tag}-${nn()}-${name}.png`, scale: 'css' });
    await p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } document.querySelector('.workbench-frame')?.style.removeProperty('display'); });
  };
  try {
    await toGenerated(p, out);
    out.steps.clsAfterGenerate = await cls(p);
    const strip = p.locator('.status-bar').first();
    out.steps.strip = { text: (await strip.innerText()).replace(/\s+/g, ' ').trim(), axe: await axe(p, '.status-bar'), m: await measure(p, '.status-bar') };
    await crop('strip', '.status-bar');
    console.log(tag, 'strip |', out.steps.strip.text);
    out.steps.placeholder = await p.evaluate(() => { const i = document.querySelector('#ref-search'); return { text: i.placeholder, fits: i.scrollWidth <= i.clientWidth, w: i.clientWidth }; });
    await crop('placeholder', '.rs-search');
    console.log(tag, 'placeholder |', JSON.stringify(out.steps.placeholder));
    await p.locator('[data-section=checked] > button.rs-head').click();
    await p.waitForTimeout(250);
    const more = p.locator('[data-section=checked] .rr-more');
    if (await more.count()) await more.first().click();
    await p.waitForTimeout(250);
    out.steps.closed = { rows: await ruleRows(p), axe: await axe(p, ROOT), m: await measure(p, ROOT) };
    await crop('checked-rows-closed', '[data-section=checked]');
    console.log(tag, 'closed rows', out.steps.closed.rows.map((r) => `${r.lines}L ${r.head}`).join(' || '), '| axe', out.steps.closed.axe.length, '| small', out.steps.closed.m.small.length);
    const both = p.locator('[data-section=checked] [data-row]', { hasText: 'Signs on both sides' }).first();
    await both.locator('.rr-head').click();
    await p.waitForTimeout(300);
    out.steps.opened = { detail: (await both.locator('.rr-detail').innerText()).replace(/\s+/g, ' ').trim(), axe: await axe(p, ROOT), m: await measure(p, ROOT) };
    await crop('checked-one-row-open', '[data-section=checked]');
    console.log(tag, 'opened |', out.steps.opened.detail);
    await both.locator('.rr-head').click();
    await p.waitForTimeout(250);
    // Close the section again so the search starts from the default state.
    await p.locator('[data-section=checked] > button.rs-head').click();
    await p.waitForTimeout(250);
    const term = process.env.TERM_INSIDE ?? 'Signs placed';
    out.steps.termInHeads = out.steps.closed.rows.filter((r) => r.head.toLowerCase().includes(term.toLowerCase())).map((r) => r.id);
    await p.locator('#ref-search').pressSequentially(term, { delay: 25 });
    await p.waitForTimeout(400);
    out.steps.search = {
      term,
      status: (await p.locator('.rs-status').innerText()).replace(/\s+/g, ' ').trim(),
      opened: await p.evaluate(() => (document.querySelector('.ref-sections').innerText.match(/Opened because the match is inside\./g) ?? []).length),
      marks: await p.evaluate(() => [...document.querySelectorAll('.ref-sections .rr-detail mark')].map((m) => m.textContent)),
      axe: await axe(p, ROOT), m: await measure(p, ROOT),
    };
    await crop('search-inside-detail');
    console.log(tag, 'search |', JSON.stringify({ ...out.steps.search, axe: out.steps.search.axe.length, m: out.steps.search.m.small.length }));
    await p.locator('#ref-search').fill('');
    await p.waitForTimeout(300);
    // The audit PDF, through the page's own Download button on the audit card.
    if (w > 480 || process.env.PDF_AT_390) {
      const files = p.locator('button.dl-files');
      if (await files.isVisible().catch(() => false)) { await files.click(); await p.waitForTimeout(400); }
      const btn = p.getByRole('button', { name: 'Download audit trail PDF' });
      await btn.scrollIntoViewIfNeeded();
      const t0 = Date.now();
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), btn.click()]);
      const file = `${PDFDIR}/audit-${tag}.pdf`;
      await dl.saveAs(file);
      out.steps.pdf = { suggested: dl.suggestedFilename(), ms: Date.now() - t0, bytes: fs.statSync(file).size };
      console.log(tag, 'audit pdf', JSON.stringify(out.steps.pdf));
    }
    out.steps.answers = [];
    for (let guard = 0; guard < 8; guard += 1) {
      const card = p.locator('.nyq-card:not([data-testid=where-questions] .nyq-card)').first();
      if (!(await card.count()) || !(await card.isVisible())) break;
      const q = (await card.locator('.nyq-q').innerText()).trim();
      const a = card.locator('label.nyq-answer').first();
      out.steps.answers.push({ q, a: (await a.innerText()).replace(/\s+/g, ' ').trim().slice(0, 80) });
      await a.click();
      await p.waitForTimeout(500);
      const foot = card.locator('.nyq-foot > button:last-child');
      if (await foot.count()) await foot.click();
      await p.waitForTimeout(4000);
    }
    await p.waitForTimeout(6000);
    out.steps.stripAfter = { text: (await strip.innerText()).replace(/\s+/g, ' ').trim(), axe: await axe(p, '.status-bar'), m: await measure(p, '.status-bar') };
    await crop('strip-no-question-open', '.status-bar');
    console.log(tag, 'answers', out.steps.answers.length, '| strip after |', out.steps.stripAfter.text);
    out.steps.clsEnd = await cls(p);
    out.steps.layoutShifts = await p.evaluate(() => (window.__ls ?? []).filter((e) => !e.r).map((e) => +e.v.toFixed(4)));
  } catch (e) {
    out.error = String(e).slice(0, 600);
    await p.screenshot({ path: `${OUT}/${tag}-error-${attempt}.png`, scale: 'css' }).catch(() => {});
  }
  await ctx.close();
  await b.close();
  out.hostsSeen = [...out.hostsSeen].sort();
  const byHost = {};
  for (const hop of out.routeHops) { const k = byHost[hop.host] ??= { hops: 0, withGate: 0 }; k.hops += 1; if (hop.gate) k.withGate += 1; }
  out.routeHopsByHost = byHost;
  out.hostsWithGate = Object.entries(byHost).filter(([, v]) => v.withGate > 0).map(([k]) => k);
  delete out.routeHops;
  return out;
}

const all = {};
for (const w of WIDTHS) {
  const tries = [];
  for (let a = 1; a <= TRIES; a += 1) {
    const r = await runOnce(w, w === 390 ? 844 : 900, a);
    tries.push(r);
    console.log(w, 'attempt', a, '| error', r.error ? r.error.slice(0, 160) : null, '| road-bearing', JSON.stringify(r.roadBearing));
    if (!r.error) break;
  }
  all[w] = tries;
}
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(all, null, 1));
for (const [k, v] of Object.entries(all)) {
  const r = v[v.length - 1];
  console.log(k, 'clerk', JSON.stringify(r.clerk), '| hosts with gate', JSON.stringify(r.hostsWithGate), '| route hops', JSON.stringify(r.routeHopsByHost), '| errors', JSON.stringify(r.errors), '| cls', r.steps.clsEnd);
}
