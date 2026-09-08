// s2-audit-1 — the design-audit walk against prod, sha-gated.  No product
// code; measurement only.  Every row it records names the surface, the
// principle, the measurement and the screenshot (findings.md is written
// from rows.json by hand, with judgement).
//
//   node audit-walk.js <outDir> <expectSha>
//
// Runs: 1440×1000 Denver · 380×800 Denver · 1440×1000 Lakewood (light).
// Surfaces, in operator order (the prompt's list):
//   S1 landing / pre-generate   S2 generate in flight   S3 post-generate
//   S4 correction round-trip    S5 refusal (natural, else replayed)
//   S6 downloads (band RENDERING, files saved for the PDF leg)
//   S7 ?debug=1
const L = require("./audit-lib.js");
const { fs, path } = L;
const BASE = "https://www.conestruct.com";
const OUT = process.argv[2] || path.join(__dirname, "out");
const EXPECT = process.argv[3] || "";
const PINS = { denver: { lat: "39.726900", lng: "-104.987300" }, lakewood: { lat: "39.711300", lng: "-105.081500" } };
const RUNS = [
  { vp: { width: 1440, height: 1000 }, pin: "denver" },
  { vp: { width: 380, height: 800 }, pin: "denver" },
  { vp: { width: 1440, height: 1000 }, pin: "lakewood", light: true },
];
const { log, rec, flush } = L.mkLog(OUT);
const DL = path.join(OUT, "downloads"); fs.mkdirSync(DL, { recursive: true });
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|VERIFIED/;
// The rect list watched across every state change (P1 / P6).
const WATCH = [".zone", ".zone-head", ".status-bar", ".progress-rail", ".jctl-band", ".jbar-suggest", ".jbar", "#rail-step-location", "#rail-step-road", "#rail-step-work", "#rail-step-schedule", "#rail-step-generate", ".generate-btn", ".setup-strip", ".results-head-lockup", ".scan-refusal", ".site-not-checked", ".hero", ".dls", ".dl-btn", ".price", ".price-head", ".ref-stack", ".refchip", "#site-corrections", ".sc-row", ".sc-foot", ".sys-event", "footer", ".working-band", ".stale-ribbon"];
let replayBody = null; // a captured refusal response for S5 replay

const S = () => { // one sample of the page's working state
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height), text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 140) }; };
  const band = document.querySelector(".working-band");
  return { scrollY: Math.round(scrollY), innerH: innerHeight, docH: document.documentElement.scrollHeight,
    band: band ? { ...r(".working-band"), verb: band.querySelector(".wb-verb")?.textContent, object: band.querySelector(".wb-object")?.textContent } : null,
    locked: document.querySelector(".workbench")?.classList.contains("ws-locked"),
    strip: r(".status-bar"), lockup: r(".results-head-lockup"), refusal: r(".scan-refusal"), ribbon: r(".stale-ribbon"), results: r("section.zone:nth-of-type(2)"), resultsTop: (() => { const z = document.querySelectorAll("section.zone")[1]; return z ? Math.round(z.getBoundingClientRect().top) : null; })(),
    sr: document.querySelector("div[role=status].sr-only")?.textContent ?? null, hero: !!document.querySelector(".hero"),
    dlOn: Array.from(document.querySelectorAll(".dl-btn")).filter((b) => !b.disabled).length };
};
async function sampleUntil(page, label, maxMs, stop) {
  const t0 = Date.now(); const out = []; let shotDone = false; let seenBand = false; let settledAt = null;
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(S); s.t = Date.now() - t0; out.push(s); if (s.band) seenBand = true;
    if (!shotDone && s.band && s.t > 400) { shotDone = true; await L.shot(page, OUT, `${label}-band`); }
    const st = s.strip?.text ?? "";
    const done = stop ? stop(s, seenBand) : (seenBand && !s.band && (SETTLED.test(st) || s.refusal || s.lockup));
    if (settledAt === null && done) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1200) break;
    await page.waitForTimeout(100);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(out));
  return { samples: out, settledAt, last: out[out.length - 1] };
}
const pinManually = async (page, pin) => {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => { const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]"); await input.fill(value); };
  await fill("Latitude", pin.lat);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", pin.lng); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  await page.waitForTimeout(400);
  return fill;
};
const edges = (rects, key) => { const v = rects.map((r) => r[key]); return { min: Math.min(...v), max: Math.max(...v), spread: Math.max(...v) - Math.min(...v), values: v }; };
const inView = (r, innerH, navH = 52) => r && r.vtop >= navH && r.vbottom <= innerH;

async function probesFor(page, vp, tag, roots) {
  // contrast / glyph / type / targets per root, saved as JSON; rows for the violations
  const all = {};
  for (const root of roots) {
    const has = await page.locator(root).count(); if (!has) continue;
    const pairs = await page.evaluate(L.PAIRS, root); const glyphs = await page.evaluate(L.GLYPHS, root); const type = await page.evaluate(L.TYPE, root); const targets = await page.evaluate(L.TARGETS, root);
    all[root] = { pairs, glyphs, type, targets };
    const low = pairs.filter((p) => p.ratio < 4.5 && p.size < 18);
    if (low.length) rec({ vp, surface: tag, p: "P9", verdict: "violated", what: `contrast under 4.5:1 in ${root}`, measure: low.slice(0, 6).map((p) => `${p.sel} "${p.text}" ${p.fg}/${p.bg} ${p.ratio} (opacity ${p.opacity})`).join(" ; ") + (low.length > 6 ? ` … +${low.length - 6}` : "") });
    const small = targets.filter((t) => !t.disabled && (t.h < 24 || t.w < 24));
    if (small.length) rec({ vp, surface: tag, p: "P10", verdict: vp.startsWith("380") ? "violated" : "note", what: `${small.length} enabled control(s) under 24 px in ${root}`, measure: small.slice(0, 8).map((t) => `${t.tag}.${t.cls.split(" ")[0]} "${t.name}" ${t.w}×${t.h}`).join(" ; ") });
    const unhidden = glyphs.filter((g) => g.hidden !== "true");
    rec({ vp, surface: tag, p: "P9", verdict: "note", what: `glyph audit ${root}`, measure: `${glyphs.length} glyph nodes: ${[...new Set(glyphs.map((g) => g.glyph))].join(" ")} ; ${unhidden.length} not aria-hidden` });
  }
  fs.writeFileSync(path.join(OUT, `probes-${tag}-${vp}.json`), JSON.stringify(all, null, 1));
  return all;
}

