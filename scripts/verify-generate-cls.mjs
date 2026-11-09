// #470 ruling 8 (Ryan, 2026-11-08): layout shift across one Generate, from
// the press to the settled strip, must stay under 0.1 at 1440x900,
// 1198x930 and 390x844.  This is the permanent check (closes #452's
// measurement).  It pins 1600 E Colfax Ave, Denver, picks shoulder work and
// the first side, presses Generate, and sums every `layout-shift` entry with
// `hadRecentInput` false from the press until the strip has settled (#452's
// measure).  Exits 1 when any width reaches 0.1.
//
// Run from the repo root.
//   Local (the site on :3000 against the stubbed backend, see below):
//     node scripts/verify-generate-cls.mjs
//   Production (live road data, no hold):
//     SITE=https://www.conestruct.com HOLD_MS=0 GATE_BYPASS_TOKEN=... node scripts/verify-generate-cls.mjs
// Env:
//   SITE      the site (default http://localhost:3000)
//   SIZES     "1440x900,1198x930,390x844" (default)
//   HOLD_MS   hold the audit's answer this long (default 4000 locally, 0 on
//             production).  A local audit answers in ~0.2 s, inside the
//             500 ms input window where no shift counts, so the hold moves
//             the answer out of it.  4 s is shorter than any measured warm
//             Generate (4.7-8.4 s, #470 evidence.md): a lower bound.
//   STUB_ROAD /api/road-bearing answered from the recorded Colfax fixture
//             (default 1 locally, 0 on production).
// The local backend with Overpass replayed (never live):
//   uv run --extra dev python scripts/verify-generate-cls-stub.py . "<fixture dir>;<fixture dir>" 8000
//   (the two dirs: validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture
//    and validation-artifacts/committed/ux-site-map/evidence/overpass-fixture;
//    WALK_SCAN_MODE=empty or signals replays the site scan empty, or with
//    its signal nodes only: the no-question and the ledger-only cases)
//   REDUCED   1 runs the pass under prefers-reduced-motion (the fade can
//             hide a shift; this pass has none), and asserts no animation
//             on 6 settled elements, not Setup (the strip, NEEDS YOU, other
//             conditions, Your plan, the Downloads cards, the reference
//             group); the vitest cascade test covers every selector.
// The outline check (#470 repair 2): layout shift cannot see an outline
// of the wrong size or place, because the sections mount NEW at the swap.
// So the check also records each outline block's box while the call is in
// flight, and its section's box after the settle, and reports the deltas.
// It FAILS when a fixed-layout section (the map frame, Setup, Your plan,
// the reference group) differs in height by more than TOL_PX,
// or, when NEEDS YOU came in at its reserved height, when any section's
// top differs by more than TOL_PX.  NEEDS YOU's own delta is REPORTED and
// never fails: its height is unknowable before the scan answers (a known
// open question for Ryan, #470 rulings.md R145-3).
// The gate header rides only the site's own origin (scripts/gate.cjs).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { newGatedContext, gateHeaders, isSiteRequest, isProduction } = require("./gate.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.env.SITE ?? "http://localhost:3000";
const PROD = isProduction(SITE);
const SIZES = (process.env.SIZES ?? "1440x900,1198x930,390x844").split(",").map((s) => s.split("x").map(Number));
const HOLD_MS = Number(process.env.HOLD_MS ?? (PROD ? 0 : 4000));
const STUB_ROAD = (process.env.STUB_ROAD ?? (PROD ? "0" : "1")) === "1";
const LIMIT = 0.1;
const REDUCED = process.env.REDUCED === "1";
// CHOSEN: 8 px, the tight gap (--space-tight); a box off by more than
// that is visibly not where its section lands.
const TOL_PX = 8;
const OUTLINE = {
  needs: "[data-outline=needs]", map: "[data-outline=needs] .ro-map", other: "[data-outline=other]",
  setup: "[data-outline=setup]", plan: "[data-outline=plan]", downloads: "[data-outline=downloads]", refs: "[data-outline=refs]",
};
const SETTLED = {
  needs: "section.needs-you", map: "section.needs-you .nyq-map-frame", other: "section.ny-other",
  setup: "[data-testid=results-head-slot]", plan: "[data-testid=your-plan]", downloads: "#downloads", refs: ".results-disc",
};
// Heights known before the scan answers.  Downloads is NOT among them: its
// header carries the open-question count (OutputCards `pendingAnswers`),
// so its height follows NEEDS YOU's and is checked only when NEEDS YOU
// came in at its reserve.  The map belongs to NEEDS YOU (absent with no
// question).
const FIXED = ["map", "setup", "plan", "refs"];
const boxes = (p, sel) => p.evaluate((sel) => {
  const out = {};
  for (const [k, s] of Object.entries(sel)) {
    const e = document.querySelector(s);
    if (!e) continue;
    const r = e.getBoundingClientRect();
    out[k] = { top: Math.round(r.top + scrollY), h: Math.round(r.height) };
  }
  return out;
}, sel);

