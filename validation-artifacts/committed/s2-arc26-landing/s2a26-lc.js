// s2-arc26 live check — #250 / #240 / #260 / #253: the landing, the slots,
// the voices and the next-steps strip, at 1440×1000 and 380×800.
//   node s2a26-lc.js <outDir> <expectBackendSha> [base] [runs] [declinedRuns]
// base defaults to the local dev server (the frontend under test at the
// worktree tip, proxying to the deployed Modal backend — the healthz gate
// records the backend sha; the frontend sha is named by the README).
// Legs, per viewport:
//   S0   load: one live speaker for the location gate; CTA bottom ≤ innerH;
//        the strip one height across the synthesised pre-generate states.
//   L×N  natural: pin Denver → Generate on the live backend → the scrollY
//        sequence sampled every 50 ms → the settle.  A natural refusal is
//        retried ONCE (Retry scan); a second refusal is recorded as a #256
//        finding and the run measures the declined landing instead.
//        Measured: results zone top = 136 (1440) / 154 (380) ±1; the
//        verdict strip inside [nav-h, innerH]; jumps > 40 px after the
//        click ≤ 1 and none after settle + 100 ms; the band seen every
//        flight; the next-steps strip present with three chips; chip
//        counts vs the audit wire; the strip pinned at 1440 (slot top ==
//        nav-h after scrolling) / static at 380 (chips 44, one edge);
//        anchor jumps land at their scroll-margin; contrast in the strip on
//        the .97 surface; axe against the arc-25 baseline; live regions.
//   C×M  the c2 declined pair (both requests fulfilled with the arc-25
//        replay 400): no strip, the container inside [nav-h, innerH], the
//        results zone at 136 / 154.
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const { fs, path } = L;
const OUT = process.argv[2]; const EXPECT = process.argv[3];
const BASE = process.argv[4] || "http://localhost:3002";
const N = Number(process.argv[5] || 10);
const M = Number(process.argv[6] || 3);
const REPLAY = JSON.parse(fs.readFileSync("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-arc25-refusal-surface/refusal-replay.json", "utf-8"));
const { log } = L.mkLog(OUT);
const results = [];
const check = (tag, id, ok, detail) => { results.push({ tag, id, ok, detail }); log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`); };
const info = (tag, id, detail) => { log(`[${tag}] info ${id} — ${detail}`); };
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|VERIFIED/;
const TARGET = { "1440x1000": 136, "380x800": 154 };
const AXE_NAMED = { "1440x1000": [], "380x800": ["scrollable-region-focusable", "target-size"] };
const AXE_TARGETS = { "1440x1000": [], "380x800": [".gap-8", 'button[aria-label="Edit Lane W"]', 'button[aria-label="Edit Work zone"]', ".strip-edit-all"] };
const AXE_BASELINE = { "1440x1000": 0, "380x800": 4 };
const GATE = "Set a location first — pick on map or enter manually.";

// ── in-page probes ──
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
  const chips = Array.from(document.querySelectorAll(".ns-strip .ns-chip")).map((a) => ({ ...R(a), href: a.getAttribute("href"), cls: a.className, read: a.hasAttribute("data-read"), inert: a.getAttribute("aria-disabled"), count: a.querySelector(".ns-count")?.textContent.replace(/\s+/g, " ").trim(), glyph: a.querySelector(".ns-glyph")?.textContent, name: a.querySelector(".ns-name")?.textContent }));
  const slot = document.querySelector(".results-head-slot");
  return {
    scrollY: Math.round(scrollY), innerH: innerHeight, navH: parseInt(getComputedStyle(ws).getPropertyValue("--nav-h"), 10) || 52, stage: ws.getAttribute("data-stage"), locked: ws.classList.contains("ws-locked"),
    stripH: getComputedStyle(ws).getPropertyValue("--strip-h").trim(), statusH: getComputedStyle(ws).getPropertyValue("--status-h").trim(), pinH: getComputedStyle(ws).getPropertyValue("--pin-h").trim(),
    resultsTop: results ? Math.round(results.getBoundingClientRect().top * 100) / 100 : null, resultsMargin: results ? getComputedStyle(results).scrollMarginTop : null,
    strip: R(document.querySelector(".status-bar")), stripText: document.querySelector(".status-bar")?.textContent.trim().replace(/\s+/g, " ") ?? null, statusSlot: R(document.querySelector(".status-slot")),
    ns: R(document.querySelector(".ns-strip")), nsSlot: R(slot), slotPos: slot ? getComputedStyle(slot).position : null, label: document.querySelector(".ns-label")?.textContent ?? null, chips,
    lockup: !!document.querySelector(".results-head-lockup"), refusal: R(document.querySelector(".scan-refusal")), hero: !!document.querySelector(".hero"),
    caption: Array.from(document.querySelectorAll("#downloads div")).filter((d) => d.children.length === 0).map((d) => d.textContent.trim()).find((t) => /^MHT PACKAGE/.test(t)) ?? null,
    anchors: { site: !!document.getElementById("site-corrections"), reference: !!document.getElementById("reference"), downloads: !!document.getElementById("downloads") },
    body: document.body.textContent,
  };
};
const WIRE = () => window.__s2a26_audit ?? null;

async function pin(page) {
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); };
  await fill("Latitude", "39.726900"); await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", "-104.987300"); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  const t0 = Date.now(); while (Date.now() - t0 < 40000) { const s = await page.evaluate(SAMPLE); if (s.strip && !/VERIFYING|AWAITING/.test(s.strip.text)) break; await page.waitForTimeout(300); }
}
// Capture the audit wire the page receives, for the count checks.
function tapAudit(page) {
  page.on("response", async (res) => {
    if (!res.url().includes("/api/render/audit")) return;
    try { const j = await res.json(); await page.evaluate((j) => { window.__s2a26_audit = j; }, { status: res.status(), body: j }); } catch {}
  });
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
  return { samples, settledAt, seen, last: samples[samples.length - 1] };
}
// Jumps (#240 / F-S2-2): the smooth landing is the one monotone run of
// same-sign scrollY deltas from the click; anything outside it — an
// instant step (the swap's clamp, an anchoring compensation) — is a
// scrollY jump when > 40 px, and a VISIBLE jump when the results zone's
// viewport top moved > 40 px with it (a compensation that holds the zone
// in place moves nothing the operator can see).
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
function arm(page) {
  const state = { audit: false, breakdown: false };
  page.route("**/api/render/audit", async (route) => { if (!state.audit) { state.audit = true; await route.fulfill({ status: REPLAY.status, headers: { "content-type": "application/json" }, body: REPLAY.body }); } else await route.continue(); });
  page.route("**/api/render/device-breakdown", async (route) => { if (!state.breakdown) { state.breakdown = true; await route.fulfill({ status: REPLAY.status, headers: { "content-type": "application/json" }, body: REPLAY.body }); } else await route.continue(); });
  return state;
}
const landings = {};
const tally = (tag, key, ok) => { landings[tag] = landings[tag] || {}; landings[tag][key] = landings[tag][key] || { ok: 0, runs: 0 }; landings[tag][key].runs++; if (ok) landings[tag][key].ok++; };

async function landedLegs(page, tag, label, s) {
  const m = await page.evaluate(MEASURE);
  fs.writeFileSync(path.join(OUT, `${label}-measure.json`), JSON.stringify(m, null, 1));
  const sh = await L.shot(page, OUT, `${label}-landed`);
  const target = TARGET[tag];
  const landed = m.resultsTop !== null && Math.abs(m.resultsTop - target) <= 1;
  tally(tag, "landing", landed);
  check(tag, `${label} L1 landing`, landed, `results zone top ${m.resultsTop} vs ${target} ±1 (scroll-margin ${m.resultsMargin}, --pin-h ${m.pinH}); scrollY ${m.scrollY}; settled ${s.settledAt} ms | ${sh}`);
  check(tag, `${label} L2 strip in view`, !!m.strip && m.strip.vtop >= m.navH && m.strip.vbottom <= m.innerH, `verdict strip ${m.strip?.vtop}..${m.strip?.vbottom} vs [${m.navH}, ${m.innerH}] "${m.stripText}"; status slot h ${m.statusSlot?.h} (--status-h ${m.statusH})`);
  const js = jumps(s.samples); const after = [...js.scroll, ...js.visible].filter((j) => s.settledAt !== null && j.t > s.settledAt + 100);
  check(tag, `${label} L3 jumps`, js.scroll.length <= 1 && js.visible.length === 0 && after.length === 0,
    `smooth run to ${js.smoothEnd} ms; instant scrollY jumps > 40 px: ${js.scroll.length} (${js.scroll.map((j) => `${j.d}@${j.t}ms, zone moved ${j.v}`).join("; ") || "none"}); visible zone jumps: ${js.visible.length}; after settle+100 ms: ${after.length}; scrollY ${s.samples.slice(0, 14).map((x) => x.scrollY).join(" → ")}…`);
  check(tag, `${label} L4 band`, s.seen, `band seen during the flight ${s.seen}`);
  const w = await page.evaluate(WIRE);
  const scan = w?.body?.sections?.site_scan; const pend = w?.body?.pending_verification?.count;
  check(tag, `${label} N1 strip`, !!m.ns && m.chips.length === 3 && m.label === "NEXT — 3 STEPS" && !m.lockup && m.chips.every((c) => c.read) && m.chips.map((c) => c.href).join(",") === "#site-corrections,#reference,#downloads",
    `ns-strip ${!!m.ns} chips ${m.chips.length} label "${m.label}" lockup ${m.lockup}; ${m.chips.map((c) => `[${c.glyph} ${c.name} · ${c.count}]`).join(" ")}`);
  if (scan && scan.status === "ok") {
    const keyed = ["intersections", "interchanges", "sidewalks", "bike_facilities", "schools"].filter((b) => scan.buckets && scan.buckets[b]);
    const recorded = new Set((scan.corrections || []).map((c) => c.flag));
    const flagOf = { intersections: "adjacent_intersection", interchanges: "adjacent_interchange", sidewalks: "pedestrian_facility", bike_facilities: "bicycle_facility", schools: "school_zone" };
    const open = keyed.filter((b) => scan.buckets[b].detected === true && !recorded.has(flagOf[b])).length;
    const want1 = open > 0 ? `${open} OPEN/${keyed.length}` : `0 OPEN/${keyed.length}`;
    const want2 = pend > 0 ? `${pend} OPEN` : "0 OPEN";
    check(tag, `${label} N2 counts`, m.chips[0].count === want1 && m.chips[1].count === want2 && m.chips[2].count === "4 FILES READY",
      `chip 1 "${m.chips[0].count}" vs wire ${want1}; chip 2 "${m.chips[1].count}" vs wire ${want2}; chip 3 "${m.chips[2].count}"`);
  } else {
    check(tag, `${label} N2 counts`, !!m.chips[0] && m.chips[0].count === "◌ NOT SCANNED" && m.chips[2].count === "4 FILES READY", `scan status ${scan?.status ?? "absent"}; chip 1 "${m.chips[0]?.count}"; chip 3 "${m.chips[2]?.count}"`);
  }
  check(tag, `${label} N3 vocabulary`, !/\bdone\b|\bcomplete\b|NOT YET EVALUATED/i.test(m.chips.map((c) => c.count).join(" ")) && m.caption === "MHT PACKAGE", `counts "${m.chips.map((c) => c.count).join(" | ")}"; caption "${m.caption}"`);
  check(tag, `${label} N4 anchors`, m.anchors.site && m.anchors.reference && m.anchors.downloads, JSON.stringify(m.anchors));
  // Pinned / static: scroll 600 px into the results zone.
  await page.evaluate(() => window.scrollBy(0, 600)); await page.waitForTimeout(400);
  const p = await page.evaluate(MEASURE);
  if (tag === "1440x1000") {
    check(tag, `${label} N5 pinned`, p.slotPos === "sticky" && p.nsSlot !== null && Math.abs(p.nsSlot.vtop - p.navH) <= 1 && p.resultsTop < p.navH, `slot ${p.slotPos} at ${p.nsSlot?.vtop} vs nav-h ${p.navH} after +600 (results zone top ${p.resultsTop}); slot h ${p.nsSlot?.h} strip h ${p.ns?.h} --strip-h ${p.stripH}`);
  } else {
    check(tag, `${label} N5 static`, p.slotPos === "static" && p.nsSlot !== null && p.nsSlot.vtop < p.navH, `slot ${p.slotPos} at ${p.nsSlot?.vtop} after +600 (un-pinned below 520 of the zone's width); slot h ${p.nsSlot?.h} strip h ${p.ns?.h} --strip-h ${p.stripH}`);
    const lefts = new Set(m.chips.map((c) => c.left)), rights = new Set(m.chips.map((c) => c.right));
    check(tag, `${label} N6 chips 44 one edge`, m.chips.every((c) => c.h >= 44) && lefts.size === 1 && rights.size === 1, m.chips.map((c) => `${c.w}×${c.h} at ${c.left}..${c.right}`).join(" ; "));
  }
  check(tag, `${label} N7 slot = strip`, p.nsSlot !== null && p.ns !== null && Math.abs(p.nsSlot.h - p.ns.h) <= 1 && Math.abs(p.nsSlot.h - parseFloat(p.stripH)) <= 1, `slot ${p.nsSlot?.h} strip ${p.ns?.h} token ${p.stripH}`);
  // Anchor jumps: each chip lands its target at the target's scroll-margin (±1).
  const jump = async (i, id) => {
    await page.evaluate((i) => document.querySelectorAll(".ns-strip .ns-chip")[i].click(), i);
    await page.waitForTimeout(900);
    return page.evaluate((id) => { const el = document.getElementById(id); const b = el.getBoundingClientRect(); return { top: Math.round(b.top * 100) / 100, margin: parseFloat(getComputedStyle(el).scrollMarginTop), focused: document.activeElement === el, pinH: getComputedStyle(el).getPropertyValue("--pin-h").trim() }; }, id);
  };
  const j3 = await jump(2, "downloads"); const j1 = await jump(0, "site-corrections"); const j2 = await jump(1, "reference");
  check(tag, `${label} N8 jumps land`, [j1, j2, j3].every((j) => Math.abs(j.top - j.margin) <= 1 && j.focused), `#site-corrections ${j1.top} vs margin ${j1.margin} (--pin-h ${j1.pinH}) focus ${j1.focused}; #reference ${j2.top} vs ${j2.margin} focus ${j2.focused}; #downloads ${j3.top} vs ${j3.margin} (--pin-h ${j3.pinH}) focus ${j3.focused}`);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  const pairs = await page.evaluate(L.PAIRS, ".ns-strip"); fs.writeFileSync(path.join(OUT, `${label}-pairs.json`), JSON.stringify(pairs, null, 1));
  const low = pairs.filter((x) => x.ratio < 4.5);
  check(tag, `${label} N9 contrast`, pairs.length >= 10 && low.length === 0, `${pairs.length} pairs on the .97 surface; lowest ${Math.min(...pairs.map((x) => x.ratio))} (${pairs.reduce((a, b) => (a.ratio < b.ratio ? a : b)).sel})${low.length ? "; LOW " + low.map((x) => `${x.sel} ${x.fg}/${x.bg} ${x.ratio}`).join(", ") : ""}`);
  const axe = await L.runAxe(page, OUT, `${label}-axe`);
  const wcag = axe.filter((v) => v.tags.some((t) => /wcag2a$|wcag2aa$|wcag21aa$|wcag22aa$/.test(t)));
  const nodes = wcag.flatMap((v) => v.nodes.map((n) => ({ id: v.id, t: n.target })));
  const unexpected = nodes.filter((n) => !AXE_NAMED[tag].includes(n.id) || !AXE_TARGETS[tag].includes(n.t) || /ns-/.test(n.t));
  check(tag, `${label} N10 axe`, nodes.length <= AXE_BASELINE[tag] && unexpected.length === 0, `${nodes.length} wcag node(s) (baseline ${AXE_BASELINE[tag]}): ${nodes.map((n) => `${n.id}[${n.t}]`).join(" ; ") || "none"}`);
  const live = await page.evaluate(L.LIVE);
  info(tag, `${label} live regions`, live.map((l) => `${l.sel} role=${l.role} live=${l.live} "${l.text.slice(0, 50)}"`).join(" | "));
  return m;
}
async function declinedLegs(page, tag, label, s) {
  const m = await page.evaluate(MEASURE);
  fs.writeFileSync(path.join(OUT, `${label}-measure.json`), JSON.stringify(m, null, 1));
  const sh = await L.shot(page, OUT, `${label}-declined`);
  const target = TARGET[tag];
  const landed = m.resultsTop !== null && Math.abs(m.resultsTop - target) <= 1;
  tally(tag, "declined", landed);
  check(tag, `${label} C1 landing`, landed, `results zone top ${m.resultsTop} vs ${target} ±1; scrollY ${m.scrollY}; settled ${s.settledAt} ms | ${sh}`);
  check(tag, `${label} C2 container in view`, !!m.refusal && m.refusal.vtop >= m.navH && m.refusal.vbottom <= m.innerH, `container ${m.refusal?.vtop}..${m.refusal?.vbottom} vs [${m.navH}, ${m.innerH}]`);
  check(tag, `${label} C3 no strip`, !m.ns && !m.nsSlot && !m.hero, `ns-strip ${!!m.ns}; slot ${!!m.nsSlot}; hero ${m.hero}; strip "${m.stripText}"`);
}

