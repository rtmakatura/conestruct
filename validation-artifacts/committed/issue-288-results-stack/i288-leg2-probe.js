// #288 leg 2 — the interim leg at f81daa6.
//   node probe.js <outDir> <expectSha> [base]
//
// What is measurable on this build: §8.29's absence, rule 28's reserved
// row holding its 44 px at the settle, and zero pageerror.  NOT the four
// states: NEEDS YOU is built but not mounted, so S5-with-items and
// S5-with-none do not exist as surfaces yet.
const ARC = "C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/issue-288-results-stack";
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const { attachErrorTaps, classify } = require(ARC + "/err-tap.js");
const { fs, path, chromium } = L;

const OUT = process.argv[2];
const EXPECT = process.argv[3];
const BASE = process.argv[4] || "https://www.conestruct.com";
const FIX = { lat: "39.71466", lng: "-104.94071", way: "39508704" };
fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (o) => { rows.push(o); fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1)); };
const check = (id, ok, d) => { rec({ id, ok, detail: d }); log(`${ok === null ? "INFO" : ok ? "PASS" : "FAIL"} ${id} — ${d}`); };

const openPicker = async (page) => {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.waitForSelector("[role=dialog]", { timeout: 15000 });
};
const confirmRoad = async (page, tag) => {
  const dlg = page.locator("[role=dialog]");
  const manual = dlg.getByRole("button", { name: /Or enter coordinates manually|Hide coordinate/i });
  if (await manual.count()) {
    const txt = await manual.first().textContent();
    if (/Or enter/i.test(txt || "")) await manual.first().click();
  }
  await dlg.getByLabel("Latitude").fill(FIX.lat);
  await dlg.getByLabel("Longitude").fill(FIX.lng);
  await dlg.getByLabel("Longitude").blur();
  let candidates = [];
  for (let i = 0; i < 60; i++) {
    candidates = await dlg.locator("button", { hasText: /way \d+/ }).allTextContents().catch(() => []);
    if (candidates.length) break;
    await page.waitForTimeout(500);
  }
  check(`${tag}.pick.candidates`, candidates.length > 0, `${candidates.length} candidate(s)`);
  if (!candidates.length) {
    // Record WHY, rather than leaving a bare zero: a refused scan (#256),
    // a different phone-width picker, or no road at the fixture all read
    // as "0 candidates" and are different facts.
    const why = await dlg.innerText().catch(() => "(dialog unreadable)");
    check(`${tag}.pick.why-zero`, null, `dialog text: ${why.replace(/\s+/g, " ").trim().slice(0, 300)}`);
    await L.shot(page, OUT, `picker-zero-${tag}`, true);
    return false;
  }
  const want = dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) });
  const target = (await want.count()) ? want.first() : dlg.locator("button", { hasText: /way \d+/ }).first();
  await target.click();
  await page.waitForTimeout(1500);
  const save = dlg.getByRole("button", { name: "Save & Close" });
  if (await save.isDisabled()) { check(`${tag}.pick.save`, false, "Save & Close stayed disabled"); return false; }
  await save.click();
  await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 15000 });
  return true;
};