async function run({ vp, pin: pinName, light }) {
  const tag = `${vp.width}x${vp.height}`; const vpTag = `${tag}-${pinName}`; const pin = PINS[pinName];
  const T = (n) => `${vpTag}-${n}`;
  const page = await browser.newPage({ viewport: vp, acceptDownloads: true });
  page.on("pageerror", (e) => rec({ vp: vpTag, surface: "page", p: "P8", verdict: "note", what: "pageerror", measure: e.message.slice(0, 160) }));
  page.on("response", async (res) => { try { if (res.url().includes("/api/render/audit") && !res.url().includes("audit-pdf")) { const t = await res.text(); if (/site_scan_unavailable/.test(t) && !replayBody) { replayBody = { status: res.status(), headers: res.headers(), body: t }; fs.writeFileSync(path.join(OUT, "refusal-replay.json"), JSON.stringify(replayBody)); log(`captured refusal body (${res.status()}, ${t.length} bytes)`); } } } catch {} });
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);

  // ── S1a empty setup ──
  let shot = await L.shot(page, OUT, T("s1-empty"), true);
  let s = await page.evaluate(S);
  const railBlocker = await page.locator("[data-testid=rail-blocker]").first().textContent().catch(() => null);
  const ctaReason = await page.locator("[data-testid=cta-reason]").first().textContent().catch(() => null);
  rec({ vp: vpTag, surface: "S1 empty", p: "P2", verdict: railBlocker === ctaReason ? "deviates-by-ruling" : "note", what: "the location blocker sentence is stated by the rail and under the CTA (one export, #228)", measure: `rail-blocker "${railBlocker}" ; cta-reason "${ctaReason}" ; strip "${s.strip?.text}"`, shot });
  rec({ vp: vpTag, surface: "S1 empty", p: "P3", verdict: inView(s.strip, s.innerH) ? "honoured" : "violated", what: "status strip in the first viewport on load", measure: `status-bar vtop ${s.strip?.vtop} vbottom ${s.strip?.vbottom} innerH ${s.innerH}; first-viewport shows the pick CTA: ${await page.getByRole("button", { name: "Pick Location on Map" }).evaluate((b) => b.getBoundingClientRect().bottom <= innerHeight).catch(() => "?")}` , shot });
  const live0 = await page.evaluate(L.LIVE);
  rec({ vp: vpTag, surface: "S1 empty", p: "P2", verdict: "note", what: "live regions mounted pre-pin", measure: `${live0.length}: ${live0.map((l) => `${l.sel}[${l.role || l.live}]="${l.text.slice(0, 40)}"`).join(" ; ")}` });
  await probesFor(page, vpTag, "S1 empty", [".setup-panel", ".status-bar", ".jbar", "footer", "nav"]);
  const axe0 = await L.runAxe(page, OUT, T("axe-empty"));
  rec({ vp: vpTag, surface: "S1 empty", p: "P10", verdict: axe0.some((v) => v.id === "target-size") ? "violated" : "honoured", what: "axe target-size + full run", measure: axe0.map((v) => `${v.id}×${v.nodes.length}[${v.nodes.slice(0, 3).map((n) => n.target).join(",")}]`).join(" ; ") || "0 violations" });
  // the empty-state block (P14)
  const empty = await page.locator(".empty-state").first().textContent().catch(() => null);
  rec({ vp: vpTag, surface: "S1 empty", p: "P14", verdict: empty ? "honoured" : "violated", what: "results zone empty state names the steps", measure: `"${(empty || "").trim().replace(/\s+/g, " ")}"` });

  // ── S1b picker modal ──
  if (!light) {
    const before = await page.evaluate(L.RECTS, WATCH);
    await page.getByRole("button", { name: "Pick Location on Map" }).click();
    await page.waitForTimeout(2500);
    const dlg = page.getByRole("dialog", { name: "Define work zone" });
    if (await dlg.count()) {
      shot = await L.shot(page, OUT, T("s1-picker"));
      const d = await dlg.evaluate((el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { top: Math.round(b.top), left: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom), overflowY: cs.overflowY, scrollH: el.scrollHeight, clientH: el.clientHeight }; });
      rec({ vp: vpTag, surface: "S1 picker", p: "P6", verdict: d.bottom <= vp.height && d.left >= 0 && d.w <= vp.width ? "honoured" : "violated", what: "dialog fits the viewport", measure: `dialog ${d.w}×${d.h} at ${d.left},${d.top} bottom ${d.bottom} (innerH ${vp.height}); overflow-y ${d.overflowY} scrollH ${d.scrollH}/${d.clientH}`, shot });
      const save = dlg.getByRole("button", { name: "Save & Close" });
      const saveState = await save.evaluate((b) => ({ disabled: b.disabled, text: b.textContent.trim() })).catch(() => null);
      const gateWords = await dlg.evaluate((el) => (el.textContent.match(/Pick a road to continue|Detecting road…[^.]*|Click the map or search to drop a pin/g) || []).join(" | "));
      rec({ vp: vpTag, surface: "S1 picker", p: "P9", verdict: saveState?.disabled && gateWords ? "honoured" : (saveState?.disabled ? "violated" : "n/a"), what: "a disabled Save carries a word saying why", measure: `Save & Close disabled=${saveState?.disabled}; gate words: "${gateWords}"`, shot });
      await probesFor(page, vpTag, "S1 picker", ["[role=dialog]"]);
      const axeP = await L.runAxe(page, OUT, T("axe-picker"));
      rec({ vp: vpTag, surface: "S1 picker", p: "P10", verdict: axeP.some((v) => v.id === "target-size") ? "violated" : "honoured", what: "axe with the dialog open", measure: axeP.map((v) => `${v.id}×${v.nodes.length}[${v.nodes.slice(0, 3).map((n) => n.target).join(",")}]`).join(" ; ") || "0 violations" });
      await dlg.getByRole("button", { name: "Cancel", exact: true }).click().catch(async () => page.keyboard.press("Escape"));
      await page.waitForTimeout(600);
      const after = await page.evaluate(L.RECTS, WATCH); const diff = L.diffRects(before, after);
      rec({ vp: vpTag, surface: "S1 picker", p: "P1", verdict: diff.length === 0 ? "honoured" : "violated", what: "open + cancel leaves the page where it was", measure: diff.length ? diff.slice(0, 6).map((d) => `${d.sel}[${d.i}] dTop ${d.dTop} dH ${d.dH}`).join(" ; ") : "0 rects moved" });
    } else rec({ vp: vpTag, surface: "S1 picker", p: "P8", verdict: "note", what: "dialog did not open in 2.5 s", measure: "not measured" });
  }

  // ── S1c manual pin → jurisdiction band states ──
  const preRects = await page.evaluate(L.RECTS, WATCH);
  const fill = await pinManually(page, pin);
  // watch the band: loading → proposal (Denver); record every distinct state with rects
  const states = []; let lastKey = ""; const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const st = await page.evaluate(() => { const b = document.querySelector(".jctl-band .jbar-suggest, .jctl-band .sugg-row"); const band = document.querySelector(".jctl-band"); const strip = document.querySelector(".status-bar"); return { cls: b?.className ?? null, text: (b?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120), bandH: band ? Math.round(band.getBoundingClientRect().height) : null, strip: strip?.textContent.trim().slice(0, 60), stripH: strip ? Math.round(strip.getBoundingClientRect().height) : null }; });
    const key = st.cls + "|" + st.text.slice(0, 30) + "|" + st.strip?.slice(0, 12);
    if (key !== lastKey) { lastKey = key; st.t = Date.now() - t0; st.rects = await page.evaluate(L.RECTS, WATCH); states.push(st); }
    if (/Confirm|agrees|appears to be/.test(st.text) && Date.now() - t0 > 2500) break;
    await page.waitForTimeout(250);
  }
  fs.writeFileSync(path.join(OUT, T("band-states.json")), JSON.stringify(states.map((x) => ({ ...x, rects: undefined })), null, 1));
  for (let i = 1; i < states.length; i++) { const d = L.diffRects(states[i - 1].rects, states[i].rects); const moved = d.filter((x) => x.dTop || x.dH); rec({ vp: vpTag, surface: "S1 band", p: "P1", verdict: moved.some((x) => /rail-step-(road|work|schedule|generate)|status-bar|section.zone/.test(x.sel) && x.dTop) ? "violated" : "honoured", what: `band state ${i}: "${states[i - 1].text.slice(0, 30)}" → "${states[i].text.slice(0, 30)}"`, measure: `band h ${states[i - 1].bandH}→${states[i].bandH}; strip h ${states[i - 1].stripH}→${states[i].stripH}; moved: ${moved.slice(0, 6).map((x) => `${x.sel}[${x.i}] dTop ${x.dTop} dH ${x.dH}`).join(" ; ") || "none"}; docH ${d.docH >= 0 ? "+" : ""}${d.docH}` }); }
  shot = await L.shot(page, OUT, T("s1-pinned"), true);
  rec({ vp: vpTag, surface: "S1 band", p: "P8", verdict: "note", what: "band states observed after the pin", measure: states.map((x) => `${x.t}ms "${x.text.slice(0, 50)}" [strip ${x.strip?.slice(0, 24)}]`).join(" → "), shot });
  const suggestion = page.locator(".jctl-band button.confirm").first();
  if (await suggestion.count()) {
    const b0 = await page.evaluate(L.RECTS, WATCH); const pend = await page.evaluate(L.RECT, ".jctl-band .jbar-suggest");
    const sugTargets = await page.evaluate(L.TARGETS, ".jctl-band");
    rec({ vp: vpTag, surface: "S1 band", p: "P10", verdict: sugTargets.some((t) => t.h < 24) ? "violated" : "honoured", what: "suggestion Confirm / Dismiss targets", measure: sugTargets.map((t) => `"${t.name}" ${t.w}×${t.h}`).join(" ; ") });
    rec({ vp: vpTag, surface: "S1 band", p: "P4", verdict: "note", what: "Confirm and Dismiss share an edge?", measure: sugTargets.length >= 2 ? `tops ${sugTargets.map((t) => t.top).join("/")} rights ${sugTargets.map((t) => t.right).join("/")} heights ${sugTargets.map((t) => t.h).join("/")}` : "n/a" });
    await suggestion.click(); await page.waitForTimeout(700);
    const b1 = await page.evaluate(L.RECTS, WATCH); const res = await page.evaluate(L.RECT, ".jctl-band .sys-event");
    shot = await L.shot(page, OUT, T("s1-band-resolved"));
    const d1 = L.diffRects(b0, b1).filter((x) => x.dTop || x.dH);
    rec({ vp: vpTag, surface: "S1 band", p: "P1", verdict: d1.some((x) => /rail-step-(road|work|schedule|generate)|status-bar|section.zone/.test(x.sel) && x.dTop) ? "violated" : "honoured", what: "Confirm → resolved record", measure: `pending slot h ${pend?.h} → record h ${res?.h}; moved: ${d1.slice(0, 6).map((x) => `${x.sel}[${x.i}] dTop ${x.dTop} dH ${x.dH}`).join(" ; ") || "none"}`, shot });
    rec({ vp: vpTag, surface: "S1 band", p: "P15", verdict: (await page.locator(".jctl-band button", { hasText: "Undo" }).count()) ? "honoured" : "violated", what: "resolved record keeps ✓ + sentence + Undo", measure: `"${res?.text}"`, shot });
    const g = await page.evaluate(L.GLYPHS, ".jctl-band");
    rec({ vp: vpTag, surface: "S1 band", p: "P9", verdict: g.length ? "honoured" : "note", what: "record glyph + word", measure: g.map((x) => `${x.glyph} ${x.color} beside "${x.sibling.slice(0, 40)}"`).join(" ; ") });
    await page.locator(".jctl-band button", { hasText: "Undo" }).first().click(); await page.waitForTimeout(700);
    const b2 = await page.evaluate(L.RECTS, WATCH); const d2 = L.diffRects(b1, b2).filter((x) => x.dTop || x.dH);
    rec({ vp: vpTag, surface: "S1 band", p: "P1", verdict: d2.some((x) => /rail-step-(road|work|schedule|generate)|status-bar|section.zone/.test(x.sel) && x.dTop) ? "violated" : "honoured", what: "Undo → proposal again", measure: `moved: ${d2.slice(0, 6).map((x) => `${x.sel}[${x.i}] dTop ${x.dTop} dH ${x.dH}`).join(" ; ") || "none"}` });
    // re-confirm so the plan carries the jurisdiction (the operator's likely path)
    await page.locator(".jctl-band button.confirm").first().click().catch(() => {}); await page.waitForTimeout(500);
  } else rec({ vp: vpTag, surface: "S1 band", p: "P8", verdict: "note", what: "no jurisdiction proposal at this pin", measure: `slot "${states[states.length - 1]?.text}"` });

  // ── S1d StatusBar INVALID INPUT (provoked with work zone 0), then restore ──
  await fill("Work zone (ft)", "0"); await page.waitForTimeout(1200);
  let st = await page.evaluate(S);
  shot = await L.shot(page, OUT, T("s1-invalid"));
  rec({ vp: vpTag, surface: "S1 strip", p: "P9", verdict: /INVALID INPUT/.test(st.strip?.text ?? "") ? "honoured" : "note", what: "INVALID INPUT provoked with work zone 0", measure: `strip "${st.strip?.text}" h ${st.strip?.h}; cta-reason "${await page.locator("[data-testid=cta-reason]").first().textContent().catch(() => "—")}"`, shot });
  await fill("Work zone (ft)", "1000"); await page.waitForTimeout(600);
  // wait for the pre-generate VERIFYING to settle (the strip leaves VERIFYING)
  const tv = Date.now(); let stripHs = new Set();
  while (Date.now() - tv < 40000) { st = await page.evaluate(S); if (st.strip) stripHs.add(st.strip.h); if (!/VERIFYING/.test(st.strip?.text ?? "")) break; await page.waitForTimeout(300); }
  rec({ vp: vpTag, surface: "S1 strip", p: "P1", verdict: stripHs.size <= 1 ? "honoured" : "violated", what: "strip height across VERIFYING → verdict", measure: `heights ${[...stripHs].join("/")}; settled "${st.strip?.text?.slice(0, 80)}" after ${Date.now() - tv} ms` });
  shot = await L.shot(page, OUT, T("s1-pre-generate"), true);
  await probesFor(page, vpTag, "S1 pinned", [".setup-panel", ".status-bar", ".jctl-band", ".fact-strip", ".progress-rail"]);
  const axe1 = await L.runAxe(page, OUT, T("axe-pinned"));
  rec({ vp: vpTag, surface: "S1 pinned", p: "P10", verdict: axe1.some((v) => v.id === "target-size") ? "violated" : "honoured", what: "axe pinned", measure: axe1.map((v) => `${v.id}×${v.nodes.length}[${v.nodes.slice(0, 3).map((n) => n.target).join(",")}]`).join(" ; ") || "0 violations", shot });
  // rail entry sizes (P10) + fact strip alignment (P4)
  const rail = await page.evaluate(L.TARGETS, ".progress-rail");
  rec({ vp: vpTag, surface: "S1 rail", p: "P10", verdict: rail.some((t) => t.h < 24) ? "violated" : "honoured", what: "rail entries are buttons", measure: rail.map((t) => `"${t.name.slice(0, 22)}" ${t.w}×${t.h}`).join(" ; ") });
  const fact = await page.evaluate(() => Array.from(document.querySelectorAll(".fact-cell")).map((c) => { const l = c.querySelector(".tr-step").getBoundingClientRect(); const v = c.lastElementChild.getBoundingClientRect(); return { label: c.querySelector(".tr-step").textContent, lLeft: Math.round(l.left), vLeft: Math.round(v.left), w: Math.round(c.getBoundingClientRect().width) }; }));
  rec({ vp: vpTag, surface: "S1 fact strip", p: "P4", verdict: fact.every((c) => c.lLeft === c.vLeft) ? "honoured" : "violated", what: "label and value share a left edge per cell", measure: fact.map((c) => `${c.label} ${c.lLeft}/${c.vLeft} w${c.w}`).join(" ; ") });

  // ── S2 generate in flight ──
  const preGen = await page.evaluate(L.RECTS, WATCH);
  await page.getByRole("button", { name: /Generate plan/ }).click();
  let gen = await sampleUntil(page, T("s2-generate"), 90000);
  const withBand = gen.samples.filter((x) => x.band);
  const scrolls = gen.samples.slice(0, 15).map((x) => x.scrollY);
  const jumps = gen.samples.slice(1, 25).filter((x, i) => Math.abs(x.scrollY - gen.samples[i].scrollY) > 40).length;
  rec({ vp: vpTag, surface: "S2 in flight", p: "P8", verdict: withBand.length && withBand.every((x) => x.band.vbottom === x.innerH) ? "honoured" : "violated", what: "band present, bottom-fixed, one voice", measure: `${withBand.length} samples with the band ("${withBand[0]?.band.verb} · ${withBand[0]?.band.object}"), first at ${withBand[0]?.t} ms, settled at ${gen.settledAt} ms; band h ${[...new Set(withBand.map((x) => x.band.h))].join("/")}` });
  rec({ vp: vpTag, surface: "S2 in flight", p: "P1", verdict: jumps <= 1 ? "honoured" : "violated", what: "scroll jumps in the first 2.5 s after Generate (#240)", measure: `scrollY samples ${scrolls.join(",")}; ${jumps} jumps > 40 px; docH ${gen.samples[0]?.docH}→${gen.last.docH}` });
  const stripInFlight = withBand.filter((x) => x.strip && x.strip.text); const ribbon = withBand.filter((x) => x.ribbon);
  rec({ vp: vpTag, surface: "S2 in flight", p: "P2", verdict: stripInFlight.length === 0 ? "honoured" : "violated", what: "no second working voice while the band is up", measure: `strip text seen in ${stripInFlight.length}/${withBand.length} band samples ("${stripInFlight[0]?.strip?.text?.slice(0, 50) ?? ""}"); stale ribbon in ${ribbon.length}` });
  // landing + next step visible (P3)
  s = gen.last;
  rec({ vp: vpTag, surface: "S2 settle", p: "P3", verdict: (inView(s.lockup, s.innerH) || inView(s.refusal, s.innerH) || inView(s.strip, s.innerH)) ? "honoured" : "violated", what: "post-generate viewport contains the verdict or the next step", measure: `results top ${s.resultsTop}; strip ${s.strip ? `${s.strip.vtop}..${s.strip.vbottom} "${s.strip.text.slice(0, 40)}"` : "—"}; lockup ${s.lockup ? `${s.lockup.vtop}..${s.lockup.vbottom}` : "—"}; refusal ${s.refusal ? `${s.refusal.vtop}..${s.refusal.vbottom}` : "—"}; innerH ${s.innerH}` });
  rec({ vp: vpTag, surface: "S2 settle", p: "P1", verdict: s.resultsTop === 98 ? "honoured" : "violated", what: "results zone lands at 98 (#152 E) — ruling-f shift is 98 + strip + 24", measure: `results top ${s.resultsTop}; strip h ${s.strip?.h}; scrollY ${s.scrollY}` });
  shot = await L.shot(page, OUT, T("s2-settled"), true);

  // ── S5 refusal (natural) ──
  const measureRefusal = async (label) => {
    const r = await page.evaluate(() => { const c = document.querySelector(".scan-refusal"); if (!c) return null; const btns = Array.from(c.querySelectorAll("button")).map((b) => { const x = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { name: b.textContent.trim().slice(0, 30), w: Math.round(x.width), h: Math.round(x.height), top: Math.round(x.top + scrollY), left: Math.round(x.left), right: Math.round(x.right), border: cs.borderTopWidth, color: cs.color, font: cs.fontSize }; }); const prov = c.querySelector(".tr-prov")?.textContent ?? ""; return { h: Math.round(c.getBoundingClientRect().height), btns, prov, rawIso: /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(prov), text: c.textContent.trim().replace(/\s+/g, " ").slice(0, 200) }; });
    if (!r) return null;
    const sh = await L.shot(page, OUT, T(`s5-refusal-${label}`));
    rec({ vp: vpTag, surface: "S5 refusal", p: "P11", verdict: r.btns.length === 2 && r.btns[0].border !== r.btns[1].border ? "violated" : "honoured", what: "two actions in one row wear two treatments (text link vs bordered)", measure: r.btns.map((b) => `"${b.name}" ${b.w}×${b.h} border ${b.border} top ${b.top}`).join(" ; "), shot: sh });
    rec({ vp: vpTag, surface: "S5 refusal", p: "P10", verdict: r.btns.some((b) => b.h < 24) ? "violated" : "honoured", what: "refusal actions hit size", measure: r.btns.map((b) => `"${b.name}" ${b.w}×${b.h}`).join(" ; "), shot: sh });
    rec({ vp: vpTag, surface: "S5 refusal", p: "P12", verdict: r.rawIso ? "violated" : "honoured", what: "provenance line prints a raw ISO timestamp", measure: `"${r.prov}"`, shot: sh });
    const x = await page.evaluate(S);
    rec({ vp: vpTag, surface: "S5 refusal", p: "P2", verdict: x.hero && /PLAN DECLINED/.test(x.strip?.text ?? "") ? "violated" : "honoured", what: "the strip says PLAN DECLINED while a plan (hero counts, live downloads, sr announcement) is on screen", measure: `strip "${x.strip?.text?.slice(0, 60)}"; hero ${x.hero}; ${x.dlOn} download buttons enabled; sr-only "${x.sr}"`, shot: sh });
    const strip = await page.evaluate(L.RECT, ".status-bar"); const cont = await page.evaluate(L.RECT, ".scan-refusal");
    rec({ vp: vpTag, surface: "S5 refusal", p: "P2", verdict: "violated", what: "the refusal is stated twice: the strip sentence and the container sentence", measure: `strip "${strip?.text?.slice(0, 90)}" ; container "${cont?.text?.slice(0, 90)}"`, shot: sh });
    await probesFor(page, vpTag, "S5 refusal", [".scan-refusal", ".status-bar"]);
    return r;
  };
  let hadRefusal = false;
  if (await page.locator(".scan-refusal").count()) {
    hadRefusal = true; await measureRefusal("natural");
    // proceed-anyway → NOT-CHECKED disclosures
    await page.getByRole("button", { name: /Generate without site check/ }).click();
    const pa = await sampleUntil(page, T("s5-proceed"), 90000);
    rec({ vp: vpTag, surface: "S5 proceed", p: "P8", verdict: pa.samples.some((x) => x.band) ? "honoured" : "violated", what: "proceed-anyway raises the band", measure: `band "${pa.samples.find((x) => x.band)?.band.verb} · ${pa.samples.find((x) => x.band)?.band.object}"; settled ${pa.settledAt} ms; strip "${pa.last.strip?.text?.slice(0, 60)}"` });
    const nc = await page.evaluate(() => ({ strip: document.querySelector(".site-not-checked")?.textContent.trim().replace(/\s+/g, " ").slice(0, 160) ?? null, tier: Array.from(document.querySelectorAll(".check-list-src")).map((e) => e.textContent.trim()).filter((t) => /NOT CHECKED/.test(t)).length, ledger: document.querySelector(".tier-ledger")?.textContent.trim(), lockup: !!document.querySelector(".results-head-lockup"), block: !!document.querySelector("#site-corrections"), verdict: document.querySelector(".status-bar")?.textContent.trim().slice(0, 80) }));
    shot = await L.shot(page, OUT, T("s5-not-checked"), true);
    rec({ vp: vpTag, surface: "S5 proceed", p: "P14", verdict: nc.strip && nc.tier ? "honoured" : "violated", what: "NOT-CHECKED disclosed on the strip and in section 03", measure: `strip "${nc.strip}"; section-03 NOT CHECKED tags ${nc.tier}; ledger "${nc.ledger}"; lockup ${nc.lockup}; block ${nc.block}; verdict "${nc.verdict}"`, shot });
    // audit PDF under NOT-CHECKED
    const ab = page.getByRole("button", { name: /Audit PDF/ }).first();
    if (await ab.count()) { await ab.scrollIntoViewIfNeeded(); const dlp = page.waitForEvent("download", { timeout: 90000 }).catch(() => null); await ab.click(); const d = await dlp; if (d) { await d.saveAs(path.join(DL, `${vpTag}-audit-not-checked.pdf`)); rec({ vp: vpTag, surface: "S6 downloads", p: "P2", verdict: "note", what: "audit PDF under NOT-CHECKED saved", measure: `${vpTag}-audit-not-checked.pdf` }); } }
    // back to a real scan: reopen setup → Generate
    await page.getByRole("button", { name: /Edit full setup/ }).click(); await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Generate plan/ }).click();
    gen = await sampleUntil(page, T("s2-generate-2"), 90000);
    for (let i = 0; i < 3 && (await page.locator(".scan-refusal").count()); i++) { rec({ vp: vpTag, surface: "S5 refusal", p: "P8", verdict: "note", what: `refusal again (${i + 1}) — Retry scan`, measure: (await page.locator(".scan-refusal .tr-prov").textContent()).trim() }); await page.getByRole("button", { name: /Retry scan/ }).click(); gen = await sampleUntil(page, T(`s5-retry${i + 1}`), 90000); }
  }
  if (await page.evaluate(() => /Device breakdown failed/.test(document.querySelector(".stale-ribbon")?.textContent ?? ""))) {
    rec({ vp: vpTag, surface: "S2 settle", p: "P16", verdict: "note", what: "breakdown failed while the audit answered — previous answer dimmed", measure: (await page.locator(".stale-ribbon").textContent()).trim().slice(0, 120) });
    const rb = page.getByRole("button", { name: "Retry", exact: true }).first(); if (await rb.count()) { await rb.scrollIntoViewIfNeeded(); await rb.click(); await sampleUntil(page, T("s2-retry-breakdown"), 90000); }
  }
  await page.waitForTimeout(800);
  if (!(await page.locator(".hero").count())) { rec({ vp: vpTag, surface: "S3", p: "P8", verdict: "note", what: "no plan on screen after retries — post-generate legs skipped", measure: (await page.evaluate(S)).strip?.text ?? "" }); await page.close(); return; }

  // ── S3 post-generate ──
  shot = await L.shot(page, OUT, T("s3-settled"), true);
  const live1 = await page.evaluate(L.LIVE);
  rec({ vp: vpTag, surface: "S3", p: "P2", verdict: "note", what: "live regions post-generate", measure: `${live1.length}: ${live1.map((l) => `${l.sel}[${l.role || l.live}]="${l.text.slice(0, 40)}"`).join(" ; ")}` });
  // results head + ledger duplicates (P2)
  const dup = await page.evaluate(() => { const lk = document.querySelector(".results-head-lockup")?.textContent.trim().replace(/\s+/g, " ") ?? null; const led = document.querySelector(".tier-ledger")?.textContent.trim() ?? null; const chips = Array.from(document.querySelectorAll(".chip-sum")).map((c) => c.textContent.trim().replace(/\s+/g, " ").slice(0, 40)); const hero = Array.from(document.querySelectorAll(".hero-cell .num")).map((n) => n.textContent.trim()); const cards = Array.from(document.querySelectorAll(".dl-card .desc b")).map((b) => b.textContent.trim()); const foot = document.querySelector("footer")?.textContent.trim().replace(/\s+/g, " "); const cta = document.querySelector("#rail-step-generate")?.textContent ?? ""; const scHead = document.querySelector("#site-corrections .tr-section")?.textContent; const scRows = document.querySelectorAll("#site-corrections .sc-row.site-correction-row").length; const scDetected = Array.from(document.querySelectorAll("#site-corrections .sc-result")).filter((e) => /detected/.test(e.textContent)).length; return { lk, led, chips, hero, cards, foot, scHead, scRows, scDetected, ctaFoot: /Output requires TCS review/.test(cta) && /Output requires TCS review/.test(foot || "") }; });
  rec({ vp: vpTag, surface: "S3 section 03", p: "P2", verdict: "violated", what: "the tier counts are stated twice: the ledger line and each chip", measure: `ledger "${dup.led}" ; chips ${dup.chips.map((c) => `"${c}"`).join(", ")}`, shot });
  rec({ vp: vpTag, surface: "S3 results head", p: "P2", verdict: dup.lk && dup.scDetected !== null ? "note" : "n/a", what: "lockup count vs block detected rows (one field, two surfaces — #253 rules one goes)", measure: `lockup "${dup.lk}" ; block "${dup.scHead}" rows ${dup.scRows}, detected ${dup.scDetected}` });
  rec({ vp: vpTag, surface: "S3 hero/cards", p: "P2", verdict: dup.hero[0] === dup.cards[0] ? "note" : "violated", what: "hero device count vs plan-sheet card count", measure: `hero ${dup.hero.join("/")} ; cards ${dup.cards.join("/")}` });
  const r3 = await page.evaluate(L.RECTS, [".dl-btn", ".dl-card", ".hero-cell", ".hero-meta .row .mv", ".hero-meta .row", ".price-head", ".zone-head", ".zone-title", ".refchip", ".chip-sum", ".tier-ledger", "h2", ".setup-strip button.sv", ".setup-strip .k", ".setup-strip .val"]);
  const dlb = r3[".dl-btn"]; const dlTops = edges(dlb, "top"); const dlRights = edges(dlb, "right");
  rec({ vp: vpTag, surface: "S3 OutputCards", p: "P4", verdict: dlTops.spread > 1 && vp.width > 600 ? "violated" : "honoured", what: "download buttons share a bottom edge across the three cards", measure: `dl-btn tops ${dlTops.values.join("/")} (spread ${dlTops.spread}); bottoms ${dlb.map((b) => b.bottom).join("/")}; heights ${dlb.map((b) => b.h).join("/")}; card heights ${r3[".dl-card"].map((c) => c.h).join("/")}`, shot });
  const mv = r3[".hero-meta .row .mv"]; const mvR = edges(mv, "right");
  rec({ vp: vpTag, surface: "S3 hero", p: "P4", verdict: mvR.spread <= 1 ? "honoured" : "violated", what: "hero meta values right-align", measure: `rights ${mvR.values.join("/")}` });
  const sv = r3[".setup-strip button.sv"]; const svH = edges(sv, "h"); const svTop = edges(sv, "top");
  rec({ vp: vpTag, surface: "S3 setup strip", p: "P4", verdict: svH.spread <= 1 && svTop.spread <= 1 ? "honoured" : "violated", what: "strip cells share height and top", measure: `heights ${svH.values.join("/")}; tops ${svTop.values.join("/")}; widths ${sv.map((b) => b.w).join("/")}` });
  // strip inline editor: open Edit Speed → P1
  const b3 = await page.evaluate(L.RECTS, WATCH);
  const editSpeed = page.getByRole("button", { name: "Edit Speed", exact: true });
  if (await editSpeed.count()) {
    await editSpeed.click(); await page.waitForTimeout(400);
    const a3 = await page.evaluate(L.RECTS, WATCH); const d3 = L.diffRects(b3, a3).filter((x) => x.dTop || x.dH);
    shot = await L.shot(page, OUT, T("s3-strip-editor"));
    rec({ vp: vpTag, surface: "S3 setup strip", p: "P1", verdict: d3.some((x) => /section.zone|\.hero|results-head|scan-refusal|#site-corrections|\.status-bar/.test(x.sel) && x.dTop) ? "violated" : "honoured", what: "opening an inline editor (Speed)", measure: `strip h ${b3[".setup-strip"]?.[0]?.h}→${a3[".setup-strip"]?.[0]?.h}; moved: ${d3.slice(0, 6).map((x) => `${x.sel}[${x.i}] dTop ${x.dTop} dH ${x.dH}`).join(" ; ") || "none"}`, shot });
    const ed = await page.evaluate(() => { const e = document.querySelector(".sv-editor"); if (!e) return null; const b = e.getBoundingClientRect(); const ctl = e.querySelector("select, input"); const c = ctl?.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), ctl: c ? `${Math.round(c.width)}×${Math.round(c.height)}` : null, hasClose: !!Array.from(e.querySelectorAll("button")).find((b) => /done|close|cancel|✓|×/i.test(b.textContent)) }; });
    rec({ vp: vpTag, surface: "S3 setup strip", p: "P3", verdict: ed?.hasClose ? "honoured" : "violated", what: "open editor shows how to close it (no Done/Cancel affordance)", measure: `editor ${ed?.w}×${ed?.h}, control ${ed?.ctl}, close affordance ${ed?.hasClose}`, shot });
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    const closed = !(await page.locator(".sv-editor").count());
    rec({ vp: vpTag, surface: "S3 setup strip", p: "P7", verdict: "note", what: "Escape closes the editor without a request", measure: `editor closed on Escape: ${closed}` });
    if (!closed) { await page.mouse.click(5, 300); await page.waitForTimeout(400); rec({ vp: vpTag, surface: "S3 setup strip", p: "P7", verdict: "note", what: "outside click closes the editor", measure: `closed: ${!(await page.locator(".sv-editor").count())}` }); }
  }
  // PricingCard open (P1: expander — user-asked, so growth below is expected; measure whether anything ABOVE moves)
  const b4 = await page.evaluate(L.RECTS, WATCH);
  await page.locator(".price-head").click(); await page.waitForTimeout(400);
  const a4 = await page.evaluate(L.RECTS, WATCH); const d4 = L.diffRects(b4, a4).filter((x) => x.dTop || x.dH);
  shot = await L.shot(page, OUT, T("s3-quote-open"), true);
  rec({ vp: vpTag, surface: "S3 PricingCard", p: "P1", verdict: d4.some((x) => /\.hero|\.dls|\.dl-btn|results-head|\.setup-strip/.test(x.sel) && x.dTop) ? "violated" : "honoured", what: "opening the quote moves nothing above it", measure: `price h ${b4[".price"]?.[0]?.h}→${a4[".price"]?.[0]?.h}; moved above: ${d4.filter((x) => /\.hero|\.dls|results-head|\.setup-strip/.test(x.sel)).map((x) => `${x.sel} dTop ${x.dTop}`).join(" ; ") || "none"}`, shot });
  const q = await page.evaluate(() => { const labels = Array.from(document.querySelectorAll(".price-body label")).map((l) => { const s = l.querySelector("span"); const i = l.querySelector("input"); const sb = s.getBoundingClientRect(); const ib = i.getBoundingClientRect(); return { label: s.textContent.trim(), lLeft: Math.round(sb.left), iLeft: Math.round(ib.left), iW: Math.round(ib.width), iH: Math.round(ib.height), caption: l.querySelectorAll("span")[1]?.textContent.trim() ?? null }; }); const btns = Array.from(document.querySelectorAll(".price-body button")).map((b) => { const r = b.getBoundingClientRect(); return { name: b.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top + scrollY), bg: getComputedStyle(b).backgroundColor, border: getComputedStyle(b).borderTopWidth }; }); const total = document.querySelector(".price-head .total")?.textContent.trim(); return { labels, btns, total }; });
  rec({ vp: vpTag, surface: "S3 QuotePanel", p: "P4", verdict: q.labels.every((l) => l.lLeft === l.iLeft) ? "honoured" : "violated", what: "field label and input share a left edge", measure: q.labels.map((l) => `${l.label} ${l.lLeft}/${l.iLeft} ${l.iW}×${l.iH}${l.caption ? ` "${l.caption}"` : ""}`).join(" ; ") });
  rec({ vp: vpTag, surface: "S3 QuotePanel", p: "P11", verdict: "note", what: "the two actions' treatments + the head total", measure: `${q.btns.map((b) => `"${b.name}" ${b.w}×${b.h} bg ${b.bg} border ${b.border}`).join(" ; ")}; head total "${q.total}"` });
  rec({ vp: vpTag, surface: "S3 QuotePanel", p: "P16", verdict: q.labels.some((l) => /Auto · 0 from layout/.test(l.caption || "")) ? "note" : "honoured", what: "the Flaggers caption asserts an auto-count", measure: q.labels.filter((l) => l.caption).map((l) => `${l.label}: "${l.caption}"`).join(" ; ") });
  await page.locator(".price-head").click(); await page.waitForTimeout(300);
  // Section 03 tiers: open each closed chip, measure that only content below moves; then close
  const chips = page.locator(".chip-sum");
  const nChips = await chips.count();
  for (let i = 0; i < nChips; i++) {
    const c = chips.nth(i); const was = await c.getAttribute("aria-expanded"); const name = (await c.textContent()).trim().replace(/\s+/g, " ").slice(0, 30);
    if (was === "true") continue;
    const bb = await page.evaluate(L.RECTS, [".refchip", ".chip-sum", "footer", ".hero", ".dls"]);
    await c.click(); await page.waitForTimeout(400);
    const aa = await page.evaluate(L.RECTS, [".refchip", ".chip-sum", "footer", ".hero", ".dls"]); const dd = L.diffRects(bb, aa).filter((x) => x.dTop || x.dH);
    const above = dd.filter((x) => /\.hero|\.dls/.test(x.sel) || (x.sel === ".chip-sum" && x.i < i));
    rec({ vp: vpTag, surface: "S3 section 03", p: "P1", verdict: above.length ? "violated" : "honoured", what: `open tier "${name}"`, measure: `chip body grew ${dd.find((x) => x.sel === ".refchip" && x.i === i)?.dH ?? 0} px; above moved: ${above.map((x) => `${x.sel}[${x.i}] dTop ${x.dTop}`).join(" ; ") || "none"}` });
    if (i === nChips - 1) { shot = await L.shot(page, OUT, T("s3-tiers-open"), true); }
    await c.click(); await page.waitForTimeout(300);
  }
  // audit expanders inside the Reference chip
  const refChip = page.locator(".refchip.sev-info .chip-sum", { hasText: "Reference" }).first();
  if (await refChip.count()) {
    await refChip.click(); await page.waitForTimeout(500);
    const heads = page.locator(".audit-head"); const nh = await heads.count();
    const hs = await page.evaluate(L.TARGETS, ".ref-stack");
    rec({ vp: vpTag, surface: "S3 AuditTrail", p: "P13", verdict: nh > 0 ? "honoured" : "note", what: "audit items are expanders (data-read)", measure: `${nh} audit-head buttons; sizes ${hs.filter((t) => /audit-head/.test(t.cls)).slice(0, 4).map((t) => `${t.w}×${t.h}`).join("/")}` });
    if (nh) { await heads.first().click(); await page.waitForTimeout(300); shot = await L.shot(page, OUT, T("s3-audit-open")); const bodyT = await page.evaluate(L.TYPE, ".audit-body"); rec({ vp: vpTag, surface: "S3 AuditTrail", p: "P5", verdict: "note", what: "type tuples in an open audit body", measure: bodyT.slice(0, 6).map((t) => `${t.key.split("|").slice(0, 3).join(" ")} ×${t.n}${t.tr ? ` [${t.tr}]` : ""}`).join(" ; ") }); await heads.first().click(); }
    // the audit PDF (S6)
    const ab = page.getByRole("button", { name: /Audit PDF/ }).first();
    if (await ab.count()) { await ab.scrollIntoViewIfNeeded(); const dlp = page.waitForEvent("download", { timeout: 90000 }).catch(() => null); await ab.click(); const rs = await sampleUntil(page, T("s6-audit-pdf"), 90000, (x, seen) => seen && !x.band); const d = await dlp; if (d) await d.saveAs(path.join(DL, `${vpTag}-audit.pdf`)); rec({ vp: vpTag, surface: "S6 downloads", p: "P8", verdict: rs.samples.some((x) => x.band) ? "honoured" : "violated", what: "audit PDF render raises the band", measure: `band "${rs.samples.find((x) => x.band)?.band.verb} · ${rs.samples.find((x) => x.band)?.band.object}" ${rs.samples.filter((x) => x.band).length} samples; file ${d ? `${vpTag}-audit.pdf` : "not received"}` }); }
    await refChip.click(); await page.waitForTimeout(300);
  }
  // section 03 headings (P5): zone head + h2 in one zone
  const heads3 = await page.evaluate(() => { const z = document.querySelectorAll("section.zone")[2]; if (!z) return null; const zt = z.querySelector(".zone-title"); const h2 = z.querySelector("h2:not(.zone-title)"); const sub = z.querySelector("p.font-mono"); const r = (e) => e ? { text: e.textContent.trim().slice(0, 40), size: getComputedStyle(e).fontSize, weight: getComputedStyle(e).fontWeight, top: Math.round(e.getBoundingClientRect().top + scrollY) } : null; return { zt: r(zt), h2: r(h2), sub: r(sub) }; });
  if (heads3) rec({ vp: vpTag, surface: "S3 section 03", p: "P5", verdict: heads3.h2 ? "violated" : "honoured", what: "two headings for one zone (zone title + a second h2 inside)", measure: `zone-title "${heads3.zt?.text}" ${heads3.zt?.size}/${heads3.zt?.weight} at ${heads3.zt?.top}; inner h2 "${heads3.h2?.text}" ${heads3.h2?.size}/${heads3.h2?.weight} at ${heads3.h2?.top}` });
  // duplicated strings on the page (P2)
  rec({ vp: vpTag, surface: "S3 footer", p: "P2", verdict: dup.ctaFoot ? "violated" : "honoured", what: "\"Output requires TCS review\" under Generate and in the footer", measure: `both present: ${dup.ctaFoot}` });
  // raw ISO anywhere visible (P12)
  const iso = await page.evaluate(() => { const hits = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const m = n.textContent.match(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\+\d\d:\d\d|Z)?/); if (m && getComputedStyle(n.parentElement).display !== "none") hits.push(`${n.parentElement.tagName.toLowerCase()}.${(n.parentElement.className || "").toString().split(" ")[0]} "${n.textContent.trim().slice(0, 70)}"`); } return hits; });
  rec({ vp: vpTag, surface: "S3 page", p: "P12", verdict: iso.length ? "violated" : "honoured", what: "raw ISO timestamps visible", measure: iso.join(" ; ") || "none" });
  const scTime = await page.evaluate(() => { const t = document.querySelector(".sc-time"); return t ? { text: t.textContent, title: t.getAttribute("title"), foot: t.closest(".sc-foot")?.textContent.trim().replace(/\s+/g, " ") } : null; });
  if (scTime) rec({ vp: vpTag, surface: "S3 block", p: "P12", verdict: "honoured", what: "block footer stamp is sliced, ISO on title", measure: `"${scTime.foot}" (title ${scTime.title})` });
  await probesFor(page, vpTag, "S3", [".setup-strip", ".status-bar", ".results-head-lockup", ".hero", ".dls", ".price", ".ref-stack", "#site-corrections", "footer"]);
  const axe3 = await L.runAxe(page, OUT, T("axe-settled"));
  rec({ vp: vpTag, surface: "S3", p: "P10", verdict: axe3.some((v) => v.id === "target-size") ? "violated" : "honoured", what: "axe settled", measure: axe3.map((v) => `${v.id}×${v.nodes.length}[${v.nodes.slice(0, 4).map((n) => n.target).join(",")}]`).join(" ; ") || "0 violations" });
  // type roles across the page (P5)
  const typeAll = await page.evaluate(L.TYPE, "main");
  fs.writeFileSync(path.join(OUT, T("type-tuples.json")), JSON.stringify(typeAll, null, 1));
  const sizes = [...new Set(typeAll.map((t) => t.key.split("|")[1]))].sort((a, b) => parseFloat(a) - parseFloat(b));
  rec({ vp: vpTag, surface: "S3 page", p: "P5", verdict: "note", what: "distinct type tuples on the settled page", measure: `${typeAll.length} tuples; sizes ${sizes.join(" ")}; ${typeAll.filter((t) => t.tr).length} carry a tr-* role` });

  // ── S3 site-conditions block ──
  const block = page.locator("#site-corrections");
  if (await block.count()) {
    await block.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    shot = await L.shot(page, OUT, T("s3-block"));
    const bk = await page.evaluate(() => { const b = document.querySelector("#site-corrections"); const rows = Array.from(b.querySelectorAll(".sc-row")).map((r) => { const x = r.getBoundingClientRect(); const name = r.querySelector(".sc-name"); const res = r.querySelector(".sc-result"); const act = r.querySelector(".sc-action button"); const ev = r.querySelector(".sc-evidence"); const g = r.querySelector(".sc-glyph, .sys-glyph"); const rr = (e) => e ? { l: Math.round(e.getBoundingClientRect().left), r: Math.round(e.getBoundingClientRect().right), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height), t: e.textContent.trim().slice(0, 60) } : null; return { cls: r.className.replace(/site-correction-row|jump-anchor/g, "").trim(), h: Math.round(x.height), top: Math.round(x.top + scrollY), name: rr(name), result: rr(res), action: rr(act), evidence: rr(ev), glyph: g ? { t: g.textContent.trim(), color: getComputedStyle(g).color } : null, lines: name ? Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight)) : null }; }); const foot = b.querySelector(".sc-foot"); const head = b.querySelector(".tr-section"); return { rows, foot: foot ? { t: foot.textContent.trim().replace(/\s+/g, " "), l: Math.round(foot.getBoundingClientRect().left) } : null, head: head ? { t: head.textContent.trim(), l: Math.round(head.getBoundingClientRect().left) } : null, w: Math.round(b.getBoundingClientRect().width), cols: getComputedStyle(b.querySelector(".sc-grid") || b).gridTemplateColumns }; });
    fs.writeFileSync(path.join(OUT, T("block-rows.json")), JSON.stringify(bk, null, 1));
    const nameL = edges(bk.rows.filter((r) => r.name).map((r) => r.name), "l"); const actR = edges(bk.rows.filter((r) => r.action).map((r) => r.action), "r"); const resL = edges(bk.rows.filter((r) => r.result).map((r) => r.result), "l"); const resR = edges(bk.rows.filter((r) => r.result).map((r) => r.result), "r");
    rec({ vp: vpTag, surface: "S3 block", p: "P4", verdict: nameL.spread <= 1 && actR.spread <= 1 ? "honoured" : "violated", what: "names share a left edge; actions share a right edge", measure: `name lefts ${nameL.values.join("/")}; action rights ${actR.values.join("/")}; result lefts ${resL.values.join("/")} rights ${resR.values.join("/")}; grid "${bk.cols}"; block w ${bk.w}`, shot });
    const hs = bk.rows.map((r) => r.h);
    rec({ vp: vpTag, surface: "S3 block", p: "P6", verdict: new Set(hs).size <= 1 ? "honoured" : "violated", what: "one row height per row kind", measure: bk.rows.map((r) => `${r.cls.split(" ").slice(0, 2).join(".")} h${r.h}${r.lines > 1 ? ` (${r.lines} lines)` : ""}`).join(" ; "), shot });
    rec({ vp: vpTag, surface: "S3 block", p: "P9", verdict: bk.rows.every((r) => r.glyph && r.result) ? "honoured" : "violated", what: "every row has glyph + word", measure: bk.rows.map((r) => `${r.glyph?.t ?? "∅"} ${r.result?.t ?? "∅"}`).join(" ; ") });
    const acts = bk.rows.filter((r) => r.action).map((r) => r.action);
    rec({ vp: vpTag, surface: "S3 block", p: "P10", verdict: acts.some((a) => a.h < 24) ? "violated" : "honoured", what: "row action button size", measure: acts.map((a) => `"${a.t}" ${a.w}×${a.h}`).join(" ; ") });
    rec({ vp: vpTag, surface: "S3 block", p: "P14", verdict: bk.rows.some((r) => /none along the corridor/.test(r.result?.t || "")) ? "honoured" : "note", what: "absent conditions render as words", measure: bk.rows.map((r) => r.result?.t).join(" ; ") });
    rec({ vp: vpTag, surface: "S3 block", p: "P4", verdict: bk.head && bk.foot && bk.head.l === bk.foot.l ? "honoured" : "note", what: "block head and foot share the block's left edge", measure: `head "${bk.head?.t}" l ${bk.head?.l}; foot "${bk.foot?.t}" l ${bk.foot?.l}` });

    // ── S4 correction round-trip: Dismiss → chips → Other → Confirm → band → record → Undo ──
    const dismiss = block.getByRole("button", { name: "Dismiss", exact: true }).first();
    if (await dismiss.count()) {
      const rowName = await dismiss.evaluate((b) => b.closest(".sc-row")?.querySelector(".sc-name")?.textContent ?? "");
      const b5 = await page.evaluate(L.RECTS, [".sc-row", ".sc-foot", "footer", ".ref-stack", "#site-corrections"]);
      await dismiss.click(); await page.waitForTimeout(400);
      const a5 = await page.evaluate(L.RECTS, [".sc-row", ".sc-foot", "footer", ".ref-stack", "#site-corrections"]); const d5 = L.diffRects(b5, a5).filter((x) => x.dTop || x.dH);
      shot = await L.shot(page, OUT, T("s4-picker"));
      rec({ vp: vpTag, surface: "S4 picker", p: "P1", verdict: "note", what: `Dismiss "${rowName}" mounts the reason picker (a user-asked mount; rows below move by its height)`, measure: `block h ${b5["#site-corrections"][0].h}→${a5["#site-corrections"][0].h}; rows ${b5[".sc-row"].length}→${a5[".sc-row"].length}; moved: ${d5.slice(0, 5).map((x) => `${x.sel}[${x.i}] dTop ${x.dTop} dH ${x.dH}`).join(" ; ")}`, shot });
      const chipsM = await page.evaluate(() => Array.from(document.querySelectorAll(".reason-chip")).map((c) => { const cb = c.getBoundingClientRect(); const t = c.querySelector(".reason-text").getBoundingClientRect(); const g = c.querySelector(".reason-glyph")?.getBoundingClientRect(); return { label: c.textContent.trim(), w: Math.round(cb.width), h: Math.round(cb.height), cx: Math.round((cb.left + cb.right) / 2 * 10) / 10, tx: Math.round((t.left + t.right) / 2 * 10) / 10, padL: Math.round(t.left - cb.left), padR: Math.round(cb.right - t.right), glyphW: g ? Math.round(g.width) : null, top: Math.round(cb.top + scrollY) }; }));
      rec({ vp: vpTag, surface: "S4 picker", p: "P4", verdict: chipsM.some((c) => Math.abs(c.cx - c.tx) > 1) ? "violated" : "honoured", what: "chip label centred in its box (#255-1)", measure: chipsM.map((c) => `"${c.label}" ${c.w}×${c.h} box-cx ${c.cx} text-cx ${c.tx} pad ${c.padL}/${c.padR}`).join(" ; "), shot });
      rec({ vp: vpTag, surface: "S4 picker", p: "P10", verdict: chipsM.some((c) => c.h < 24) ? "violated" : "honoured", what: "reason chip hit height", measure: chipsM.map((c) => `${c.w}×${c.h}`).join(" ") });
      const confirmBefore = await page.evaluate(L.RECT, "#site-corrections button.confirm");
      const chipCount = await page.locator(".reason-chip").count();
      for (let i = 0; i < chipCount; i++) { await page.locator(".reason-chip").nth(i).click(); await page.waitForTimeout(150); }
      // "Other (say what)" is the last chip
      const confirmAfter = await page.evaluate(L.RECT, "#site-corrections button.confirm"); const note = await page.evaluate(L.RECT, ".site-correction-note");
      shot = await L.shot(page, OUT, T("s4-other"));
      rec({ vp: vpTag, surface: "S4 picker", p: "P1", verdict: confirmBefore && confirmAfter && (confirmBefore.top !== confirmAfter.top || confirmBefore.left !== confirmAfter.left) ? "violated" : "honoured", what: "choosing Other moves Confirm (#255-3)", measure: `Confirm ${confirmBefore?.left},${confirmBefore?.top} → ${confirmAfter?.left},${confirmAfter?.top}; note input ${note ? `${note.w}×${note.h} at ${note.left},${note.top}` : "absent"}`, shot });
      const cf = await page.evaluate(() => { const b = document.querySelector("#site-corrections button.confirm"); return b ? { disabled: b.disabled, text: b.textContent.trim(), aria: b.getAttribute("aria-disabled"), title: b.title } : null; });
      rec({ vp: vpTag, surface: "S4 picker", p: "P9", verdict: cf?.disabled && !cf.title ? "violated" : "honoured", what: "a disabled Confirm (note required) says why", measure: `Confirm disabled=${cf?.disabled} title="${cf?.title}" text "${cf?.text}"`, shot });
      await page.locator(".site-correction-note").fill("audit walk"); await page.waitForTimeout(200);
      const cAct = await page.evaluate(() => Array.from(document.querySelectorAll("#site-corrections .sc-sub button, #site-corrections .sc-action button")).map((b) => { const r = b.getBoundingClientRect(); return `"${b.textContent.trim().slice(0, 16)}" right ${Math.round(r.right)} top ${Math.round(r.top + scrollY)} ${Math.round(r.width)}×${Math.round(r.height)}`; }));
      rec({ vp: vpTag, surface: "S4 picker", p: "P4", verdict: "note", what: "action edges with the picker open (Cancel / Confirm / other rows)", measure: cAct.join(" ; ") });
      await page.locator("#site-corrections button.confirm").click();
      let cor = await sampleUntil(page, T("s4-confirm"), 90000);
      rec({ vp: vpTag, surface: "S4 confirm", p: "P7", verdict: "violated", what: "one Confirm re-generates and locks (a per-edit request; #254)", measure: `band "${cor.samples.find((x) => x.band)?.band.verb} · ${cor.samples.find((x) => x.band)?.band.object}" for ${cor.samples.filter((x) => x.band).length} samples, settled ${cor.settledAt} ms` });
      for (let i = 0; i < 3 && (await page.locator(".scan-refusal").count()); i++) { rec({ vp: vpTag, surface: "S4 confirm", p: "P8", verdict: "note", what: `re-generation refused (${i + 1}) — Retry`, measure: (await page.locator(".scan-refusal .tr-prov").textContent()).trim() }); await page.getByRole("button", { name: /Retry scan/ }).click(); cor = await sampleUntil(page, T(`s4-retry${i + 1}`), 90000); }
      await page.waitForTimeout(600);
      const recRow = await page.evaluate(() => { const r = document.querySelector("#site-corrections .sc-record"); if (!r) return null; const x = r.getBoundingClientRect(); const d = r.querySelector(".sc-disclosure"); const u = r.querySelector("button"); const scan = document.querySelector("#site-corrections .sc-row.site-correction-row"); const lh = d ? parseFloat(getComputedStyle(d).lineHeight) : 0; return { h: Math.round(x.height), scanH: scan ? Math.round(scan.getBoundingClientRect().height) : null, text: d?.textContent.trim(), lines: d ? Math.round(d.getBoundingClientRect().height / lh) : null, undo: u ? { t: u.textContent.trim(), r: Math.round(u.getBoundingClientRect().right), w: Math.round(u.getBoundingClientRect().width), h: Math.round(u.getBoundingClientRect().height) } : null, glyph: r.querySelector(".sys-glyph")?.textContent.trim(), actR: scan ? Math.round(scan.querySelector(".sc-action button")?.getBoundingClientRect().right ?? 0) : null }; });
      shot = await L.shot(page, OUT, T("s4-record"));
      if (recRow) {
        rec({ vp: vpTag, surface: "S4 record", p: "P6", verdict: recRow.scanH && recRow.h > recRow.scanH + 1 ? "violated" : "honoured", what: "record row grows past the scan rows (#255-2)", measure: `record h ${recRow.h} (${recRow.lines} lines) vs scan row h ${recRow.scanH}; sentence "${recRow.text?.slice(0, 120)}…"`, shot });
        rec({ vp: vpTag, surface: "S4 record", p: "P15", verdict: recRow.undo && recRow.glyph ? "honoured" : "violated", what: "record keeps glyph + sentence + Undo", measure: `${recRow.glyph} "${recRow.undo?.t}" ${recRow.undo?.w}×${recRow.undo?.h} right ${recRow.undo?.r} vs scan-row action right ${recRow.actR}`, shot });
        rec({ vp: vpTag, surface: "S4 record", p: "P4", verdict: recRow.undo && recRow.actR && Math.abs(recRow.undo.r - recRow.actR) <= 1 ? "honoured" : "violated", what: "Undo shares the action edge", measure: `Undo right ${recRow.undo?.r}; Dismiss/Assert right ${recRow.actR}` });
        const lk2 = await page.evaluate(() => document.querySelector(".results-head-lockup")?.textContent.trim().replace(/\s+/g, " ") ?? null);
        rec({ vp: vpTag, surface: "S4 record", p: "P2", verdict: "note", what: "lockup after the correction", measure: `"${lk2}"` });
        await page.locator("#site-corrections .sc-record button", { hasText: "Undo" }).first().click();
        const und = await sampleUntil(page, T("s4-undo"), 90000);
        for (let i = 0; i < 3 && (await page.locator(".scan-refusal").count()); i++) { await page.getByRole("button", { name: /Retry scan/ }).click(); await sampleUntil(page, T(`s4-undo-retry${i + 1}`), 90000); }
        const after = await page.evaluate(() => ({ records: document.querySelectorAll("#site-corrections .sc-record").length, rows: document.querySelectorAll("#site-corrections .sc-row").length }));
        rec({ vp: vpTag, surface: "S4 undo", p: "P15", verdict: after.records === 0 ? "honoured" : "violated", what: "Undo removes the record (and re-generates: P7)", measure: `band "${und.samples.find((x) => x.band)?.band.object}"; records after ${after.records}, rows ${after.rows}` });
      } else rec({ vp: vpTag, surface: "S4 record", p: "P15", verdict: "note", what: "no record row after Confirm", measure: (await page.evaluate(S)).strip?.text ?? "" });
    } else rec({ vp: vpTag, surface: "S4", p: "P7", verdict: "note", what: "no Dismiss (nothing detected) — round trip via Assert not run", measure: "" });
  } else rec({ vp: vpTag, surface: "S3 block", p: "P14", verdict: "note", what: "no site-conditions block (scan not ok)", measure: (await page.evaluate(S)).strip?.text ?? "" });

  // ── S6 downloads: each render raises the band; files saved for the PDF leg ──
  if (!light) {
    const kinds = [["Download PDF", 0, "plan.pdf"], ["Download XLSX", 0, "devices.xlsx"], ["Download PDF", 1, "crew.pdf"], ["Download .md", 0, "crew.md"]];
    for (const [name, idx, file] of kinds) {
      const b = page.locator(".dl-btn", { hasText: name }).nth(idx); if (!(await b.count())) continue;
      await b.scrollIntoViewIfNeeded(); const dlp = page.waitForEvent("download", { timeout: 90000 }).catch(() => null); await b.click();
      const rs = await sampleUntil(page, T(`s6-${file}`), 90000, (x, seen) => seen && !x.band); const d = await dlp; if (d) await d.saveAs(path.join(DL, `${vpTag}-${file}`));
      const first = rs.samples.find((x) => x.band); const label = await b.textContent();
      rec({ vp: vpTag, surface: "S6 downloads", p: "P8", verdict: first ? "honoured" : "violated", what: `${file}: band RENDERING, button label unchanged`, measure: `band "${first?.band.verb} · ${first?.band.object}" ${rs.samples.filter((x) => x.band).length} samples; button "${label.trim()}"; file ${d ? "saved" : "not received"}` });
    }
    await page.locator(".price-head").click(); await page.waitForTimeout(300);
    const qb = page.getByRole("button", { name: /Download Quote/ }); if (await qb.count()) { await qb.scrollIntoViewIfNeeded(); const dlp = page.waitForEvent("download", { timeout: 90000 }).catch(() => null); await qb.click(); const rs = await sampleUntil(page, T("s6-quote"), 90000, (x, seen) => seen && !x.band); const d = await dlp; if (d) await d.saveAs(path.join(DL, `${vpTag}-quote.xlsx`)); rec({ vp: vpTag, surface: "S6 downloads", p: "P8", verdict: rs.samples.some((x) => x.band) ? "honoured" : "violated", what: "quote XLSX render raises the band", measure: `band "${rs.samples.find((x) => x.band)?.band.object}"; file ${d ? "saved" : "not received"}` }); }
    const zb = page.getByRole("button", { name: /All \(\.zip\)/ }); if (await zb.count()) { await zb.scrollIntoViewIfNeeded(); const dlp = page.waitForEvent("download", { timeout: 120000 }).catch(() => null); await zb.click(); const rs = await sampleUntil(page, T("s6-zip"), 120000, (x, seen) => seen && !x.band); const d = await dlp; if (d) await d.saveAs(path.join(DL, `${vpTag}-package.zip`)); rec({ vp: vpTag, surface: "S6 downloads", p: "P8", verdict: rs.samples.some((x) => x.band) ? "honoured" : "violated", what: "zip render raises the band", measure: `band "${rs.samples.find((x) => x.band)?.band.object}"; file ${d ? "saved" : "not received"}` }); }
  }
  // the final settled page at this viewport
  await L.shot(page, OUT, T("s3-final"), true);
  await page.close();
  return hadRefusal;
}

