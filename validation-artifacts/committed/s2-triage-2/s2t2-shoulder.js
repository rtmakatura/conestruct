// s2-triage-2 — targeted prod leg on the SHOULDER flow.
//
//   node s2t2-shoulder.js <outDir> <expectSha> [base]
//
// Scope, deliberately narrow.  This pass ranks issues; it does not fix
// them.  The shoulder flow is where the operator-frequency weight sits
// (handoff board), so it is the only flow measured on prod here —
// flagger and near-intersection stay source reads in findings.md and
// are labelled as such.  Every row this prints is a rect, a computed
// style, or a contrast ratio; nothing is an eyeball.
//
// What each leg answers, by open issue:
//   #272  ns-label vs ns-chips — BOX edges and INK edges, separately.
//         The issue's acceptance criterion is written against boxes;
//         arc 29 showed (for #273) that a box criterion can pass while
//         the ink defect stands, so both are measured here.
//   #264  every enabled control on the settled page, height ranked.
//         Two of the issue's ten rows are expected STALE (#258 made
//         Retry a .dl-btn, #261 moved the audit PDF into a card).
//   #262  setup-strip height with a Speed editor open vs closed.
//   #259  the stale ribbon's own contrast, measured mid-flight, on the
//         composited surface — the ribbon is inside .results-stale.
//   #276  the jurisdiction cell's rendered text on the happy path.
//   #277  does the ledger mount on shoulder (it should; the issue is
//         about the OTHER four kinds).
//   #256  first-scan-of-session duration and whether it refused.
//   #212  baked ISSUED vs the client's today + pageerror trio.
//
// #212 SELF-DESCRIBING CAVEAT (arc 30's lesson, and the reason that
// issue's acceptance criterion is load-bearing): a run on the deploy's
// own UTC day CANNOT observe the hydration mismatch, because the baked
// prerender date and the client's today are the same string.  When that
// is the case this probe prints a loud line saying zero errors proves
// nothing, ABOVE the results — so a future reader cannot mistake this
// run for evidence of a fix.
const L = require("./audit-lib.js");
const { fs, path } = L;

const OUT = process.argv[2] || "out-shoulder";
const EXPECT = process.argv[3] || null;
const BASE = process.argv[4] || "https://www.conestruct.com";
const PIN = { lat: "39.7269", lng: "-104.9873", bearing: "180", zone: "1000" };

fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (r) => {
  rows.push(r);
  log(`[${r.vp}] ${r.issue} ${r.verdict} — ${r.what} :: ${r.measure}`);
};

// Box vs ink.  A grid/flex item stretches to its track, so two boxes can
// share an edge while the text inside them does not.  Range rects give
// the ink.
const INK = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = document.createRange();
  r.selectNodeContents(el);
  const ink = r.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  return {
    boxLeft: +box.left.toFixed(1), boxRight: +box.right.toFixed(1),
    inkLeft: +ink.left.toFixed(1), inkRight: +ink.right.toFixed(1),
    text: (el.textContent || "").trim().slice(0, 40),
  };
};

