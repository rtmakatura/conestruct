// s2-arc23 live check — #252 the global working band + the write lock +
// RENDERING, on a real browser against the deployed /sandbox (or the
// local stack with A23_BASE=http://localhost:3000).  From the arc-21
// harness (s2a21-lc-prod.js): same pin flow, same axe / pairs probes.
//
//   node s2a23-lc-prod.js <outDir> <expectSha> [lat lng]
//
// Legs, per viewport (1440×1000, 380×800), sampled every 100 ms:
//   B1  band present iff a request is open: present in every sample from
//       the Generate click until the verdict lands (the strip's settled
//       text / the lockup), absent in every sample after; .ws-locked on
//       the root iff the band is mounted
//   B2  band rect within the viewport: bottom === innerHeight, top >
//       the nav's bottom; height reported
//   B3  no sample with both the band and the refusal container; no
//       sample with a retired working voice (COMPUTING / VERIFYING /
//       the wait line / Generating… / Recomputing) anywhere on the page
//   B4  under the lock: every data-write control off (disabled or
//       aria-disabled), every data-read control on and one toggles on
//       click, nav + footer links live, scrolling works; every write
//       re-enabled at settle
//   B5  footer reachable at max scroll while the band is up (its bottom
//       edge clears the band's top)
//   B6  the #152 E landing: the results zone's top at the nav + rail +
//       8 px margin (98) after the settle scroll — unmoved
//   B7  axe (wcag2a/aa/21aa/22aa) with the band up: 1440 total ≤ 0,
//       380 ≤ 2 (the two named pre-existing); no color-contrast node in
//       the band
//   B8  measured pairs on the band surface ≥ 4.5:1: glyph, verb,
//       object, the named span, the lock notice
//   B9  reduced motion: the track's ::after has no animation and the
//       track is the static --act-glow fill
//   B10 RENDERING: a plan-sheet PDF download raises the band with
//       "RENDERING · plan sheet PDF", the button never says Rendering…,
//       the band leaves with the response
//   B11 a correction (Assert) from the block: the band says
//       "RE-GENERATING · after a correction to {name}", the block is
//       mounted + aria-busy with every button off; the band leaves on
//       settle and the record row renders
//   A1  aria: exactly one live region carries the band's words; the
//       strip's polite wrapper is empty while the band is up
// Prod: a refused scan is a finding first — recorded (with the B3
// co-frame check across the refusal) — then Retry scan is clicked
// through the refusal container (≤ 3 times) so the plan renders.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = process.env.A23_BASE || "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2] || path.join(__dirname, "outS2A23");
const EXPECT_SHA = process.argv[3] || "";
const LAT = process.argv[4] || "39.726900", LNG = process.argv[5] || "-104.987300", BEARING = "180", WORKLEN = "1000";
fs.mkdirSync(OUT, { recursive: true });
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");
const AXE_BASELINE = { "1440x1000": 0, "380x800": 2 };
const RETIRED = /COMPUTING|VERIFYING|the plan settles here|Generating…|Recomputing|Rendering…|Bundling…|Calculating…/;
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };
const results = [];
const check = (tag, id, ok, detail) => { results.push({ tag, id, ok, detail }); log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`); };
const info = (tag, id, detail) => { results.push({ tag, id, ok: true, info: true, detail }); log(`[${tag}] INFO ${id} — ${detail}`); };

const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/;
async function pinManually(page) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  await fill("Latitude", LAT);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", LNG);
  await fill("Bearing (° from N)", BEARING);
  await fill("Work zone (ft)", WORKLEN);
  await page.waitForTimeout(400);
}
const SAMPLE = () => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), text: (el.textContent || "").trim().slice(0, 120) }; };
  const cs = getComputedStyle(document.querySelector(".workbench"));
  const nav = document.querySelector("nav");
  const band = document.querySelector(".working-band");
  const writes = Array.from(document.querySelectorAll("main [data-write], nav [data-write]"));
  const off = (el) => el.disabled === true || el.getAttribute("aria-disabled") === "true";
  const blk = document.querySelector(".site-corrections");
  const btns = blk ? Array.from(blk.querySelectorAll("button")) : [];
  return {
    scrollY: Math.round(window.scrollY), innerH: window.innerHeight, navH: parseInt(cs.getPropertyValue("--nav-h"), 10),
    navBottom: nav ? Math.round(nav.getBoundingClientRect().bottom) : null,
    band: band ? { ...r(".working-band"), verb: band.querySelector(".wb-verb")?.textContent ?? null, object: band.querySelector(".wb-object")?.textContent ?? null, named: band.querySelector(".wb-named")?.textContent ?? null, lock: band.querySelector(".wb-lock")?.textContent ?? null } : null,
    locked: document.querySelector(".workbench").classList.contains("ws-locked"),
    statusBar: r(".status-bar"), lockup: r(".results-head-lockup"), refusal: r(".scan-refusal"), wait: r(".results-head-wait"),
    retired: (() => { const re = /COMPUTING|VERIFYING|the plan settles here|Generating…|Recomputing|Rendering…|Bundling…|Calculating…/; const m = (document.body.textContent || "").match(re); return m ? m[0] : null; })(),
    writes: writes.length, writesOff: writes.filter(off).length,
    busy: blk ? blk.getAttribute("aria-busy") : null, blockButtons: btns.length, blockOff: btns.filter(off).length,
  };
};
async function sampleUntilSettled(page, label, maxMs, extraStop) {
  const t0 = Date.now(); const samples = []; let settledAt = null; let shot = false; let seenBand = false;
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0; samples.push(s);
    if (s.band) seenBand = true;
    if (!shot && s.band && s.t > 300) { shot = true; await page.screenshot({ path: path.join(OUT, `band-${label}.png`) }); }
    const st = s.statusBar?.text ?? "";
    // Settled = the band has been seen and is gone with a verdict on the
    // strip (a prior verdict — PLAN DECLINED before a Retry — is not this
    // request's settle).
    const settledNow = (seenBand && SETTLED.test(st) && !s.band) || (extraStop && extraStop(s));
    if (settledAt === null && settledNow) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1200) break;
    await page.waitForTimeout(100);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples, null, 1));
  return { samples, settledAt };
}
function bandLegs(tag, label, samples, expectVerb) {
  const withBand = samples.filter((s) => s.band);
  const first = withBand[0];
  const lastBandIdx = samples.map((s) => !!s.band).lastIndexOf(true);
  const after = samples.slice(lastBandIdx + 1);
  const gaps = samples.slice(0, lastBandIdx + 1).filter((s) => !s.band && s.t > 200);
  const lockMismatch = samples.filter((s) => (!!s.band) !== s.locked);
  const settledAfter = after.filter((s) => SETTLED.test(s.statusBar?.text ?? "") || s.lockup);
  check(tag, `B1 ${label}`, withBand.length > 0 && gaps.length === 0 && after.length > 0 && settledAfter.length === after.length && lockMismatch.length === 0,
    `${withBand.length} samples with the band (first at ${first?.t ?? "—"} ms, last at ${samples[lastBandIdx]?.t ?? "—"} ms), ${gaps.length} gaps while open, ${after.length} after (${settledAfter.length} settled), lock≠band in ${lockMismatch.length}`);
  const geo = withBand.filter((s) => s.band.bottom === s.innerH && s.band.top > s.navBottom);
  const heights = [...new Set(withBand.map((s) => s.band.h))];
  check(tag, `B2 ${label}`, withBand.length > 0 && geo.length === withBand.length,
    `${geo.length}/${withBand.length} samples with bottom === innerH (${first?.innerH}) and top > nav (${first?.navBottom}); band ${first ? `${first.band.top}..${first.band.bottom}` : "—"}, heights ${heights.join("/")} px`);
  const coFrame = samples.filter((s) => s.band && s.refusal);
  const voices = samples.filter((s) => s.retired);
  check(tag, `B3 ${label}`, coFrame.length === 0 && voices.length === 0,
    `${coFrame.length} samples with band + refusal; ${voices.length} samples with a retired voice${voices[0] ? ` ("${voices[0].retired}")` : ""}; wait line seen ${samples.filter((s) => s.wait).length}×`);
  if (expectVerb && first) check(tag, `verb ${label}`, first.band.verb === expectVerb.verb && (expectVerb.object ? first.band.object === expectVerb.object : true),
    `"${first.band.verb}" · "${first.band.object}" (named "${first.band.named}") · "${first.band.lock}"`);
  return { first, after };
}
const LOCK_PROBE = async (page, tag, label) => {
  const p = await page.evaluate(() => {
    const off = (el) => el.disabled === true || (el.getAttribute("aria-disabled") === "true" && (el.tagName !== "A" || el.tabIndex === -1));
    const writes = Array.from(document.querySelectorAll("main [data-write], nav [data-write]"));
    const reads = Array.from(document.querySelectorAll("main [data-read], nav [data-read]"));
    const links = Array.from(document.querySelectorAll("nav a[href], footer a[href]"));
    const liveLink = (a) => getComputedStyle(a).pointerEvents !== "none" && a.getAttribute("aria-disabled") !== "true";
    const y0 = window.scrollY; window.scrollBy(0, 120); const moved = window.scrollY !== y0; window.scrollTo(0, y0);
    const opacities = [...new Set(writes.map((w) => getComputedStyle(w).opacity))];
    return {
      writes: writes.length, writesOn: writes.filter((w) => !off(w)).map((w) => `${w.tagName.toLowerCase()} "${(w.getAttribute("aria-label") || w.textContent || "").trim().slice(0, 30)}"`),
      reads: reads.length, readsOff: reads.filter(off).length, links: links.length, linksLive: links.filter(liveLink).length, scrolls: moved, opacities,
    };
  });
  check(tag, `B4 ${label} writes off`, p.writes > 10 && p.writesOn.length === 0, `${p.writes} write controls, on: ${p.writesOn.join(", ") || "none"}; opacities ${p.opacities.join("/")}`);
  check(tag, `B4 ${label} reads on`, p.reads > 0 && p.readsOff === 0 && p.links > 0 && p.linksLive === p.links && p.scrolls,
    `${p.reads} read controls (${p.readsOff} off), ${p.linksLive}/${p.links} nav+footer links live, scroll ${p.scrolls ? "moves" : "STUCK"}`);
  // A read toggles under the lock: the pricing card's head.
  const head = page.locator(".price-head");
  if (await head.count()) {
    const before = await head.getAttribute("aria-expanded");
    await head.click();
    await page.waitForTimeout(100);
    const afterA = await head.getAttribute("aria-expanded");
    check(tag, `B4 ${label} read toggles`, before !== afterA, `price-head aria-expanded ${before} → ${afterA}`);
    await head.click();
  }
  // Footer reachable at max scroll while the band is up.
  const foot = await page.evaluate(() => { const y = window.scrollY; window.scrollTo(0, 1e9); const f = document.querySelector("footer").getBoundingClientRect(); const b = document.querySelector(".working-band")?.getBoundingClientRect(); const out = { footerBottom: Math.round(f.bottom), bandTop: b ? Math.round(b.top) : null, innerH: window.innerHeight }; window.scrollTo(0, y); return out; });
  check(tag, `B5 ${label}`, foot.bandTop !== null && foot.footerBottom <= foot.bandTop, `footer bottom ${foot.footerBottom} vs band top ${foot.bandTop} (innerH ${foot.innerH})`);
};
async function runAxe(page, tag, name) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  const compact = res.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(" ")), data: v.nodes.map((n) => n.any?.[0]?.data ?? null) }));
  fs.writeFileSync(path.join(OUT, `axe-${name}-${tag}.json`), JSON.stringify(compact, null, 2));
  const inBand = compact.filter((v) => v.id === "color-contrast").flatMap((v) => v.targets).filter((t) => /working-band|wb-/.test(t));
  const total = compact.reduce((n, v) => n + v.targets.length, 0);
  check(tag, `B7 axe ${name}`, inBand.length === 0 && total <= AXE_BASELINE[tag],
    `color-contrast in the band: ${inBand.length}; total nodes ${total} (baseline ${AXE_BASELINE[tag]}): ${compact.map((v) => `${v.id}[${v.targets.join(",")}]`).join(" ; ") || "none"}`);
}
const PAIRS = () => {
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const parse = (rgb) => { const m = rgb.match(/\d+(\.\d+)?/g); if (!m) return null; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] }; };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const effBg = (el) => { const layers = []; let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.unshift(c); if (c.a >= 1) break; } e = e.parentElement; } let out = { r: 255, g: 255, b: 255 }; for (const l of layers) out = { r: l.r * l.a + out.r * (1 - l.a), g: l.g * l.a + out.g * (1 - l.a), b: l.b * l.a + out.b * (1 - l.a) }; return hex(out); };
  const pair = (name, sel, prop = "color") => { const el = document.querySelector(sel); if (!el) return { name, missing: sel }; const fg = hex(parse(getComputedStyle(el)[prop])); const bg = effBg(el); return { name, fg, bg, ratio: ratio(fg, bg) }; };
  const band = document.querySelector(".working-band");
  return {
    surface: band ? hex(parse(getComputedStyle(band).backgroundColor)) : null,
    border: band ? hex(parse(getComputedStyle(band).borderTopColor)) : null,
    pairs: [
      pair("glyph ◌ (--none)", ".wb-glyph"),
      pair("verb (--act-bright)", ".wb-verb"),
      pair("object (--ink)", ".wb-object"),
      pair("named (sans, --ink)", ".wb-named"),
      pair("lock notice (--warn)", ".wb-lock"),
    ],
    named: band ? getComputedStyle(band.querySelector(".wb-named") || band).fontFamily : null,
    mono: band ? getComputedStyle(band.querySelector(".wb-verb")).fontFamily : null,
  };
};
async function pairLegs(page, tag, label) {
  const p = await page.evaluate(PAIRS);
  fs.writeFileSync(path.join(OUT, `pairs-${label}-${tag}.json`), JSON.stringify(p, null, 1));
  const present = p.pairs.filter((x) => !x.missing);
  const low = present.filter((x) => x.ratio < 4.5);
  check(tag, `B8 ${label}`, present.length >= 4 && low.length === 0,
    `surface ${p.surface} border ${p.border}; ${present.map((x) => `${x.name} ${x.fg}/${x.bg} ${x.ratio}`).join(" ; ")}${p.pairs.filter((x) => x.missing).length ? ` (missing: ${p.pairs.filter((x) => x.missing).map((x) => x.name).join(", ")})` : ""}`);
  info(tag, `B8 fonts ${label}`, `named "${(p.named || "").slice(0, 40)}" · mono "${(p.mono || "").slice(0, 40)}"`);
}
async function ariaLeg(page, tag, label) {
  const a = await page.evaluate(() => {
    const regions = Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert]"));
    const speakers = regions.filter((e) => /GENERATING|RENDERING|CONTROLS LOCKED/.test(e.textContent || ""));
    const row = document.querySelector(".working-band .wb-row");
    const strip = document.querySelector(".status-bar");
    return { regions: regions.length, speakers: speakers.length, rowRole: row?.getAttribute("role"), rowLive: row?.getAttribute("aria-live"), rowText: row?.textContent, stripPresent: !!strip, glyphHidden: row?.querySelector(".wb-glyph")?.getAttribute("aria-hidden") };
  });
  check(tag, `A1 ${label}`, a.speakers === 1 && a.rowRole === "status" && a.rowLive === "polite" && !a.stripPresent && a.glyphHidden === "true",
    `${a.speakers} region(s) carry the band's words of ${a.regions}; row role=${a.rowRole} aria-live=${a.rowLive}; strip ${a.stripPresent ? "PRESENT" : "empty"}; sentence "${a.rowText}"`);
}
async function reducedMotionLeg(page, tag, label) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const m = await page.evaluate(() => { const t = document.querySelector(".wb-track"); if (!t) return null; const after = getComputedStyle(t, "::after"); return { anim: after.animationName, bg: getComputedStyle(t).backgroundColor, afterBg: after.backgroundImage }; });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const n = await page.evaluate(() => { const t = document.querySelector(".wb-track"); if (!t) return null; return { anim: getComputedStyle(t, "::after").animationName }; });
  check(tag, `B9 ${label}`, !!m && m.anim === "none" && /rgba\(52, 169, 232, 0\.32\)/.test(m.bg) && !!n && n.anim === "wb-sweep",
    m ? `reduced: animation ${m.anim}, track ${m.bg}, ::after image ${m.afterBg}; normal: animation ${n?.anim}` : "no track");
}
async function landingLeg(page, tag) {
  // The #152 E landing target is 98 (nav + rail + 8).  Ruling f (the
  // strip renders nothing in flight) re-mounts the verdict strip in the
  // settle frame; when Chrome's scroll anchor node sits in the setup
  // strip above it — the case at 380, where the strip's rows fill the
  // viewport — that one mount is uncompensated and the zone lands the
  // strip's height + its 24 px margin lower.  Declared; both are
  // accepted, and the exact figure is recorded.
  const l = await page.evaluate(() => { const res = document.querySelectorAll("section.zone")[1]; const sb = document.querySelector(".status-bar, .status-details"); return { resultsTop: Math.round(res.getBoundingClientRect().top), margin: getComputedStyle(res).scrollMarginTop, scrollY: Math.round(window.scrollY), stripH: sb ? Math.round(sb.getBoundingClientRect().height) : 0 }; });
  const shifted = 98 + l.stripH + 24;
  check(tag, "B6 landing", l.resultsTop === 98 || Math.abs(l.resultsTop - shifted) <= 1, `results zone top ${l.resultsTop} (target 98; strip re-mount shift would be ${shifted}; scroll-margin ${l.margin}) at scrollY ${l.scrollY}`);
}

