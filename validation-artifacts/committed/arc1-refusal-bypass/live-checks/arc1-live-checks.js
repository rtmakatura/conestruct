/**
 * Arc 1 live-site verification — checks 2 (#189) and 3 (#190).
 * Headless Chromium against https://www.conestruct.com/sandbox.
 * READ-ONLY: never clicks Generate, never saves a plan, no accounts.
 *
 * Outputs into ./out: screenshots + transcript.md (assertion log with
 * timestamps).  Exit code 0 only if every assertion passed.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const COLFAX = { lat: "39.73997", lng: "-104.96632" };
const PARK = { lat: "39.7312", lng: "-104.9665" }; // Cheesman Park lawn — no road within 30 m

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
async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  log(`screenshot: ${name}`);
}

async function openPickerWithCoords(page, coords) {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(coords.lat);
  await page.getByLabel("Longitude").fill(coords.lng);
}

const saveBtn = (page) => page.getByRole("button", { name: "Save & Close" });
const detectingNote = (page) => page.getByText("Detecting road…", { exact: false });
const speedRowInput = (page) =>
  page
    .locator(
      'xpath=//div[contains(@class,"min-h-[52px]")][contains(., "Speed limit (mph)")]//input[@type="number"]',
    )
    .first();

// If the pin returns multiple candidates, pick E Colfax (or the first).
async function pickCandidateIfAsked(page) {
  const header = page.getByText(/Which road\? · \d+ detected/);
  if (await header.isVisible().catch(() => false)) {
    const rows = page.locator("button", { hasText: "m from pin" });
    const colfax = rows.filter({ hasText: /colfax/i });
    const target = (await colfax.count()) > 0 ? colfax.first() : rows.first();
    const label = (await target.textContent())?.replace(/\s+/g, " ").trim();
    await target.click();
    log(`candidate picker shown; picked: "${label}"`);
    return true;
  }
  return false;
}

// Set a React-controlled range input (the form's #sh-speed slider).
async function setRange(page, selector, value) {
  await page.$eval(
    selector,
    (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    String(value),
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ======================================================================
  // CHECK 2 (#189) — Save disabled while classification resolves
  // ======================================================================
  lines.push("## Check 2 (#189) — Save disabled mid-detection\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Throttle the classification call so the resolving window is observable.
    await page.route("**/api/road-bearing", async (route) => {
      log("intercepted /api/road-bearing — delaying 3000 ms");
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await openPickerWithCoords(page, COLFAX);

    // Inside the delay window: note visible, Save disabled.
    await detectingNote(page).waitFor({ timeout: 2500 });
    assert("2a: 'Detecting road…' footer note visible while resolving", true);
    assert(
      "2b: Save & Close disabled while resolving",
      await saveBtn(page).isDisabled(),
    );
    await shot(page, "check2-mid-resolve.png");

    // Let it settle.
    await detectingNote(page).waitFor({ state: "hidden", timeout: 20000 });
    log("classification settled (note gone)");
    const picked = await pickCandidateIfAsked(page);
    if (picked)
      log(
        "note: Save was additionally gated by the #139 pick requirement until a road was chosen — expected, separate from #189",
      );
    await page.waitForTimeout(300);
    assert(
      "2c: Save & Close enabled once detection settled" +
        (picked ? " (after candidate pick)" : ""),
      await saveBtn(page).isEnabled(),
    );
    await shot(page, "check2-settled-enabled.png");

    // Settled-failure case: pin with no road within 30 m stays saveable.
    await page.getByLabel("Latitude").fill(PARK.lat);
    await page.getByLabel("Longitude").fill(PARK.lng);
    await detectingNote(page).waitFor({ timeout: 2500 }).catch(() => {});
    await page
      .getByText(/No road detected within 30 m/)
      .waitFor({ timeout: 20000 });
    assert("2d: zero-candidate settle reached (park pin)", true);
    assert(
      "2e: Save & Close stays enabled on a settled failure (only in-flight blocks)",
      await saveBtn(page).isEnabled(),
    );
    assert(
      "2f: note gone on settled failure",
      !(await detectingNote(page).isVisible().catch(() => false)),
    );
    await shot(page, "check2-settled-error-saveable.png");

    // Leave without saving — read-only.
    await page.getByRole("button", { name: "Cancel" }).click();
    await ctx.close();
  }

  // ======================================================================
  // CHECK 3 (#190) — no-change re-save preserves manual edits
  // ======================================================================
  lines.push("\n## Check 3 (#190) — re-save preserves manual edits\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await openPickerWithCoords(page, COLFAX);

    // Wait for detection to settle, pick a road if asked.
    await page
      .getByText(/Which road\?|Speed limit \(mph\)/)
      .first()
      .waitFor({ timeout: 30000 });
    await pickCandidateIfAsked(page);
    await speedRowInput(page).waitFor({ timeout: 10000 });
    const detected = await speedRowInput(page).inputValue();
    log(`detected/current picker speed value: "${detected}"`);

    // Picker override: 40.
    await speedRowInput(page).fill("40");
    await shot(page, "check3-picker-override-40.png");
    await saveBtn(page).click();
    await page.locator("#sh-speed").waitFor({ timeout: 10000 });
    assert(
      "3a: after first save, form speed is the picker override 40",
      (await page.locator("#sh-speed").inputValue()) === "40",
      `form value: ${await page.locator("#sh-speed").inputValue()}`,
    );
    await shot(page, "check3-form-after-save-40.png");

    // Manual refine to 25 in the form.
    await setRange(page, "#sh-speed", 25);
    assert(
      "3b: manual form edit lands (speed 25)",
      (await page.locator("#sh-speed").inputValue()) === "25",
    );
    await shot(page, "check3-form-manual-25.png");

    // Reopen, change nothing, Save & Close.
    await page.getByRole("button", { name: /Edit Location & Corridor/ }).click();
    await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
    const restored = await speedRowInput(page).inputValue();
    log(`reopened picker shows restored override: "${restored}" (expected 40)`);
    await shot(page, "check3-picker-reopened.png");
    await saveBtn(page).click();
    await page.locator("#sh-speed").waitFor({ timeout: 10000 });
    assert(
      "3c: THE assertion — no-change re-save preserves the manual 25 (pre-fix build reverted to 40)",
      (await page.locator("#sh-speed").inputValue()) === "25",
      `form value: ${await page.locator("#sh-speed").inputValue()}`,
    );
    await shot(page, "check3-form-preserved-25.png");

    // Negative control: change the override to 35; it must apply.
    await page.getByRole("button", { name: /Edit Location & Corridor/ }).click();
    await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
    await speedRowInput(page).fill("35");
    await shot(page, "check3-picker-override-35.png");
    await saveBtn(page).click();
    await page.locator("#sh-speed").waitFor({ timeout: 10000 });
    assert(
      "3d: control — a CHANGED override still applies (form reads 35)",
      (await page.locator("#sh-speed").inputValue()) === "35",
      `form value: ${await page.locator("#sh-speed").inputValue()}`,
    );
    await shot(page, "check3-form-control-35.png");

    log("no Generate click occurred at any point (read-only run)");
    await ctx.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(OUT, "assertions.md"),
    lines.join("\n") + `\n\n**Result: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}**\n`,
  );
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  lines.push(`\n**ABORTED**: ${err.stack}`);
  fs.writeFileSync(path.join(OUT, "assertions.md"), lines.join("\n"));
  console.error(err);
  process.exit(2);
});
