// #453 production check, adapted from ../../evidence/script/walk.mjs (the
// local walk: every row opened, the two searches) and
// ux-group5-followup/prod-check/script/walk-prod.mjs (#450's production
// check: everything live, the gate helper wrapped to record each hop, the
// audit PDF through the page's own button, layout shift).
// usage: [WIDTHS=1440,390] node walk-prod.mjs <outdir> <pdfdir>
// The REAL site, everything live: geocoding, /api/road-bearing (no stub, no
// Overpass replay), the generate, the audit and the audit PDF.  The one
// Playwright route is the shared helper's (scripts/gate.cjs newGatedContext),
// which adds the gate header on the site's own hops only.
// The token: GATE_BYPASS_TOKEN from the environment, else read from
// conestruct/site/.env.local.  Never printed, never written.
// Read-only: no NEEDS YOU answer is given, nothing is saved.
import { createRequire } from 'module';
import fs from 'fs';
const R = 'C:/Users/rtmak/Documents/traffic-control-tool';
const W = `${R}/.claude/worktrees/issue-453-prod-check`;
const require = createRequire(`${R}/package.json`);
const { chromium } = require('playwright');
const { newGatedContext, GATE_HEADER } = require(`${W}/scripts/gate.cjs`);
const AXE = fs.readFileSync(`${R}/conestruct/site/node_modules/axe-core/axe.min.js`, 'utf8');
const [OUT, PDFDIR] = process.argv.slice(2);
const SITE = 'https://www.conestruct.com';
const ADDR = process.env.ADDR ?? '1600 E Colfax Ave, Denver';
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
const TRIES = Number(process.env.TRIES ?? 3);
const TERMS = ['sidewalk', 'taper'];
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

// An opened detail as text, each leaf text run with its font family, size and
// transform (the local walk's detailParts, unchanged).
const detailParts = (p, rowId) => p.evaluate((rowId) => {
  const d = document.querySelector(`[data-row="${CSS.escape(rowId)}"] .rr-detail`);
  if (!d) return null;
  const parts = [];
  const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent.replace(/\s+/g, ' ');
    if (!text.trim()) continue;
    const el = t.parentElement;
    const cs = getComputedStyle(el);
    const block = el.closest('p, dt, dd, li, button, a, .rr-line-sub, .rr-value') ?? el;
    const key = `${block.tagName}.${block.className}|${/mono/i.test(cs.fontFamily) ? 'mono' : 'sans'}|${cs.fontSize}|${cs.textTransform}`;
    if (last && last.key === key && last.node === block) { last.text += text; continue; }
    last = { key, node: block, text, tag: block.tagName.toLowerCase(), cls: String(block.className), mono: /mono/i.test(cs.fontFamily), size: cs.fontSize, caps: cs.textTransform === 'uppercase' };
    parts.push(last);
  }
  return parts.map(({ key, node, ...r }) => ({ ...r, text: r.text.trim() }));
}, rowId);

