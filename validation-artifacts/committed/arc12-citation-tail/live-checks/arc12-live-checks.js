/**
 * Arc 12 live-site verification — the citation recite on production
 * (#70/#83, ship cac32db).  READ-ONLY: no accounts, no DB writes, no
 * plan saves; downloads are stateless renders through the page's own
 * controls; passive observation only.
 *
 * Checks (per the arc prompt):
 *   gate. healthz == origin/main == served bundle (abort on mismatch)
 *   1. audit panel Colorado section renders CDOT S-630-1 attributions
 *      (Sheet 2 Notes 3/4/8/22 as applicable, Sheet 23 Case 38 info
 *      row, "G20-5P Work Zone signs" label); "CO Supplement Sec"
 *      nowhere in the rendered panel
 *   2. reduced-speed narrative + Fines Double section carry the Sheet
 *      12 recite (no "§2B.13 +" prefix) — panel + served MHT package
 *   3. Rule 9: rendered citations name "July 2026"
 *   4. the audit's CDOT source URL ("(19-Page Set)" filename, CDOT's
 *      own quirk) resolves — leave-unless-404 per the GO
 *   5. control: JurisdictionSection's statewide "MUTCD + Colorado
 *      Supplement" line still renders (true legal-layer claim; its
 *      disappearance would be a regression)
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=<scratch>/pw/node_modules node arc12-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out12");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";
const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" }; // Arc 5 control pin (divided shoulder in Arc 9)

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
async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: full });
  log(`screenshot: ${name}`);
}
const bodyText = async (page) =>
  (((await page.locator("body").textContent().catch(() => "")) ?? "")).replace(/\s+/g, " ");

async function openPickerWithCoords(page, coords) {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(coords.lat);
  await page.getByLabel("Longitude").fill(coords.lng);
}
async function pickAnyCandidate(page) {
  for (let i = 0; i < 40; i++) {
    const t = (
      (await page.getByRole("dialog").textContent().catch(() => "")) ?? ""
    ).replace(/\s+/g, " ");
    if (!/Detecting roads at pin|Classifying road/i.test(t)) break;
    await page.waitForTimeout(1000);
  }
  const rows = page.locator("button", { hasText: "m from pin" });
  if ((await rows.count()) > 0) {
    const label = ((await rows.first().textContent()) ?? "").trim();
    await rows.first().click();
    log(`candidate picked: "${label}"`);
  } else log("candidate: (auto)");
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
async function waitSettled(page, timeout = 90000) {
  await page.waitForFunction(
    () => {
      const s = document.querySelector(".status-bar")?.textContent ?? "";
      return !/VERIFYING|COMPUTING/.test(s);
    },
    null,
    { timeout },
  );
}
async function generateAndWait(page) {
  const gen = page.getByRole("button", { name: /Generate/ }).first();
  for (let i = 0; i < 60 && !(await gen.isEnabled().catch(() => false)); i++) {
    await page.waitForTimeout(1000);
  }
  await gen.click();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        /Download PDF/.test(b.textContent ?? ""),
      ),
    null,
    { timeout: 120000 },
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Build gate ────────────────────────────────────────────────────
  const gate = await browser.newContext();
  const gp = await gate.newPage();
  const hz = await (
    await gp.request.get(
      "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz",
    )
  ).json();
  log(`healthz sha: ${hz.sha}`);
  log(`expected (git rev-parse origin/main): ${EXPECTED_SHA}`);
  await gp.goto(SITE, { waitUntil: "networkidle" });
  const chunkUrls = await gp.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]"))
      .map((s) => s.src)
      .filter((s) => s.includes("/_next/static")),
  );
  let servedSha = null;
  for (const u of chunkUrls) {
    const txt = await (await gp.request.get(u)).text();
    const m = txt.match(new RegExp(`${EXPECTED_SHA.slice(0, 7)}[0-9a-f]{33}`));
    if (m) {
      servedSha = m[0];
      break;
    }
  }
  log(`served bundle sha: ${servedSha}`);
  if (hz.sha !== EXPECTED_SHA || servedSha !== EXPECTED_SHA) {
    log("**ABORT** — build gate mismatch");
    process.exit(2);
  }
  assert("gate. healthz == origin/main == served bundle", true, hz.sha);
  await gate.close();

  // ── Context A — divided shoulder + reduction at the Lakewood pin ──
  lines.push("\n## Context A — reduced-speed divided shoulder, audit panel + served MHT\n");
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1600 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.getByText("Shoulder work", { exact: true }).click();
  log("kind: shoulder work");
  await openPickerWithCoords(page, LAKEWOOD);
  await pickAnyCandidate(page);
  assert("a1. picker Save & Close enabled after candidate", await saveWhenReady(page));

  // Reduction toggle (defaults to posted − 10, a ≤15 single-sign case)
  const toggle = page.getByText("Apply work-zone speed reduction", { exact: false }).first();
  await toggle.click();
  await page.waitForTimeout(600);
  const formText = await bodyText(page);
  assert(
    "a2. form reduction hint cites S-630-1 Sheet 2 Note 3 (not CO §2B.13(A))",
    /S-630-1 Sheet 2 Note 3/.test(formText) && !/CO §2B\.13/.test(formText),
  );

  // The Lakewood detection (S Wadsworth, 4 lanes × 12 ft + 10 ft
  // shoulder) exceeds the sheet's drawable width — narrow the lane
  // width through the form's own control, as the button title advises.
  const gen = page.getByRole("button", { name: /Generate/ }).first();
  if (!(await gen.isEnabled().catch(() => false))) {
    await page.locator("#sh-lane-width").fill("10.5");
    await page.waitForTimeout(600);
    log("lane width narrowed to 10.5 ft (drawable-width gate)");
  }
  await waitSettled(page);
  await generateAndWait(page);
  log("generated");
  await shot(page, "01-post-generate.png", true);

  // Open the collapsed "Verification & audit trail" expander, then any
  // collapsed sections inside it, so bodyText sees the details.
  await page.getByText("Verification & audit trail", { exact: false }).first().click();
  await page.waitForTimeout(1200);
  // The trail is a one-at-a-time accordion — expand and capture each
  // row separately.
  async function expandRow(rowText, openPattern) {
    for (let tries = 0; tries < 3; tries++) {
      const bt = await bodyText(page);
      if (openPattern.test(bt)) return bt;
      await page.getByText(rowText, { exact: false }).last().click().catch(() => {});
      await page.waitForTimeout(900);
    }
    return await bodyText(page);
  }
  const tCol = await expandRow("Colorado requirements", /General Note 3/i);
  fs.writeFileSync(path.join(OUT, "audit-colorado-text.txt"), tCol);
  await shot(page, "02-audit-colorado-section.png", true);
  const tFines = await expandRow("Fines Double envelope", /operational rules/i);
  fs.writeFileSync(path.join(OUT, "audit-fines-text.txt"), tFines);
  const t = tCol + " || " + tFines;
  fs.writeFileSync(path.join(OUT, "audit-panel-text.txt"), t);

  // 1. Colorado section attributions
  assert('1a. section title "Colorado requirements (CDOT S-630-1)"', /Colorado requirements \(CDOT S-630-1\)/.test(t));
  assert('1b. speed-reduction citation → Sheet 2, General Note 3', /CDOT S-630-1 \(July 2026\) Sheet 2, General Note 3/i.test(t));
  assert('1c. plaque check label "G20-5P Work Zone signs every 2,640 ft" + Note 4', /G20-5P Work Zone signs every 2,640 ft/i.test(t) && /Sheet 2, General Note 4/i.test(t));
  assert('1d. both-sides citation → Sheet 2, General Note 8', /Sheet 2, General Note 8/i.test(t));
  assert('1e. flagger-lighting citation → Sheet 2, General Note 22', /Sheet 2, General Note 22/i.test(t));
  assert('1f. AADT info row → Sheet 23, Case 38 Note 1', /Sheet 23, Case 38 Note 1/i.test(t));
  assert('1g. "CO Supplement Sec" nowhere in rendered page', !/CO Supplement Sec/i.test(t));
  assert(
    '1h. no "COLORADO SUPPLEMENT" / "CO SUPPLEMENT" attribution chip in the trail',
    !/CO SUPPLEMENT|COLORADO SUPPLEMENT ·|· COLORADO SUPPLEMENT/.test(t),
  );

  // 2. Fines Double + narrative recite
  assert('2a. Fines Double cites Sheet 12 Fines Double Signing Notes', /Sheet 12, Fines Double Signing Notes/.test(t));
  assert('2b. no "§2B.13 and" / "§ 2B.13" prefix anywhere', !/2B\.13/.test(t));
  assert('2c. case narrative single-side/Note-8 or divided phrasing free of §6C.04(A)', !/6C\.04/.test(t));

  // 3. Rule 9 edition naming
  // (the trail's cite chips render uppercase — match case-insensitively)
  assert('3. rendered citations name "July 2026"', /\(July 2026\)/i.test(t));

  // 5. statewide-baseline control (deliberately standing text)
  assert('5. JurisdictionSection statewide "MUTCD + Colorado Supplement" line still renders', /MUTCD \+ Colorado Supplement/.test(t));

  // Served narrative markdown (Crew instructions card → Download .md)
  const mdBtn = page.getByRole("button", { name: /Download \.md/ }).first();
  let served = "";
  if (await mdBtn.isVisible().catch(() => false)) {
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      mdBtn.click(),
    ]);
    const dest = path.join(OUT, "served-narrative.md");
    await dl.saveAs(dest);
    log(`downloaded: served-narrative.md (${fs.statSync(dest).size} B)`);
    served = fs.readFileSync(dest, "utf-8");
  } else {
    log("Download .md button not found — narrative assertions fall back to panel text");
    served = t;
  }
  const servedTxt = served.replace(/\s+/g, " ");
  assert('2d. served narrative: Fines Double section cites "CDOT S-630-1 (July 2026) Sheet 12, Fines Double Signing Notes"', /CDOT S-630-1 \(July 2026\) Sheet 12, Fines Double Signing Notes/.test(servedTxt));
  assert('2e. served narrative: spacing-adjust clause cites Sheet 2 General Note 4', /per Sheet 2 General Note 4/.test(servedTxt));
  assert('2f. served narrative: 15-mph bullet cites Sheet 2 General Note 3', /15 mph \(CDOT S-630-1 Sheet 2 General Note 3\)/.test(servedTxt));
  assert('2g. served narrative: no "CO Supplement §" / "Colorado Supplement §" attribution', !/CO Supplement §|Colorado Supplement §/.test(servedTxt));
  assert('2h. served narrative: Reference inventory line still lists the Colorado Supplement (deliberate)', /Colorado Supplement \(effective January 18, 2026\)/.test(servedTxt));

  // 4. the CDOT "(19-Page Set)" URL — leave-unless-404
  const cdotUrl =
    "https://www.codot.gov/safety/traffic-safety/assets/s-standard-plans/s-630-1/S-630-01%20(19-Page%20Set).pdf";
  let status = 0;
  try {
    const res = await page.request.get(cdotUrl, { timeout: 30000, maxRedirects: 5 });
    status = res.status();
  } catch (e) {
    log(`CDOT URL fetch error: ${e.message}`);
  }
  assert("4. CDOT source URL resolves (2xx/3xx)", status >= 200 && status < 400, `HTTP ${status}`);

  await ctx.close();
  await browser.close();

  lines.push(`\n**Total failures: ${failures}**\n`);
  fs.writeFileSync(path.join(OUT, "assertions-raw.md"), lines.join("\n"));
  process.exit(failures === 0 ? 0 : 1);
})();
