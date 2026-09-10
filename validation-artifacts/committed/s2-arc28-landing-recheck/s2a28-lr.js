// s2-arc28 live re-check — #271: a settle INSIDE the landing scroll.
//   node s2a28-lr.js <outDir> <expectBackendSha> [base] [runs] [forcedRuns]
// base defaults to the local dev server on :3005 (the frontend under test
// is this worktree's tip; the healthz gate records the DEPLOYED backend's
// sha, and the README names the frontend sha).
//
// Arc 26's prod run at 3fa7d18 caught the failure this arc fixes: at
// 380x800, 1 of 10 Generates landed the results zone at 793 instead of
// 154, because the memoised pair settled at 705 ms while the landing's
// smooth scroll was still animating and the one re-issue had already
// been spent inside the window.  Arc 26's harness and outProd-3fa7d18/
// stay untouched as the record that produced the finding; this is its
// own harness, with the landing legs plus a FORCED leg.
//
// Legs, per viewport:
//   L×N  natural: pin Denver -> Generate on the live backend -> the
//        scrollY sequence sampled every 50 ms -> the settle.  A natural
//        refusal is retried ONCE (Retry scan); a second refusal is
//        recorded as a #256 finding and the run is not counted.  Twenty
//        FRESH pages at 380 (ten at 1440), never twenty regenerates.
//        Measured: L1 results zone top = 136 (1440) / 154 (380) +-1;
//        L2 the verdict strip inside [nav-h, innerH]; L3 the jump census
//        (instant scrollY steps > 40 px, visible zone jumps, and the
//        re-issue census read off an instrumented scrollIntoView — every
//        re-issue is PRINTED, never swallowed by a tolerance); L4 the
//        band seen every flight; N5 the pin (sticky at 1440 / static at
//        380); N6 chips 44 px on one edge at 380; N10 axe.
//   F×K  forced: the audit + device-breakdown responses captured live on
//        a first natural Generate, then replayed on a fresh page HELD
//        until 700 ms after the click — the prod window, on demand.  A
//        forced run counts ONLY if it actually entered the window
//        (settledAt < smoothEnd, i.e. the pair settled while the smooth
//        run was still going); otherwise it is re-run.
const L = require("../s2-audit-1/audit-lib.js");
const { fs, path } = L;
const OUT = process.argv[2]; const EXPECT = process.argv[3];
const BASE = process.argv[4] || "http://localhost:3005";
// Acceptance: TWENTY fresh pages at 380 (the viewport the failure was
// caught on), ten at 1440.  argv[5] overrides both, for a smoke run.
const NRUNS = { "1440x1000": 10, "380x800": 20 };
const N = process.argv[5] ? Number(process.argv[5]) : null;
const K = Number(process.argv[6] || 5);
// The forced hold, per viewport.  700 ms is the prod settle at 380 to
// the millisecond (arc 26 L10).  At 1440 the landing's smooth run is
// only ~510 ms, so a 700 ms hold lands AFTER it and the run would never
// enter the window; 350 ms is the same fraction of that viewport's run.
// Declared: the leg's gate is still "settledAt < smoothEnd", measured.
const FORCE_MS = { "1440x1000": 350, "380x800": 700 };
const FORCE_TRIES = 3;         // re-runs allowed per forced run that missed the window
const { log } = L.mkLog(OUT);
const results = [];
const check = (tag, id, ok, detail) => { results.push({ tag, id, ok, detail }); log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`); };
const info = (tag, id, detail) => { log(`[${tag}] info ${id} — ${detail}`); };
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|VERIFIED/;
const TARGET = { "1440x1000": 136, "380x800": 154 };
const AXE_NAMED = { "1440x1000": [], "380x800": ["scrollable-region-focusable", "target-size"] };
const AXE_TARGETS = { "1440x1000": [], "380x800": [".gap-8", 'button[aria-label="Edit Lane W"]', 'button[aria-label="Edit Work zone"]', ".strip-edit-all"] };
const AXE_BASELINE = { "1440x1000": 0, "380x800": 4 };

// ── in-page probes (arc 26's SAMPLE / MEASURE / jumps, verbatim) ──
const SAMPLE = () => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height * 100) / 100, text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120) }; };
  const band = document.querySelector(".working-band");
  return {
    scrollY: Math.round(scrollY), innerH: innerHeight, docH: document.documentElement.scrollHeight, navH: parseInt(getComputedStyle(document.querySelector(".workbench")).getPropertyValue("--nav-h"), 10) || 52,
    stage: document.querySelector(".workbench").getAttribute("data-stage"),
    band: band ? { verb: band.querySelector(".wb-verb")?.textContent ?? null } : null,
    strip: r(".status-bar"), slot: r(".status-slot"), results: r("section.zone.results"), ns: r(".ns-strip"), nsSlot: r(".results-head-slot"), refusal: r(".scan-refusal"),
    hero: !!document.querySelector(".hero"), sr: document.querySelector("div[role=status].sr-only")?.textContent ?? null,
  };
};
const MEASURE = () => {
  const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { vtop: Math.round(b.top * 100) / 100, vbottom: Math.round(b.bottom * 100) / 100, h: Math.round(b.height * 100) / 100, w: Math.round(b.width), left: Math.round(b.left), right: Math.round(b.right) }; };
  const ws = document.querySelector(".workbench");
  const results = document.querySelector("section.zone.results");
  const chips = Array.from(document.querySelectorAll(".ns-strip .ns-chip")).map((a) => ({ ...R(a), href: a.getAttribute("href"), read: a.hasAttribute("data-read"), count: a.querySelector(".ns-count")?.textContent.replace(/\s+/g, " ").trim(), glyph: a.querySelector(".ns-glyph")?.textContent, name: a.querySelector(".ns-name")?.textContent }));
  const slot = document.querySelector(".results-head-slot");
  return {
    scrollY: Math.round(scrollY), innerH: innerHeight, docH: document.documentElement.scrollHeight, navH: parseInt(getComputedStyle(ws).getPropertyValue("--nav-h"), 10) || 52, stage: ws.getAttribute("data-stage"),
    stripH: getComputedStyle(ws).getPropertyValue("--strip-h").trim(), statusH: getComputedStyle(ws).getPropertyValue("--status-h").trim(), pinH: getComputedStyle(ws).getPropertyValue("--pin-h").trim(),
    resultsTop: results ? Math.round(results.getBoundingClientRect().top * 100) / 100 : null, resultsMargin: results ? getComputedStyle(results).scrollMarginTop : null,
    strip: R(document.querySelector(".status-bar")), stripText: document.querySelector(".status-bar")?.textContent.trim().replace(/\s+/g, " ") ?? null, statusSlot: R(document.querySelector(".status-slot")),
    ns: R(document.querySelector(".ns-strip")), nsSlot: R(slot), slotPos: slot ? getComputedStyle(slot).position : null, label: document.querySelector(".ns-label")?.textContent ?? null, chips,
    refusal: R(document.querySelector(".scan-refusal")), hero: !!document.querySelector(".hero"),
  };
};
// The re-issue census.  Observation only: scrollIntoView is wrapped so
// every call is recorded with its element, behaviour and timestamp, then
// called through unchanged.  #271's whole subject is HOW MANY landing
// scrolls are issued and when, so the harness reads them directly
// instead of inferring them from a scrollY tolerance.
// ``scrollend`` is recorded alongside, because it is what ARMS the
// check's one shot: whichever fires first — a scrollend or six stable
// frames — spends it.
const INSTRUMENT = () => {
  window.__s2a28_scrolls = [];
  window.__s2a28_ends = [];
  const orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (arg) {
    try { window.__s2a28_scrolls.push({ t: Date.now(), cls: String(this.className || ""), behavior: (arg && arg.behavior) || "auto", off: Math.round(this.getBoundingClientRect().top) }); } catch (e) {}
    return orig.apply(this, arguments);
  };
  addEventListener("scrollend", () => { try { window.__s2a28_ends.push({ t: Date.now(), y: Math.round(scrollY) }); } catch (e) {} }, true);
};
const SCROLLS = () => ({ scrolls: window.__s2a28_scrolls || [], ends: window.__s2a28_ends || [] });

// Jumps (#240 / F-S2-2), arc 26 verbatim: the smooth landing is the one
// monotone run of same-sign scrollY deltas from the click; anything
// outside it — an instant step (the swap's clamp, an anchoring
// compensation) — is a scrollY jump when > 40 px, and a VISIBLE jump when
// the results zone's viewport top moved > 40 px with it.
function jumps(samples) {
  let dir = 0, smoothUntil = 0;
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i].scrollY - samples[i - 1].scrollY;
    if (d === 0) { if (dir !== 0) { smoothUntil = i; break; } continue; }
    if (dir === 0) { dir = Math.sign(d); smoothUntil = i; continue; }
    if (Math.sign(d) !== dir) { smoothUntil = i - 1; break; }
    smoothUntil = i;
  }
  const scroll = [], visible = [];
  for (let i = smoothUntil + 1; i < samples.length; i++) {
    const d = samples[i].scrollY - samples[i - 1].scrollY;
    const v = (samples[i].results?.vtop ?? 0) - (samples[i - 1].results?.vtop ?? 0);
    if (Math.abs(d) > 40) scroll.push({ t: samples[i].t, d, v: Math.round(v) });
    if (Math.abs(v) > 40) visible.push({ t: samples[i].t, d, v: Math.round(v) });
  }
  return { smoothUntil, smoothEnd: samples[smoothUntil]?.t ?? 0, scroll, visible };
}

async function pin(page) {
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); };
  await fill("Latitude", "39.726900"); await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", "-104.987300"); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  const t0 = Date.now(); while (Date.now() - t0 < 40000) { const s = await page.evaluate(SAMPLE); if (s.strip && !/VERIFYING|AWAITING/.test(s.strip.text)) break; await page.waitForTimeout(300); }
}
async function sampleUntilSettled(page, label, maxMs) {
  const t0 = Date.now(); const samples = []; let seen = false, settledAt = null;
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0; samples.push(s);
    if (s.band) seen = true;
    const settledNow = !s.band && (!!s.refusal || (seen && !!s.ns) || (seen && SETTLED.test(s.strip?.text ?? "")));
    if (settledAt === null && settledNow) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1500) break;
    await page.waitForTimeout(50);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples));
  return { samples, settledAt, seen, last: samples[samples.length - 1], t0 };
}
const landings = {};
const tally = (tag, key, ok) => { landings[tag] = landings[tag] || {}; landings[tag][key] = landings[tag][key] || { ok: 0, runs: 0 }; landings[tag][key].runs++; if (ok) landings[tag][key].ok++; };

// The legs every landing run measures, natural or forced.
async function landingLegs(page, tag, label, s, clickAt, opts) {
  const m = await page.evaluate(MEASURE);
  fs.writeFileSync(path.join(OUT, `${label}-measure.json`), JSON.stringify(m, null, 1));
  const sh = await L.shot(page, OUT, `${label}-landed`);
  const target = TARGET[tag];
  const landed = m.resultsTop !== null && Math.abs(m.resultsTop - target) <= 1;
  tally(tag, opts.key, landed);
  check(tag, `${label} L1 landing`, landed, `results zone top ${m.resultsTop} vs ${target} ±1 (scroll-margin ${m.resultsMargin}, --pin-h ${m.pinH}); scrollY ${m.scrollY}; docH ${m.docH}; settled ${s.settledAt} ms | ${sh}`);
  check(tag, `${label} L2 strip in view`, !!m.strip && m.strip.vtop >= m.navH && m.strip.vbottom <= m.innerH, `verdict strip ${m.strip?.vtop}..${m.strip?.vbottom} vs [${m.navH}, ${m.innerH}] "${m.stripText}"; status slot h ${m.statusSlot?.h} (--status-h ${m.statusH})`);
  const js = jumps(s.samples);
  const after = [...js.scroll, ...js.visible].filter((j) => s.settledAt !== null && j.t > s.settledAt + 100);
  const raw = await page.evaluate(SCROLLS);
  const zone = raw.scrolls.filter((r) => /\bresults\b/.test(r.cls)).map((r) => ({ at: r.t - clickAt, behavior: r.behavior, off: r.off }));
  const ends = raw.ends.map((e) => ({ at: e.t - clickAt, y: e.y }));
  fs.writeFileSync(path.join(OUT, `${label}-scrolls.json`), JSON.stringify({ clickAt, settledAt: s.settledAt, smoothEnd: js.smoothEnd, zone, ends, all: raw.scrolls.map((r) => ({ at: r.t - clickAt, cls: r.cls, behavior: r.behavior, off: r.off })) }, null, 1));
  // The census is PRINTED, and the cap is the assertion: the landing
  // scroll plus at most two re-issues (#271's ruled cap), never three.
  const reissues = zone.length - 1;
  const census = zone.map((z, i) => `${i === 0 ? "landing" : "re-issue " + i}@${z.at}ms ${z.behavior} (zone ${z.off} px off)`).join(" ; ") || "none";
  const endCensus = ends.map((e) => `@${e.at}ms y=${e.y}`).join(" ; ") || "none";
  check(tag, `${label} L3 jumps + re-issue census`, js.scroll.length <= 1 && js.visible.length === 0 && after.length === 0 && zone.length >= 1 && reissues <= 2,
    `smooth run to ${js.smoothEnd} ms; scrollIntoView on the zone: ${zone.length} (${census}) → ${reissues} re-issue(s), cap 2; scrollend: ${endCensus}; instant scrollY steps > 40 px: ${js.scroll.length} (${js.scroll.map((j) => `${j.d}@${j.t}ms, zone moved ${j.v}`).join("; ") || "none"}); visible zone jumps: ${js.visible.length}; after settle+100 ms: ${after.length}; scrollY ${s.samples.slice(0, 14).map((x) => x.scrollY).join(" → ")}…`);
  check(tag, `${label} L4 band`, s.seen, `band seen during the flight ${s.seen}`);
  // N5/N6 — the arc-26 pin and target-size regression legs.
  await page.evaluate(() => window.scrollBy(0, 600)); await page.waitForTimeout(400);
  const p = await page.evaluate(MEASURE);
  if (tag === "1440x1000") {
    check(tag, `${label} N5 pinned`, p.slotPos === "sticky" && p.nsSlot !== null && Math.abs(p.nsSlot.vtop - p.navH) <= 1 && p.resultsTop < p.navH, `slot ${p.slotPos} at ${p.nsSlot?.vtop} vs nav-h ${p.navH} after +600 (results zone top ${p.resultsTop}); slot h ${p.nsSlot?.h} strip h ${p.ns?.h} --strip-h ${p.stripH}`);
  } else {
    check(tag, `${label} N5 static`, p.slotPos === "static" && p.nsSlot !== null && p.nsSlot.vtop < p.navH, `slot ${p.slotPos} at ${p.nsSlot?.vtop} after +600 (un-pinned below 520 of the zone's width); slot h ${p.nsSlot?.h} strip h ${p.ns?.h} --strip-h ${p.stripH}`);
    const lefts = new Set(m.chips.map((c) => c.left)), rights = new Set(m.chips.map((c) => c.right));
    check(tag, `${label} N6 chips 44 one edge`, m.chips.length === 3 && m.chips.every((c) => c.h >= 44) && lefts.size === 1 && rights.size === 1, m.chips.map((c) => `${c.w}×${c.h} at ${c.left}..${c.right}`).join(" ; "));
  }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  const axe = await L.runAxe(page, OUT, `${label}-axe`);
  const wcag = axe.filter((v) => v.tags.some((t) => /wcag2a$|wcag2aa$|wcag21aa$|wcag22aa$/.test(t)));
  const nodes = wcag.flatMap((v) => v.nodes.map((n) => ({ id: v.id, t: n.target })));
  const unexpected = nodes.filter((n) => !AXE_NAMED[tag].includes(n.id) || !AXE_TARGETS[tag].includes(n.t) || /ns-/.test(n.t));
  check(tag, `${label} N10 axe`, nodes.length <= AXE_BASELINE[tag] && unexpected.length === 0, `${nodes.length} wcag node(s) (baseline ${AXE_BASELINE[tag]}): ${nodes.map((n) => `${n.id}[${n.t}]`).join(" ; ") || "none"}`);
  return { m, js, zone };
}

