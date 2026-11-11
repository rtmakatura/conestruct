// #517 local evidence walk: the What section ("What's the job?"), scoped to
// the What band, at each size.  Adapted from #507's walk507.mjs (same local
// site + stub backend, Overpass replayed, Playwright Chromium, axe-core from
// the site's node_modules).
//   node walk517.mjs <worktree> <committed crops dir> <extra dir>
// Env: SIZES (default "1440x900,1198x930,390x844"), FLOWS (comma list:
//   colfax,pin,zero), GATE_BYPASS_TOKEN (local value, set by run.ps1).
// In every state: a crop of the What band, axe on [data-testid=band-what]
// (0 violations required), the 44 px measure on every visible control in the
// band (height; Mapbox marks excepted per #505, none are in this band), no
// computed font-family containing "mono" and no text-transform: uppercase
// (reported for the section body `.w-what` + the band's question and intro,
// and separately for the band's head eyebrow), and the "About the work"
// columns' bottoms.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [WT, CROPS, EXTRA] = process.argv.slice(2);
const require = createRequire(path.join(WT, "scripts", "gate.cjs"));
const { newGatedContext, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(WT, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "http://localhost:3000";
const SIZES = (process.env.SIZES ?? "1440x900,1198x930,390x844").split(",").map((s) => s.split("x").map(Number));
const FLOWS = (process.env.FLOWS ?? "colfax,pin,zero").split(",");
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
// memory.md's reference pins: E Colfax at Williams (Denver); the walk's
// failing point (the road lookup always fails at lat 39.7501, in Denver);
// N Lincoln St (Denver, a one-way street) as the moved-to road.
const PT = { colfax: [39.73997, -104.96632], fail: [39.7501, -104.9601], lincoln: [39.7345, -104.9862] };
const R = { states: [] };
const log = (s) => console.log(s);
const BAND = "[data-testid=band-what]";

// ── readings ────────────────────────────────────────────────────────────
async function axeBand(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async (sel) => {
    const r = await window.axe.run({ include: [[sel]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  }, BAND);
}
// Every visible control in the band: its height must be >= 44.
function smallInPage(sel) {
  const d = document.querySelector(sel);
  if (!d) return { checked: 0, under: [], excepted: [], list: [] };
  const els = [...d.querySelectorAll("button, a[href], input, select, textarea, summary, [role=option], [role=radio], [role=button], [role=checkbox], [tabindex]:not([tabindex='-1'])")];
  const vis = els.filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; });
  const name = (e) => (e.getAttribute("aria-label") || e.innerText || e.getAttribute("title") || e.className || e.tagName).toString().replace(/\s+/g, " ").trim().slice(0, 40);
  const under = [], excepted = [], kinds = {};
  for (const e of vis) {
    const r = e.getBoundingClientRect();
    const k = e.getAttribute("role") ?? e.tagName.toLowerCase();
    kinds[k] = Math.min(kinds[k] ?? 1e9, Math.round(r.height * 100) / 100);
    if (r.height >= 44) continue;
    const rec = `${name(e)} ${Math.round(r.width)}x${Math.round(r.height * 100) / 100}`;
    if (e.closest(".mapboxgl-ctrl-attrib, .mapboxgl-ctrl-logo, [data-testid=band-aerial-logo], [data-testid=band-aerial-attribution]")) excepted.push(rec);
    else under.push(rec);
  }
  return { checked: vis.length, under, excepted, minByKind: kinds };
}
// No mono family, no uppercase transform, on every shown element.
function typeInPage(sel) {
  const band = document.querySelector(sel);
  if (!band) return null;
  const shown = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden"; };
  const head = band.querySelector(".a-head, .band-head, header") ?? null;
  const body = [], headHits = [];
  let n = 0;
  for (const e of band.querySelectorAll("*")) {
    if (!shown(e)) continue;
    const cs = getComputedStyle(e);
    const hit = [];
    if (/mono/i.test(cs.fontFamily)) hit.push(`mono(${cs.fontFamily.split(",")[0]})`);
    if (cs.textTransform === "uppercase") hit.push("uppercase");
    n++;
    if (!hit.length) continue;
    // Only count elements that render text of their own.
    const ownText = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!ownText) continue;
    const rec = `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join(".")} "${e.textContent.trim().slice(0, 24)}" ${hit.join("+")}`;
    if (head && head.contains(e) && !e.closest(".w-what")) headHits.push(rec);
    else body.push(rec);
  }
  return { elements: n, body: [...new Set(body)], head: [...new Set(headHits)] };
}
// "About the work" (and the measured panel when open): each column's bottom
// and each cell's top, in page px.
function colsInPage() {
  const out = {};
  const bx = (e) => { const r = e.getBoundingClientRect(); return { top: +(r.top + scrollY).toFixed(2), bottom: +(r.bottom + scrollY).toFixed(2), left: +r.left.toFixed(2), right: +r.right.toFixed(2), h: +r.height.toFixed(2) }; };
  const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  for (const [k, s] of [["about", "[data-testid=what-about] .w-cols"], ["measured", "[data-testid=what-measured-panel] .w-cols"], ["files", "[data-testid=what-files-panel] .w-cols"]]) {
    const g = document.querySelector(s);
    if (!g || !shown(g)) continue;
    const cols = [...g.children].filter(shown).map(bx);
    const twoCol = cols.length >= 2 && cols[1].left >= cols[0].right - 1 && Math.abs(cols[1].top - cols[0].top) <= 1;
    const cells = [...g.children].filter(shown).map((c) => [...c.querySelectorAll(":scope > .a-cell, :scope > * > .a-cell")].filter(shown).map((e) => `${e.getAttribute("data-testid")}@${Math.round(e.getBoundingClientRect().top + scrollY)}-${Math.round(e.getBoundingClientRect().bottom + scrollY)}`));
    out[k] = { twoCol, bottoms: cols.map((c) => c.bottom), diff: twoCol ? +(Math.max(...cols.map((c) => c.bottom)) - Math.min(...cols.map((c) => c.bottom))).toFixed(2) : null, grid: bx(g), cells };
  }
  const b = document.querySelector("[data-testid=band-what]");
  out.bandH = b ? +b.getBoundingClientRect().height.toFixed(2) : null;
  out.whereH = (() => { const w = document.querySelector("[data-testid=band-where]"); return w ? +w.getBoundingClientRect().height.toFixed(2) : null; })();
  // Text past the right edge at the band's width (overflow at 390).
  const band = b?.getBoundingClientRect();
  out.overflow = [];
  if (b) {
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      for (const r of rg.getClientRects()) if (r.width > 0 && (r.right > band.right + 0.5 || r.left < band.left - 0.5)) { out.overflow.push(`"${t.textContent.trim().slice(0, 30)}" ${Math.round(r.left)}-${Math.round(r.right)} vs band ${Math.round(band.left)}-${Math.round(band.right)}`); break; }
    }
    out.docScrollW = document.documentElement.scrollWidth;
    out.vw = innerWidth;
    // #517 round 1, finding 8: the viewport and the band's own box, so a
    // crop identical across sizes is shown to be the same band, not a
    // missed resize.
    out.vh = innerHeight;
    out.bandBox = { left: Math.round(band.left), width: Math.round(band.width) };
  }
  return out;
}
function boxRowsInPage() {
  const box = document.querySelector("[data-testid=what-guesses]");
  if (!box) return null;
  const rows = [...box.querySelectorAll(":scope > .a-cell, :scope > * > .a-cell")].map((e) => ({ id: e.getAttribute("data-testid"), top: +(e.getBoundingClientRect().top + scrollY).toFixed(2), h: +e.getBoundingClientRect().height.toFixed(2), line: (e.querySelector(".w-src")?.innerText ?? "").replace(/\s+/g, " ").trim() }));
  const r = box.getBoundingClientRect();
  return { head: document.querySelector("[data-testid=what-guesses-head]")?.innerText ?? null, boxTop: +(r.top + scrollY).toFixed(2), boxH: +r.height.toFixed(2), rows };
}
const fontsOk = (p) => p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });

