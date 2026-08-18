/**
 * s2-arc3 live checks round 2, browser series (Refs #207) — production,
 * headless, READ-ONLY.  The proxy fix is live; the round-1 B-series
 * re-runs expecting success end-to-end:
 *   gate — healthz == origin/main == served bundle
 *   B1'  — the detect body carries the confirmed road's centerline
 *   B2'  — the relay-bearing browser detect returns 200 (round 1: 413)
 *   B3'  — the result surfaces ("N flag(s) auto-checked"), never silence
 *   AX1' — axe on the post-detect state
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=conestruct/site/node_modules node s2a3-browser-r2.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");
async function runAxe(page, outName) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    }),
  );
  const compact = res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  fs.writeFileSync(path.join(OUT, outName), JSON.stringify(compact, null, 2));
  return compact;
}

const OUT = path.join(__dirname, "outS2A3");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "https://www.conestruct.com";
const SITE = `${BASE}/sandbox`;
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";
const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" };

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

async function openPickerWithCoords(page, coords, buttonRe) {
  await page.getByRole("button", { name: buttonRe }).click();
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
async function pickCandidate(page, nameRe) {
  await waitDetection(page);
  const row = page
    .locator("button", { hasText: "m from pin" })
    .filter({ hasText: nameRe });
  if ((await row.count()) > 0) {
    await row.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
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

(async () => {
  const hz = await (
    await fetch("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz")
  ).json();
  log(`healthz sha: ${hz.sha}`);
  log(`expected: ${EXPECTED_SHA}`);
  let bundleOk = false;
  {
    const html = await (await fetch(SITE)).text();
    const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[a-zA-Z0-9._-]+\.js/g)].map(
      (m) => m[0],
    );
    for (const c of [...new Set(chunks)]) {
      const js = await (await fetch(BASE + c)).text();
      if (EXPECTED_SHA && js.includes(EXPECTED_SHA)) {
        bundleOk = true;
        log(`served bundle sha found in ${c}`);
        break;
      }
    }
  }
  assert(
    "gate. healthz == origin/main == served bundle",
    hz.sha === EXPECTED_SHA && bundleOk,
    hz.sha.slice(0, 7),
  );

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let detectRequestBody = null;
  let detectResponseStatus = null;
  page.on("request", (req) => {
    if (req.url().includes("/api/render/detect-site") && req.method() === "POST") {
      try {
        detectRequestBody = JSON.parse(req.postData() || "null");
      } catch {
        detectRequestBody = null;
      }
    }
  });
  page.on("response", (res) => {
    if (res.url().includes("/api/render/detect-site")) detectResponseStatus = res.status();
  });

  await page.goto(SITE, { waitUntil: "networkidle" });
  await openPickerWithCoords(page, LAKEWOOD, /Pick Location on Map/);
  const picked = await pickCandidate(page, /Wadsworth/i);
  log(picked ? "Lakewood candidate picked (Wadsworth)" : "no candidate row found");
  const saved = await saveWhenReady(page);
  log(saved ? "picker saved (Lakewood)" : "Save & Close never enabled");

  await page
    .getByRole("button", { name: /detect nearby site conditions/i })
    .click()
    .catch(() => {});
  // The corridor detect legitimately runs long (Overpass + Modal cold
  // start — the payload series measured up to ~40 s); wait up to 120 s.
  for (let i = 0; i < 120 && detectResponseStatus === null; i++) {
    await page.waitForTimeout(1000);
  }

  assert(
    "B1'. the browser's detect body carries the confirmed road's centerline",
    !!(
      detectRequestBody &&
      Array.isArray(detectRequestBody.centerline) &&
      detectRequestBody.centerline.length >= 2
    ),
    detectRequestBody && detectRequestBody.centerline
      ? `${detectRequestBody.centerline.length} vertices`
      : "no centerline in the POSTed body",
  );
  assert(
    "B2'. the relay-bearing browser detect succeeds end-to-end (round 1: 413)",
    detectResponseStatus === 200,
    `HTTP ${detectResponseStatus}`,
  );

  await page.waitForTimeout(1500);
  const bodyText = ((await page.textContent("body").catch(() => "")) ?? "").replace(
    /\s+/g,
    " ",
  );
  assert(
    "B3'. the corridor-scan result surfaces (\"flag(s) auto-checked\")",
    /Corridor scan: \d+ flag\(s\) auto-checked/i.test(bodyText),
    (bodyText.match(/Corridor scan: \d+ flag\(s\) auto-checked/i) || [""])[0],
  );
  await page.screenshot({ path: path.join(OUT, "02-r2-post-detect-state.png"), fullPage: true });

  const ax = await runAxe(page, "axe-r2-post-detect.json");
  assert("AX1'. axe zero violations — post-detect state", ax.length === 0, `${ax.length} finding(s)`);

  await browser.close();
  fs.writeFileSync(path.join(OUT, "r2-browser-raw.md"), lines.join("\n") + "\n");
  console.log(`\nDONE — failures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
})();