(async () => {
  if (EXPECT_SHA) {
    const hz = await (await fetch(HEALTHZ)).json();
    log(`healthz sha ${hz.sha} expect ${EXPECT_SHA}`);
    if (hz.sha !== EXPECT_SHA) { log("SHA GATE FAILED"); process.exit(2); }
  } else log(`local run against ${BASE} — no sha gate (A20_DELAY_S=${process.env.A20_DELAY_S ?? "?"} on the stand-in)`);
  const browser = await chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const page = await browser.newPage({ viewport: vp });
    page.on("pageerror", (e) => log(`[${tag}] PAGEERROR ${e.message}`));
    // B10 needs the render to be observable: the local stack answers a
    // memoised plan-sheet render in under one sample, so the harness
    // holds the RESPONSE 3 s on the wire (a network delay, never a
    // product timer; prod renders take 3–8 s on their own).
    await page.route("**/api/render/pdf", async (route) => { await new Promise((r) => setTimeout(r, 3000)); await route.continue(); });
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(600);
    await pinManually(page);
    await page.waitForTimeout(3000);
    // Pre-generate: no band even with the per-edit pair in flight.
    const pre = await page.evaluate(SAMPLE);
    check(tag, "B1 pre-generate", pre.band === null && !pre.locked, `band ${pre.band ? "PRESENT" : "absent"}, lock ${pre.locked}`);

    // ── Generate ──
    await page.getByRole("button", { name: /Generate plan/ }).click();
    let gen = await sampleUntilSettled(page, `generate-${tag}`, 90000);
    let g = bandLegs(tag, "generate", gen.samples, { verb: "GENERATING" });
    // A refused scan on prod: recorded; the B3 co-frame check above already
    // covered the refusal's arrival.  Retry through the container (≤ 3×).
    for (let i = 0; i < 3 && (await page.locator(".scan-refusal").count()); i++) {
      info(tag, `refusal ${i + 1}`, (await page.locator(".scan-refusal").textContent()).trim().slice(0, 160));
      await page.getByRole("button", { name: /Retry scan/ }).click();
      gen = await sampleUntilSettled(page, `retry${i + 1}-${tag}`, 90000);
      g = bandLegs(tag, `retry${i + 1}`, gen.samples, { verb: "RE-GENERATING", object: "retrying the site scan" });
    }
    await page.waitForTimeout(800);
    await landingLeg(page, tag);
    await page.screenshot({ path: path.join(OUT, `settled-${tag}.png`) });
    const settledWrites = await page.evaluate(() => { const off = (el) => el.disabled === true || el.getAttribute("aria-disabled") === "true"; const w = Array.from(document.querySelectorAll("main [data-write]")); return { n: w.length, off: w.filter(off).map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)) }; });
    check(tag, "B4 settle re-enable", settledWrites.n > 10 && settledWrites.off.length === 0, `${settledWrites.n} write controls, still off: ${settledWrites.off.join(", ") || "none"}`);

    // ── RENDERING: a plan-sheet PDF ──
    const pdfBtn = page.getByRole("button", { name: /Download PDF/ }).first();
    if (await pdfBtn.count()) {
      const dlPromise = page.waitForEvent("download", { timeout: 90000 }).catch(() => null);
      await pdfBtn.click();
      const rend = await sampleUntilSettled(page, `render-${tag}`, 90000, (s) => s.t > 500 && !s.band);
      const dl = await dlPromise;
      const withBand = rend.samples.filter((s) => s.band);
      check(tag, "B10 RENDERING", withBand.length > 0 && withBand[0].band.verb === "RENDERING" && withBand[0].band.object === "plan sheet PDF" && rend.samples.filter((s) => s.retired).length === 0 && !rend.samples[rend.samples.length - 1].band,
        `${withBand.length} samples with the band: "${withBand[0]?.band.verb}" · "${withBand[0]?.band.object}"; retired voice ${rend.samples.filter((s) => s.retired).length}×; download ${dl ? "received" : "not observed"}; band gone at end ${!rend.samples[rend.samples.length - 1].band}`);
      if (dl) await dl.delete().catch(() => {});
    } else check(tag, "B10 RENDERING", false, "no Download PDF button");

    // ── the correction flight (Assert), with the lock probes while it is open ──
    const block = page.locator("#site-corrections");
    if (await block.count()) {
      await block.scrollIntoViewIfNeeded();
      const assertBtn = block.getByRole("button", { name: "Assert", exact: true }).first();
      if (await assertBtn.count()) {
        const rowName = await assertBtn.evaluate((b) => b.closest(".site-correction-row")?.querySelector(".sc-name")?.textContent ?? "");
        await assertBtn.click();
        // Probe the lock while the request is open (the stand-in holds the scan; prod: as long as it takes).
        await page.waitForTimeout(250);
        const open = await page.evaluate(SAMPLE);
        if (open.band) {
          await LOCK_PROBE(page, tag, "assert");
          await runAxe(page, tag, "band-up");
          await pairLegs(page, tag, "assert");
          await ariaLeg(page, tag, "assert");
          await reducedMotionLeg(page, tag, "assert");
          check(tag, "B11 block under the lock", open.busy === "true" && open.blockButtons > 0 && open.blockOff === open.blockButtons,
            `aria-busy ${open.busy}; ${open.blockOff}/${open.blockButtons} block buttons off; band "${open.band.verb}" · "${open.band.object}"`);
        } else check(tag, "B11 block under the lock", false, "no band 250 ms after Assert (the request settled before the probe?)");
        const asr = await sampleUntilSettled(page, `assert-${tag}`, 90000);
        bandLegs(tag, "assert", asr.samples, { verb: "RE-GENERATING", object: `after a correction to ${rowName}` });
        const rec = await page.evaluate(() => { const b = document.getElementById("site-corrections"); return { busy: b?.getAttribute("aria-busy"), records: b ? b.querySelectorAll(".sc-record").length : 0, undo: b ? b.querySelectorAll("button").length : 0, off: b ? Array.from(b.querySelectorAll("button")).filter((x) => x.disabled).length : 0 }; });
        check(tag, "B11 settle", rec.busy === null && rec.records >= 1 && rec.off === 0, `aria-busy ${rec.busy}; ${rec.records} record row(s); ${rec.off}/${rec.undo} block buttons off`);
      } else info(tag, "B11", "no Assert button (every condition detected) — correction leg skipped");
    } else info(tag, "B11", "no correction block (scan not ok) — correction leg skipped");
    await page.close();
  }
  await browser.close();
  const fails = results.filter((r) => !r.ok);
  const passes = results.filter((r) => r.ok && !r.info);
  log(`\n${fails.length === 0 ? "ALL PASS" : "FAILURES"} ${passes.length}/${passes.length + fails.length} (+${results.filter((r) => r.info).length} info)`);
  for (const f of fails) log(`  FAIL [${f.tag}] ${f.id} — ${f.detail}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