// The crop: the What band, with the page's fixed/sticky chrome outside the
// band hidden for the capture only (Playwright's screenshot `style`; no
// layout change).  `extra` widens the crop to a popup that hangs below.
async function crop(p, name, { keep = true } = {}) {
  await p.evaluate((sel) => {
    const band = document.querySelector(sel);
    for (const e of document.querySelectorAll("body *")) {
      if (band.contains(e) || e.contains(band)) continue;
      const pos = getComputedStyle(e).position;
      if (pos === "fixed" || pos === "sticky") e.setAttribute("data-walk-hide", "");
    }
  }, BAND);
  const box = await p.evaluate((sel) => {
    const b = document.querySelector(sel).getBoundingClientRect();
    let bottom = b.bottom, right = b.right;
    for (const pop of document.querySelectorAll(`${sel} [role=listbox], ${sel} [data-testid=date-picker], ${sel} .w-tip:not([hidden])`)) {
      const r = pop.getBoundingClientRect(); bottom = Math.max(bottom, r.bottom); right = Math.max(right, r.right);
    }
    return { x: b.left + scrollX, y: b.top + scrollY, width: Math.min(right, document.documentElement.clientWidth) - b.left, height: bottom - b.top };
  }, BAND);
  const dir = keep ? CROPS : EXTRA;
  const file = path.join(dir, `${name}.png`);
  // The band is taller than the viewport: capture the page and clip to it.
  await p.screenshot({ path: file, fullPage: true, clip: box, style: "[data-walk-hide]{visibility:hidden !important}" });
  await p.evaluate(() => document.querySelectorAll("[data-walk-hide]").forEach((e) => e.removeAttribute("data-walk-hide")));
  return `${keep ? "crops/" : "extra/"}${name}.png`;
}
async function measure(p, sz, state, opts = {}) {
  await p.waitForTimeout(opts.wait ?? 600);
  const file = await crop(p, `w517-${state}-${sz}`, opts);
  const ax = await axeBand(p);
  const s = await p.evaluate(smallInPage, BAND);
  const ty = await p.evaluate(typeInPage, BAND);
  const cols = await p.evaluate(colsInPage);
  const box = await p.evaluate(boxRowsInPage);
  const text = await p.evaluate((sel) => (document.querySelector(sel)?.innerText ?? "").replace(/\(why: [^)]*\)/g, "").replace(/\n+/g, " / ").slice(0, 900), BAND);
  const st = { sz, state, file, axe: ax, small: s, type: ty, cols, box, text };
  R.states.push(st);
  log(`  [${sz}] ${state}: axe ${ax.length}${ax.length ? " " + ax.join("; ") : ""} | 44px checked ${s.checked}, under ${s.under.length}${s.under.length ? " " + s.under.join("; ") : ""} | min h ${JSON.stringify(s.minByKind)}`);
  log(`     type: ${ty.elements} shown elements, mono/caps in the section ${ty.body.length}${ty.body.length ? " " + ty.body.join("; ") : ""} | in the band head ${ty.head.length}${ty.head.length ? " " + ty.head.join("; ") : ""}`);
  log(`     cols: ${JSON.stringify(cols)}`);
  if (box) log(`     box: ${JSON.stringify(box)}`);
  log(`     text: ${text}`);
  return st;
}