const pinManually = async (page) => {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]");
    await input.fill(value);
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
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 120)));

  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);

  // ── #212: the baked date, and whether this run can even see the bug ──
  const issued = await page
    .locator("text=/ISSUED/")
    .first()
    .evaluate((el) => el.parentElement?.textContent?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null)
    .catch(() => null);
  const clientToday = await page.evaluate(() => new Date().toISOString().slice(0, 10));
  const canObserve212 = issued !== null && issued !== clientToday;
  if (!canObserve212) {
    log("");
    log("!!  #212 CANNOT BE OBSERVED BY THIS RUN  !!");
    log(`!!  baked ISSUED=${issued} equals the client's today=${clientToday}: this is the`);
    log("!!  deploy's own UTC day.  Zero page errors below PROVES NOTHING about #212.");
    log("!!  Only a run on a page built a previous UTC day can see it (arc 30, #212 comment).");
    log("");
  }
  rec({
    vp: tag, issue: "#212",
    verdict: canObserve212 ? (pageErrors.length ? "still-present" : "stale?") : "not-measurable-today",
    what: "baked ISSUED vs client today",
    measure: `ISSUED=${issued} clientToday=${clientToday} canObserve=${canObserve212} pageErrors=${pageErrors.length}`,
  });

  // ── pin → generate the shoulder plan ──
  const tScan = Date.now();
  await pinManually(page);
  await page.waitForTimeout(3000);
  const genBtn = page.getByRole("button", { name: "Generate plan", exact: true });
  await genBtn.click().catch(() => {});

  // ── #259: the ribbon mid-flight.  Only a RE-generate dims, so this
  //    first flight is used to reach a settled plan; the dim is measured
  //    on the second Generate below.
  let settled = false;
  for (let i = 0; i < 300; i++) {
    const s = await page.evaluate(() => ({
      band: !!document.querySelector(".working-band"),
      strip: (document.querySelector(".status-bar")?.textContent || "").trim().slice(0, 60),
      refusal: !!document.querySelector(".refusal-container, [data-refusal]"),
      // The ANSWER's own marks, not the strip's words: the pre-generate
      // strip already reads "VERIFIED · READY FOR TCS REVIEW", so a strip
      // regex settles before Generate has run (it did, on the first
      // 1440 leg of this probe).  Downloads and the next-steps strip
      // exist only after a plan lands.
      dl: Array.from(document.querySelectorAll(".dl-btn")).filter((b) => !b.disabled).length,
      ns: !!document.querySelector(".ns-strip"),
    }));
    if (!s.band && (s.refusal || (s.dl > 0 && s.ns))) { settled = true; break; }
    await page.waitForTimeout(200);
  }
  const scanMs = Date.now() - tScan;
  const refused = await page.locator(".refusal-container, [data-refusal]").count();
  rec({
    vp: tag, issue: "#256",
    verdict: refused ? "refused-this-run" : "ok-this-run",
    what: "first scan of session, Denver demo pin",
    measure: `settled=${settled} wall=${scanMs}ms refusalContainer=${refused} (one sample; #256's claim is a RATE — 3 of 8 — and one run cannot confirm or refute it)`,
  });
  await L.shot(page, OUT, `${tag}-settled`, true);

  // ── #277: does the ledger mount on shoulder ──
  const dva = await page.locator(".dva").count();
  rec({
    vp: tag, issue: "#277", verdict: dva ? "mounts-on-shoulder" : "absent",
    what: "detected-vs-applied ledger on the shoulder kind",
    measure: `.dva count=${dva} (manual-pin flow carries no confirmed road, so absence here is the audit-walk limitation, not #277)`,
  });

  // ── #276: the jurisdiction cell ──
  const jur = await page
    .locator(".setup-strip")
    .evaluate((el) => {
      const c = el.querySelector('button.sv[aria-label="Edit Jurisdiction"] .val');
      return c ? (c.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60) : null;
    })
    .catch(() => null);
  rec({
    vp: tag, issue: "#276", verdict: "happy-path-only",
    what: "jurisdiction cell text (loaded state)",
    measure: `"${jur}" — the defect is the ERRORED/absent fallback, which this run cannot force without intercepting the evaluate call`,
  });

  // ── #272: label vs chips, box and ink ──
  const nsLabel = await page.evaluate(INK, ".ns-label");
  const nsChips = await page.evaluate(INK, ".ns-chips");
  const nsFirstChipInk = await page.evaluate(INK, ".ns-chip .ns-index");
  if (nsLabel && nsChips) {
    const boxDelta = +(nsLabel.boxLeft - nsChips.boxLeft).toFixed(1);
    const inkDelta = nsFirstChipInk ? +(nsLabel.inkLeft - nsFirstChipInk.inkLeft).toFixed(1) : null;
    rec({
      vp: tag, issue: "#272",
      verdict: Math.abs(boxDelta) <= 1 ? "box-criterion-PASSES" : "box-criterion-fails",
      what: "ns-label vs ns-chips left edge",
      measure: `BOX label.left=${nsLabel.boxLeft} chips.left=${nsChips.boxLeft} delta=${boxDelta} | INK label=${nsLabel.inkLeft} firstChipIndex=${nsFirstChipInk?.inkLeft} delta=${inkDelta}`,
    });
  } else {
    rec({ vp: tag, issue: "#272", verdict: "not-measured", what: "next-steps strip", measure: "strip absent on this run" });
  }

  // ── #264: every enabled control, smallest first ──
  const targets = await page.evaluate(L.TARGETS, ".workbench");
  const small = (targets || []).filter((t) => !t.disabled && t.h < 32).sort((a, b) => a.h - b.h);
  rec({
    vp: tag, issue: "#264", verdict: small.length ? "still-present" : "stale",
    what: "enabled controls under the P10 32 px desk floor",
    measure: `${small.length} under 32: ` + small.slice(0, 14).map((t) => `"${(t.name || "").slice(0, 22)}" ${t.w}×${t.h}`).join(" ; "),
  });
  fs.writeFileSync(path.join(OUT, `${tag}-targets.json`), JSON.stringify(targets, null, 1));

  // ── #262: strip height with an editor open ──
  const stripH = async () =>
    page.locator(".setup-strip").evaluate((el) => +el.getBoundingClientRect().height.toFixed(1)).catch(() => null);
  const hClosed = await stripH();
  const speedEdit = page.getByRole("button", { name: /Edit Speed/i }).first();
  let hOpen = null, escClosed = null;
  if (await speedEdit.count()) {
    await speedEdit.click();
    await page.waitForTimeout(400);
    hOpen = await stripH();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    escClosed = (await page.locator(".sv-editor").count()) === 0;
  }
  rec({
    vp: tag, issue: "#262",
    verdict: hOpen !== null && Math.abs((hOpen ?? 0) - (hClosed ?? 0)) > 1 ? "still-present" : "no-shift-here",
    what: "setup-strip height with the Speed editor open; Escape closes?",
    measure: `closed=${hClosed} open=${hOpen} delta=${hOpen !== null ? +(hOpen - hClosed).toFixed(1) : "n/a"} escapeClosedEditor=${escClosed}`,
  });

  // ── #259: re-generate, then measure the ribbon inside the dim ──
  await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.waitForTimeout(300);
  const gen2 = page.getByRole("button", { name: "Generate plan", exact: true });
  let ribbon = null;
  if (await gen2.count()) {
    await gen2.click().catch(() => {});
    for (let i = 0; i < 60; i++) {
      const r = await page.evaluate(() => {
        const el = document.querySelector(".results-stale .stale-ribbon");
        if (!el) return null;
        const cs = getComputedStyle(el);
        const wrap = el.closest(".results-stale");
        const ws = wrap ? getComputedStyle(wrap) : null;
        return {
          text: (el.textContent || "").trim().slice(0, 60),
          color: cs.color, bg: cs.backgroundColor,
          wrapperOpacity: ws?.opacity ?? null, wrapperFilter: ws?.filter ?? null,
          insideDim: !!wrap,
        };
      });
      if (r) { ribbon = r; break; }
      await page.waitForTimeout(100);
    }
  }
  rec({
    vp: tag, issue: "#259",
    verdict: ribbon?.insideDim ? "still-present" : "not-measured",
    what: "the Previous-answer ribbon is inside the .results-stale dim",
    measure: ribbon
      ? `text="${ribbon.text}" color=${ribbon.color} wrapperOpacity=${ribbon.wrapperOpacity} wrapperFilter=${ribbon.wrapperFilter} insideDim=${ribbon.insideDim}`
      : "ribbon not caught mid-flight (the re-generate settled faster than the sampler, or the dim did not mount)",
  });
  if (ribbon) await L.shot(page, OUT, `${tag}-midflight`);

  rec({
    vp: tag, issue: "#212b", verdict: "note", what: "page errors across the whole run",
    measure: `${pageErrors.length}: ${[...new Set(pageErrors)].slice(0, 4).join(" | ") || "none"}${canObserve212 ? "" : "  << deploy-day run: this number is not evidence about #212"}`,
  });

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
