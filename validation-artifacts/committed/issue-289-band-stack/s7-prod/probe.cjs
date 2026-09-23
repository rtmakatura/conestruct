// #289 Phase 2, S7 — the prod acceptance leg.
//
// Drives the REAL deployed /sandbox (the verification gate: a suite is
// not evidence that a surface works).  Captures, at both widths:
//
//   · the panel's four situations 7a / 7b / 7c / 7d, with the real
//     preview request recorded off the wire;
//   · APPLY folding a staged FIELD and a staged CORRECTION into ONE
//     write;
//   · DISCARD firing ZERO requests;
//   · CHANGE SOMETHING ELSE returning to the column.
//
// Output goes OUTSIDE the repo; the evidence commit carries the summary.

const path = require("path");
const fs = require("fs");
const { chromium } = require(
  "C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright",
);

const SITE = "https://www.conestruct.com/sandbox";
const OUT = __dirname;
// A pin whose detection settles fast and cleanly.  It reports NO road
// at the point, which is a legitimate outcome and is stated in the
// evidence: S7 is about the revision panel, and a confirmed road changes
// none of its claims.  The E Colfax pin needs a candidate picked off the
// map canvas — the picker's own decision work, whose migration #189
// defers past Phase 2 — which a headless leg cannot drive honestly.
// E Colfax mid-block: the pin the arc has used throughout.  Detection
// returns several candidates and the operator picks one — the picker's
// own decision work, which #189 keeps in the modal for Phase 2 — so the
// leg picks the first candidate exactly as a user does.  A confirmed
// road is what makes the site scan run, and the scan is what gives
// NEEDS YOU a stageable row: without one there is no CORRECTION half to
// fold, and this leg has to prove APPLY folds both.
const PIN = { lat: "39.74020", lng: "-104.95600" };

const log = [];
function say(s) {
  console.log(s);
  log.push(s);
}

async function shot(page, name) {
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f, fullPage: false });
  return path.basename(f);
}

/** Every request the page makes, with the bits that matter. */
function recorder(page) {
  const seen = [];
  page.on("request", (r) => {
    if (!r.url().includes("/api/render/")) return;
    let body = {};
    try {
      body = JSON.parse(r.postData() ?? "{}");
    } catch {}
    seen.push({
      url: r.url().replace(/^https:\/\/[^/]+/, ""),
      preview: body?.scenario?.preview === true,
      speed: body?.scenario?.speed,
      siteConditions: body?.scenario?.meta?.siteConditions ?? null,
      // The wire carries an ARRAY of override records; read the entries,
      // not the indices (the first pass printed ["0"], which is
      // Object.keys of an array — a reading defect, not a wire one).
      overrides: (() => {
        const o = body?.scenario?.meta?.siteConditionOverrides;
        if (Array.isArray(o)) return o.map((x) => `${x.flag}:${x.action}`);
        return Object.keys(o ?? {});
      })(),
    });
  });
  return seen;
}

async function pinAndGenerate(page) {
  // Prod carries a Mapbox token, so the WHERE band offers the PICKER and
  // not the manual fallback.  The picker's own "+ Or enter coordinates
  // manually" is the no-map route to a pin, which is what a headless run
  // can drive honestly — the map itself is #189's deferred migration and
  // not what S7 is about.
  await page.getByRole("button", { name: /Pick Location on Map/ }).click();
  await page.waitForTimeout(3500);
  await page
    .getByRole("button", { name: /enter coordinates manually/i })
    .click();
  await page.waitForTimeout(1200);
  // The picker's manual pair are TEXT inputs, named by their
  // placeholders — captured off the live surface rather than assumed.
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
  await page.waitForTimeout(2500);
  // Detection runs off the typed pin.  Wait for the candidate list, then
  // pick the first road — the modal's own decision, made the way a user
  // makes it.
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page
    .locator("button")
    .filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ })
    .first();
  for (let i = 0; i < 90; i += 1) {
    if ((await candidate.count()) > 0 || (await save.isEnabled())) break;
    await page.waitForTimeout(1000);
  }
  if ((await candidate.count()) > 0) {
    await candidate.click();
    await page.waitForTimeout(2500);
  }
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) {
    await page.waitForTimeout(1000);
  }
  await page.getByRole("button", { name: /Save & Close/ }).click();
  await page.waitForTimeout(3000);

  const len = page.locator("#band-worklen");
  if (await len.count()) {
    await len.fill("1000");
    await len.blur();
  }
  await page.waitForTimeout(1500);
  const gen = page.getByRole("button", { name: /Generate plan/ });
  await gen.click();
  await page.waitForSelector('[data-testid="fact-setup"]', { timeout: 90000 });
  await page.waitForTimeout(2000);
}

