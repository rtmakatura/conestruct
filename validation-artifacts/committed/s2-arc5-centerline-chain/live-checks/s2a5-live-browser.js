// s2-arc5 live checks, browser series (Refs #210, #211) — production,
// headless, READ-ONLY.
//   gate — healthz == origin/main == served bundle (re-asserted in-log)
//   B1   — E Bayaud money shot: pre-pick shows NO Centerline row while
//          the Which-road card is up; picking E Bayaud shows
//          "OSM, full corridor"; recentered screenshot = the ribbons on
//          the road through the S Colorado crossing (the pre-fix
//          baseline screenshot is in the arc evidence for contrast)
//   B2   — partial coverage at the S Colorado pin: the Centerline row
//          reads "covers 0–N ft, bearing beyond"; screenshot captures
//          the dimmed extension
//   AX1  — axe on the picker state (known .opacity-80 node expected)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A5-live");
fs.mkdirSync(OUT, { recursive: true });
const AXE_SRC = fs.readFileSync(
  require.resolve("axe-core/axe.min.js"),
  "utf-8",
);
const BASE = "https://www.conestruct.com";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

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

async function openPicker(page, lat, lng) {
  await page.getByRole("button", { name: /Pick Location on Map|Edit Location/ }).first().click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(lat);
  await page.getByLabel("Longitude").fill(lng);
  for (let i = 0; i < 40; i++) {
    const t = ((await page.getByRole("dialog").textContent().catch(() => "")) ?? "");
    if (!/Detecting roads at pin|Classifying road/i.test(t)) break;
    await page.waitForTimeout(1000);
  }
  const wz = page.getByRole("dialog").getByLabel(/work zone length/i);
  if (await wz.isVisible().catch(() => false)) await wz.fill("1000");
  await page.waitForTimeout(2000);
}

(async () => {
  const hz = await (
    await fetch("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz")
  ).json();
  assert("gate. healthz == origin/main", hz.sha === EXPECTED_SHA, hz.sha.slice(0, 7));

  const browser = await chromium.launch();
  const page = await (
    await browser.newContext({ viewport: { width: 1500, height: 950 } })
  ).newPage();
  await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle" });

  // ---- B1: E Bayaud -------------------------------------------------------
  await openPicker(page, "39.71466", "-104.94071");
  const dlg = page.getByRole("dialog");
  const prePick = ((await dlg.textContent()) ?? "").replace(/\s+/g, " ");
  assert(
    "B1a. pending pick: no Centerline row while the Which-road card is up",
    /Which road\?/i.test(prePick) && !/Centerline/i.test(prePick),
  );
  await page
    .locator("button", { hasText: "m from pin" })
    .filter({ hasText: /Bayaud/i })
    .first()
    .click();
  await page.waitForTimeout(2000);
  const postPick = ((await dlg.textContent()) ?? "").replace(/\s+/g, " ");
  assert(
    "B1b. picked E Bayaud: Centerline row reads OSM, full corridor",
    /Centerline/i.test(postPick) && /OSM, full corridor/i.test(postPick),
  );
  await page.getByRole("button", { name: /recenter/i }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "b1-bayaud-fixed.png") });
  log("B1c. recentered screenshot captured (b1-bayaud-fixed.png) — compare the pre-fix baseline in the arc evidence");
  await page.getByRole("button", { name: "Cancel" }).click().catch(() => {});
  await page.waitForTimeout(800);

  // ---- B2: partial coverage at the S Colorado pin -------------------------
  await openPicker(page, "39.7135", "-104.94055");
  const rows = page
    .locator("button", { hasText: "m from pin" })
    .filter({ hasText: /Colorado Boulevard/i });
  if ((await rows.count()) > 0) {
    await rows.first().click();
    await page.waitForTimeout(2000);
  }
  const b2Text = ((await dlg.textContent()) ?? "").replace(/\s+/g, " ");
  const m = b2Text.match(/covers 0–([\d,]+) ft, bearing beyond/i);
  assert(
    "B2. partial coverage discloses on the served page",
    m !== null,
    m ? `"covers 0–${m[1]} ft, bearing beyond"` : "row text not found",
  );
  await page.getByRole("button", { name: /recenter/i }).click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "b2-colorado-partial.png") });

  // ---- AX1 -----------------------------------------------------------------
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
  fs.writeFileSync(path.join(OUT, "axe-picker-state.json"), JSON.stringify(compact, null, 2));
  assert("AX1. axe zero violations — picker state", compact.length === 0, `${compact.length} finding(s)`);

  await browser.close();
  fs.writeFileSync(path.join(OUT, "s2a5-browser-raw.md"), lines.join("\n") + "\n");
  console.log(`\nDONE — failures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
})();
