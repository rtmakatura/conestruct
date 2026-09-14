// s2-triage-2 — #259 on a STABLE dim.
//
//   node s2t2-staleribbon.js <outDir> <expectSha> [base]
//
// Why a second probe.  s2t2-shoulder.js tried to catch the ribbon during
// a re-generate and missed it on all four legs: with a warm memo the
// flight settles faster than a 100 ms sampler, so the transient dim is
// not a reliable surface to measure.  Arc 26 bucket A shipped a dim that
// does NOT expire — staged corrections render `.results-stale` plus the
// ribbon "Previous answer — N corrections staged, not yet applied." and
// hold it until Apply (the "disclose, don't lock" ruling).  That is the
// same wrapper and the same ribbon class #259 is about, in a state that
// stands still long enough to measure.
//
// What this proves and what it does not.  It proves the ribbon renders
// INSIDE `.results-stale` and what its composited contrast is.  It does
// not re-measure the in-flight ribbon; #259's "56 of 59 pairs" figure
// belongs to the audit's mid-flight capture and is NOT re-confirmed here.
const L = require("./audit-lib.js");
const { fs, path } = L;

const OUT = process.argv[2] || "out-ribbon";
const EXPECT = process.argv[3] || null;
const BASE = process.argv[4] || "https://www.conestruct.com";
const PIN = { lat: "39.7269", lng: "-104.9873", bearing: "180", zone: "1000" };

fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (r) => { rows.push(r); log(`[${r.vp}] ${r.issue} ${r.verdict} — ${r.what} :: ${r.measure}`); };

// sRGB relative luminance → WCAG contrast.  The wrapper's opacity and
// grayscale filter are applied by the compositor, so getComputedStyle on
// the ribbon alone reports the UNdimmed ink; the effective ink is
// composited against the page behind it.  Both are reported.
const CONTRAST = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  // walk up for the first opaque background
  let bgEl = el, bg = null;
  while (bgEl) {
    const c = getComputedStyle(bgEl).backgroundColor;
    const p = parse(c);
    if (p.length === 3 && !/rgba\(.*,\s*0\)/.test(c)) { bg = p; break; }
    bgEl = bgEl.parentElement;
  }
  const cs = getComputedStyle(el);
  const fg = parse(cs.color);
  const wrap = el.closest(".results-stale");
  const ws = wrap ? getComputedStyle(wrap) : null;
  const op = ws ? Number(ws.opacity) : 1;
  // composite the ribbon ink over its own background at the wrapper's opacity
  const mixed = bg ? fg.map((v, i) => Math.round(v * op + bg[i] * (1 - op))) : fg;
  return {
    text: (el.textContent || "").trim().slice(0, 70),
    insideDim: !!wrap,
    wrapperOpacity: ws?.opacity ?? null,
    wrapperFilter: ws?.filter ?? null,
    fg: cs.color, bg: bg ? `rgb(${bg.join(",")})` : null,
    ratioUndimmed: bg ? ratio(fg, bg) : null,
    ratioComposited: bg ? ratio(mixed, bg) : null,
  };
};

const pinManually = async (page) => {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (t, v) => {
    await page.locator(`label:text-is("${t}")`).locator("xpath=following-sibling::input[1]").fill(v);
  };
  await fill("Latitude", PIN.lat);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", PIN.lng);
  await fill("Bearing (° from N)", PIN.bearing);
  await fill("Work zone (ft)", PIN.zone);
  await page.waitForTimeout(400);
};

async function run(browser, vp) {
  const tag = `${vp.width}x${vp.height}`;
  const page = await browser.newPage({ viewport: vp });
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await pinManually(page);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Generate plan", exact: true }).click().catch(() => {});

  // A refused plan renders no downloads and no next-steps strip, so the
  // settle gate must name the refusal explicitly or a refusal reads as
  // "never settled" — which is a different, and much less informative,
  // sentence.  The final state is captured either way.
  let settled = false, last = null;
  for (let i = 0; i < 400; i++) {
    last = await page.evaluate(() => ({
      band: !!document.querySelector(".working-band"),
      bandText: (document.querySelector(".working-band")?.textContent || "").trim().slice(0, 60),
      dl: Array.from(document.querySelectorAll(".dl-btn")).filter((b) => !b.disabled).length,
      ns: !!document.querySelector(".ns-strip"),
      strip: (document.querySelector(".status-bar")?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70),
      refusal: (document.body.textContent || "").match(/PLAN DECLINED|site scan|could not|unavailable/i)?.[0] || null,
      dismiss: document.querySelectorAll('button').length,
    }));
    if (!last.band && last.dl > 0 && last.ns) { settled = true; break; }
    await page.waitForTimeout(200);
  }
  if (!settled) {
    rec({
      vp: tag, issue: "#259", verdict: "not-measured",
      what: "plan never reached a downloadable state in 80 s",
      measure: `final: band=${last?.band} "${last?.bandText}" dl=${last?.dl} ns=${last?.ns} strip="${last?.strip}" refusalWord=${last?.refusal} — a refusal and a slow scan both land here; see #256`,
    });
    await L.shot(page, OUT, `${tag}-unsettled`, true);
    await page.close();
    return;
  }

  // Stage a correction: one Dismiss, no Apply.  Arc 26 ruling — the
  // staged state discloses (dim + ribbon) and does NOT lock.
  // Scope by container.  "Dismiss" is NOT a unique name on this page —
  // the jurisdiction suggestion carries one too, and an unscoped
  // .first() hit it on the previous run, staging nothing (handoff
  // standing caution: scope every non-unique name by container).
  const dismiss = page.locator(".sc-row").getByRole("button", { name: "Dismiss", exact: true }).first();
  const n = await dismiss.count();
  if (!n) {
    rec({ vp: tag, issue: "#259", verdict: "not-measured", what: "no Dismiss control on this plan", measure: "no site-condition rows to stage" });
    await page.close();
    return;
  }
  await dismiss.click();
  await page.waitForTimeout(1200);

  const c = await page.evaluate(CONTRAST, ".results-stale .stale-ribbon");
  rec({
    vp: tag, issue: "#259",
    verdict: c ? (c.insideDim ? "still-present" : "stale") : "not-measured",
    what: "staged-correction ribbon: is it inside the dim, and what does it measure",
    measure: c
      ? `text="${c.text}" insideDim=${c.insideDim} wrapperOpacity=${c.wrapperOpacity} wrapperFilter=${c.wrapperFilter} fg=${c.fg} bg=${c.bg} ratioUndimmed=${c.ratioUndimmed} ratioComposited=${c.ratioComposited}`
      : "no .results-stale .stale-ribbon after staging a Dismiss",
  });
  if (c) await L.shot(page, OUT, `${tag}-staged-dim`, true);

  // How many text nodes inside the dim, for scale (NOT the audit's 56/59
  // in-flight figure — a different state, recorded as its own number).
  const inside = await page.evaluate(() => document.querySelectorAll(".results-stale *").length);
  rec({ vp: tag, issue: "#259b", verdict: "note", what: "nodes inside the staged dim", measure: `${inside} (state = staged, not in-flight; not comparable to the audit's mid-flight 56/59)` });

  await page.close();
}

(async () => {
  if (EXPECT) await L.shaGate(log, EXPECT);
  log(`base ${BASE}`);
  const browser = await L.chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    log(`──────── viewport ${vp.width}x${vp.height} ────────`);
    try { await run(browser, vp); } catch (e) { log(`RUN FAILED ${vp.width}: ${e.message}`); }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  log(`wrote ${rows.length} rows`);
})();
