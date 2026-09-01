/** s2-arc12 DEFINITIVE prod live checks (Refs #213, #224) — READ-ONLY,
 *  sha-gated in its own output.
 *
 *  Prologue (before any check): UTC timestamp, BASE, the live /healthz
 *  JSON verbatim, `git rev-parse origin/main` (after a fetch), and a
 *  PASS/FAIL gate that the healthz sha equals origin/main.  The run
 *  ABORTS if the gate fails.
 *
 *  Then the full s2a12 check set (same sections as the archived
 *  s2a12-live-checks.js / s2a12-lc-prod.js run):
 *   L1  real Overpass at the E Bayaud pin — candidates render, neither
 *       failure copy shows.
 *   L2  the lake pin — a completed EMPTY scan reads "No road detected
 *       within 30 m", never the unavailable copy.
 *   L3  the unavailable wire shape through the served modal bundle
 *       (route interception — Overpass cannot be downed on demand).
 *   L4  interception dropped, ↻ Re-detect roads → real detection
 *       recovers.
 *
 *  No saves, no Generate, no DB writes.  Output: outS2A12Prod-pinned/.
 *
 *  Run (repo root node_modules carries playwright):
 *    set NODE_PATH=C:\Users\rtmak\Documents\traffic-control-tool\node_modules
 *    node s2a12-lc-prod-pinned.js
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A12Prod-pinned");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "https://www.conestruct.com/sandbox";
const HEALTHZ =
  "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";

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
function writeMd() {
  fs.writeFileSync(
    path.join(OUT, "s2a12-prod-pinned.md"),
    `# s2-arc12 live checks (prod, sha-pinned — definitive)\n\n${lines.join("\n")}\n`,
  );
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  log(`screenshot: ${name}`);
}
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", reject);
  });
}

async function openPickerWithCoords(page, pin) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pick Location on Map/i }).click();
  const toggle = page.getByRole("button", {
    name: /Or enter coordinates manually/i,
  });
  await page.getByLabel("Latitude", { exact: true }).or(toggle).first().waitFor();
  if (await toggle.count()) await toggle.click();
  await page.getByLabel("Latitude", { exact: true }).fill(pin.lat);
  await page.getByLabel("Longitude", { exact: true }).fill(pin.lng);
}

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
  // ---- sha gate (FIRST lines of the record) --------------------------------
  log(`run start (UTC): ${new Date().toISOString()}`);
  log(`BASE: ${BASE}`);
  const hz = await fetchText(HEALTHZ);
  log(`healthz (HTTP ${hz.status}): ${hz.body.trim()}`);
  execSync("git fetch --quiet", { cwd: __dirname });
  const originMain = execSync("git rev-parse origin/main", { cwd: __dirname })
    .toString()
    .trim();
  log(`git rev-parse origin/main: ${originMain}`);
  let hzSha = null;
  try {
    hzSha = JSON.parse(hz.body).sha;
  } catch {
    /* gate fails below */
  }
  const gateOk = hz.status === 200 && hzSha === originMain;
  assert(
    "GATE — healthz sha == git rev-parse origin/main",
    gateOk,
    `healthz ${hzSha} vs origin/main ${originMain}`,
  );
  if (!gateOk) {
    log("GATE FAILED — aborting; no checks run.");
    writeMd();
    process.exit(2);
  }

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

  log(failures === 0 ? "ALL PASS (gate included)" : `${failures} FAILURE(S)`);
  writeMd();
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