// ── navigation ───────────────────────────────────────────────────────────
async function setup(w, h) {
  const b = await chromium.launch();
  const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const net = { bad: [] };
  p.on("response", (r) => { if (r.url().startsWith(SITE) && r.status() >= 400) net.bad.push(`${r.status()} ${r.url().replace(SITE, "")}`); });
  p.on("pageerror", (e) => net.bad.push(`pageerror ${oneLine(e).slice(0, 160)}`));
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  return { b, p, net };
}
async function openPicker(p, label = "Pick on map") {
  await p.getByRole("button", { name: label }).first().click();
  await p.waitForSelector("[role=dialog]", { timeout: 30000 });
  await p.waitForTimeout(1500);
}
async function pinAt(p, [lat, lng]) {
  const t = p.locator("[role=dialog] button", { hasText: "Or enter coordinates manually" });
  if (await t.count()) await t.click();
  await p.getByLabel("Latitude").fill(String(lat));
  await p.getByLabel("Longitude").fill(String(lng));
  await p.waitForFunction(() => {
    const d = document.querySelector("[role=dialog]");
    return d && !/Looking up the roads at your pin/.test(d.innerText) && (d.querySelector("[data-testid=road-pick-panel]") || d.querySelector("[data-testid=road-lookup-status]"));
  }, null, { timeout: 60000 });
  await p.waitForTimeout(2000);
}
async function saveWindow(p) {
  await p.getByRole("button", { name: "Save and close" }).click();
  await p.waitForSelector("[role=dialog]", { state: "detached", timeout: 15000 });
  await p.waitForTimeout(2500);
}
async function kindAndSide(p, kind = "shoulder") {
  await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.locator(`label.nyq-answer:has([data-testid=kind-chip-${kind}])`).click();
  await p.waitForTimeout(1200);
  const foot = p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child");
  if (!/Confirm and lay out/.test((await foot.innerText().catch(() => "")).trim())) await foot.click();
  await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
}
async function sideAndConfirm(p) {
  await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1000);
  const opt = p.locator("[data-testid=where-questions] label.nyq-answer:has([data-testid=side-option])");
  const checked = await p.locator("[data-testid=where-questions] [data-testid=side-option]:checked").count();
  log(`     side options ${await opt.count()}, checked ${checked}`);
  if ((await opt.count()) && !checked) { await opt.first().click(); await p.waitForTimeout(2000); }
  await p.locator("[data-testid=where-confirm]").click();
  await p.waitForSelector(BAND, { timeout: 90000 });
  await settle(p);
}
// The jurisdiction's breakdown has answered (no "Checking" left in the band).
async function settle(p) {
  await p.waitForFunction((sel) => {
    const t = document.querySelector(sel)?.innerText ?? "";
    return t && !/Checking|checking your dates|◌ loading/.test(t);
  }, BAND, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(1500);
}
async function pickLb(p, id, value) {
  await p.locator(`#${id}`).click();
  await p.waitForSelector("[role=listbox]", { timeout: 5000 });
  await p.locator(`[role=listbox] [role=option][data-value="${value}"]`).click();
  await p.waitForTimeout(1200);
}
async function closeTipAndPop(p) {
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
}

// ── the flows ────────────────────────────────────────────────────────────
async function colfax(p, net, sz) {
  await openPicker(p);
  await pinAt(p, PT.colfax);
  await p.locator("[role=dialog] [role=radio]", { hasText: "East Colfax Avenue" }).click();
  await p.waitForTimeout(1500);
  await saveWindow(p);
  await kindAndSide(p);
  await sideAndConfirm(p);
  await p.locator(BAND).scrollIntoViewIfNeeded();
  await measure(p, sz, "guesses-3");
  await measure(p, sz, "measured-closed");
  await measure(p, sz, "dates-unset");
  await measure(p, sz, "files-closed");
  // A why tip for a guess: the road type's reason line.
  await p.getByTestId("info-toggle-road-type").click();
  await measure(p, sz, "tip-guess", { wait: 500 });
  await closeTipAndPop(p);
  // The dropdown open: the jurisdiction.
  await p.locator("#what-jurisdiction").click();
  await p.waitForSelector("[role=listbox]", { timeout: 5000 });
  await measure(p, sz, "dropdown-jurisdiction", { wait: 500 });
  await closeTipAndPop(p);
  // A guess changed: street class Arterial -> Collector.  Each box row's y
  // before and after.
  const before = await p.evaluate(boxRowsInPage);
  await pickLb(p, "what-street-class", "collector");
  await settle(p);
  const after = await p.evaluate(boxRowsInPage);
  const moved = before.rows.map((r, i) => `${r.id} ${r.top}->${after.rows[i]?.top} (${(after.rows[i]?.top ?? NaN) - r.top} px)`);
  log(`  [${sz}] guess changed: box ${before.boxTop}/${before.boxH} -> ${after.boxTop}/${after.boxH}; rows ${moved.join(", ")}; lines ${JSON.stringify(after.rows.map((r) => r.line))}`);
  R.states.push({ sz, state: "guess-checked-y", before, after });
  await measure(p, sz, "guess-checked");
  // The measured row open, and a measured field's tip (speed).
  await p.getByTestId("what-measured-toggle").click();
  await measure(p, sz, "measured-open");
  await p.getByTestId("info-toggle-speed").click();
  await measure(p, sz, "tip-measured", { wait: 500 });
  await closeTipAndPop(p);
  await p.getByTestId("what-measured-toggle").click();
  // File details open.
  await p.getByTestId("what-files-toggle").click();
  await measure(p, sz, "files-open");
  await p.getByTestId("what-files-toggle").click();
  // Work dates: Mon Nov 16 to Fri Nov 20 2026 (weekdays), then the hours.
  await p.locator("#what-date").click();
  await p.waitForSelector("[data-testid=date-picker]");
  await measure(p, sz, "dates-picker-open", { keep: false, wait: 400 });
  await p.locator("[data-testid=date-picker] [data-date='2026-11-16']").click();
  await p.waitForTimeout(500);
  await p.locator("[data-testid=date-picker] [data-date='2026-11-20']").click();
  await p.waitForTimeout(500);
  if (await p.locator("[data-testid=date-picker]").count()) await closeTipAndPop(p);
  await settle(p);
  await measure(p, sz, "dates-set-no-times", { keep: false });
  // Inside Denver's weekday window (8:30 AM to 3:30 PM): 9:00 AM to 3:00 PM.
  await pickLb(p, "sched-start", "9");
  await pickLb(p, "sched-end", "15");
  await settle(p);
  await measure(p, sz, "dates-inside");
  // #227's windows table, opened from "See all of Denver's work hours".
  const all = p.getByTestId("what-hours-all");
  if (await all.count()) {
    await all.click();
    await measure(p, sz, "hours-all-open");
    await all.click();
  } else log(`  [${sz}] no "See all" link`);
  // Outside: 7:00 AM to 5:00 PM.
  await pickLb(p, "sched-start", "7");
  await pickLb(p, "sched-end", "17");
  await settle(p);
  await measure(p, sz, "dates-outside");
  log(`  [${sz}] colfax 4xx/5xx/page errors: ${net.bad.length ? net.bad.join(", ") : "none"}`);
}
// One guess: the failing point (no road; a direction answered), the pin's
// jurisdiction guessed.
async function pin(p, net, sz) {
  await openPicker(p);
  await pinAt(p, PT.fail);
  await p.locator("[data-testid=road-axis]", { hasText: "North–south" }).click();
  await p.waitForTimeout(800);
  await saveWindow(p);
  await kindAndSide(p);
  await sideAndConfirm(p);
  await p.locator(BAND).scrollIntoViewIfNeeded();
  await measure(p, sz, "guesses-1");
  log(`  [${sz}] pin 4xx/5xx/page errors: ${net.bad.length ? net.bad.join(", ") : "none"}`);
}
// None: on E Colfax every guess checked, then the pin moved (Edit on map)
// to N Lincoln St, a new road: the checked values are the operator's, so no
// guess is left.
async function zero(p, net, sz) {
  await openPicker(p);
  await pinAt(p, PT.colfax);
  await p.locator("[role=dialog] [role=radio]", { hasText: "East Colfax Avenue" }).click();
  await p.waitForTimeout(1500);
  await saveWindow(p);
  await kindAndSide(p);
  await sideAndConfirm(p);
  // Each guess picked at the value it holds: the check (S2).
  for (const id of ["what-road-type", "what-street-class", "what-jurisdiction"]) {
    await p.locator(`#${id}`).click();
    await p.waitForSelector("[role=listbox]");
    await p.locator("[role=listbox] [role=option][aria-selected=true]").click();
    await p.waitForTimeout(1000);
  }
  await settle(p);
  await measure(p, sz, "all-checked", { keep: false });
  await p.locator("[data-testid=fact-link-where]").click();
  await p.waitForTimeout(1500);
  await openPicker(p, "Edit on map");
  await pinAt(p, PT.lincoln);
  const enabled = await p.evaluate(() => !([...document.querySelectorAll("[role=dialog] button")].find((x) => x.innerText.trim() === "Save and close")?.disabled));
  if (!enabled) await p.locator("[role=dialog] [role=radio]").first().click();
  await p.waitForTimeout(1000);
  await saveWindow(p);
  const done = p.getByTestId("where-edit-done");
  if ((await done.count()) && (await done.first().isVisible())) { await done.first().click(); await p.waitForTimeout(2000); }
  await sideAndConfirm(p);
  await p.locator(BAND).scrollIntoViewIfNeeded();
  await measure(p, sz, "guesses-0");
  log(`  [${sz}] zero 4xx/5xx/page errors: ${net.bad.length ? net.bad.join(", ") : "none"}`);
}

const FN = { colfax, pin, zero };
for (const [w, h] of SIZES) {
  const sz = String(w);
  for (const f of FLOWS) {
    log(`== ${w}x${h} ${f}`);
    const { b, p, net } = await setup(w, h);
    try {
      log(`  Inter loaded: ${await fontsOk(p)}`);
      await FN[f](p, net, sz);
    } catch (e) {
      log(`  ${f} ERROR ${oneLine(e).slice(0, 300)}`);
      R.states.push({ sz, state: `${f} ERROR`, error: oneLine(e).slice(0, 300) });
      await p.screenshot({ path: path.join(EXTRA, `error-${sz}-${f}.png`) }).catch(() => {});
    } finally {
      await b.close();
    }
  }
}
fs.writeFileSync(path.join(EXTRA, `walk517-${Date.now()}.json`), JSON.stringify(R, null, 1));