const FIX = JSON.parse(
  fs.readFileSync(path.join(ROOT, "validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json"), "utf8"),
);
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const distM = (a, at) => Math.hypot((a.lat - at.lat) * 111320, (a.lon - at.lng) * 111320 * Math.cos(rad(at.lat)));
const COLFAX_WEST = [1547338997, 1547338998, 223788857, 600545918, 791808880];
function roadAnswer(at) {
  const g = [];
  for (const id of COLFAX_WEST) {
    for (const n of FIX.elements.find((e) => e.type === "way" && e.id === id).geometry) {
      const l = g[g.length - 1];
      if (!l || l.lat !== n.lat || l.lon !== n.lon) g.push(n);
    }
  }
  const w = FIX.elements.find((e) => e.type === "way" && e.id === COLFAX_WEST[0]);
  let i = 0;
  g.forEach((n, k) => { if (distM(n, at) < distM(g[i], at)) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return JSON.stringify({
    scan_status: "ok", primary_index: 0, isUrban: true, placeName: "Denver",
    candidates: [{
      way_id: String(w.id), highway_class: w.tags.highway, name: w.tags.name, ref: s("ref"), bearing: +brg(a, b).toFixed(2),
      snap_distance_m: +distM(g[i], at).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
      tags: { oneway: s("oneway"), maxspeed: s("maxspeed"), lanes: s("lanes"), lanes_forward: s("lanes:forward"), lanes_backward: s("lanes:backward"),
        lanes_both_ways: s("lanes:both_ways"), turn_lanes: s("turn:lanes"), turn_lanes_forward: s("turn:lanes:forward"), turn_lanes_backward: s("turn:lanes:backward") },
      geometry: g.map((n) => [n.lat, n.lon]),
    }],
  });
}

async function one(w, h) {
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: REDUCED ? "reduce" : "no-preference" });
    await ctx.addInitScript(() => {
      window.__ls = [];
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, r: e.hadRecentInput, t: e.startTime }); })
          .observe({ type: "layout-shift", buffered: true });
      } catch {}
    });
    const p = await ctx.newPage();
    if (STUB_ROAD) {
      await p.route("**/api/road-bearing**", (r) => {
        const asked = JSON.parse(r.request().postData() ?? "null");
        return r.fulfill({ status: 200, contentType: "application/json", body: roadAnswer({ lat: asked.lat, lng: asked.lng }) });
      });
    }
    let hold = 0;
    await p.route("**/api/render/audit", async (r) => {
      if (hold === 0) return r.fallback();
      const url = r.request().url();
      const own = isSiteRequest(url, SITE) ? gateHeaders(SITE) : {};
      const resp = await r.fetch({ headers: { ...r.request().headers(), ...own } });
      const body = await resp.body();
      await new Promise((res) => setTimeout(res, hold));
      return r.fulfill({ status: resp.status(), headers: resp.headers(), body });
    });
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.getByRole("button", { name: "Pick on map" }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel("Address or intersection search").fill("1600 E Colfax Ave, Denver");
    await p.getByRole("button", { name: "SEARCH" }).click();
    await p.waitForFunction(() => /PICK THE ROAD|Which road|Save & Close/i.test(document.querySelector("[role=dialog]")?.innerText ?? ""), null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole("dialog").locator("button", { hasText: /Colfax/ });
    if (await want.count()) await want.first().click().catch(() => {});
    await p.waitForTimeout(2000);
    await p.getByRole("button", { name: "Save & Close" }).click();
    await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.locator("label.nyq-answer:has([data-testid=kind-chip-shoulder])").click();
    await p.waitForTimeout(1200);
    await p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();
    await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 30000 });
    await p.waitForTimeout(1200);
    await p.locator("[data-testid=where-questions] label.nyq-answer").first().click();
    await p.waitForTimeout(1500);
    await p.locator("[data-testid=where-confirm]").click();
    await p.waitForSelector("[data-testid=cell-work-type]", { timeout: 90000 });
    await p.waitForTimeout(3000);
    const oneWay = p.getByRole("button", { name: /^One-way$/ });
    if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(3000); }
    const laneOk = p.getByRole("button", { name: "Lane count is right" });
    if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(3000); }
    await p.waitForFunction(() => { const g = document.querySelector("[data-testid=generate-plan]"); return g && !g.disabled; }, null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    hold = HOLD_MS;
    const t0 = await p.evaluate(() => performance.now());
    await p.getByTestId("generate-plan").click();
    // The outline's boxes while the call is in flight (the press scroll done).
    let before = {};
    if (HOLD_MS >= 2000) {
      await p.waitForTimeout(1200);
      before = await boxes(p, OUTLINE);
    }
    await p.waitForFunction(() => {
      const s = document.querySelector(".status-slot")?.innerText ?? "";
      return /Plan ready|VERIFIED|UNAVAILABLE|DECLINED/i.test(s) && !document.querySelector("[data-testid=results-outline]") && document.querySelector(".ref-sections");
    }, null, { timeout: 240000 });
    hold = 0;
    await p.waitForTimeout(2500);
    const after = await boxes(p, SETTLED);
    // ruling 5 under reduced motion: nothing in the results animates.
    const anim = await p.evaluate(() => {
      const sel = [".status-slot > .status-bar", "section.needs-you", "section.ny-other", "[data-testid=your-plan]", "#downloads > *", ".results-disc"];
      return sel.map((s) => { const e = document.querySelector(s); return e ? `${s}=${getComputedStyle(e).animationName}` : null; }).filter(Boolean);
    });
    const deltas = {};
    for (const k of Object.keys(OUTLINE)) {
      if (before[k] && after[k]) deltas[k] = { top: after[k].top - before[k].top, h: after[k].h - before[k].h };
      else if (before[k] || after[k]) deltas[k] = { absent: before[k] ? "after" : "before" };
    }
    const r = await p.evaluate((t0) => {
      const es = (window.__ls ?? []).filter((e) => e.t >= t0 && !e.r);
      return {
        cls: +es.reduce((s, e) => s + e.v, 0).toFixed(4),
        strip: (document.querySelector(".status-slot")?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
        questions: document.querySelectorAll("section.needs-you .nyq-card").length,
        needsYou: Math.round(document.querySelector("section.needs-you")?.getBoundingClientRect().height ?? 0),
      };
    }, t0);
    return { ...r, deltas, anim };
  } finally {
    await b.close();
  }
}