let browser;
(async () => {
  const sha = await L.shaGate(log, EXPECT);
  log(`s2-audit-1 walk · prod ${sha} · ${new Date().toISOString()}`);
  browser = await L.chromium.launch();
  let anyRefusal = false;
  for (const r of RUNS) { try { anyRefusal = (await run(r)) || anyRefusal; } catch (e) { log(`ERR run ${r.vp.width} ${r.pin}: ${e.stack}`); rec({ vp: `${r.vp.width}-${r.pin}`, surface: "run", p: "—", verdict: "note", what: "run aborted", measure: e.message.slice(0, 200) }); } flush(); }
  // ── S5 replay: if no natural refusal at 380, replay the captured body there ──
  if (replayBody && !fs.existsSync(path.join(OUT, "380x800-denver-s5-refusal-natural.png"))) {
    try {
      const page = await browser.newPage({ viewport: { width: 380, height: 800 } });
      let once = true;
      await page.route("**/api/render/audit", async (route) => { if (once) { once = false; await route.fulfill({ status: replayBody.status, headers: { "content-type": "application/json" }, body: replayBody.body }); } else await route.continue(); });
      await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(800);
      await pinManually(page, PINS.denver); await page.waitForTimeout(3000);
      await page.getByRole("button", { name: /Generate plan/ }).click();
      const gen = await sampleUntil(page, "380x800-replay-s2-generate", 90000);
      const r = await page.evaluate(() => { const c = document.querySelector(".scan-refusal"); if (!c) return null; const b = c.getBoundingClientRect(); return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height), btns: Array.from(c.querySelectorAll("button")).map((x) => { const y = x.getBoundingClientRect(); return `"${x.textContent.trim().slice(0, 24)}" ${Math.round(y.width)}×${Math.round(y.height)} left ${Math.round(y.left)}`; }) }; });
      const sh = await L.shot(page, OUT, "380x800-denver-s5-refusal-replay");
      rec({ vp: "380x800-denver", surface: "S5 refusal (replayed)", p: "P3", verdict: r && r.vtop >= 52 && r.vbottom <= 800 ? "honoured" : "violated", what: "refusal container in the viewport at settle (replayed body)", measure: r ? `container ${r.vtop}..${r.vbottom} h ${r.h}; ${r.btns.join(" ; ")}; results top ${gen.last.resultsTop}` : "no container", shot: sh });
      await page.close();
    } catch (e) { log("ERR replay " + e.message); }
  }
  // ── S7 ?debug=1 ──
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(BASE + "/sandbox?debug=1", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(1500);
    const dbg = await page.locator("button", { hasText: /Replication snapshot/ }).count();
    const dbgRect = dbg ? await page.locator("button", { hasText: /Replication snapshot/ }).evaluate((b) => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top + scrollY)}`; }) : null;
    const sh = await L.shot(page, OUT, "1440-debug-1");
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(1500);
    const plain = await page.locator("button", { hasText: /Replication snapshot/ }).count();
    rec({ vp: "1440x1000", surface: "S7 debug", p: "P13", verdict: dbg === 1 && plain === 0 ? "honoured" : "violated", what: "snapshot button renders only with ?debug=1", measure: `?debug=1: ${dbg} (${dbgRect}); plain: ${plain}`, shot: sh });
    await page.close();
  } catch (e) { log("ERR debug " + e.message); }
  await browser.close(); flush();
  log(`done · ${L.path.basename(OUT)} · rows ${fs.readFileSync(path.join(OUT, "rows.json"), "utf-8").length} bytes`);
})().catch((e) => { log("ERR " + e.stack); flush(); process.exit(1); });
