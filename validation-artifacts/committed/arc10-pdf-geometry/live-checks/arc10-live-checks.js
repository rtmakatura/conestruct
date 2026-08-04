/**
 * Arc 10 live-site verification — PDF geometry trio (#140 centerline,
 * #141 labels, #157 print-both) against https://www.conestruct.com/sandbox.
 * READ-ONLY: no accounts, no DB writes, no plan saves.  PDF downloads
 * are stateless renders through the page's own controls.  No route
 * interception.
 *
 * Checks (per the GO):
 *   A  Curved-road pin (Lookout Mountain Rd — the fixture spot), typed
 *      address, shoulder scenario: picker corridor-preview screenshot
 *      (the ribbon follows the curve), plan-sheet PDF downloaded via
 *      the page's own button.  The <15 ft deviation bar, the
 *      Centerline row, #141 labels/attribution, and #157 title-block
 *      text are all measured on that document by
 *      measure-served-pdf.py.
 *   B  Compat control: an off-road pin (Ferril Lake, City Park) where
 *      detection finds no road; bearing typed manually.  Still renders
 *      — chord path, no Centerline row (asserted by the helper).
 *
 * Absent-location control: a render with no pin is blocked by #186's
 * gate on prod (AWAITING LOCATION, Generate disabled) — there is no
 * path to an unlocated PDF, so the backend test
 * (test_plan_sheet_location.py::test_no_location_renders_dash_never_zeros)
 * carries the em-dash case.  Stated here, not forced.
 *
 * Run: EXPECTED_SHA=$(git rev-parse origin/main) \
 *      NODE_PATH=<scratch>/pw/node_modules node arc10-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = __dirname;
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

// The committed fixture's pin: a node ON Lookout Mountain Road.
const LOOKOUT = { lat: "39.74231", lng: "-105.23925" };
// Ferril Lake, City Park — open water, no highway way within snap range.
const OFFROAD = { lat: "39.74810", lng: "-104.95610" };

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push(`- \`${stamp}\` ${msg}`);
  console.log(`${stamp} ${msg}`);
}
function assert(name, cond, extra = "") {
  if (cond) log(`**PASS** — ${name}${extra ? ` (${extra})` : ""}`);
  else {
    failures++;
    log(`**FAIL** — ${name}${extra ? ` (${extra})` : ""}`);
  }
}

async function waitSettled(page, timeout = 90000) {
  await page.waitForFunction(
    () => {
      const s = document.querySelector(".status-bar")?.textContent ?? "";
      return !/VERIFYING|COMPUTING/.test(s);
    },
    null,
    { timeout },
  );
}
const strip = async (page) =>
  (await page.locator(".status-bar").first().textContent().catch(() => "")) ?? "";

async function openPickerWithCoords(page, coords) {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(coords.lat);
  await page.getByLabel("Longitude").fill(coords.lng);
}
async function waitDetection(page) {
  for (let i = 0; i < 40; i++) {
    const t = (
      (await page.getByRole("dialog").textContent().catch(() => "")) ?? ""
    ).replace(/\s+/g, " ");
    if (!/Detecting roads at pin|Classifying road/i.test(t)) return t;
    await page.waitForTimeout(1000);
  }
  return "";
}
async function pickAnyCandidate(page) {
  await waitDetection(page);
  const rows = page.locator("button", { hasText: "m from pin" });
  if ((await rows.count()) > 0) {
    const label = ((await rows.first().textContent()) ?? "").trim();
    await rows.first().click();
    log(`candidate picked: "${label}"`);
    return label;
  }
  log("candidate: (auto)");
  return null;
}
async function saveWhenReady(page) {
  const save = page.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++) {
    await page.waitForTimeout(1000);
  }
  if (!(await save.isEnabled().catch(() => false))) return false;
  await save.click();
  await page.waitForTimeout(800);
  return true;
}
async function downloadPdf(page, saveName) {
  const btn = page.getByRole("button", { name: "Download PDF" }).first();
  await btn.waitFor({ timeout: 30000 });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    btn.click(),
  ]);
  const dest = path.join(OUT, saveName);
  await dl.saveAs(dest);
  log(`downloaded: ${saveName} (${fs.statSync(dest).size} B)`);
  return dest;
}
async function generateAndWait(page) {
  const gen = page.getByRole("button", { name: /Generate/ }).first();
  await gen.click();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        /Download PDF/.test(b.textContent ?? ""),
      ),
    null,
    { timeout: 120000 },
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Build gate ────────────────────────────────────────────────────────
  const gate = await browser.newContext();
  const gp = await gate.newPage();
  const hz = await (
    await gp.request.get(
      "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz",
    )
  ).json();
  log(`healthz sha: ${hz.sha}`);
  log(`expected (git rev-parse origin/main): ${EXPECTED_SHA}`);
  await gp.goto(SITE, { waitUntil: "networkidle" });
  const chunkUrls = await gp.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]"))
      .map((s) => s.src)
      .filter((s) => s.includes("/_next/static")),
  );
  let servedSha = null;
  for (const u of chunkUrls) {
    const txt = await (await gp.request.get(u)).text();
    const m = txt.match(new RegExp(`${EXPECTED_SHA.slice(0, 7)}[0-9a-f]{33}`));
    if (m) {
      servedSha = m[0];
      break;
    }
  }
  log(`served bundle sha: ${servedSha}`);
  if (hz.sha !== EXPECTED_SHA || servedSha !== EXPECTED_SHA) {
    log("**ABORT** — build gate mismatch");
    process.exit(2);
  }
  assert("gate. healthz == origin/main == served bundle", true, hz.sha);
  await gate.close();

  // ── Context A — curved road (#140 + #141 + #157 document) ────────────
  lines.push("\n## Context A — Lookout Mountain Rd (curved), shoulder\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Shoulder work", { exact: true }).click();
    log("kind: shoulder work");

    // #157 typed string goes in "Location description" (#proj-location)
    // — run-3 finding: the ADDRESS field geocodes and lands the pin
    // (the issue's own "let the pin land there" behavior), which moved
    // the plan a mile down the road and out from under the
    // measurement's reference window.  The description field feeds the
    // same LOCATION row (location_description or address) without the
    // geocode side effect, so the pin stays under the picker's
    // control.  Both fields sit in the collapsed "Project details"
    // section.
    await page.getByRole("button", { name: /Project details/ }).click();
    await page.locator("#proj-location").fill("Lookout Mountain Road, Golden, CO");
    log('location description typed: "Lookout Mountain Road, Golden, CO"');

    await openPickerWithCoords(page, LOOKOUT);
    const picked = await pickAnyCandidate(page);
    assert(
      "1a. detection resolves Lookout Mountain Road at the fixture pin",
      picked !== null && /Lookout Mountain/i.test(picked),
      picked ?? "no candidate row",
    );
    // #140 UI preview: the corridor ribbon on the picker map follows
    // the curve.  Give the corridor-spec debounce + polyline a beat,
    // then Recenter — the map opens state-wide and the one-shot
    // auto-fit can fire before the ribbon exists (run-4 finding: the
    // first capture showed all of Colorado).
    await page.waitForTimeout(2500);
    const recenter = page.getByRole("button", { name: /recenter/i });
    if (await recenter.isVisible().catch(() => false)) await recenter.click();
    await page.waitForTimeout(3500);
    await page
      .getByRole("dialog", { name: "Define work zone" })
      .screenshot({ path: path.join(OUT, "01-picker-corridor-lookout.png") });
    log("screenshot: 01-picker-corridor-lookout.png (preview ribbon on the curve)");
    assert("1b. picker saved at the Lookout pin", await saveWhenReady(page));

    await page.waitForTimeout(700);
    await waitSettled(page);
    const s = await strip(page);
    assert(
      "1c. strip settles without refusal/invalid-input",
      !/PLAN DECLINED|INVALID INPUT/.test(s),
      s.replace(/\s+/g, " ").slice(0, 90),
    );
    await generateAndWait(page);
    log("generated — output cards on screen");
    await page.screenshot({ path: path.join(OUT, "02-lookout-post-generate.png"), fullPage: true });
    const pdfPath = await downloadPdf(page, "served-lookout-shoulder.pdf");
    assert(
      "1d. plan-sheet PDF downloaded through the page's own control",
      fs.statSync(pdfPath).size > 20000,
    );
    await ctx.close();
  }

  // ── Context B — compat control (no confirmed road) ───────────────────
  lines.push("\n## Context B — off-road pin, manual bearing (compat control)\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Shoulder work", { exact: true }).click();
    await openPickerWithCoords(page, OFFROAD);
    const t = await waitDetection(page);
    const noRoad = !/m from pin/.test(t);
    assert("2a. detection finds no road at the lake pin", noRoad, noRoad ? "zero candidates" : "unexpected candidate");
    // Manual bearing so the corridor (and its page-2 overlay) still
    // renders — as the pre-#140 chord, with no Centerline row.  The
    // picker's bearing input is the "0–359" placeholder field (run-2
    // finding: getByLabel(/bearing/i) matches the map's compass
    // button instead).
    const bearingField = page
      .getByRole("dialog", { name: "Define work zone" })
      .getByPlaceholder("0–359");
    if (await bearingField.isVisible().catch(() => false)) {
      await bearingField.fill("90");
      log("bearing typed manually: 90");
    } else {
      log("NOTE: no visible bearing field — corridor may be absent (honest absence)");
    }
    assert("2b. zero-candidate picker still saves", await saveWhenReady(page));
    await page.waitForTimeout(700);
    await waitSettled(page);
    const s = await strip(page);
    assert(
      "2c. strip settles without refusal/invalid-input",
      !/PLAN DECLINED|INVALID INPUT/.test(s),
      s.replace(/\s+/g, " ").slice(0, 90),
    );
    await generateAndWait(page);
    const pdfPath = await downloadPdf(page, "served-offroad-shoulder.pdf");
    assert("2d. compat PDF downloaded (no confirmed road, no error)", fs.statSync(pdfPath).size > 20000);
    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, "assertions-raw.md"), lines.join("\n") + "\n");
  console.log(`\nDONE — failures: ${failures}`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