let failed = false;
for (const [w, h] of SIZES) {
  let r;
  try {
    r = await one(w, h);
  } catch (e) {
    console.log(`${w}x${h} ERROR ${String(e).slice(0, 200)}`);
    failed = true;
    continue;
  }
  const ok = r.cls < LIMIT;
  if (!ok) failed = true;
  console.log(`${w}x${h}${REDUCED ? " reduced-motion" : ""} generate CLS ${r.cls} ${ok ? "PASS" : "FAIL"} (< ${LIMIT}) | NEEDS YOU ${r.needsYou} px | strip: ${r.strip}`);
  if (HOLD_MS >= 2000) {
    const needsAtReserve = r.deltas.needs && !r.deltas.needs.absent && Math.abs(r.deltas.needs.h) <= TOL_PX;
    const bad = [];
    for (const [k, d] of Object.entries(r.deltas)) {
      if (d.absent) { if (!["needs", "other", "map"].includes(k)) bad.push(`${k} absent ${d.absent}`); continue; }
      if ((FIXED.includes(k) || (needsAtReserve && k === "downloads")) && Math.abs(d.h) > TOL_PX) bad.push(`${k} height ${d.h}`);
      if (needsAtReserve && Math.abs(d.top) > TOL_PX) bad.push(`${k} top ${d.top}`);
    }
    const nd = r.deltas.needs;
    console.log(`   outline vs settled (top/h deltas, px): ${Object.entries(r.deltas).map(([k, d]) => (d.absent ? `${k} absent ${d.absent}` : `${k} ${d.top}/${d.h}`)).join(" | ")}`);
    console.log(`   NEEDS YOU delta ${nd && !nd.absent ? nd.h : "n/a"} px: reported, not failed (its height is unknowable before the scan; open question for Ryan)`);
    console.log(`   outline check ${bad.length ? "FAIL: " + bad.join(", ") : "PASS"} (tolerance ${TOL_PX} px)`);
    if (bad.length) failed = true;
  }
  if (REDUCED) {
    const moving = r.anim.filter((a) => !/=none$/.test(a));
    console.log(`   reduced motion: ${moving.length ? "FAIL animating: " + moving.join(", ") : "PASS, no animation on " + r.anim.length + " elements"}`);
    if (moving.length) failed = true;
  }
}
process.exit(failed ? 1 : 0);
