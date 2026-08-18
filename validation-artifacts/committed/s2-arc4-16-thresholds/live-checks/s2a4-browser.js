/**
 * s2-arc4 live checks, browser series (Refs #16) — production, headless,
 * READ-ONLY.  The margin display measured on the real sandbox:
 *   gate — healthz == origin/main == served bundle
 *   B1   — #186 absent case: before any detect, the site-conditions
 *          rows carry no evidence text (no "found", no "nearest ~")
 *   B2   — after a real detect at the Lakewood control pin, the
 *          auto-checked rows carry the margin ("N found, nearest ~X m"
 *          + a backend detail line); logs whether a lateral-format
 *          line landed in the visible first-two slice (the format
 *          itself is payload-proven in P2)
 *   AX1  — axe on the post-detect state (known pre-existing
 *          .opacity-80 node expected on record)
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=conestruct/site/node_modules node s2a4-browser.js
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

const OUT = path.join(__dirname, "outS2A4");
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

  let detectResponseStatus = null;
  page.on("response", (res) => {
    if (res.url().includes("/api/render/detect-site")) detectResponseStatus = res.status();
  });

  await page.goto(SITE, { waitUntil: "networkidle" });
  await openPickerWithCoords(page, LAKEWOOD, /Pick Location on Map/);
  const picked = await pickCandidate(page, /Wadsworth/i);
  log(picked ? "Lakewood candidate picked (Wadsworth)" : "no candidate row found");
  const saved = await saveWhenReady(page);
  log(saved ? "picker saved (Lakewood)" : "Save & Close never enabled");

  // B1 — #186 absent case, asserted BEFORE any detect runs.
  {
    const pre = ((await page.textContent("body").catch(() => "")) ?? "").replace(/\s+/g, " ");
    assert(
      "B1. #186 absent case: no evidence text before detect",
      !/\d+ found/.test(pre) && !/nearest ~/.test(pre),
    );
  }

  await page
    .getByRole("button", { name: /detect nearby site conditions/i })
    .click()
    .catch(() => {});
  // The corridor detect legitimately runs long (Overpass + Modal cold
  // start — up to ~40 s measured in s2-arc3); wait up to 120 s.
  for (let i = 0; i < 120 && detectResponseStatus === null; i++) {
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1500);

  const bodyText = ((await page.textContent("body").catch(() => "")) ?? "").replace(
    /\s+/g,
    " ",
  );
  const summary = bodyText.match(/\d+ found, nearest ~[\d.]+ m/g) || [];
  const detailLines = bodyText.match(/\[[a-z_]+ (@ -?\d+ ft|\d+ ft off centerline)\]/g) || [];
  assert(
    "B2. auto-checked rows carry the margin (summary + backend detail lines)",
    detectResponseStatus === 200 && summary.length > 0 && detailLines.length > 0,
    `HTTP ${detectResponseStatus}; summaries: ${JSON.stringify(summary.slice(0, 3))}; ` +
      `details visible: ${detailLines.length}`,
  );
  const lateralVisible = bodyText.match(/\[lateral \d+ ft off centerline\]/g) || [];
  log(
    `lateral-format lines visible in the first-two slices: ${lateralVisible.length}` +
      (lateralVisible.length ? ` (${lateralVisible[0]})` : " (format payload-proven in P2)"),
  );
  await page.screenshot({ path: path.join(OUT, "01-post-detect-margin.png"), fullPage: true });

  const ax = await runAxe(page, "axe-post-detect.json");
  assert("AX1. axe zero violations — post-detect state", ax.length === 0, `${ax.length} finding(s)`);

  await browser.close();
  fs.writeFileSync(path.join(OUT, "s2a4-browser-raw.md"), lines.join("\n") + "\n");
  console.log(`\nDONE — failures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
})();
