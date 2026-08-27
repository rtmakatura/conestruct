/** s2-arc10 live checks (Refs #227, #214) — READ-ONLY, local
 *  before/after run.
 *
 *  BEFORE = the main checkout's dev server (pre-arc HEAD 793a3f1) on
 *  :3111.  AFTER = the issue-227-panel-restructure worktree's dev
 *  server on :3112.  (Prod re-run happens after ship.)
 *
 *  Sections:
 *   L1  per live kind: before/after full-page shots (pinned via the
 *       manual-entry fallback) + after grayscale; pre-pin after shot
 *       (empty states: band pending, no fact strip).
 *   L2  fact strip: five labeled cells; jurisdiction cell answers
 *       "None — baseline"; absent pre-pin (GO ruling 1).
 *   L3  jurisdiction band: .jctl-band a sibling of the Location step,
 *       pending pre-pin (inert body + gate summary).
 *   L4  suggestion resolved-state flow at the Denver pin: proposal
 *       (⌁ + two buttons) → Dismiss → ×-record + evidence + Undo →
 *       Undo re-arms → Confirm → ✓-record → Undo restores None.
 *       Captures at each state.
 *   L5  corridor bar: five segments, aria-hidden, min width ≥ 6px
 *       rendered, extent rows carry no ✓ prefix (GO ruling 5).
 *   L6  schedule window block: one-row no-jurisdiction state; after a
 *       Denver confirm the REAL rows render ◌ unevaluated; with dates
 *       set, labels identical and only glyph/value change (needs the
 *       backend breakdown — .env.local must point at the live Modal).
 *   L7  detected-vs-applied (#214): the real picker at the E Bayaud
 *       pin — typed coords fire detection (Overpass), pick the Bayaud
 *       candidate, type bearing 90, see the governs note in the modal,
 *       Save & Close, then the Road step's block shows detected AND
 *       applied bearing plus the role sentence.  Network-dependent;
 *       the run fails honestly if detection is unreachable.
 *   L8  axe (arc16 injection idiom) pre-pin + pinned on BEFORE and
 *       AFTER: zero NEW violation ids.
 *
 *  No saves, no DB writes; all state is client state on dev servers.
 *
 *  Run (repo root node_modules carries playwright):
 *    set NODE_PATH=C:\Users\rtmak\Documents\traffic-control-tool\node_modules
 *    node s2a10-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A10LC");
fs.mkdirSync(OUT, { recursive: true });
const BEFORE = "http://localhost:3111/sandbox";
const AFTER = "http://localhost:3112/sandbox";
const AXE_SRC = fs.readFileSync(
  path.join(
    __dirname,
    "..", "..", "..", "..",
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

const KINDS = [
  { kind: "shoulder", label: "Shoulder work", slug: "shoulder" },
  { kind: "flagger_lane_closure", label: "Flagger lane closure", slug: "flagger" },
  {
    kind: "near_intersection",
    label: "Lane closure near intersection",
    slug: "near-intersection",
  },
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

  log("— L1: per-kind captures —");
  for (const k of KINDS) {
    await page.goto(BEFORE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: k.label }).click();
    await pinManually(page);
    await shot(page, `before-${k.slug}.png`);
  }
  await page.goto(AFTER, { waitUntil: "networkidle" });
  await shot(page, "after-prepin.png");
  for (const k of KINDS) {
    await page.goto(AFTER, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: k.label }).click();
    await pinManually(page);
    await shot(page, `after-${k.slug}.png`);
    await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
    await shot(page, `after-${k.slug}-gray.png`);
  }

  log("— L2: fact strip —");
  await page.goto(AFTER, { waitUntil: "networkidle" });
  assert(
    "pre-pin: no fact strip (GO ruling 1 — the pick CTA is the surface)",
    (await page.locator(".fact-strip").count()) === 0,
  );
  await pinManually(page);
  const cellLabels = await page.$$eval(
    ".fact-strip .fact-cell .tr-step",
    (els) => els.map((e) => e.textContent),
  );
  assert(
    "pinned: five labeled cells (lat/lng/bearing/speed/jurisdiction)",
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

  log("— L3: the band —");
  await page.goto(AFTER, { waitUntil: "networkidle" });
  const bandOutside = await page.evaluate(() => {
    const loc = document.getElementById("rail-step-location");
    const locSection = loc && loc.parentElement;
    const band = document.querySelector(".jctl-band");
    return Boolean(
      band && locSection && !locSection.contains(band) &&
        !locSection.querySelector(".jctl"),
    );
  });
  assert("band is a full-width sibling — controls left the Location body", bandOutside);
  const bandPending = await page.evaluate(() => {
    const band = document.querySelector(".jctl-band");
    const body = band && band.closest(".step-pending-body");
    return Boolean(body && body.getAttribute("aria-hidden") === "true");
  });
  assert("pre-pin: the band body is pending (inert + aria-hidden)", bandPending);

  log("— L4: resolved-state records (Denver pin) —");
  await pinManually(page);
  await page.waitForSelector(".jbar-suggest .sugg-glyph", { timeout: 30000 });
  assert(
    "proposal: ⌁ glyph + Confirm + Dismiss",
    (await page.locator(".sugg-glyph", { hasText: "⌁" }).count()) >= 1 &&
      (await page.getByRole("button", { name: /Confirm Denver/ }).count()) === 1 &&
      (await page.getByRole("button", { name: "Dismiss" }).count()) >= 1,
  );
  await shot(page, "record-1-proposal.png");
  // Dismiss the jurisdiction suggestion (its Dismiss is the first).
  await page.getByRole("button", { name: "Dismiss" }).first().click();
  const dismissed = page.locator(".sys-event.dismissed").first();
  assert(
    "dismiss: ×-record with sentence + evidence + Undo",
    /Dismissed the Denver suggestion — None — baseline stands\./.test(
      (await dismissed.textContent()) ?? "",
    ) &&
      /Boundary data is approximate/.test((await dismissed.textContent()) ?? "") &&
      (await dismissed.getByRole("button", { name: "Undo" }).count()) === 1,
  );
  await shot(page, "record-2-dismissed.png");
  await dismissed.getByRole("button", { name: "Undo" }).click();
  assert(
    "undo re-arms the live proposal",
    (await page.getByRole("button", { name: /Confirm Denver/ }).count()) === 1,
  );
  await page.getByRole("button", { name: /Confirm Denver/ }).click();
  const confirmed = page.locator(".sys-event.confirmed").first();
  assert(
    "confirm: ✓-record naming old and new, with Undo",
    /Confirmed Denver — was None — baseline\./.test(
      (await confirmed.textContent()) ?? "",
    ) && (await confirmed.getByRole("button", { name: "Undo" }).count()) === 1,
  );
  assert(
    "confirm wrote the select",
    (await page.locator("#jl-jurisdiction").inputValue()) === "denver",
  );
  await shot(page, "record-3-confirmed.png");

  log("— L6: schedule window block (uses the confirmed Denver) —");
  // The evaluated block rides the device-breakdown refetch (~4s to the
  // live Modal backend) — wait out the honest "Loading window data…"
  // in-flight state before reading the rows.
  try {
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll(
          ".sched-windows .sched-window-row",
        );
        return (
          rows.length > 0 &&
          !/Loading window data/.test(rows[0].textContent ?? "")
        );
      },
      null,
      { timeout: 45000 },
    );
  } catch {
    assert("window rows arrived from the breakdown fetch", false, "timeout");
  }
  const rowsUnevaluated = await page.$$eval(
    ".sched-windows .sched-window-row",
    (els) =>
      els.map((r) => ({
        glyph: r.children[0] ? r.children[0].textContent.trim() : "",
        label: r.children[1] ? r.children[1].textContent : "",
        value: r.children[2] ? r.children[2].textContent : "",
      })),
  );
  assert(
    "real window rows render ◌ '— set dates to check' (no invented rows)",
    rowsUnevaluated.length > 0 &&
      rowsUnevaluated.every(
        (r) => r.glyph === "◌" && r.value === "— set dates to check",
      ),
    JSON.stringify(rowsUnevaluated),
  );
  await shot(page, "schedule-1-unevaluated.png");
  // Denver's windows are class-scoped — pick Arterial so hours_eval has
  // a scope to evaluate, then set a schedule: Single day + date + times.
  await page
    .getByRole("group", { name: /street classification/i })
    .getByRole("button", { name: "Arterial", exact: true })
    .click();
  await page.getByRole("button", { name: "Single day", exact: true }).click();
  await page.locator("#sched-date").fill("2026-09-01");
  await page.locator("#sched-start").selectOption("9");
  await page.locator("#sched-end").selectOption("15");
  // Wait for the breakdown refetch to land an evaluated hours_eval.
  try {
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll(
          ".sched-windows .sched-window-row",
        );
        return (
          rows.length > 0 &&
          Array.from(rows).some(
            (r) =>
              r.children[2] &&
              r.children[2].textContent !== "— set dates to check" &&
              !/Loading window data/.test(r.textContent ?? ""),
          )
        );
      },
      null,
      { timeout: 45000 },
    );
  } catch {
    assert("evaluated hours_eval arrived", false, "timeout");
  }
  const rowsEvaluated = await page.$$eval(
    ".sched-windows .sched-window-row",
    (els) =>
      els.map((r) => ({
        glyph: r.children[0] ? r.children[0].textContent.trim() : "",
        label: r.children[1] ? r.children[1].textContent : "",
        value: r.children[2] ? r.children[2].textContent : "",
      })),
  );
  assert(
    "evaluated: same row count and labels — only glyph/value changed",
    rowsEvaluated.length === rowsUnevaluated.length &&
      JSON.stringify(rowsEvaluated.map((r) => r.label)) ===
        JSON.stringify(rowsUnevaluated.map((r) => r.label)),
    JSON.stringify(rowsEvaluated),
  );
  await shot(page, "schedule-2-evaluated.png");
  // The no-jurisdiction one-row state, fresh page.
  await page.goto(AFTER, { waitUntil: "networkidle" });
  await pinManually(page);
  assert(
    "no jurisdiction: the one-row answer",
    (await page
      .getByText("Select a jurisdiction to see its windows")
      .count()) === 1,
  );

  log("— L5: corridor bar —");
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

  log("— L7: detected-vs-applied via the real picker (#214) —");
  await page.goto(AFTER, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pick Location on Map/i }).click();
  // The typed-coords row sits behind its toggle under the search bar.
  await page
    .getByRole("button", { name: /Or enter coordinates manually/i })
    .click();
  await page.getByLabel("Latitude", { exact: true }).fill("39.71466");
  await page.getByLabel("Longitude", { exact: true }).fill("-104.94071");
  // Detection fires on valid coords (a real Overpass round trip, ~15s+
  // cold).  A multi-candidate pin holds Save disabled until a pick, so
  // wait for EITHER an offered Bayaud row OR an already-settled Save.
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
  const modalNote = await page
    .getByText(/road geometry governs the drawing/)
    .count();
  assert(
    "picker: the bearing role note stands beside the field (GO ruling 7)",
    modalNote >= 1,
  );
  await shot(page, "214-1-picker-bearing-90.png");
  await page.getByRole("button", { name: /Save & Close/ }).click();
  await page.waitForSelector(".dva", { timeout: 8000 });
  const dvaText = (await page.locator(".dva").textContent()) ?? "";
  assert(
    "#214 repro: block shows detected AND applied bearing + the governs sentence",
    /OSM detection/.test(dvaText) &&
      /Bearing/.test(dvaText) &&
      /90°/.test(dvaText) &&
      /road geometry governs the drawing — the typed bearing sets the travel-direction sign only/.test(
        dvaText,
      ),
    dvaText.slice(0, 200),
  );
  await shot(page, "214-2-detected-vs-applied.png");

  log("— L8: axe zero-new (arc16 injection idiom) —");
  async function axeIds(base) {
    const ids = {};
    await page.goto(base, { waitUntil: "networkidle" });
    await page.evaluate(AXE_SRC);
    let res = await page.evaluate(async () => await window.axe.run());
    ids.prepin = res.violations.map((v) => v.id).sort();
    await pinManually(page);
    await page.evaluate(AXE_SRC);
    res = await page.evaluate(async () => await window.axe.run());
    ids.pinned = res.violations.map((v) => v.id).sort();
    return ids;
  }
  const beforeIds = await axeIds(BEFORE);
  const afterIds = await axeIds(AFTER);
  fs.writeFileSync(
    path.join(OUT, "axe-before.json"),
    JSON.stringify(beforeIds, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT, "axe-after.json"),
    JSON.stringify(afterIds, null, 2),
  );
  for (const state of ["prepin", "pinned"]) {
    const fresh = afterIds[state].filter((id) => !beforeIds[state].includes(id));
    assert(
      `axe ${state}: zero NEW violation ids`,
      fresh.length === 0,
      `before=[${beforeIds[state]}] after=[${afterIds[state]}]`,
    );
  }

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "assertions-raw.md"),
    `# s2a10 live checks — raw log\n\n${lines.join("\n")}\n\n${
      failures === 0 ? "**ALL PASS**" : `**${failures} FAILURE(S)**`
    }\n`,
  );
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