async function openRevision(page) {
  await page.locator('[data-testid="fact-link-setup"]').click();
  await page.waitForSelector('[data-testid="revision-panel"]', { timeout: 15000 });
}

async function panelState(page) {
  return page.locator('[data-testid="revision-panel"]').getAttribute("data-preview");
}

async function statusLine(page) {
  return (await page.locator('[data-testid="panel-status"]').textContent()) ?? "";
}

async function run(width, height, tag) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const seen = recorder(page);
  const result = { width, shots: {}, checks: {} };

  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await pinAndGenerate(page);
  say(`[${tag}] generated`);

  // ── 7a — no request fired for the value in the field ──────────────
  await openRevision(page);
  result.checks["7a_state"] = await panelState(page);
  result.checks["7a_status"] = await statusLine(page);
  result.checks["7a_rows"] = await page
    .locator('[data-testid^="panel-row-"]')
    .count();
  result.shots["7a"] = await shot(page, `${tag}-7a-idle`);
  say(`[${tag}] 7a state=${result.checks["7a_state"]} rows=${result.checks["7a_rows"]}`);

  // ── 7b — in flight (hold the preview open) ────────────────────────
  let release;
  const held = new Promise((r) => (release = r));
  await page.route("**/api/render/device-breakdown", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body?.scenario?.preview === true) {
      result.checks["preview_request"] = {
        url: route.request().url().replace(/^https:\/\/[^/]+/, ""),
        preview: true,
        speed: body.scenario.speed,
      };
      await held;
    }
    await route.continue();
  });
  const before7b = seen.length;
  await page.selectOption("#revise-speed", "35");
  await page.waitForTimeout(700);
  result.checks["7b_state"] = await panelState(page);
  result.checks["7b_status"] = await statusLine(page);
  result.checks["7b_footer"] = await page
    .locator('[data-testid="revise-sentence"]')
    .textContent();
  result.shots["7b"] = await shot(page, `${tag}-7b-loading`);
  say(`[${tag}] 7b state=${result.checks["7b_state"]}`);

  release();
  await page.waitForTimeout(2500);
  await page.unroute("**/api/render/device-breakdown");

  // ── 7c — landed ───────────────────────────────────────────────────
  result.checks["7c_state"] = await panelState(page);
  result.checks["7c_status"] = await statusLine(page);
  result.checks["7c_note"] = await page
    .locator('[data-testid="panel-note"]')
    .textContent();
  result.checks["7c_taper"] = await page
    .locator('[data-testid="panel-row-taper"]')
    .textContent();
  result.checks["7c_verdict"] = await page
    .locator('[data-testid="panel-row-verdict"]')
    .textContent();
  result.checks["7c_needs_you"] = await page
    .locator('[data-testid="panel-row-needs-you"]')
    .textContent();
  result.shots["7c"] = await shot(page, `${tag}-7c-ready`);
  // What the preview asked for, off the wire.
  result.checks["preview_requests_only_breakdown"] = seen
    .slice(before7b)
    .every((r) => r.url.includes("device-breakdown") || !r.preview);
  say(`[${tag}] 7c state=${result.checks["7c_state"]}`);

  // ── 7d — failed ───────────────────────────────────────────────────
  await page.route("**/api/render/device-breakdown", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body?.scenario?.preview === true) {
      await route.fulfill({ status: 500, body: "{}" });
      return;
    }
    await route.continue();
  });
  await page.selectOption("#revise-speed", "45");
  await page.waitForTimeout(2500);
  result.checks["7d_state"] = await panelState(page);
  result.checks["7d_status"] = await statusLine(page);
  result.checks["7d_footer"] = await page
    .locator('[data-testid="revise-sentence"]')
    .textContent();
  result.checks["7d_apply_enabled"] = await page
    .locator('[data-testid="revise-apply"]')
    .isEnabled();
  result.shots["7d"] = await shot(page, `${tag}-7d-error`);
  await page.unroute("**/api/render/device-breakdown");
  say(`[${tag}] 7d state=${result.checks["7d_state"]}`);

  // ── DISCARD fires zero requests ───────────────────────────────────
  const beforeDiscard = seen.length;
  await page.locator('[data-testid="revise-discard"]').click();
  await page.waitForTimeout(2500);
  result.checks["discard_requests"] = seen.length - beforeDiscard;
  result.checks["discard_closed_panel"] =
    (await page.locator('[data-testid="revision-panel"]').count()) === 0;
  result.shots["discard"] = await shot(page, `${tag}-after-discard`);
  say(`[${tag}] discard requests=${result.checks["discard_requests"]}`);

  // ── CHANGE SOMETHING ELSE returns to the column ───────────────────
  await openRevision(page);
  const beforeElse = seen.length;
  await page.locator('[data-testid="revise-open-column"]').click();
  await page.waitForTimeout(1500);
  result.checks["column_back"] =
    (await page.locator('[data-testid="band-stack"]').count()) > 0;
  result.checks["else_requests"] = seen.length - beforeElse;
  result.shots["column"] = await shot(page, `${tag}-change-something-else`);
  say(`[${tag}] column back=${result.checks["column_back"]}`);

  // ── APPLY folds a staged FIELD and a staged CORRECTION ────────────
  // Stage a manual site condition first (NEEDS YOU's ASSERT rows), then
  // a field, then APPLY once.
  const assertRow = page.locator('[data-testid^="assert-"]').first();
  let stagedCorrection = false;
  if (await assertRow.count()) {
    await assertRow.click();
    stagedCorrection = true;
  } else {
    const anyAssert = page.getByRole("button", { name: /^Assert$/ }).first();
    if (await anyAssert.count()) {
      await anyAssert.click();
      stagedCorrection = true;
    }
  }
  await page.waitForTimeout(800);
  await openRevision(page);
  await page.selectOption("#revise-speed", "40");
  await page.waitForTimeout(2500);
  result.checks["apply_sentence"] = await page
    .locator('[data-testid="revise-sentence"]')
    .textContent();
  result.shots["staged"] = await shot(page, `${tag}-staged-both`);

  const beforeApply = seen.length;
  await page.locator('[data-testid="revise-apply"]').click();
  await page.waitForTimeout(6000);
  const applyCalls = seen.slice(beforeApply).filter((r) => !r.preview);
  result.checks["staged_correction"] = stagedCorrection;
  result.checks["apply_writes"] = applyCalls.map((r) => ({
    url: r.url,
    speed: r.speed,
    siteConditions: r.siteConditions,
    overrides: r.overrides,
  }));
  result.checks["apply_breakdown_count"] = applyCalls.filter((r) =>
    r.url.includes("device-breakdown"),
  ).length;
  result.shots["applied"] = await shot(page, `${tag}-after-apply`);
  say(`[${tag}] apply writes=${result.checks["apply_breakdown_count"]}`);

  result.requests = seen;
  await browser.close();
  return result;
}

(async () => {
  const out = { site: SITE, at: new Date().toISOString(), runs: {} };
  out.runs["1440"] = await run(1440, 900, "1440");
  out.runs["380"] = await run(380, 780, "380");
  fs.writeFileSync(
    path.join(OUT, "s7-prod.json"),
    JSON.stringify(out, null, 2),
  );
  fs.writeFileSync(path.join(OUT, "s7-prod.log"), log.join("\n") + "\n");
  console.log("WROTE", path.join(OUT, "s7-prod.json"));
})().catch((e) => {
  console.error("FAILED", e.message);
  fs.writeFileSync(
    path.join(OUT, "s7-prod.log"),
    log.join("\n") + "\nFAILED " + e.stack + "\n",
  );
  process.exit(1);
});