(async () => {
  const sha = await L.shaGate(log, EXPECT);
  log(`B1 healthz ${sha} == ${EXPECT}: PASS · base ${BASE} · ${N} natural + ${M} declined run(s) per viewport`);
  const browser = await L.chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const tag = `${vp.width}x${vp.height}`;
    // S0 — load
    {
      const page = await browser.newPage({ viewport: vp });
      await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(1200);
      const s0 = await page.evaluate((GATE) => {
        const live = Array.from(document.querySelectorAll("[aria-live],[role=status],[role=alert]"));
        const cta = Array.from(document.querySelectorAll("button")).find((b) => /Pick Location on Map/i.test(b.textContent));
        const sb = document.querySelector(".status-bar");
        return { speakers: live.filter((e) => (e.textContent || "").includes(GATE)).map((e) => e.getAttribute("data-testid") || e.className), liveCount: live.length, ctaBottom: cta ? Math.round(cta.getBoundingClientRect().bottom) : null, innerH: innerHeight, strip: sb?.textContent.trim(), stripH: sb ? Math.round(sb.getBoundingClientRect().height * 100) / 100 : null, blockerHidden: document.querySelector('[data-testid="rail-blocker"]')?.getAttribute("aria-hidden"), quietLive: document.querySelector(".jbar-suggest.quiet")?.getAttribute("aria-live") ?? null, noneBaseline: (document.body.textContent.match(/None — baseline/g) || []).length };
      }, GATE);
      check(tag, "S0 one voice", s0.speakers.length === 1 && s0.speakers[0] === "cta-reason" && s0.liveCount === 3 && s0.blockerHidden === "true" && s0.quietLive === null, `gate speakers ${JSON.stringify(s0.speakers)}; live regions ${s0.liveCount}; blocker aria-hidden ${s0.blockerHidden}; quiet band live ${s0.quietLive}`);
      check(tag, "S0 CTA in view", s0.ctaBottom !== null && s0.ctaBottom <= s0.innerH, `CTA bottom ${s0.ctaBottom} vs innerH ${s0.innerH}`);
      check(tag, "S0 strip voice", s0.strip === "AWAITING LOCATION · no site chosen" && s0.noneBaseline === 0, `strip "${s0.strip}" h ${s0.stripH}; "None — baseline" ×${s0.noneBaseline}`);
      await page.close();
    }
    // L×N — natural
    for (let i = 1; i <= N; i++) {
      const label = `${tag}-L${i}`;
      const page = await browser.newPage({ viewport: vp });
      tapAudit(page);
      await pin(page);
      await page.getByRole("button", { name: /Generate plan/ }).click();
      let s = await sampleUntilSettled(page, label, 120000);
      if (s.last.refusal) {
        info(tag, `${label}`, `natural refusal on the live backend (#256) — "${s.last.refusal.text.slice(0, 80)}"; retrying once`);
        await page.getByRole("button", { name: "↻ Retry scan", exact: true }).click();
        s = await sampleUntilSettled(page, `${label}-retry`, 120000);
      }
      if (s.last.refusal) {
        info(tag, `${label}`, `refused twice — recorded as a #256 finding; measuring the declined landing`);
        await declinedLegs(page, tag, `${label}-refused`, s);
      } else {
        await landedLegs(page, tag, label, s);
      }
      await page.close();
    }
    // C×M — the c2 declined pair (replayed)
    for (let i = 1; i <= M; i++) {
      const label = `${tag}-C${i}`;
      const page = await browser.newPage({ viewport: vp });
      await pin(page);
      const st = arm(page);
      await page.getByRole("button", { name: /Generate plan/ }).click();
      const s = await sampleUntilSettled(page, label, 120000);
      info(tag, `${label} replay`, `audit fulfilled ${st.audit}; breakdown fulfilled ${st.breakdown}; settled ${s.settledAt} ms`);
      await declinedLegs(page, tag, label, s);
      await page.close();
    }
  }
  await browser.close();
  for (const tag of Object.keys(landings)) for (const k of Object.keys(landings[tag])) log(`[${tag}] ${k}: at target ±1 on ${landings[tag][k].ok} of ${landings[tag][k].runs}`);
  const fails = results.filter((r) => !r.ok);
  log(`RESULT ${fails.length === 0 ? "ALL PASS" : "FAIL"} ${results.length - fails.length}/${results.length}${fails.length ? " — " + fails.map((f) => `[${f.tag}] ${f.id}`).join(", ") : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
