// #288 leg 3 — the FOUR-STATE leg at 65bc7e8.
//   node probe.js <outDir> <expectSha> [base]
//
// S5-with-items / S5-with-none, S6 declined, S8 reference open, at
// 1440x1000 and 380x800.  Builds on leg 2's harness, whose lessons are
// kept: the CTA is keyed on `button.generate-btn` (the rail's
// `.rail-entry.st-generate` is a READ and sorts first in the DOM), and no
// probe blocks the leg on its own instrumentation.
const ARC = "C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/issue-288-results-stack";
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const { attachErrorTaps, classify } = require(ARC + "/err-tap.js");
const { fs, path, chromium } = L;

const OUT = process.argv[2];
const EXPECT = process.argv[3];
const BASE = process.argv[4] || "https://www.conestruct.com";
// The fixture leg 2 reached candidates on at both widths.
const FIX = { lat: "39.71466", lng: "-104.94071", way: "39508704" };
fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (o) => { rows.push(o); fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1)); };
const check = (id, ok, d) => { rec({ id, ok, detail: d }); log(`${ok === null ? "INFO" : ok ? "PASS" : "FAIL"} ${id} — ${d}`); };

const pick = async (page, tag) => {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.waitForSelector("[role=dialog]", { timeout: 15000 });
  const dlg = page.locator("[role=dialog]");
  const manual = dlg.getByRole("button", { name: /Or enter coordinates manually|Hide coordinate/i });
  if (await manual.count()) {
    const t = await manual.first().textContent();
    if (/Or enter/i.test(t || "")) await manual.first().click();
  }
  await dlg.getByLabel("Latitude").fill(FIX.lat);
  await dlg.getByLabel("Longitude").fill(FIX.lng);
  await dlg.getByLabel("Longitude").blur();
  let cands = [];
  for (let i = 0; i < 70; i++) {
    cands = await dlg.locator("button", { hasText: /way \d+/ }).allTextContents().catch(() => []);
    if (cands.length) break;
    await page.waitForTimeout(500);
  }
  check(`${tag}.pick`, cands.length > 0, `${cands.length} candidate(s)`);
  if (!cands.length) return false;
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

const fillForm = async (page, workLen) => {
  for (const name of [/^Arterial$/, /^2$/, /^Single day$/]) {
    try {
      const b = page.getByRole("button", { name }).first();
      if (await b.count()) { await b.click(); await page.waitForTimeout(350); }
    } catch {}
  }
  if (workLen != null) {
    for (const lbl of [/work.*length/i, /length/i]) {
      try {
        const f = page.getByLabel(lbl).first();
        if (await f.count()) { await f.fill(String(workLen)); await f.blur(); break; }
      } catch {}
    }
  }
  await page.waitForTimeout(1200);
};

const generate = async (page, tag) => {
  const gen = page.locator("button.generate-btn").first();
  const name = ((await gen.textContent({ timeout: 4000 }).catch(() => "")) || "").replace(/\s+/g, " ").trim();
  check(`${tag}.cta`, !/blocked/i.test(name), `"${name}"`);
  await gen.scrollIntoViewIfNeeded();
  try {
    await gen.click({ timeout: 15000 });
  } catch (e) {
    const why = String(e.message).split(String.fromCharCode(10))[0].slice(0, 120);
    check(`${tag}.cta.click`, false, `the CTA did not accept a click in 15 s: ${why}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    if (await page.locator(".results-head-slot").count()) break;
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 180; i++) {
    if (!(await page.locator(".working-band").count())) return true;
    await page.waitForTimeout(1000);
  }
  return false;
};

/** The whole stack, read off the settled DOM in one pass. */
const READ = () => {
  const q = (s) => document.querySelector(s);
  const all = (s) => Array.from(document.querySelectorAll(s));
  const ny = q(".needs-you");
  const disc = q(".disc-head");
  return {
    needsYou: !!ny,
    nyCount: ny ? (q(".ny-count") ? q(".ny-count").textContent : null) : null,
    nyRows: all(".ny-item").length,
    nyChanged: all(".ny-item.is-changed").length,
    nyAttention: all(".ny-item.is-attention").length,
    nySub: q(".ny-sub") ? q(".ny-sub").textContent.replace(/\s+/g, " ").trim() : null,
    nyButtons: ny ? ny.querySelectorAll("button").length : null,
    nyCaretInHead: q(".ny-head") ? q(".ny-head").textContent.indexOf("\u203a") !== -1 : null,
    disclosure: !!disc,
    discOpen: disc ? disc.getAttribute("aria-expanded") : null,
    discCount: !!q(".disc-count"),
    discRead: disc ? disc.hasAttribute("data-read") : null,
    discWrite: disc ? disc.hasAttribute("data-write") : null,
    discPanel: !!q(".disc-panel"),
    discNameSize: q(".disc-name") ? getComputedStyle(q(".disc-name")).fontSize : null,
    slotH: q(".results-head-slot") ? Math.round(q(".results-head-slot").getBoundingClientRect().height) : null,
    refusal: !!q(".scan-refusal") || /PLAN DECLINED/i.test(document.body.textContent || ""),
    nsStrip: !!q(".ns-strip"),
  };
};

async function state(page, tag, opts) {
  await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  if (!(await pick(page, tag))) return null;
  // Armed BEFORE the form is filled.  The audit fires on input change
  // and the shell reuses that settled answer at Generate, so a route
  // armed at click time never sees the call that decides the verdict.
  // Routing only /audit/ leaves the picker's detection untouched, which
  // is why it can sit here and could not when the whole /api/render/
  // tree was routed (that refused the detection and left the CTA
  // un-clickable).  NOTE: an earlier splice of this file dropped this
  // call entirely, so two runs reported "S6 unreachable" against a
  // replay that was never armed.  The hook existed; nothing invoked it.
  if (opts.beforeGenerate) await opts.beforeGenerate();
  await fillForm(page, opts.workLen);
  if (opts.skipGenerate) {
    // S6 is reached WITHOUT a generate.  A declined audit gates the
    // CTA -- #180's input gating rides the backend 400 -- so the
    // refusal state exists before any generate and the click can never
    // land.  Two runs of this leg read that as 'the CTA did not accept
    // a click', which was the product working, not a defect.
    await page.waitForTimeout(3000);
    const gated = await page.locator('button.generate-btn').first()
      .isDisabled().catch(() => null);
    check(`${tag}.cta-gated`, gated !== false,
      `Generate disabled under the declined audit: ${gated} (#180)`);
    const rr = await page.evaluate(READ);
    await L.shot(page, OUT, `${tag}`, true);
    return rr;
  }
  const settled = await generate(page, tag);
  check(`${tag}.settle`, settled, settled ? "the pair settled" : "the band never cleared in 180 s");
  if (!settled) return null;
  const r = await page.evaluate(READ);
  await L.shot(page, OUT, `${tag}`, true);
  return r;
}

(async () => {
  await L.shaGate(log, EXPECT);
  check("gate.healthz", true, `healthz == ${EXPECT}`);
  const browser = await chromium.launch();

  for (const [vp, width, height] of [["1440", 1440, 1000], ["380", 380, 800]]) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const early = attachErrorTaps(page, "early");

    // S5
    const s5 = await state(page, `${vp}.S5`, { workLen: 200 });
    if (s5) {
      check(`${vp}.S5.strip-absent`, !s5.nsStrip, `.ns-strip present: ${s5.nsStrip}`);
      check(`${vp}.S5.reserve-44`, s5.slotH === 44, `reserved row height ${s5.slotH}px`);
      check(`${vp}.S5.which`, null,
        s5.needsYou
          ? `S5 WITH ITEMS — count "${s5.nyCount}", ${s5.nyRows} row(s): ${s5.nyChanged} changed, ${s5.nyAttention} attention`
          : `S5 WITH NONE — the block did not render (a clean plan)`);
      if (s5.needsYou) {
        check(`${vp}.S5.count-is-sum`, String(s5.nyRows) === s5.nyCount, `header "${s5.nyCount}" vs ${s5.nyRows} rows (ruling 185)`);
        check(`${vp}.S5.decomposition`, !!s5.nySub, `provenance: ${s5.nySub}`);
        check(`${vp}.S5.ruling-d-no-buttons`, s5.nyButtons === 0, `${s5.nyButtons} button(s) in the block`);
        check(`${vp}.S5.ruling-186-expanded`, s5.nyCaretInHead === false, `caret in the header: ${s5.nyCaretInHead}`);
      }
      // S8
      check(`${vp}.S8.row-mounted`, s5.disclosure, `reference disclosure present: ${s5.disclosure}`);
      check(`${vp}.S8.closed-in-S5`, s5.discOpen === "false", `aria-expanded ${s5.discOpen}`);
      check(`${vp}.S8.panel-absent-when-closed`, !s5.discPanel, `.disc-panel present: ${s5.discPanel}`);
      check(`${vp}.S8.uncounted`, !s5.discCount, `a numeral on the uncounted tier: ${s5.discCount}`);
      check(`${vp}.S8.rule-129-read`, s5.discRead === true && s5.discWrite === false, `data-read ${s5.discRead} · data-write ${s5.discWrite}`);
      check(`${vp}.S8.rule-88-name`, null, `.disc-name font-size "${s5.discNameSize}" — 13px lands with abb8cc0, NOT in this sha`);
      const before = s5.nyRows;
      if (s5.disclosure) {
        await page.locator(".disc-head").first().click();
        await page.waitForTimeout(800);
        const s8 = await page.evaluate(READ);
        check(`${vp}.S8.opens`, s8.discOpen === "true" && s8.discPanel, `aria-expanded ${s8.discOpen} · panel ${s8.discPanel}`);
        check(`${vp}.S8.nothing-above-moves`, s8.nyRows === before, `NEEDS YOU rows ${before} -> ${s8.nyRows}`);
        await L.shot(page, OUT, `${vp}.S8-open`, true);
      }
    }

    // S6 declined, by REPLAY and labelled as one.
    //
    // The first attempt drove an out-of-range work length, expecting a
    // backend 400.  It never reaches the backend: StatusBar's precedence
    // puts "invalid input" (the client bounds, #180) ABOVE "plan
    // declined", so an out-of-range length blocks the CTA and produces a
    // different state entirely.  A true S6 needs input the client accepts
    // and the backend refuses (a gate refusal, the geometry taper floor),
    // which prod will not produce on demand.
    //
    // So the backend's refusal is replayed at the network boundary: the
    // render/audit calls are answered with a real-shaped 400.  What this
    // measures is the FRONTEND's S6 behaviour -- spec 31 and rule 10, the
    // refusal container as the one voice -- against a refusal that did
    // not originate on this run.  It does not measure the backend.
    const REFUSAL =
      "Work zone geometry refused: taper length below the MUTCD floor for the posted speed.";
    const s6 = await state(page, `${vp}.S6`, {
      workLen: 200,
      skipGenerate: true,
      beforeGenerate: async () => {
        await page.route((u) => /audit/i.test(u.toString()), async (route) => {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ detail: REFUSAL }),
          });
        });
        check(`${vp}.S6.replay-armed`, null, "the AUDIT call is answered with a real-shaped 400 — the audit is what drives the declined verdict, not the bundle");
      },
    });
    await page.unroute((u) => /audit/i.test(u.toString()));
    if (s6) {
      check(`${vp}.S6.declined`, s6.refusal, `a refusal is on screen: ${s6.refusal}`);
      check(`${vp}.S6.no-needs-you`, !s6.needsYou, `NEEDS YOU beside the refusal: ${s6.needsYou} (spec 31, rule 10)`);
    }

    const e = early.report(); const ce = classify(e);
    check(`${vp}.pageerror-zero`, e.counts.pageerror === 0, `${e.counts.pageerror} pageerror, ${e.counts.consoleError} console error(s)`);
    check(`${vp}.hydration-zero`, ce.hydration.length === 0, `hydration-shaped: ${ce.hydration.length}`);
    fs.writeFileSync(path.join(OUT, `taps-${vp}.json`), JSON.stringify(e, null, 1));
    await ctx.close();
  }

  await browser.close();
  await L.shaGate(log, EXPECT);
  check("gate.healthz-after", true, `healthz still ${EXPECT}`);
  log(`\nDONE — ${rows.length} rows, ${rows.filter((r) => r.ok === false).length} FAIL`);
})().catch((e) => { log("LEG CRASHED " + e.stack); process.exit(3); });
