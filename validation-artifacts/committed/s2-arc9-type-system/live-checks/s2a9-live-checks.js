/** s2-arc9 live checks (Refs #226) — READ-ONLY, local before/after run.
 *
 *  BEFORE = the main checkout's dev server (pre-arc HEAD) on :3111.
 *  AFTER  = the issue-226-type-roles worktree's dev server on :3112.
 *  (GO sequence 7: local for now; the prod re-run happens after ship.)
 *
 *  Per live kind (shoulder / flagger_lane_closure / near_intersection):
 *    - pin via the manual-entry fallback (deterministic, no Mapbox), so
 *      the full panel is enabled, then full-page before/after shots and
 *      a grayscale (CSS filter) variant of the after shot — the #226
 *      acceptance desaturation check.
 *  Plus the picker modal (GO ruling 5 — the widened surface on record).
 *
 *  Type-system spot assertions on AFTER (computed styles, mounted):
 *    - section span: white ink, 2px letter-spacing (0.20em @ 10px), mono
 *    - STEP tag: dim ink (#93a0b0), textContent still "STEP 2" (caps)
 *    - field label (.field-label-row): sans, 12px, no text-transform
 *    - provenance (.tr-prov): dotted underline, no text-transform
 *    - rail entry: byte-identical pre-#226 values (0.08em @ 10px mono)
 *
 *  Axe (arc16 injection idiom — axe.min.js from the site node_modules):
 *  same states on BEFORE and AFTER; assert zero NEW violation ids.
 *
 *  No saves, no DB writes; the pin is client state on a dev server.
 *
 *  Run (repo root node_modules carries playwright):
 *    set NODE_PATH=C:\Users\rtmak\Documents\traffic-control-tool\node_modules
 *    node s2a9-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "outS2A9LC");
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
  // The manual fallback is the deterministic pin path — no Mapbox.
  // exact — the rail's Location blocker aria-label also contains the
  // phrase "enter manually".
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    // The manual-fallback rows are <div><label/><input/></div> — take
    // the label's direct sibling (an ancestor-div filter over-matches).
    const input = page
      .locator(`label:text-is("${labelText}")`)
      .locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  // The first non-zero coordinate flips hasPin, swapping the unset
  // block for LocationSummary (the fallback unmounts mid-fill) — so
  // fill Latitude, then reopen the summary's own manual editor for the
  // rest.
  await fill("Latitude", "39.714660");
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", "-104.940710");
  await fill("Bearing (° from N)", "85");
  await fill("Work zone (ft)", "400");
  // The panel enables once hasLocation flips; the rail's Location entry
  // leaves the blocker state.
  await page.waitForTimeout(400);
}

async function statesFor(page, base, tag, withGray) {
  for (const k of KINDS) {
    await page.goto(base, { waitUntil: "networkidle" });
    // Substring name match — the button's accessible name is the kind
    // label + the TA/sheet citation concatenated.
    await page.getByRole("button", { name: k.label }).click();
    await pinManually(page);
    await shot(page, `${tag}-${k.slug}.png`);
    if (withGray) {
      await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
      await shot(page, `${tag}-${k.slug}-gray.png`);
    }
  }
  // The picker modal (GO ruling 5 — one voice includes the modal).
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pick Location on Map/i }).click();
  await page.waitForTimeout(1500);
  await shot(page, `${tag}-modal.png`);
  if (withGray) {
    await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
    await shot(page, `${tag}-modal-gray.png`);
  }
}

async function axeIds(page, base) {
  const ids = {};
  // State A: pre-pin default (the s2a8 axe state family).
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(AXE_SRC);
  let res = await page.evaluate(async () => await window.axe.run());
  ids.prepin = res.violations.map((v) => v.id).sort();
  // State B: shoulder pinned via manual entry.
  await pinManually(page);
  await page.evaluate(AXE_SRC);
  res = await page.evaluate(async () => await window.axe.run());
  ids.pinned = res.violations.map((v) => v.id).sort();
  return ids;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  log("— BEFORE captures (pre-arc HEAD on :3111) —");
  await statesFor(page, BEFORE, "before", false);

  log("— AFTER captures (issue-226-type-roles on :3112) —");
  await statesFor(page, AFTER, "after", true);

  log("— AFTER type-system spot assertions (computed, mounted) —");
  await page.goto(AFTER, { waitUntil: "networkidle" });
  const style = (sel, prop) =>
    page.$eval(
      sel,
      (el, p) => getComputedStyle(el).getPropertyValue(p),
      prop,
    );
  const sectionSel = ".setup-panel .tr-section";
  assert(
    "section role: white ink",
    (await style(sectionSel, "color")) === "rgb(255, 255, 255)",
  );
  assert(
    "section role: 0.20em tracking at 10px = 2px",
    (await style(sectionSel, "letter-spacing")) === "2px",
  );
  const stepSel = ".setup-panel .tr-step";
  assert(
    "step-index role: dim ink (#93a0b0), not --act",
    (await style(stepSel, "color")) === "rgb(147, 160, 176)",
  );
  const stepText = await page.$eval(
    "#rail-step-location .tr-step",
    (el) => el.textContent,
  );
  assert(
    'STEP tag textContent still literal caps "STEP 2"',
    stepText === "STEP 2",
    JSON.stringify(stepText),
  );
  const flSel = ".setup-panel .field-label-row";
  assert(
    "field-label role: 12px sans",
    (await style(flSel, "font-size")) === "12px" &&
      /Inter|ui-sans-serif|system-ui/i.test(await style(flSel, "font-family")),
  );
  assert(
    "field-label role: no text-transform",
    (await style(flSel, "text-transform")) === "none",
  );
  const provSel = ".setup-panel .tr-prov";
  assert(
    "provenance role: dotted underline",
    /underline/.test(await style(provSel, "text-decoration-line")) &&
      /dotted/.test(await style(provSel, "text-decoration-style")),
  );
  assert(
    "provenance role: no text-transform (ruling 1 — voice, not CSS)",
    (await style(provSel, "text-transform")) === "none",
  );
  const railSel = ".progress-rail .rail-entry";
  assert(
    "rail entry byte-identical: 10px mono, 0.8px (0.08em) tracking, uppercase",
    (await style(railSel, "font-size")) === "10px" &&
      (await style(railSel, "letter-spacing")) === "0.8px" &&
      (await style(railSel, "text-transform")) === "uppercase",
  );

  log("— axe zero-new (arc16 injection idiom) —");
  const beforeIds = await axeIds(page, BEFORE);
  const afterIds = await axeIds(page, AFTER);
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
    `# s2a9 live checks — raw log\n\n${lines.join("\n")}\n\n${
      failures === 0 ? "**ALL PASS**" : `**${failures} FAILURE(S)**`
    }\n`,
  );
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
