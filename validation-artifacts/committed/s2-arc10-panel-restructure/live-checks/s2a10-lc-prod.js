/** s2-arc10 PROD live checks (Refs #227, #214) — production after the
 *  ship, READ-ONLY (no saves, no DB writes, no Generate; the pin,
 *  jurisdiction pick, and suggestion resolution are client state).
 *
 *  P1  per live kind: full-page prod captures pinned via the
 *      manual-entry fallback + one grayscale.
 *  P2  fact strip on the deployed bundle: absent pre-pin (GO ruling
 *      1); five labeled cells pinned; jurisdiction cell answers
 *      "None — baseline".
 *  P3  jurisdiction band: full-width sibling of Location, pending
 *      pre-pin (inert + aria-hidden body).
 *  P4  resolved-state record, read-only interaction: Dismiss renders
 *      the ×-record with sentence + evidence + Undo; Undo re-arms the
 *      live proposal.  Captures at both states.
 *  P5  corridor bar: aria-hidden, five segments in row order, every
 *      segment at the 6px floor or above; extent rows carry no ✓.
 *  P6  schedule window block: the one-row no-jurisdiction answer;
 *      after selecting Denver in the picker (client state), the REAL
 *      class-scoped rows render ◌ "— set dates to check".
 *  P7  the #214 repro on prod: the real picker at the E Bayaud pin —
 *      typed coords fire detection, pick the Bayaud candidate, type
 *      bearing 90 over the detected value, the governs note stands in
 *      the modal; after Save & Close the Road step's block shows
 *      detected AND applied bearing plus the role sentence.
 *  P8  axe (arc16 injection idiom) on pre-pin and pinned states —
 *      violation-id sets must equal the committed local baseline
 *      ([region] pre-pin, [label, region] pinned): zero new.
 *
 *  Run (repo root node_modules carries playwright; AXE_PATH overrides
 *  the axe.min.js location when running outside the main checkout):
 *    set NODE_PATH=C:\Users\rtmak\Documents\traffic-control-tool\node_modules
 *    node s2a10-lc-prod.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A10Prod");
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
// The committed local baseline (outS2A10LC/axe-*.json) — prod must
// match it exactly.
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

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  log(`— P1: prod captures (${SITE}) —`);
  for (const k of KINDS) {
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: k.label }).click();
    await pinManually(page);
    await shot(page, `prod-${k.slug}.png`);
  }
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  await shot(page, "prod-near-intersection-gray.png");

  log("— P2: fact strip —");
  await page.goto(SITE, { waitUntil: "networkidle" });
  assert(
    "pre-pin: no fact strip (GO ruling 1)",
    (await page.locator(".fact-strip").count()) === 0,
  );
  await pinManually(page);
  const cellLabels = await page.$$eval(
    ".fact-strip .fact-cell .tr-step",
    (els) => els.map((e) => e.textContent),
  );
  assert(
    "pinned: five labeled cells",
    JSON.stringify(cellLabels) ===
      JSON.stringify(["Lat", "Lng", "Bearing", "Speed", "Jurisdiction"]),
    JSON.stringify(cellLabels),
  );
  const jvalue = await page
    .locator(".fact-strip .fact-cell", { hasText: "Jurisdiction" })
    .locator("span")
    .nth(1)
    .textContent();
  assert(
    'jurisdiction cell answers "None — baseline"',
    jvalue === "None — baseline",
    JSON.stringify(jvalue),
  );

  log("— P3: the band —");
  await page.goto(SITE, { waitUntil: "networkidle" });
  const bandOutside = await page.evaluate(() => {
    const loc = document.getElementById("rail-step-location");
    const locSection = loc && loc.parentElement;
    const band = document.querySelector(".jctl-band");
    return Boolean(
      band && locSection && !locSection.contains(band) &&
        !locSection.querySelector(".jctl"),
    );
  });
  assert("band is a full-width sibling below Location", bandOutside);
  const bandPending = await page.evaluate(() => {
    const band = document.querySelector(".jctl-band");
    const body = band && band.closest(".step-pending-body");
    return Boolean(body && body.getAttribute("aria-hidden") === "true");
  });
  assert("pre-pin: the band body is pending (inert + aria-hidden)", bandPending);

  log("— P4: dismiss record + undo (read-only interaction) —");
  await pinManually(page);
  await page.waitForSelector(".jbar-suggest .sugg-glyph", { timeout: 30000 });
  assert(
    "proposal: ⌁ glyph + two explicit buttons",
    (await page.locator(".sugg-glyph", { hasText: "⌁" }).count()) >= 1 &&
      (await page.getByRole("button", { name: /Confirm Denver/ }).count()) === 1 &&
      (await page.getByRole("button", { name: "Dismiss" }).count()) >= 1,
  );
  await page.getByRole("button", { name: "Dismiss" }).first().click();
  const dismissed = page.locator(".sys-event.dismissed").first();
  const dismissedText = (await dismissed.textContent()) ?? "";
  assert(
    "dismiss: ×-record with sentence + evidence + Undo",
    /Dismissed the Denver suggestion — None — baseline stands\./.test(
      dismissedText,
    ) &&
      /Boundary data is approximate/.test(dismissedText) &&
      (await dismissed.getByRole("button", { name: "Undo" }).count()) === 1,
  );
  await shot(page, "prod-record-dismissed.png");
  await dismissed.getByRole("button", { name: "Undo" }).click();
  assert(
    "undo re-arms the live proposal",
    (await page.getByRole("button", { name: /Confirm Denver/ }).count()) === 1,
  );
  await shot(page, "prod-record-rearmed.png");

  log("— P5: corridor bar —");
  const segWidths = await page.$$eval(
    ".corridor-bar .corridor-bar-seg",
    (els) => els.map((e) => e.getBoundingClientRect().width),
  );
  assert(
    "five segments render, every one at least the 6px floor",
    segWidths.length === 5 && segWidths.every((w) => w >= 6),
    JSON.stringify(segWidths.map((w) => Math.round(w))),
  );
  assert(
    "bar is aria-hidden (the table is the record)",
    (await page.locator(".corridor-bar[aria-hidden]").count()) === 1,
  );
  // Segment order matches row order: the widths must be proportional to
  // the row values read top-to-bottom (compare rank order).
  const rowFt = await page.$$eval(
    ".setup-panel .flex.flex-col.gap-1 > .flex.items-baseline",
    (els) =>
      els
        .map((r) => {
          const v = r.querySelector(".font-mono");
          return v ? parseInt((v.textContent || "").replace(/[^\d]/g, ""), 10) : NaN;
        })
        .filter((n) => !Number.isNaN(n)),
  );
  const rank = (a) =>
    a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).map((p) => p[1]).join(",");
  assert(
    "segment order matches row order (proportional rank agreement)",
    rowFt.length === 5 && rank(rowFt) === rank(segWidths),
    `rows=${JSON.stringify(rowFt)} segs=${JSON.stringify(segWidths.map((w) => Math.round(w)))}`,
  );
  const extentText = await page
    .locator(".setup-panel", { hasText: "Corridor extent" })
    .first()
    .textContent();
  assert(
    "extent rows carry no ✓ prefix (GO ruling 5)",
    !/✓ (Advance warning|Transition|Buffer|Work zone|Downstream)/.test(
      extentText ?? "",
    ),
  );

  log("— P6: schedule window block —");
  assert(
    "no jurisdiction: the one-row answer",
    (await page
      .getByText("Select a jurisdiction to see its windows")
      .count()) === 1,
  );
  // Selecting Denver is client state (read-only against the backend).
  await page.locator("#jl-jurisdiction").selectOption("denver");
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll(
        ".sched-windows .sched-window-row",
      );
      return (
        rows.length > 0 &&
        !/Loading window data|Select a jurisdiction/.test(
          rows[0].textContent ?? "",
        )
      );
    },
    null,
    { timeout: 45000 },
  );
  const rows = await page.$$eval(".sched-windows .sched-window-row", (els) =>
    els.map((r) => ({
      glyph: r.children[0] ? r.children[0].textContent.trim() : "",
      label: r.children[1] ? r.children[1].textContent : "",
      value: r.children[2] ? r.children[2].textContent : "",
    })),
  );
  assert(
    "real class-scoped rows render ◌ '— set dates to check'",
    rows.length > 0 &&
      rows.every((r) => r.glyph === "◌" && r.value === "— set dates to check"),
    JSON.stringify(rows),
  );
  await shot(page, "prod-schedule-unevaluated.png");

  log("— P7: the #214 repro on prod —");
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pick Location on Map/i }).click();
  await page
    .getByRole("button", { name: /Or enter coordinates manually/i })
    .click();
  await page.getByLabel("Latitude", { exact: true }).fill("39.71466");
  await page.getByLabel("Longitude", { exact: true }).fill("-104.94071");
  await page.waitForFunction(
    () => {
      const save = Array.from(document.querySelectorAll("button")).find((x) =>
        /Save & Close/.test(x.textContent || ""),
      );
      const pick = Array.from(document.querySelectorAll("button")).find((x) =>
        /Bayaud/.test(x.textContent || ""),
      );
      return Boolean((save && !save.disabled) || pick);
    },
    null,
    { timeout: 120000 },
  );
  const bayaud = page.locator("button", { hasText: /Bayaud/ }).first();
  if ((await bayaud.count()) > 0) {
    await bayaud.click();
  }
  await page.waitForFunction(
    () => {
      const b = Array.from(document.querySelectorAll("button")).find((x) =>
        /Save & Close/.test(x.textContent || ""),
      );
      return Boolean(b && !b.disabled);
    },
    null,
    { timeout: 30000 },
  );
  await page.getByLabel("Direction of travel in degrees").fill("90");
  assert(
    "picker: the bearing role note stands beside the field (GO ruling 7)",
    (await page.getByText(/road geometry governs the drawing/).count()) >= 1,
  );
  await shot(page, "prod-214-picker-bearing-90.png");
  await page.getByRole("button", { name: /Save & Close/ }).click();
  await page.waitForSelector(".dva", { timeout: 8000 });
  const dvaText = (await page.locator(".dva").textContent()) ?? "";
  assert(
    "#214 prod repro: detected AND applied bearing + the governs sentence",
    /OSM detection/.test(dvaText) &&
      /Bearing/.test(dvaText) &&
      /90°/.test(dvaText) &&
      /road geometry governs the drawing — the typed bearing sets the travel-direction sign only/.test(
        dvaText,
      ),
    dvaText.slice(0, 160),
  );
  await shot(page, "prod-214-detected-vs-applied.png");

  log("— P8: axe vs the committed local baseline —");
  const ids = {};
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.evaluate(AXE_SRC);
  let res = await page.evaluate(async () => await window.axe.run());
  ids.prepin = res.violations.map((v) => v.id).sort();
  await pinManually(page);
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
    `# s2a10 PROD live checks — raw log\n\n${lines.join("\n")}\n\n${
      failures === 0 ? "**ALL PASS**" : `**${failures} FAILURE(S)**`
    }\n`,
  );
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