(async () => {
  await L.shaGate(log, EXPECT);
  check("gate.healthz", true, `healthz == ${EXPECT}`);

  const browser = await chromium.launch();
  for (const [vp, width, height] of [["1440", 1440, 1000], ["380", 380, 800]]) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const early = attachErrorTaps(page, "early");        // before goto, by contract
    await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle", timeout: 60000 });
    const late = attachErrorTaps(page, "late");
    await page.waitForTimeout(2500);

    // §8.29 — the absence, on the settled DOM not just the bundle.
    const gone = await page.evaluate(() => ({
      nsStrip: !!document.querySelector(".ns-strip"),
      nsChip: document.querySelectorAll(".ns-chip").length,
      nextCopy: (document.body.textContent || "").includes("NEXT — 3 STEPS"),
      slotPre: !!document.querySelector(".results-head-slot"),
    }));
    check(`${vp}.strip-absent`, !gone.nsStrip && gone.nsChip === 0 && !gone.nextCopy,
      `.ns-strip ${gone.nsStrip} · .ns-chip ${gone.nsChip} · "NEXT — 3 STEPS" ${gone.nextCopy}`);
    check(`${vp}.slot-pre-generate`, gone.slotPre === false, `slot pre-generate: ${gone.slotPre} (rule 28: nothing before Generate)`);

    // Drive to the settle so the reserved row is mounted for real.
    let settled = false;
    try {
      await openPicker(page);
      if (await confirmRoad(page, vp)) {
        // The Generate control's ACCESSIBLE NAME is state-derived and now
        // reads "Generate — blocked, see the marked step" / "Generate …".
        // Earlier legs keyed on /Generate package/i, which no longer
        // matches anything: keying a leg on state-derived copy is how a
        // harness rots.  Anchored on the stable leading word instead.
        // Generate is GATED on a complete scenario -- its own accessible
        // name says so ("Generate - blocked, see the marked step").  The
        // earlier legs never had to pass this gate because they measured
        // pre-generate surfaces.  Best-effort completion, each step
        // optional and recorded, so a gate that stays shut is a FINDING
        // with a reason rather than a bare timeout.
        for (const [label, name] of [["road class", /^Arterial$/], ["lanes", /^2$/], ["schedule", /^Single day$/]]) {
          try {
            const b = page.getByRole("button", { name }).first();
            if (await b.count()) { await b.click(); await page.waitForTimeout(400); }
          } catch { check(`${vp}.form.${label}`, null, "not clickable at this width"); }
        }
        for (const lbl of [/work.*length/i, /length/i]) {
          try {
            const f = page.getByLabel(lbl).first();
            if (await f.count()) { await f.fill("200"); await f.blur(); break; }
          } catch {}
        }
        await page.waitForTimeout(1200);
        // The CTA is `.generate-btn` ("Generate plan", 56 px -- rule 130's
        // .pri height).  Matching on the NAME picks the progress rail's
        // step chip instead (`button.rail-entry.st-generate`, "->Generate",
        // 21 px), which sorts first in the DOM and is a read, not a write:
        // three earlier runs of this leg clicked it and recorded "no
        // generation started" because none ever did.  Keyed on the class.
        const gen = page.locator("button.generate-btn").first();
        const genName = ((await gen.textContent()) || "").replace(/\s+/g, " ").trim();
        const blocked = /blocked/i.test(genName);
        check(`${vp}.generate.gate`, !blocked, `accessible name "${genName.slice(0, 90)}"`);
        if (blocked) {
          const pending = await page.evaluate(() =>
            Array.from(document.querySelectorAll("button"))
              .map((e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim())
              .filter((t) => /pending|needs attention/i.test(t))
              .slice(0, 6));
          check(`${vp}.generate.blockers`, null, `steps still open: ${pending.join(" | ") || "(none reported)"}`);
        }
        await gen.scrollIntoViewIfNeeded();
        check(`${vp}.generate.name`, null, `accessible name "${(await gen.textContent() || "").replace(/\s+/g, " ").trim().slice(0, 80)}"`);
        await gen.click();
        // Two separate waits, each recorded: the slot appearing proves the
        // click registered (rule 28 mounts it from the click); the band
        // clearing is the settle.  Collapsing them into one condition hid
        // which of the two never happened in the first two runs.
        // Does the click start a generation at all?  Recorded separately
        // from the slot, so "no slot" cannot be read as "no generation"
        // or the reverse.
        let slotSeen = false, bandSeen = false, firstSlotMs = null, firstBandMs = null;
        const t0 = Date.now();
        for (let i = 0; i < 40; i++) {
          if (!bandSeen && (await page.locator(".working-band").count())) { bandSeen = true; firstBandMs = Date.now() - t0; }
          if (!slotSeen && (await page.locator(".results-head-slot").count())) { slotSeen = true; firstSlotMs = Date.now() - t0; break; }
          await page.waitForTimeout(500);
        }
        check(`${vp}.generate.started`, bandSeen || slotSeen,
          `working band ${bandSeen ? "appeared at " + firstBandMs + " ms" : "never appeared"} · slot ${slotSeen ? "at " + firstSlotMs + " ms" : "never"}`);
        // Defensive: the CTA unmounts or swaps under the working-band lock,
        // so reading it after the click can hang.  A probe that blocks the
        // leg on its own instrumentation is worse than one that records
        // "unreadable".
        const afterName = await gen
          .textContent({ timeout: 2000 })
          .then((t) => (t || "").replace(/\s+/g, " ").trim())
          .catch(() => "(unreadable — the CTA is gone or locked)");
        check(`${vp}.generate.name-after-click`, null, `"${afterName.slice(0, 90)}"`);
        await L.shot(page, OUT, `after-click-${vp}`, true);
        check(`${vp}.reserve.mounts-on-click`, slotSeen, slotSeen
          ? "the reserved row mounted from the Generate click (rule 28)"
          : "no .results-head-slot within 20 s of the click");
        if (slotSeen) {
          let bandGone = false;
          for (let i = 0; i < 150; i++) {
            if (!(await page.locator(".working-band").count())) { bandGone = true; break; }
            await page.waitForTimeout(1000);
          }
          settled = bandGone;
          if (!bandGone) {
            const bandText = await page.locator(".working-band").first().innerText().catch(() => "(unreadable)");
            check(`${vp}.settle.band-still-up`, null, `after 150 s the band reads: ${bandText.replace(/\s+/g, " ").trim().slice(0, 160)}`);
          }
        }
      }
    } catch (e) { check(`${vp}.drive`, false, `drive threw: ${e.message.slice(0, 160)}`); }

    if (settled) {
      const slot = await page.evaluate(() => {
        const el = document.querySelector(".results-head-slot");
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          minHeight: cs.minHeight, height: Math.round(r.height * 10) / 10,
          marginBottom: cs.marginBottom, position: cs.position, zIndex: cs.zIndex,
          children: el.children.length,
          factH: getComputedStyle(document.querySelector(".workbench") || document.body).getPropertyValue("--fact-h").trim(),
        };
      });
      check(`${vp}.reserve.min-height`, slot && slot.minHeight === "44px", `min-height ${slot && slot.minHeight} (--fact-h resolves "${slot && slot.factH}")`);
      check(`${vp}.reserve.height-at-settle`, slot && slot.height >= 44, `measured height ${slot && slot.height}px at the settle`);
      check(`${vp}.reserve.gap`, slot && slot.marginBottom === "14px", `margin-bottom ${slot && slot.marginBottom} (rule 27's first gap)`);
      check(`${vp}.reserve.not-sticky`, slot && slot.position !== "sticky", `position ${slot && slot.position} (rule 32: only the nav)`);
      check(`${vp}.reserve.empty`, slot && slot.children === 0, `${slot && slot.children} child(ren) — the fact line lands with the container`);
      await L.shot(page, OUT, `settled-${vp}`, true);
    } else {
      check(`${vp}.settle`, null, "the generate did not settle — reserve rows not measured at this width");
    }

    const e = early.report(), l = late.report();
    const ce = classify(e), cl = classify(l);
    check(`${vp}.pageerror-zero`, e.counts.pageerror === 0,
      `${e.counts.pageerror} pageerror, ${e.counts.consoleError} console error(s)${e.counts.pageerror ? " | " + e.pageerrors.map(x => x.message).join(" ¦ ") : ""}`);
    check(`${vp}.hydration-zero`, ce.hydration.length === 0, `hydration-shaped: ${ce.hydration.length}`);
    check(`${vp}.tap-order`, null, `early ${ce.total} vs late ${cl.total} classified`);
    fs.writeFileSync(path.join(OUT, `taps-${vp}.json`), JSON.stringify({ early: e, late: l }, null, 1));
    await ctx.close();
  }
  await browser.close();
  await L.shaGate(log, EXPECT);
  check("gate.healthz-after", true, `healthz still ${EXPECT}`);
  log(`\nDONE — ${rows.length} rows, ${rows.filter(r => r.ok === false).length} FAIL`);
})().catch((e) => { log("LEG CRASHED " + e.stack); process.exit(3); });