// One natural Generate on a fresh page.  Returns null when the backend
// refused twice (#256) — recorded, never retried in a loop.
async function naturalRun(browser, vp, tag, label, cap) {
  const page = await browser.newPage({ viewport: vp });
  await page.addInitScript(INSTRUMENT);
  const local = {};
  if (cap) {
    page.on("response", async (res) => {
      try {
        if (res.url().includes("/api/render/audit")) local.audit = { status: res.status(), body: await res.text() };
        else if (res.url().includes("/api/render/device-breakdown")) local.breakdown = { status: res.status(), body: await res.text() };
      } catch (e) {}
    });
  }
  await pin(page);
  const clickAt = Date.now();
  await page.getByRole("button", { name: /Generate plan/ }).click();
  let s = await sampleUntilSettled(page, label, 120000);
  if (s.last.refusal) {
    info(tag, `${label}`, `natural refusal on the live backend (#256) — "${s.last.refusal.text.slice(0, 80)}"; retrying once`);
    await page.getByRole("button", { name: "↻ Retry scan", exact: true }).click();
    // The refusal container is still mounted for a beat after the click;
    // sampling straight away reads the STALE refusal as the settle and
    // measures a page that is still in flight (this cost the first run
    // of 2026-09-10 three bogus FAILs).  Wait for the new flight to be
    // visible — the band up, or the refusal gone — before sampling.
    const tw = Date.now();
    while (Date.now() - tw < 15000) { const w = await page.evaluate(SAMPLE); if (w.band || !w.refusal) break; await page.waitForTimeout(100); }
    s = await sampleUntilSettled(page, `${label}-retry`, 120000);
  }
  if (s.last.refusal) {
    info(tag, `${label}`, `refused twice — recorded as a #256 finding; the run is not counted`);
    await page.close();
    return null;
  }
  // The forced leg replays a PLAN, never a refusal: a 400 audit carries
  // no corrections block, so the document never grows above the zone and
  // the window would not be the prod case at all.  Commit the capture
  // only from a run that produced one (this cost the first run of
  // 2026-09-10 its whole 380 forced leg — F0 captured L1's 400).
  if (cap && !cap.audit && local.audit?.status === 200 && local.breakdown?.status === 200) {
    cap.audit = local.audit; cap.breakdown = local.breakdown;
  }
  const out = await landingLegs(page, tag, label, s, clickAt, { key: "natural" });
  await page.close();
  return out;
}

