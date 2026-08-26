/** s2-arc9 PROD live checks (Refs #226) — production after the ship,
 *  READ-ONLY (no saves, no DB writes; the pin is client state).
 *
 *  P1  per live kind: full-page screenshot on prod, pinned via the
 *      manual-entry fallback (deterministic, no Mapbox dependency).
 *  P2  computed-style role checks against the DEPLOYED bundle — one
 *      element per role (section header span, STEP tag, field label,
 *      provenance line) asserting family/weight/casing/size/tracking/
 *      color match lib/design/type-roles.ts; rail entry byte-identity.
 *      This is the mirror guard proven on prod, not on source.
 *  P3  grayscale capture: shoulder kind at the E Colfax pin
 *      (39.73997, -104.96632) — the acceptance desaturation check on
 *      the live surface.
 *  P4  axe (arc16 injection idiom) on the pre-pin and pinned states —
 *      violation-id sets must equal the committed LOCAL baseline
 *      ([region] pre-pin, [label, region] pinned): zero new.
 *
 *  Run (repo root node_modules carries playwright; AXE_PATH overrides
 *  the axe.min.js location when running outside the main checkout):
 *    set NODE_PATH=C:\Users\rtmak\Documents\traffic-control-tool\node_modules
 *    node s2a9-lc-prod.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A9Prod");
fs.mkdirSync(OUT, { recursive: true });
const SITE = "https://www.conestruct.com/sandbox";
const AXE_SRC = fs.readFileSync(
  process.env.AXE_PATH ||
    path.join(
      __dirname,
      "..", "..", "..", "..",
      "conestruct", "site", "node_modules", "axe-core", "axe.min.js",
    ),
  "utf-8",
);
// The committed local baseline (outS2A9LC/axe-before.json ==
// axe-after.json) — prod must match it exactly.
const BASELINE = { prepin: ["region"], pinned: ["label", "region"] };

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

const KINDS = [
  { label: "Shoulder work", slug: "shoulder" },
  { label: "Flagger lane closure", slug: "flagger" },
  { label: "Lane closure near intersection", slug: "near-intersection" },
];

async function pinManually(page, lat, lng) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    const input = page
      .locator(`label:text-is("${labelText}")`)
      .locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  // The first non-zero coordinate flips hasPin (the unset block swaps
  // for LocationSummary) — reopen the summary's manual editor after.
  await fill("Latitude", lat);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", lng);
  await fill("Bearing (° from N)", "85");
  await fill("Work zone (ft)", "400");
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  log(`— P1: prod captures (${SITE}) —`);
  for (const k of KINDS) {
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: k.label }).click();
    await pinManually(page, "39.714660", "-104.940710");
    await shot(page, `prod-${k.slug}.png`);
  }

  log("— P2: computed-style role checks on the deployed bundle —");
  await page.goto(SITE, { waitUntil: "networkidle" });
  const style = (sel, prop) =>
    page.$eval(sel, (el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  const sectionSel = ".setup-panel .tr-section";
  assert(
    "section: mono 500 10px 0.20em(=2px) UPPERCASE white",
    /JetBrains|ui-monospace|Menlo/i.test(await style(sectionSel, "font-family")) &&
      (await style(sectionSel, "font-weight")) === "500" &&
      (await style(sectionSel, "font-size")) === "10px" &&
      (await style(sectionSel, "letter-spacing")) === "2px" &&
      (await style(sectionSel, "text-transform")) === "uppercase" &&
      (await style(sectionSel, "color")) === "rgb(255, 255, 255)",
  );
  const stepSel = ".setup-panel .tr-step";
  assert(
    "step index: mono 400 10px 0.14em(=1.4px) UPPERCASE dim #93a0b0",
    (await style(stepSel, "font-weight")) === "400" &&
      (await style(stepSel, "font-size")) === "10px" &&
      (await style(stepSel, "letter-spacing")) === "1.4px" &&
      (await style(stepSel, "text-transform")) === "uppercase" &&
      (await style(stepSel, "color")) === "rgb(147, 160, 176)",
  );
  const flSel = ".setup-panel .field-label-row";
  assert(
    "field label: sans 500 12px 0 tracking no-transform mid #c8d1dd",
    /Inter|ui-sans-serif|system-ui/i.test(await style(flSel, "font-family")) &&
      (await style(flSel, "font-weight")) === "500" &&
      (await style(flSel, "font-size")) === "12px" &&
      ["normal", "0px"].includes(await style(flSel, "letter-spacing")) &&
      (await style(flSel, "text-transform")) === "none" &&
      (await style(flSel, "color")) === "rgb(200, 209, 221)",
  );
  const provSel = ".setup-panel .tr-prov";
  assert(
    "provenance: mono 400 10px 0.04em(=0.4px) no-transform dim + dotted underline",
    (await style(provSel, "font-weight")) === "400" &&
      (await style(provSel, "font-size")) === "10px" &&
      (await style(provSel, "letter-spacing")) === "0.4px" &&
      (await style(provSel, "text-transform")) === "none" &&
      (await style(provSel, "color")) === "rgb(147, 160, 176)" &&
      /underline/.test(await style(provSel, "text-decoration-line")) &&
      /dotted/.test(await style(provSel, "text-decoration-style")),
  );
  const railSel = ".progress-rail .rail-entry";
  assert(
    "rail entry byte-identical: 10px mono 0.08em(=0.8px) uppercase",
    (await style(railSel, "font-size")) === "10px" &&
      (await style(railSel, "letter-spacing")) === "0.8px" &&
      (await style(railSel, "text-transform")) === "uppercase",
  );

  log("— P3: E Colfax grayscale (shoulder, 39.73997 / -104.96632) —");
  await page.goto(SITE, { waitUntil: "networkidle" });
  await pinManually(page, "39.73997", "-104.96632");
  await shot(page, "prod-shoulder-colfax.png");
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  await shot(page, "prod-shoulder-colfax-gray.png");

  log("— P4: axe vs the committed local baseline —");
  const ids = {};
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.evaluate(AXE_SRC);
  let res = await page.evaluate(async () => await window.axe.run());
  ids.prepin = res.violations.map((v) => v.id).sort();
  await pinManually(page, "39.714660", "-104.940710");
  await page.evaluate(AXE_SRC);
  res = await page.evaluate(async () => await window.axe.run());
  ids.pinned = res.violations.map((v) => v.id).sort();
  fs.writeFileSync(
    path.join(OUT, "axe-prod.json"),
    JSON.stringify(ids, null, 2),
  );
  for (const state of ["prepin", "pinned"]) {
    assert(
      `axe ${state}: violation ids == committed baseline`,
      JSON.stringify(ids[state]) === JSON.stringify(BASELINE[state]),
      `baseline=[${BASELINE[state]}] prod=[${ids[state]}]`,
    );
  }

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "assertions-raw.md"),
    `# s2a9 PROD live checks — raw log\n\n${lines.join("\n")}\n\n${
      failures === 0 ? "**ALL PASS**" : `**${failures} FAILURE(S)**`
    }\n`,
  );
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
