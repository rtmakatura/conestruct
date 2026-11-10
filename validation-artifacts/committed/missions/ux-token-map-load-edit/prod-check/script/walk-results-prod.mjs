// PRODUCTION COPY (mission #486 prod check, 2026-11-10) of issue-484/script/walk.mjs,
// run against https://www.conestruct.com with live data (STUB_ROAD defaults to 0 on
// production).  Added for the prod check, marked "#486:" below: #482's reads with the
// audit held (HOLD_MS=16000: the strip and the outline's note at 14.5 s, the outline's
// reference-group gap, then the settled gap); #479's Details closed / open / Esc on
// question 1; each full map request's fetch time and its cross-street header values;
// console errors; axe from the main checkout.  Read-only: one Generate, answers picked
// on the page, nothing saved.
// usage: SITE=https://www.conestruct.com HOLD_MS=16000 OUT=<dir> GATE_BYPASS_TOKEN=... node walk-results-prod.mjs
//
// #484 walk: #483's walk (issue-483/script/walk.mjs), plus the intersection
// question's cross-street tag: its text, size, weight, colours, its box in
// the frame and whether it meets the zoom buttons or the street-level link,
// and the key's text.  Each NEEDS YOU question soft, then sharp: box,
// frame, crops, axe, the 44 px measure.  The full image is held
// MAP_HOLD_MS so the soft one can be seen.
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
//     checks layout shift and outlines left; it prints the outline box
//     check as SKIPPED, since that needs HOLD_MS >= 2000.
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
// never fails: its height is unknowable before the scan answers.  #477
// answer 1 (Ryan, 2026-11-09): the reserve is the room of one question, so
// the one-question scan (WALK_SCAN_MODE=signals) is the case that comes in
// at it and has every top checked; more questions grow downward.  With no
// question the outline closes: any [data-outline] left after the settle
// FAILS.
// The soft→sharp check (#483 ruling 4, Ryan 2026-11-09: "A NEEDS YOU map's
// box doesn't change size from soft to sharp"): every animation frame from
// the page's load, each NEEDS YOU map frame's box is recorded the first time
// it shows its soft image and the first time its full image is decoded
// (`data-map` soft / sharp, `data-loaded`), with each image's `data-frame`
// (the backend's x-map-frame).  After the settle the run waits up to
// SHARP_WAIT_MS for the first question's full image.  It FAILS when a map's
// soft and sharp boxes differ (0 px, rounded) or their frames differ; a map
// that never showed both (failed, or already drawn this session) prints
// SKIPPED with the reason, never PASS.
// The gate header rides only the site's own origin (scripts/gate.cjs), and
// no output carries the token or a header line, even on a crash (#481:
// guardOutput, and errors print as their first line, redacted).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The walk sits in the evidence folder; the repo is six folders up.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const require = createRequire(path.join(ROOT, "scripts", "verify-generate-cls.mjs"));
const { newGatedContext, gateHeaders, isSiteRequest, isProduction, guardOutput, oneLine, isClosedError } = require("./gate.cjs");
guardOutput();
const { chromium } = require("playwright");

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
const MAP_HOLD_MS = Number(process.env.MAP_HOLD_MS ?? 2500);
const OUT = process.env.OUT;
const AXE = fs.readFileSync(path.join(ROOT, "../../..", "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
// #483: CHOSEN, not measured: room for a cold container, the map's own
// Overpass read and two Mapbox images; a slower map prints SKIPPED, not PASS.
const SHARP_WAIT_MS = 30000;
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
      // #483: each NEEDS YOU map frame's box at its first soft and sharp paint.
      window.__nyq = [];
      const seen = new Map();
      const tick = () => {
        for (const f of document.querySelectorAll(".nyq-map-frame")) {
          let rec = seen.get(f);
          if (!rec) { rec = { phases: {} }; seen.set(f, rec); window.__nyq.push(rec); }
          const ph = f.getAttribute("data-map");
          const sharp = f.querySelector("img.nyq-map-sharp");
          const key = ph === "sharp" ? (sharp?.hasAttribute("data-loaded") ? "sharp" : null) : ph;
          if (!key || rec.phases[key]) continue;
          const r = f.getBoundingClientRect();
          const img = key === "sharp" ? sharp : f.querySelector("[data-testid=needs-you-map-soft]");
          rec.phases[key] = { w: Math.round(r.width), h: Math.round(r.height), frame: img?.getAttribute("data-frame") ?? null };
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      window.__ls = [];
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, r: e.hadRecentInput, t: e.startTime }); })
          .observe({ type: "layout-shift", buffered: true });
      } catch {}
    });
    const p = await ctx.newPage();
    // #486: console errors, page errors, and each map request's time.
    const extra = { console: [], pageerrors: [], maps: [], wait: {}, details: null, settledGap: null };
    p.on("console", (m) => { if (m.type() === "error") extra.console.push(m.text().slice(0, 200)); });
    p.on("pageerror", (e) => extra.pageerrors.push(String(e).split("\n")[0].slice(0, 200)));
    p.on("requestfinished", (rq) => {
      if (!/\/api\/needs-you-map/.test(rq.url())) return;
      let soft = false;
      try { soft = JSON.parse(rq.postData() ?? "{}").soft === true; } catch {}
      if (soft) { const t = rq.timing(); extra.maps.push({ soft: true, ms: Math.round(t.responseEnd) }); }
    });
    if (STUB_ROAD) {
      await p.route("**/api/road-bearing**", (r) => {
        const asked = JSON.parse(r.request().postData() ?? "null");
        return r.fulfill({ status: 200, contentType: "application/json", body: roadAnswer({ lat: asked.lat, lng: asked.lng }) });
      });
    }
    let hold = 0;
    // #483: hold every full NEEDS YOU image (never the soft one).
    await p.route("**/api/needs-you-map", async (r) => {
      const soft = JSON.parse(r.request().postData() ?? "{}").soft === true;
      if (soft) return r.fallback();
      try {
        const url = r.request().url();
        const own = isSiteRequest(url, SITE) ? gateHeaders(SITE) : {};
        const t0m = Date.now();
        const resp = await r.fetch({ headers: { ...r.request().headers(), ...own } });
        const body = await resp.body();
        const rh = resp.headers();
        // #486: response header values for the cross street only (never request headers).
        extra.maps.push({ soft: false, ms: Date.now() - t0m, status: resp.status(), crossStreet: rh["x-map-cross-street"] ? decodeURIComponent(rh["x-map-cross-street"]) : null, crossTag: rh["x-map-cross-tag"] ?? null, frame: rh["x-map-frame"] ?? null });
        await new Promise((res) => setTimeout(res, MAP_HOLD_MS));
        return await r.fulfill({ status: resp.status(), headers: resp.headers(), body });
      } catch (e) {
        if (isClosedError(e)) return;
        await r.abort().catch(() => {});
      }
    });
    await p.route("**/api/render/audit", async (r) => {
      if (hold === 0) return r.fallback();
      // #481: this route carries the gate header itself; like gate.cjs's it
      // never rejects (Playwright doesn't await it).
      try {
        const url = r.request().url();
        const own = isSiteRequest(url, SITE) ? gateHeaders(SITE) : {};
        const resp = await r.fetch({ headers: { ...r.request().headers(), ...own } });
        const body = await resp.body();
        await new Promise((res) => setTimeout(res, hold));
        return await r.fulfill({ status: resp.status(), headers: resp.headers(), body });
      } catch (e) {
        if (isClosedError(e)) return;
        console.log(`${w}x${h} audit hold: ${oneLine(e)}`);
        await r.abort().catch(() => {});
      }
    });
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.getByRole("button", { name: "Pick on map" }).click();
    await p.waitForTimeout(1500);
    await p.getByLabel("Address or intersection search").fill("1600 E Colfax Ave, Denver");
    await p.getByRole("button", { name: "SEARCH" }).click();
    // #476: wait for the road list itself, not the "Save & Close" text, which
    // is in the dialog while it still reads DETECTING ROADS AT PIN (live
    // road data answers seconds later; the local stub answers in time).
    await p.waitForFunction(() => {
      const d = document.querySelector("[role=dialog]");
      const save = [...(d?.querySelectorAll("button") ?? [])].find((x) => /Save & Close/.test(x.innerText));
      return /PICK THE ROAD · \d+ FOUND|Which road/i.test(d?.innerText ?? "") || (save && !save.disabled);
    }, null, { timeout: 90000 });
    await p.waitForTimeout(1500);
    const want = p.getByRole("dialog").locator("button", { hasText: /Colfax/ });
    const found = (await want.count()) > 0;
    const clicked = found && (await want.first().click().then(() => true, () => false));
    await p.waitForTimeout(2000);
    // #476 (Rule 10): a run that walks on without Colfax says so.  Decided
    // from the dialog's road-picked row, which a list pick and the auto-
    // adopted sole road (the local stub) both show.
    const pickedName = await p.locator("[role=dialog] [data-testid=road-picked] .road-picked-name").first().innerText({ timeout: 1000 }).catch(() => "");
    if (!/Colfax/.test(pickedName)) console.log(`${w}x${h} WARN road pick: ${found && !clicked ? "Colfax option found but its click failed" : "no Colfax option found"}; walking with ${pickedName ? `"${pickedName}"` : "no road"} picked`);
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
      // #486 (#482): the outline's reference-group gap, then the strip and note at 14.5 s.
      extra.wait.outlineGap = await p.evaluate(() => {
        const d = document.querySelector("[data-outline=downloads]"), r = document.querySelector("[data-outline=refs]");
        return d && r ? +(r.getBoundingClientRect().top - d.getBoundingClientRect().bottom).toFixed(1) : null;
      });
      if (HOLD_MS >= 15000) {
        const now = await p.evaluate(() => performance.now());
        await p.waitForTimeout(Math.max(0, 14500 - (now - t0)));
        extra.wait.at14500 = await p.evaluate(() => {
          const line = document.querySelector(".status-slot .wait-line");
          const note = document.querySelector("[data-outline=needs] .ro-note");
          const body = document.body.innerText;
          return {
            line: (document.querySelector(".status-slot")?.innerText ?? "").replace(/\s+/g, " ").trim(),
            lineClass: line?.className ?? null,
            note: note ? note.textContent : null,
            noteH: note ? Math.round(note.getBoundingClientRect().height) : null,
            twentySeconds: /20 seconds/.test(body),
            outline: !!document.querySelector("[data-testid=results-outline]"),
          };
        });
        if (OUT) {
          await p.locator(".status-slot").screenshot({ path: path.join(OUT, `${w}x${h}-482-strip-14s.png`) }).catch(() => {});
          await p.locator("[data-outline=needs]").screenshot({ path: path.join(OUT, `${w}x${h}-482-needs-outline-14s.png`) }).catch(() => {});
        }
      }
    }
    await p.waitForFunction(() => {
      const s = document.querySelector(".status-slot")?.innerText ?? "";
      return /Plan ready|VERIFIED|UNAVAILABLE|DECLINED/i.test(s) && !document.querySelector("[data-testid=results-outline]") && document.querySelector(".ref-sections");
    }, null, { timeout: 240000 });
    hold = 0;
    const tag = `${w}x${h}`;
    // #486 (#482): the settled gap, the Downloads bottom to the reference group's top.
    extra.settledGap = await p.evaluate(() => {
      const d = document.querySelector("#downloads"), r = document.querySelector(".results-disc");
      return d && r ? { gap: +(r.getBoundingClientRect().top - d.getBoundingClientRect().bottom).toFixed(1), strip: (document.querySelector(".status-slot")?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 120) } : null;
    });
    // #486: what stands between Downloads and the reference group, at the settle and 6 s later.
    const gapDetail = () => p.evaluate(() => {
      const d = document.querySelector("#downloads"), r = document.querySelector(".results-disc");
      if (!d || !r) return null;
      const bx = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { el: `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${[...e.classList].join(".")}`, top: +(b.top + scrollY).toFixed(1), bottom: +(b.bottom + scrollY).toFixed(1), mt: cs.marginTop, mb: cs.marginBottom, text: (e.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 60) }; };
      const chain = [];
      let a = d; while (a && !a.parentElement?.contains(r)) a = a.parentElement;
      let n = a; while (n && !n.contains(r)) { chain.push(bx(n)); n = n.nextElementSibling; }
      if (n) chain.push(bx(n));
      const last = d.lastElementChild;
      return { gap: +(r.getBoundingClientRect().top - d.getBoundingClientRect().bottom).toFixed(1), downloads: bx(d), lastChild: last ? bx(last) : null, refs: bx(r), chain };
    });
    extra.gapDetailAtSettle = await gapDetail();
    if (OUT) {
      const g = await p.evaluate(() => {
        const d = document.querySelector("#downloads"), r = document.querySelector(".results-disc");
        if (!d || !r) return null;
        const a = d.getBoundingClientRect(), c = r.getBoundingClientRect();
        return { y: a.bottom + scrollY - 60, h: c.top - a.bottom + 120 };
      });
      if (g) await p.screenshot({ path: path.join(OUT, `${tag}-482-reference-gap.png`), fullPage: true, clip: { x: 0, y: g.y, width: w, height: g.h } }).catch(() => {});
    }
    const rows = [];
    const measure = async () => {
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await window.axe.run(document.querySelector("section.results") ?? document, { resultTypes: ["violations"] })).violations.map((x) => `${x.id}:${x.nodes.length}`));
      const small = await p.evaluate(() => {
        const out = [];
        for (const e of document.querySelector("section.needs-you").querySelectorAll("button, a, label.nyq-answer, summary")) {
          const r = e.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (getComputedStyle(e).visibility === "hidden") continue;
          if (r.width < 44 || r.height < 44) out.push(`${(e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 30)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
        }
        return out;
      });
      return { axe: v, small };
    };
    const state = () => p.evaluate(() => {
      const f = document.querySelector("section.needs-you .nyq-map-frame");
      if (!f) return null;
      const r = f.getBoundingClientRect();
      const fig = f.closest("figure").getBoundingClientRect();
      const label = document.querySelector("section.needs-you [data-testid=needs-you-map-loading]");
      const soft = f.querySelector("[data-testid=needs-you-map-soft]");
      const sharp = f.querySelector("img.nyq-map-sharp");
      const key = document.querySelector("section.needs-you [data-testid=needs-you-map-key]");
      return {
        phase: f.getAttribute("data-map"),
        box: `${Math.round(r.width)}x${Math.round(r.height)}`,
        figure: `${Math.round(fig.width)}x${Math.round(fig.height)}`,
        label: label ? label.innerText : null,
        labelPx: label ? getComputedStyle(label).fontSize : null,
        softFrame: soft?.getAttribute("data-frame") ?? null,
        sharpFrame: sharp?.getAttribute("data-frame") ?? null,
        keyHidden: key?.hasAttribute("data-hidden") ?? null,
        softFilter: soft ? getComputedStyle(soft).filter : null,
        title: (document.querySelector("section.needs-you .nyq-card h3, section.needs-you .nyq-card .nyq-title")?.innerText ?? "").slice(0, 60),
        keyText: key ? key.innerText.replace(/\s+/g, " ").trim() : null,
        chip: document.querySelector("section.needs-you [data-testid=needs-you-map-label]")?.innerText ?? null,
        tag: (() => {
          const t = f.querySelector("[data-testid=needs-you-map-tag]");
          if (!t) return null;
          const b = t.getBoundingClientRect();
          const cs = getComputedStyle(t);
          const meets = (sel) => {
            const e = document.querySelector(`section.needs-you ${sel}`);
            if (!e) return null;
            const o = e.getBoundingClientRect();
            if (o.width === 0) return null;
            return b.left < o.right && o.left < b.right && b.top < o.bottom && o.top < b.bottom;
          };
          return {
            text: t.innerText,
            at: `${Math.round(b.left - r.left)},${Math.round(b.top - r.top)} ${Math.round(b.width)}x${Math.round(b.height)}`,
            inside: b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom,
            font: `${cs.fontFamily.split(",")[0]} ${cs.fontSize}/${cs.fontWeight}`,
            ground: cs.backgroundColor,
            border: `${cs.borderTopWidth} ${cs.borderTopColor}`,
            meetsZoom: meets(".nyq-map-zoom"),
            meetsStreet: meets(".nyq-map-street"),
          };
        })(),
      };
    });
    const crop = async (name) => {
      if (!OUT) return;
      const fig = p.locator("section.needs-you .nyq-card").first();
      await fig.scrollIntoViewIfNeeded();
      await fig.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
    };
    for (let q = 1; q <= 5; q++) {
      const got = await p.waitForFunction(() => {
        const f = document.querySelector("section.needs-you .nyq-map-frame");
        return f && ["soft", "sharp", "failed"].includes(f.getAttribute("data-map"));
      }, null, { timeout: 30000 }).then(() => true, () => false);
      if (!got) { rows.push({ q, error: "no map phase within 30 s" }); break; }
      const soft = await state();
      const softM = await measure();
      await crop(`q${q}-soft`);
      await p.waitForFunction(() => {
        const f = document.querySelector("section.needs-you .nyq-map-frame");
        return f.getAttribute("data-map") === "failed" || !!f.querySelector("img.nyq-map-sharp[data-loaded]");
      }, null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(400);
      const sharp = await state();
      const sharpM = await measure();
      await crop(`q${q}-sharp`);
      rows.push({ q, soft, sharp, softMeasure: softM, sharpMeasure: sharpM });
      if (q === 1) extra.details = await details479(p, tag);
      const next = p.locator("section.needs-you").getByRole("button", { name: "Next question" });
      if (!(await next.count())) break;
      await p.locator("section.needs-you label.nyq-answer").first().click();
      await p.waitForTimeout(300);
      await next.click();
      await p.waitForTimeout(300);
    }
    extra.gapDetailLater = await gapDetail();
    return { rows, extra };
  } finally {
    await b.close();
  }
}

let failed = false;
const all = {};
const extras = {};
// #486 (#479): NEEDS YOU's Details on the current question, closed / open / Esc
// (issue-479/script/walk479.mjs's measure, axe and 44 px, on section.needs-you).
const BOXES = {
  needs: "section.needs-you", card: "section.needs-you .nyq-card", foot: "section.needs-you .nyq-foot",
  toggle: "section.needs-you .nyq-details-btn", rows: "section.needs-you .nyq-rows", other: "section.ny-other",
  plan: "[data-testid=your-plan]", downloads: "#downloads", refs: ".results-disc",
};
const measure479 = (p) => p.evaluate((sel) => {
  const out = {};
  for (const [k, s] of Object.entries(sel)) {
    const e = document.querySelector(s);
    if (!e) continue;
    const r = e.getBoundingClientRect();
    out[k] = { top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1) };
  }
  const t = document.querySelector("section.needs-you .nyq-details-btn");
  const panel = t ? document.getElementById(t.getAttribute("aria-controls")) : null;
  out.page = { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
  out.inFlowDetails = document.querySelectorAll("section.needs-you .nyq-card > .nyq-details").length;
  if (panel && !panel.hidden) {
    const r = panel.getBoundingClientRect();
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
    out.panel = {
      position: getComputedStyle(panel).position,
      left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +(r.top + scrollY).toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1),
      inViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
      onTop: pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && (e === panel || panel.contains(e)); }),
    };
  }
  return out;
}, BOXES);
const axeNeeds = async (p) => {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => (await window.axe.run(document.querySelector("section.needs-you"), { resultTypes: ["violations"] })).violations.map((v) => `${v.id}:${v.nodes.length}`));
};
const small479 = (p) => p.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll("section.needs-you button, section.needs-you a, section.needs-you label.nyq-answer")) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (getComputedStyle(e).visibility === "hidden") continue;
    if (r.width < 44 || r.height < 44) out.push(`${(e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 30)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
  }
  return out;
});
async function details479(p, tag) {
  if (!(await p.locator("section.needs-you .nyq-details-btn").count())) return null;
  await p.evaluate(() => document.querySelector("section.needs-you .nyq-foot").scrollIntoView({ block: "center" }));
  await p.waitForTimeout(1200);
  const s = {};
  s.question = (await p.locator("section.needs-you .nyq-q").first().innerText()).trim();
  s.closed = await measure479(p);
  s.axeClosed = await axeNeeds(p);
  s.smallClosed = await small479(p);
  if (OUT) await p.screenshot({ path: path.join(OUT, `${tag}-479-details-closed.png`) });
  const t0 = await p.evaluate(() => performance.now());
  await p.locator("section.needs-you .nyq-details-btn").click();
  await p.waitForTimeout(800);
  s.open = await measure479(p);
  s.shiftsOnOpen = await p.evaluate((t0) => (window.__ls ?? []).filter((e) => e.t >= t0).map((e) => ({ v: +e.v.toFixed(4), recentInput: e.r })), t0);
  s.axeOpen = await axeNeeds(p);
  s.smallOpen = await small479(p);
  if (OUT) await p.screenshot({ path: path.join(OUT, `${tag}-479-details-open.png`) });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  s.afterEsc = await measure479(p);
  s.escFocusOnToggle = await p.evaluate(() => !!document.activeElement?.classList.contains("nyq-details-btn") && !!document.activeElement.closest("section.needs-you"));
  s.escClosed = !s.afterEsc.panel;
  s.moved = [];
  for (const k of Object.keys(BOXES)) {
    const a = s.closed[k], o = s.open[k];
    if (a && o && (o.top !== a.top || o.h !== a.h)) s.moved.push(`${k} ${+(o.top - a.top).toFixed(1)}/${+(o.h - a.h).toFixed(1)}`);
  }
  return s;
}
for (const [w, h] of SIZES) {
  let rows;
  try {
    const got = await one(w, h);
    rows = got.rows;
    extras[`${w}x${h}`] = got.extra;
    const X = got.extra;
    console.log(`${w}x${h} #482 outline gap ${X.wait.outlineGap} | at 14.5 s ${JSON.stringify(X.wait.at14500)} | settled ${JSON.stringify(X.settledGap)}`);
    const D = X.details;
    if (D) console.log(`${w}x${h} #479 q "${D.question}" | NEEDS YOU h ${D.closed.needs?.h} -> ${D.open.needs?.h} | card h ${D.closed.card?.h} -> ${D.open.card?.h} | moved: ${D.moved.length ? D.moved.join(", ") : "none"} | in-flow details ${D.open.inFlowDetails} | panel ${D.open.panel ? `${D.open.panel.position} x ${D.open.panel.left}-${D.open.panel.right} w ${D.open.panel.w} h ${D.open.panel.h} inView=${D.open.panel.inViewport} onTop=${D.open.panel.onTop}` : "NOT OPEN"} | scrollW ${D.open.page.scrollW}/${D.open.page.clientW} | shifts on open ${JSON.stringify(D.shiftsOnOpen)} | axe ${D.axeClosed.length}/${D.axeOpen.length} | <44 ${JSON.stringify(D.smallClosed)}/${JSON.stringify(D.smallOpen)} | Esc closed=${D.escClosed} focus=${D.escFocusOnToggle}`);
    else console.log(`${w}x${h} #479 NOT MEASURED (no Details on question 1)`);
    console.log(`${w}x${h} gap at settle ${X.gapDetailAtSettle?.gap} later ${X.gapDetailLater?.gap}`);
    console.log(`${w}x${h} maps ${JSON.stringify(X.maps)}`);
    console.log(`${w}x${h} console errors ${X.console.length}${X.console.length ? " [" + X.console.join(" | ") + "]" : ""} | page errors ${X.pageerrors.length}${X.pageerrors.length ? " [" + X.pageerrors.join(" | ") + "]" : ""}`);
    if (X.console.length || X.pageerrors.length) failed = true;
  } catch (e) {
    console.log(`${w}x${h} ERROR ${oneLine(e).slice(0, 200)}`);
    failed = true;
    continue;
  }
  all[`${w}x${h}`] = rows;
  for (const r of rows) {
    if (r.error) { console.log(`${w}x${h} q${r.q} ERROR ${r.error}`); failed = true; continue; }
    const same = r.soft.box === r.sharp.box && r.soft.figure === r.sharp.figure && r.soft.softFrame === r.sharp.sharpFrame;
    const a11y = !r.softMeasure.axe.length && !r.sharpMeasure.axe.length && !r.softMeasure.small.length && !r.sharpMeasure.small.length;
    if (!same || !a11y || r.soft.phase !== "soft" || r.sharp.phase !== "sharp") failed = true;
    console.log(`${w}x${h} q${r.q} "${r.soft.title}" ${r.soft.phase} ${r.soft.box} (figure ${r.soft.figure}, label "${r.soft.label}" ${r.soft.labelPx}, key hidden ${r.soft.keyHidden}, filter ${r.soft.softFilter}) -> ${r.sharp.phase} ${r.sharp.box} (figure ${r.sharp.figure}, label ${r.sharp.label}, key hidden ${r.sharp.keyHidden}) | frame ${r.soft.softFrame} -> ${r.sharp.sharpFrame} ${same ? "SAME" : "DIFFERENT"} | axe ${r.softMeasure.axe.length}/${r.sharpMeasure.axe.length} [${[...r.softMeasure.axe, ...r.sharpMeasure.axe].join(", ")}] | under 44 px ${r.softMeasure.small.length}/${r.sharpMeasure.small.length} [${[...r.softMeasure.small, ...r.sharpMeasure.small].join("; ")}] | soft tag ${r.soft.tag ? "SHOWN" : "none"} | chip ${JSON.stringify(r.sharp.chip)} | key "${r.sharp.keyText}" | tag ${r.sharp.tag ? JSON.stringify(r.sharp.tag) : "none"}`);
    if (r.soft.tag || (r.sharp.tag && (!r.sharp.tag.inside || r.sharp.tag.meetsZoom || r.sharp.tag.meetsStreet))) failed = true;
  }
}
if (OUT) fs.writeFileSync(path.join(OUT, "walk.json"), JSON.stringify(all, null, 2));
if (OUT) fs.writeFileSync(path.join(OUT, "extra.json"), JSON.stringify(extras, null, 2));
process.exit(failed ? 1 : 0);
