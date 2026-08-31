/** s2-arc12 live checks (Refs #213, #224) — READ-ONLY, local run against
 *  the issue-213-scan-honesty worktree's dev server on :3213.  (Prod
 *  re-run happens after ship.)
 *
 *  Sections:
 *   L1  the real E Bayaud pin (39.71466, -104.94071 — the #213 triage
 *       coordinate): real Overpass detection through the real modal —
 *       candidates render, and NEITHER failure copy shows (a completed
 *       scan claims what it measured).  Capture.
 *   L2  the lake pin (Ferril Lake, 39.74810, -104.95610 — the arc10
 *       zero-candidate coordinate): a completed EMPTY scan still reads
 *       "No road detected within 30 m" (#213 acceptance bullet 2) and
 *       never the unavailable copy.  Capture.
 *   L3  unavailable, served-bundle path: the browser's /api/road-bearing
 *       call is fulfilled with {scan_status:"unavailable", …} via
 *       Playwright route interception (Overpass itself cannot be downed
 *       on demand — the route's own mirror handling is proven at the
 *       route.test.ts level; THIS check proves the served modal bundle
 *       renders the unavailable wire shape honestly): the unavailable
 *       copy + ↻ Re-detect roads render, the absence claim does NOT,
 *       and the property panel says "Detection service unavailable"
 *       with no Rural verdict.  Capture.
 *   L4  retry recovery: drop the interception, click ↻ Re-detect roads
 *       at the same pin → REAL detection recovers to candidates.
 *       Capture.
 *
 *  No saves, no DB writes; all state is client state on a dev server.
 *
 *  Run (repo root node_modules carries playwright):
 *    set NODE_PATH=C:\Users\rtmak\Documents\traffic-control-tool\node_modules
 *    node s2a12-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A12LC");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3213/sandbox";

const BAYAUD = { lat: "39.71466", lng: "-104.94071" };
const LAKE = { lat: "39.74810", lng: "-104.95610" };

const UNAVAILABLE_BODY = JSON.stringify({
  scan_status: "unavailable",
  candidates: [],
  primary_index: null,
  isUrban: null,
  placeName: null,
});

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

async function openPickerWithCoords(page, pin) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pick Location on Map/i }).click();
  // With a Mapbox token the manual inputs hide behind a toggle; without
  // one (this worktree's dev server) they auto-show.  Handle both.
  const toggle = page.getByRole("button", {
    name: /Or enter coordinates manually/i,
  });
  await page.getByLabel("Latitude", { exact: true }).or(toggle).first().waitFor();
  if (await toggle.count()) await toggle.click();
  await page.getByLabel("Latitude", { exact: true }).fill(pin.lat);
  await page.getByLabel("Longitude", { exact: true }).fill(pin.lng);
}

// Wait until the detection outcome settles (any of: candidate rows,
// the absence copy, the unavailable copy) and return the modal text.
async function waitDetection(page) {
  await page.waitForFunction(
    () => {
      const t = document.body.textContent ?? "";
      return (
        /m from pin/.test(t) ||
        /No road detected within 30 m/.test(t) ||
        /Road detection is unavailable right now/.test(t)
      );
    },
    null,
    { timeout: 60000 },
  );
  return page.evaluate(() => document.body.textContent ?? "");
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  log("— L1: real detection at the E Bayaud pin (the #213 triage coordinate) —");
  await openPickerWithCoords(page, BAYAUD);
  const t1 = await waitDetection(page);
  assert("L1 candidates render (completed scan)", /m from pin/.test(t1));
  assert(
    "L1 no absence claim beside candidates",
    !/No road detected within 30 m/.test(t1),
  );
  assert(
    "L1 no unavailable copy on a completed scan",
    !/Road detection is unavailable right now/.test(t1),
  );
  await shot(page, "l1-bayaud-candidates.png");

  log("— L2: completed empty scan at the lake pin —");
  await openPickerWithCoords(page, LAKE);
  const t2 = await waitDetection(page);
  assert(
    "L2 absence copy renders (a measurement)",
    /No road detected within 30 m/.test(t2),
  );
  assert(
    "L2 never the unavailable copy",
    !/Road detection is unavailable right now/.test(t2),
  );
  await shot(page, "l2-lake-absence.png");

  log("— L3: unavailable wire shape through the served modal bundle —");
  await page.route("**/api/road-bearing", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: UNAVAILABLE_BODY,
    }),
  );
  await openPickerWithCoords(page, BAYAUD);
  const t3 = await waitDetection(page);
  assert(
    "L3 unavailable copy renders",
    /Road detection is unavailable right now/.test(t3),
  );
  assert(
    "L3 the absence claim does NOT",
    !/No road detected within 30 m/.test(t3),
  );
  assert(
    "L3 panel names the failure",
    /Detection service unavailable/.test(t3),
  );
  // Scoped to the dialog: the page BEHIND the modal legitimately holds
  // the form's Road type control (where "Rural — undivided" is an
  // option); the claim under test is the MODAL asserting a verdict.
  const modalText = await page
    .locator('[role="dialog"]')
    .evaluate((el) => el.textContent ?? "");
  assert("L3 no Rural verdict claimed in the modal", !/Rural/.test(modalText));
  const redetect = page.getByRole("button", { name: /Re-detect roads/i });
  assert("L3 ↻ Re-detect roads stands", (await redetect.count()) === 1);
  await shot(page, "l3-unavailable.png");

  log("— L4: retry recovers to real detection —");
  await page.unroute("**/api/road-bearing");
  await redetect.click();
  const t4 = await waitDetection(page);
  assert("L4 real candidates after retry", /m from pin/.test(t4));
  assert(
    "L4 unavailable copy cleared",
    !/Road detection is unavailable right now/.test(t4),
  );
  await shot(page, "l4-recovered.png");

  log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
  fs.writeFileSync(
    path.join(OUT, "s2a12-live-checks.md"),
    `# s2-arc12 live checks (local)\n\n${lines.join("\n")}\n`,
  );
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
