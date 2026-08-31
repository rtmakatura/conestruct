/** s2-arc11 live checks (Refs #228) — READ-ONLY, PROD run against the
 *  deployed site (post-ship re-run of the committed local checks;
 *  same sections R1–R6, same assertions).
 *
 *  Sections:
 *   R1  pre-pin rail: step indexes 02–05 visible, ◌ + "pending" on
 *       every downstream entry, Location carries the blocker verbatim
 *       and the "(current blocker)" aria suffix, one ⚠ only; register
 *       computed letter-spacing = 1.4px (0.14em @ 10px, ruling 3).
 *       Captures + grayscale.
 *   R2  pinned (manual-entry Denver pin): Location — done; Schedule ◌
 *       "optional · not set"; capture.
 *   R3  count subline at the Denver pin: the live suggest round-trip
 *       reads "1 to confirm" on Location (aria "Location — done · 1 to
 *       confirm"); Dismiss removes ONLY the line (dismiss-honesty,
 *       PDF p.4).  Captures both states.
 *   R4  duration subline: Single day → "1 day"; Date range 09-01 →
 *       09-04 → "4 days" (inclusive), aria "Schedule — done · 4 days".
 *   R5  stale end to end (the live path): real picker detection at the
 *       E Bayaud pin (Overpass; fails honestly if unreachable), pick
 *       Bayaud, Save & Close → Road done (fresh road); then the
 *       post-pin "Edit manually" fallback moves Latitude — the pin no
 *       longer matches meta.confirmedRoad's staleness key → Road
 *       renders ▲ "detection stale" in --dim rgb(255,138,46).
 *       Captures fresh + stale + grayscale.
 *   R6  axe (arc16 injection idiom) pre-pin + pinned: violation id
 *       sets EQUAL the committed baseline ([region] / [label, region])
 *       — zero new.
 *
 *  No saves, no DB writes; all state is client state on a dev server.
 *
 *  Run (repo root node_modules carries playwright):
 *    set NODE_PATH=C:\Users\rtmak\Documents\traffic-control-tool\node_modules
 *    node s2a11-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A11Prod");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "https://www.conestruct.com/sandbox";
const AXE_SRC = fs.readFileSync(
  path.join(
    "C:\\Users\\rtmak\\Documents\\traffic-control-tool",
    "conestruct", "site", "node_modules", "axe-core", "axe.min.js",
  ),
  "utf-8",
);

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push(`- \`${stamp}\` ${msg}`);
  console.log(`${stamp} ${msg}`);
}
function assert(name, cond, extra = "") {
  if (!cond) failures++;
  log(`${cond ? "**PASS**" : "**FAIL**"} — ${name}${extra ? ` (${extra})` : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  log(`screenshot: ${name}`);
}
async function grayShot(page, name) {
  await page.evaluate(() => {
    document.documentElement.style.filter = "grayscale(1)";
  });
  await shot(page, name);
  await page.evaluate(() => {
    document.documentElement.style.filter = "";
  });
}

async function pinManually(page) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    const input = page
      .locator(`label:text-is("${labelText}")`)
      .locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  await fill("Latitude", "39.714660");
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", "-104.940710");
  await fill("Bearing (° from N)", "85");
  await fill("Work zone (ft)", "400");
  await page.waitForTimeout(400);
}

function railEntry(page, label) {
  return page.locator(".progress-rail .rail-entry", {
    has: page.locator(`.rail-label:text-is("${label}")`),
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  log("— R1: pre-pin rail —");
  await page.goto(BASE, { waitUntil: "networkidle" });
  const steps = await page
    .locator(".progress-rail .rail-step")
    .allTextContents();
  assert(
    "R1 step indexes 02–05, zero-padded, in order",
    JSON.stringify(steps) === JSON.stringify(["02", "03", "04", "05"]),
    steps.join(","),
  );
  const locAria = await railEntry(page, "Location").getAttribute("aria-label");
  assert(
    "R1 Location aria carries the blocker verbatim + (current blocker)",
    locAria ===
      "Location — needs attention: Set a location first — pick on map or enter manually. (current blocker)",
    locAria ?? "null",
  );
  const roadAria = await railEntry(page, "Road").getAttribute("aria-label");
  assert(
    "R1 Road aria byte-identical pre-arc format",
    roadAria === "Road — pending — set a location first",
    roadAria ?? "null",
  );
  const roadWord = await railEntry(page, "Road")
    .locator(".rail-note")
    .textContent();
  assert("R1 Road visible word 'pending'", roadWord === "pending", roadWord);
  const warnCount = await page
    .locator(".progress-rail .rail-glyph", { hasText: "⚠" })
    .count();
  assert("R1 exactly one ⚠ pre-pin (the location blocker)", warnCount === 1);
  const tracking = await page
    .locator(".progress-rail .rail-entry")
    .first()
    .evaluate((el) => getComputedStyle(el).letterSpacing);
  assert(
    "R1 register letter-spacing 1.4px (0.14em @ 10px, ruling 3)",
    tracking === "1.4px",
    tracking,
  );
  await shot(page, "r1-prepin.png");
  await grayShot(page, "r1-prepin-grayscale.png");

  log("— R2: pinned —");
  await pinManually(page);
  assert(
    "R2 Location — done",
    (await railEntry(page, "Location").getAttribute("aria-label")).startsWith(
      "Location — done",
    ),
  );
  const schedWord = await railEntry(page, "Schedule")
    .locator(".rail-note")
    .textContent();
  assert(
    "R2 Schedule word 'optional · not set' (sheeted p.5)",
    schedWord === "optional · not set",
    schedWord,
  );
  const schedGlyph = await railEntry(page, "Schedule")
    .locator(".rail-glyph")
    .textContent();
  assert("R2 Schedule glyph ◌", schedGlyph === "◌", schedGlyph);
  await shot(page, "r2-pinned.png");

  log("— R3: the count subline + dismiss-honesty —");
  await page.waitForFunction(
    () => {
      const btn = Array.from(
        document.querySelectorAll(".progress-rail .rail-entry"),
      ).find((b) => b.getAttribute("aria-label")?.startsWith("Location — "));
      return (
        btn?.getAttribute("aria-label") === "Location — done · 1 to confirm"
      );
    },
    null,
    { timeout: 30000 },
  );
  assert("R3 live suggest → 'Location — done · 1 to confirm'", true);
  const infoText = await railEntry(page, "Location")
    .locator(".rail-info")
    .textContent();
  assert("R3 visible info line '1 to confirm'", infoText === "1 to confirm");
  await shot(page, "r3-count.png");
  const classesBefore = await page
    .locator(".progress-rail .rail-entry")
    .evaluateAll((els) => els.map((e) => e.className));
  await page.getByRole("button", { name: "Dismiss" }).first().click();
  await page.waitForFunction(
    () => {
      const btn = Array.from(
        document.querySelectorAll(".progress-rail .rail-entry"),
      ).find((b) => b.getAttribute("aria-label")?.startsWith("Location — "));
      return btn?.getAttribute("aria-label") === "Location — done";
    },
    null,
    { timeout: 5000 },
  );
  const classesAfter = await page
    .locator(".progress-rail .rail-entry")
    .evaluateAll((els) => els.map((e) => e.className));
  assert(
    "R3 dismiss-honesty: only the count line moved — every entry's state class unchanged",
    JSON.stringify(classesBefore) === JSON.stringify(classesAfter),
  );
  assert(
    "R3 no info line after dismiss",
    (await railEntry(page, "Location").locator(".rail-info").count()) === 0,
  );
  await shot(page, "r3-dismissed.png");

  log("— R4: the duration subline —");
  await page.getByRole("button", { name: "Single day", exact: true }).click();
  await page.locator("#sched-date").fill("2026-09-01");
  await page.waitForFunction(
    () => {
      const btn = Array.from(
        document.querySelectorAll(".progress-rail .rail-entry"),
      ).find((b) => b.getAttribute("aria-label")?.startsWith("Schedule — "));
      return btn?.getAttribute("aria-label") === "Schedule — done · 1 day";
    },
    null,
    { timeout: 5000 },
  );
  assert("R4 single day → 'Schedule — done · 1 day'", true);
  await page.getByRole("button", { name: "Date range", exact: true }).click();
  await page.locator("#sched-date-end").fill("2026-09-04");
  await page.waitForFunction(
    () => {
      const btn = Array.from(
        document.querySelectorAll(".progress-rail .rail-entry"),
      ).find((b) => b.getAttribute("aria-label")?.startsWith("Schedule — "));
      return btn?.getAttribute("aria-label") === "Schedule — done · 4 days";
    },
    null,
    { timeout: 5000 },
  );
  assert("R4 range 09-01→09-04 → 'Schedule — done · 4 days' (inclusive)", true);
  const schedGlyphDone = await railEntry(page, "Schedule")
    .locator(".rail-glyph")
    .textContent();
  assert("R4 Schedule glyph flips to ✓", schedGlyphDone === "✓");
  await shot(page, "r4-duration.png");

  log("— R5: stale end to end (real picker + the Edit-manually move) —");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pick Location on Map/i }).click();
  await page
    .getByRole("button", { name: /Or enter coordinates manually/i })
    .click();
  await page.getByLabel("Latitude", { exact: true }).fill("39.71466");
  await page.getByLabel("Longitude", { exact: true }).fill("-104.94071");
  await page.waitForFunction(
    () => {
      const bayaud = Array.from(document.querySelectorAll("button")).some(
        (b) => /Bayaud/.test(b.textContent ?? ""),
      );
      const save = Array.from(document.querySelectorAll("button")).find((b) =>
        /Save & Close/.test(b.textContent ?? ""),
      );
      return bayaud || (save && !save.disabled);
    },
    null,
    { timeout: 60000 },
  );
  const bayaud = page.locator("button", { hasText: /Bayaud/ }).first();
  if ((await bayaud.count()) > 0) await bayaud.click();
  await page.waitForFunction(
    () => {
      const save = Array.from(document.querySelectorAll("button")).find((b) =>
        /Save & Close/.test(b.textContent ?? ""),
      );
      return save && !save.disabled;
    },
    null,
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: /Save & Close/ }).click();
  await page.waitForTimeout(600);
  // The Bayaud pin's relayed OSM lane tags contradict each other
  // beside the signal (#173 refusal, a REAL blocker) — apply the
  // pointer's own remedy (set Lanes per direction) so the entry can
  // settle to done before the staleness move.  attention outranking
  // stale is exactly the ruled rank; asserted implicitly here.
  const afterSave = await railEntry(page, "Road").getAttribute("aria-label");
  if (afterSave !== "Road — done") {
    log(`R5 refusal on save (expected at this pin): ${afterSave}`);
    await page
      .locator(
        'xpath=//div[normalize-space()="Lanes per direction"]/following-sibling::div[1]//button[normalize-space()="1"]',
      )
      .click();
  }
  await page.waitForFunction(
    () => {
      const btn = Array.from(
        document.querySelectorAll(".progress-rail .rail-entry"),
      ).find((b) => b.getAttribute("aria-label")?.startsWith("Road — "));
      return btn?.getAttribute("aria-label") === "Road — done";
    },
    null,
    { timeout: 30000 },
  );
  assert(
    "R5 fresh confirmed road: Road — done (never stale at its own pin)",
    true,
  );
  await shot(page, "r5-fresh.png");
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  const latInput = page
    .locator('label:text-is("Latitude")')
    .locator("xpath=following-sibling::input[1]");
  await latInput.fill("39.724660");
  await page.waitForFunction(
    () => {
      const btn = Array.from(
        document.querySelectorAll(".progress-rail .rail-entry"),
      ).find((b) => b.getAttribute("aria-label")?.startsWith("Road — "));
      return btn?.getAttribute("aria-label") === "Road — detection stale";
    },
    null,
    { timeout: 5000 },
  );
  assert("R5 moved pin → 'Road — detection stale'", true);
  const staleEntry = railEntry(page, "Road");
  assert(
    "R5 st-stale class on the entry",
    ((await staleEntry.getAttribute("class")) ?? "").includes("st-stale"),
  );
  const staleGlyph = await staleEntry.locator(".rail-glyph").textContent();
  assert("R5 ▲ glyph", staleGlyph === "▲", staleGlyph);
  const staleWord = await staleEntry.locator(".rail-note").textContent();
  assert("R5 word 'detection stale'", staleWord === "detection stale");
  const staleColor = await staleEntry
    .locator(".rail-glyph")
    .evaluate((el) => getComputedStyle(el).color);
  assert(
    "R5 ▲ computed color --dim rgb(255, 138, 46)",
    staleColor === "rgb(255, 138, 46)",
    staleColor,
  );
  assert(
    "R5 stale never gates: no blocker string on the Road entry",
    (await staleEntry.locator('[data-testid="rail-blocker"]').count()) === 0,
  );
  await shot(page, "r5-stale.png");
  await grayShot(page, "r5-stale-grayscale.png");

  log("— R6: axe — violation id sets equal the committed baseline —");
  async function axeIds() {
    const ids = {};
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate(AXE_SRC);
    let res = await page.evaluate(async () => await window.axe.run());
    ids.prepin = res.violations.map((v) => v.id).sort();
    await pinManually(page);
    await page.evaluate(AXE_SRC);
    res = await page.evaluate(async () => await window.axe.run());
    ids.pinned = res.violations.map((v) => v.id).sort();
    return ids;
  }
  const ids = await axeIds();
  fs.writeFileSync(
    path.join(OUT, "axe-prod.json"),
    JSON.stringify(ids, null, 2),
  );
  assert(
    "R6 pre-pin set == baseline [region]",
    JSON.stringify(ids.prepin) === JSON.stringify(["region"]),
    ids.prepin.join(","),
  );
  assert(
    "R6 pinned set == baseline [label, region]",
    JSON.stringify(ids.pinned) === JSON.stringify(["label", "region"]),
    ids.pinned.join(","),
  );

  log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
  fs.writeFileSync(
    path.join(OUT, "s2a11-live-checks.md"),
    `# s2-arc11 live checks (local)\n\n${lines.join("\n")}\n`,
  );
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