// Leg F — the forced window.  The captured audit + breakdown are held
// and fulfilled exactly FORCE_MS after the click, so the pair settles
// while the landing's smooth scroll is still animating: the prod case,
// on demand.  Only a run that ACTUALLY entered the window counts.
async function forcedRun(browser, vp, tag, label, cap) {
  const holdMs = FORCE_MS[tag];
  const page = await browser.newPage({ viewport: vp });
  await page.addInitScript(INSTRUMENT);
  await pin(page);
  let clickAt = 0;
  const held = { audit: 0, breakdown: 0 };
  const hold = async (route, which) => {
    if (!clickAt || !cap[which]) return route.continue();
    const wait = holdMs - (Date.now() - clickAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    held[which] += 1;
    await route.fulfill({ status: cap[which].status, headers: { "content-type": "application/json" }, body: cap[which].body });
  };
  await page.route("**/api/render/audit", (route) => hold(route, "audit"));
  await page.route("**/api/render/device-breakdown", (route) => hold(route, "breakdown"));
  clickAt = Date.now();
  await page.getByRole("button", { name: /Generate plan/ }).click();
  const s = await sampleUntilSettled(page, label, 120000);
  const js = jumps(s.samples);
  const entered = s.settledAt !== null && js.smoothEnd > 0 && s.settledAt < js.smoothEnd;
  info(tag, `${label} window`, `replayed audit ×${held.audit} breakdown ×${held.breakdown} held to ${holdMs} ms; settled ${s.settledAt} ms vs smooth run end ${js.smoothEnd} ms → ${entered ? "INSIDE the window" : "missed the window — re-run"}`);
  if (!entered) { await page.close(); return { entered: false }; }
  const out = await landingLegs(page, tag, label, s, clickAt, { key: "forced" });
  await page.close();
  return { entered: true, ...out };
}

(async () => {
  const sha = await L.shaGate(log, EXPECT);
  log(`B1 healthz ${sha} == ${EXPECT}: PASS · base ${BASE} · ${N === null ? JSON.stringify(NRUNS) : N} natural + ${K} forced run(s) per viewport · forced settle held to ${JSON.stringify(FORCE_MS)} ms`);
  const browser = await L.chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const cap = {};
    const runs = N === null ? NRUNS[tag] : N;
    for (let i = 1; i <= runs; i++) {
      // Each natural run offers its wire for the forced leg; the first
      // one that produced a PLAN (audit 200) is the one kept.
      await naturalRun(browser, vp, tag, `${tag}-L${i}`, cap);
    }
    check(tag, "F0 capture", !!cap.audit && !!cap.breakdown, `audit ${cap.audit ? cap.audit.status + " " + cap.audit.body.length + " B" : "MISSING"}; breakdown ${cap.breakdown ? cap.breakdown.status + " " + cap.breakdown.body.length + " B" : "MISSING"}`);
    if (cap.audit && cap.breakdown) {
      for (let i = 1; i <= K; i++) {
        let done = false;
        for (let t = 1; t <= FORCE_TRIES && !done; t++) {
          const r = await forcedRun(browser, vp, tag, `${tag}-F${i}${t > 1 ? "r" + t : ""}`, cap);
          done = r.entered;
        }
        if (!done) check(tag, `${tag}-F${i} window`, false, `never entered the window in ${FORCE_TRIES} attempts — not counted as acceptance evidence`);
      }
    }
  }
  await browser.close();
  for (const tag of Object.keys(landings)) for (const k of Object.keys(landings[tag])) log(`[${tag}] ${k}: at target ±1 on ${landings[tag][k].ok} of ${landings[tag][k].runs}`);
  const fails = results.filter((r) => !r.ok);
  log(`RESULT ${fails.length === 0 ? "ALL PASS" : "FAIL"} ${results.length - fails.length}/${results.length}${fails.length ? " — " + fails.map((f) => `[${f.tag}] ${f.id}`).join(", ") : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
