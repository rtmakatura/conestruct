/**
 * Arc 9 live-site verification — grayscale trio (#132 nav, #159 served
 * PDF, #144 stated-not-faked) against https://www.conestruct.com/sandbox.
 * READ-ONLY: no accounts, no DB writes, no plan saves.  PDF downloads
 * are stateless renders through the page's own controls.  No route
 * interception at all this arc.
 *
 * Checks (per the GO):
 *   1  nav: no animate-pulse / --pass-painted span; badge text present;
 *      screenshot for the grayscale pair (pre-fix prod shot is in the
 *      evidence pack).
 *   2  axe (wcag2a/aa + 21/22aa) post-generate: zero violations rooted
 *      in the nav (arc failure if any); non-nav findings reported as
 *      triage input.
 *   3  divided-road shoulder closure configured on prod, plan-sheet PDF
 *      downloaded via the page's own button; measured by
 *      measure-served-pdfs.py (hatch >90% of closed-band columns,
 *      <5% open, fills unchanged).
 *   4  flagger PDF regression glance (no hatch where none belongs) —
 *      also measured by the python helper.
 *   5  #144 PCMS: stated in the transcript, not faked (emission retired
 *      per #142; glyph-level backend test is the verification of
 *      record).  No browser check exists for a device that cannot
 *      render.
 *
 * Run: EXPECTED_SHA=$(git rev-parse origin/main) \
 *      NODE_PATH=<scratch>/pw/node_modules node arc9-live-checks.js
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out9");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" }; // Arc 5 control pin
const PARK = { lat: "39.7312", lng: "-104.9665" }; // Arc 8 quiet pin

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
async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: full });
  log(`screenshot: ${name}`);
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
async function pickAnyCandidate(page) {
  for (let i = 0; i < 40; i++) {
    const t = (
      (await page.getByRole("dialog").textContent().catch(() => "")) ?? ""
    ).replace(/\s+/g, " ");
    if (!/Detecting roads at pin|Classifying road/i.test(t)) break;
    await page.waitForTimeout(1000);
  }
  const rows = page.locator("button", { hasText: "m from pin" });
  if ((await rows.count()) > 0) {
    const label = ((await rows.first().textContent()) ?? "").trim();
    await rows.first().click();
    log(`candidate picked: "${label}"`);
  } else log("candidate: (auto)");
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
      document.querySelectorAll("button").length > 0 &&
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

  // ── Context A — #132 nav ─────────────────────────────────────────────
  lines.push("\n## Context A — #132 nav (no hue-only status chrome)\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "networkidle" });
    const nav = page.locator("nav").first();
    const badge = await nav.getByText(/MUTCD 2023 · CDOT/).count();
    assert("1a. edition badge text present in nav", badge === 1);
    const pulses = await nav.locator(".animate-pulse").count();
    assert("1b. no animate-pulse element in nav", pulses === 0, `count ${pulses}`);
    const painted = await nav.evaluate((el) =>
      Array.from(el.querySelectorAll("span")).filter(
        (s) => s.textContent === "" && /bg-\[/.test(s.className),
      ).length,
    );
    assert("1c. no empty color-painted span in nav", painted === 0, `count ${painted}`);
    await nav.screenshot({ path: path.join(OUT, "01-nav-post-fix-color.png") });
    log("screenshot: 01-nav-post-fix-color.png (grayscale pair built by helper)");
    await ctx.close();
  }

  // ── Context B — #159 served shoulder PDF + axe post-generate ────────
  lines.push("\n## Context B — #159 divided shoulder closure, served PDF\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Shoulder work", { exact: true }).click();
    log("kind: shoulder work");

    await openPickerWithCoords(page, LAKEWOOD);
    await pickAnyCandidate(page);
    assert("3a. picker saved at the Lakewood control pin", await saveWhenReady(page));

    // Road type AFTER the pin so detection's road-type handoff cannot
    // overwrite the divided choice (divided derives from road type, #85).
    const rtSel = page
      .locator("select", { has: page.locator('option:text("Rural — divided hwy")') })
      .first();
    await rtSel.selectOption({ label: "Rural — divided hwy" });
    // Run-1 finding: Wadsworth detection hands off 4 lanes/direction and
    // 4×12ft + 10ft shoulder honestly fails the 52-ft drawable-width
    // input check (INVALID INPUT, Generate disabled — working as
    // designed).  Set lanes to 2 for a drawable divided sheet.
    const lanesField = page
      .locator("div")
      .filter({ has: page.getByText("Lanes per direction", { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "2", exact: true }) })
      .last();
    await lanesField.getByRole("button", { name: "2", exact: true }).click();
    log("lanes per direction set to 2 (run-1 drawable-width finding)");
    await page.waitForTimeout(700);
    await waitSettled(page);
    const s = await strip(page);
    assert("3b. strip settles on a verdict (no refusal) for the divided shoulder closure", !/PLAN DECLINED|INVALID INPUT/.test(s), s.replace(/\s+/g, " ").slice(0, 90));

    await generateAndWait(page);
    log("generated — output cards on screen");
    await shot(page, "02-shoulder-post-generate.png", true);

    // Axe post-generate, BEFORE the download click: run 2 scanned after
    // it and caught the first card's button in its transient dimmed
    // "downloading" state (a scan-order artifact — the settled button
    // computes rgb(86,188,242) on rgb(20,32,46) and the flagger
    // post-generate surface scans zero violations at this same sha).
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const compact = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(" ")),
    }));
    fs.writeFileSync(path.join(OUT, "axe-post-generate.json"), JSON.stringify(compact, null, 2));
    const navHits = compact.filter((v) => v.targets.some((t) => /(^|\s|>)nav/.test(t)));
    assert("2a. zero axe violations rooted in the nav (touched surface)", navHits.length === 0, JSON.stringify(navHits));
    assert("2b. Arc 7 zero-violation post-generate baseline holds", compact.length === 0, compact.length ? `${compact.length} finding(s) — see axe-post-generate.json (triage input if non-nav)` : "0 violations");

    const pdfPath = await downloadPdf(page, "served-shoulder-divided.pdf");
    assert("3c. plan-sheet PDF downloaded through the page's own control", fs.statSync(pdfPath).size > 20000);
    await ctx.close();
  }

  // ── Context C — #159 flagger regression glance ───────────────────────
  lines.push("\n## Context C — flagger PDF regression glance\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Flagger lane closure", { exact: true }).click();
    await openPickerWithCoords(page, PARK);
    await pickAnyCandidate(page);
    assert("4a. picker saved at the quiet Park pin", await saveWhenReady(page));
    await page.waitForTimeout(700);
    await waitSettled(page);
    const s = await strip(page);
    assert("4b. flagger settles clean at the quiet pin", !/PLAN DECLINED|INVALID INPUT/.test(s), s.replace(/\s+/g, " ").slice(0, 90));
    await generateAndWait(page);
    const pdfPath = await downloadPdf(page, "served-flagger.pdf");
    assert("4c. flagger PDF downloaded", fs.statSync(pdfPath).size > 20000);
    await ctx.close();
  }

  // ── #144 — stated, not faked ─────────────────────────────────────────
  lines.push("\n## #144 — PCMS (stated, not faked)\n");
  log(
    "#144: PCMS emission is retired (#142 — site_adjustments no longer stamps it), so no production PDF can contain the PCMS glyph and no live check can exercise it without synthesizing a fake document. The verification of record is tests/test_plan_sheet_grayscale.py::TestPcmsGlyphDistinct, which renders both glyphs through the production _DEVICE_GLYPHS mapping and measures the grayscale split.",
  );

  fs.writeFileSync(path.join(OUT, "assertions-raw.md"), lines.join("\n") + "\n");
  console.log(`\nDONE — failures: ${failures}`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