// The checks on one opened detail, from its parts.
const RAW = [/road_type/, /urban_low/, /\[work_zone/, /STALENESS RISK/, /\b[a-z]+_[a-z_]+\b/];
function judge(parts) {
  const res = { sentences: 0, rows: 0, raw: [], arrow: [], monoOutsideValue: [], capsText: [], sources: [] };
  for (const x of parts ?? []) {
    const isLink = x.tag === 'a' || x.tag === 'button';
    if (x.tag === 'p' && !/^Source:/i.test(x.text)) res.sentences += 1;
    if (x.tag === 'dt') res.rows += 1;
    if (!isLink) for (const re of RAW) if (re.test(x.text)) res.raw.push(`${re}: ${x.text.slice(0, 120)}`);
    if (!isLink && x.tag !== 'dd' && x.text.includes('->')) res.arrow.push(x.text.slice(0, 160));
    if (x.mono && !isLink && x.tag !== 'dd') res.monoOutsideValue.push(`${x.tag}: ${x.text.slice(0, 80)}`);
    if (x.caps && !isLink) res.capsText.push(`${x.tag}: ${x.text.slice(0, 80)}`);
    if (/^source:/i.test(x.text)) res.sources.push({ text: x.text, sentenceCase: x.text.startsWith('Source: ') && !x.caps && x.text !== x.text.toUpperCase(), mono: x.mono });
  }
  return res;
}

const cls = (p) => p.evaluate(() => +(window.__ls ?? []).filter((e) => !e.r).reduce((s, e) => s + e.v, 0).toFixed(4));

async function runOnce(w, h, attempt) {
  const tag = `${w}`;
  const b = await chromium.launch();
  const out = { width: w, height: h, attempt, rows: {}, searches: {}, errors: [], hostsSeen: new Set(), routeHops: [], roadBearing: [], clerkResponses: [] };
  // A browser whose contexts' route handlers record each route.fetch hop
  // (host, and whether the gate header is on it: presence only).
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
  const unstick = () => p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'sticky') { e.dataset.walkSticky = '1'; e.style.position = 'relative'; } } document.querySelector('.workbench-frame')?.style.setProperty('display', 'none'); });
  const restick = () => p.evaluate(() => { for (const e of document.querySelectorAll('[data-walk-sticky]')) { e.style.position = ''; delete e.dataset.walkSticky; } document.querySelector('.workbench-frame')?.style.removeProperty('display'); });
  const crop = async (name, loc) => { await unstick(); await loc.screenshot({ path: `${OUT}/${tag}-${name}.png`, scale: 'css' }); await restick(); };
  const safe = (s) => s.replace(/[^a-z0-9-]+/gi, '_').slice(0, 48);
  try {
    await toGenerated(p, out);
    out.clsAfterGenerate = await cls(p);
    const allHeads = [];
    for (const sec of ['checked', 'reference']) {
      const head = p.locator(`[data-section=${sec}] > button.rs-head`);
      if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
      await p.waitForTimeout(250);
      const more = p.locator(`[data-section=${sec}] .rr-more`);
      if (await more.count()) { await more.first().click(); await p.waitForTimeout(250); }
      const ids = await p.locator(`[data-section=${sec}] [data-row]`).evaluateAll((es) => es.map((e) => e.dataset.row));
      let k = 0;
      for (const id of ids) {
        k += 1;
        const row = p.locator(`[data-section=${sec}] [data-row="${id}"]`);
        const btn = row.locator('.rr-head');
        const title = (await btn.innerText()).replace(/\s+/g, ' ').replace(/ (Show|Hide)$/, '').trim();
        allHeads.push({ sec, id, title });
        if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
        await p.waitForTimeout(200);
        const name = `${sec}-${String(k).padStart(2, '0')}-${safe(id)}`;
        const parts = await detailParts(p, id);
        out.rows[name] = { sec, id, title, parts, judge: judge(parts) };
        await crop(name, row);
        await btn.click();
        await p.waitForTimeout(120);
      }
      out[`${sec}Open`] = { axe: await axe(p, ROOT), m: await measure(p, ROOT) };
    }
    out.driveways = allHeads.filter((r) => /driveway/i.test(r.title));
    const flipAll = async (state) => {
      const loc = p.locator(`${ROOT} [data-row] .rr-head[aria-expanded=${state}]`);
      for (let guard = 0; guard < 80 && (await loc.count()) > 0; guard += 1) { await loc.first().click(); await p.waitForTimeout(60); }
    };
    await flipAll('false');
    await p.waitForTimeout(400);
    out.allOpen = { axe: await axe(p, ROOT), m: await measure(p, ROOT) };
    await flipAll('true');
    console.log(tag, 'rows', Object.keys(out.rows).length, '| all open axe', out.allOpen.axe.length, '| small', out.allOpen.m.small.length, '| overflowX', out.allOpen.m.overflowX);
    for (const term of TERMS) {
      await p.locator('#ref-search').fill('');
      await p.locator('#ref-search').pressSequentially(term, { delay: 25 });
      await p.waitForTimeout(500);
      const opened = await p.locator(`${ROOT} [data-row]:has(.rr-detail)`).evaluateAll((es) => es.map((e) => ({ id: e.dataset.row, title: (e.querySelector('.rr-head')?.innerText ?? '').replace(/\s+/g, ' ').trim() })));
      const rec = { status: (await p.locator('.rs-status').innerText()).replace(/\s+/g, ' ').trim(), opened: {}, axe: await axe(p, ROOT), m: await measure(p, ROOT) };
      for (const o of opened) rec.opened[o.id] = { title: o.title, parts: await detailParts(p, o.id) };
      out.searches[term] = rec;
      await crop(`search-${safe(term)}`, p.locator(ROOT));
      for (const pick of [/^.?\s*Permit/, /Warning signs/]) {
        const hit = opened.find((o) => pick.test(o.title.replace(/^[^A-Za-z]+/, '')));
        if (hit) await crop(`search-${safe(term)}-${safe(hit.id)}`, p.locator(`${ROOT} [data-row="${hit.id}"]`));
      }
      console.log(tag, 'search', term, '|', rec.status, '| opened', opened.map((o) => o.id).join(','), '| axe', rec.axe.length, '| small', rec.m.small.length);
    }
    await p.locator('#ref-search').fill('');
    await p.waitForTimeout(300);
    // The audit PDF, through the page's own Download button on the audit card.
    const files = p.locator('button.dl-files');
    if (await files.isVisible().catch(() => false)) { await files.click(); await p.waitForTimeout(400); }
    const btn = p.getByRole('button', { name: 'Download audit trail PDF' });
    await btn.scrollIntoViewIfNeeded();
    const t0 = Date.now();
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), btn.click()]);
    const file = `${PDFDIR}/audit-${tag}.pdf`;
    await dl.saveAs(file);
    out.pdf = { suggested: dl.suggestedFilename(), ms: Date.now() - t0, bytes: fs.statSync(file).size };
    console.log(tag, 'audit pdf', JSON.stringify(out.pdf));
    out.overflowEnd = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    out.clsEnd = await cls(p);
    out.layoutShifts = await p.evaluate(() => (window.__ls ?? []).filter((e) => !e.r).map((e) => +e.v.toFixed(4)));
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
  console.log(k, 'clerk', JSON.stringify(r.clerk), '| hosts with gate', JSON.stringify(r.hostsWithGate), '| route hops', JSON.stringify(r.routeHopsByHost), '| page errors', r.errors.length, '| cls', r.clsEnd);
}
