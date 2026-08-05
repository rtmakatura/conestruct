/**
 * Arc 12 coda — post-fix live verification of the expanded-body chip
 * (#70, coda fix 952f989, shipped in 4760308).  READ-ONLY: no
 * accounts, no DB writes, no plan saves; passive observation only.
 *
 * The merged evidence pack's transcript ends on the chip FAIL
 * (assertion 1h: "· COLORADO SUPPLEMENT" in the expanded Colorado
 * row).  This is the one-check counterpart against the shipped fix:
 *
 *   gate. healthz == origin/main == served bundle (abort on mismatch)
 *   1.   expand the Colorado accordion row at the Lakewood control
 *        pin; assert the expanded-body chip reads
 *        "CDOT S-630-1 · STANDARD PLAN"; assert /colorado supplement/i
 *        appears nowhere in the expanded body; control: the
 *        JurisdictionSection statewide-baseline line still renders its
 *        deliberate "MUTCD + Colorado Supplement" text (true
 *        legal-layer claim — excluded from the defect-class scan by
 *        scanning the audit-trail container, not the whole page).
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=<scratch>/pw/node_modules node arc12-coda-check.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out-coda");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";
const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" }; // same control pin as the pre-fix run

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
const bodyText = async (page) =>
  (((await page.locator("body").textContent().catch(() => "")) ?? "")).replace(/\s+/g, " ");

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
  // Ruled equivalence (Ryan, 2026-08-05): the served bundle stamps
  // 952f989 — the coda-fix commit, main head 4760308's direct parent.
  // Vercel skipped the docs-only evidence commit (git diff
  // 952f989..origin/main touches only validation-artifacts/committed/
  // .../live-checks/; conestruct/site delta is empty), so the served
  // frontend is byte-identical to origin/main's and contains the fix
  // under test.  Gate accepts either sha; anything else aborts.
  const RULED_EQUIVALENT_SHA = "952f98976cfb777fb838a3ce15d3869b64b521fe";
  if (servedSha === null) {
    // sha-prefix scan keyed on EXPECTED_SHA misses the equivalent sha —
    // rescan for it explicitly.
    for (const u of chunkUrls) {
      const txt = await (await gp.request.get(u)).text();
      if (txt.includes(RULED_EQUIVALENT_SHA)) {
        servedSha = RULED_EQUIVALENT_SHA;
        break;
      }
    }
  }
  log(`served bundle sha: ${servedSha}`);
  const servedOk =
    servedSha === EXPECTED_SHA || servedSha === RULED_EQUIVALENT_SHA;
  if (hz.sha !== EXPECTED_SHA || !servedOk) {
    log("**ABORT** — build gate mismatch");
    process.exit(2);
  }
  assert(
    "gate. healthz == origin/main; served bundle == origin/main or the ruled-equivalent 952f989 (docs-only delta, ruled acceptable by Ryan)",
    true,
    `healthz ${hz.sha.slice(0, 7)}, served ${servedSha.slice(0, 7)}`,
  );
  await gate.close();

  // ── The one check — Colorado row expanded body ────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.getByText("Shoulder work", { exact: true }).click();
  log("kind: shoulder work");

  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(LAKEWOOD.lat);
  await page.getByLabel("Longitude").fill(LAKEWOOD.lng);
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
  const save = page.getByRole("button", { name: "Save & Close" });
  for (let i = 0; i < 30 && !(await save.isEnabled().catch(() => false)); i++) {
    await page.waitForTimeout(1000);
  }
  await save.click();
  await page.waitForTimeout(800);

  // Lakewood detection exceeds drawable width — narrow lane width via
  // the form's own control (same as the pre-fix run).
  const gen = page.getByRole("button", { name: /Generate/ }).first();
  if (!(await gen.isEnabled().catch(() => false))) {
    await page.locator("#sh-lane-width").fill("10.5");
    await page.waitForTimeout(600);
    log("lane width narrowed to 10.5 ft (drawable-width gate)");
  }
  await page.waitForFunction(
    () => {
      const s = document.querySelector(".status-bar")?.textContent ?? "";
      return !/VERIFYING|COMPUTING/.test(s);
    },
    null,
    { timeout: 90000 },
  );
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
  log("generated");

  // Open the audit-trail expander, then the Colorado accordion row.
  await page.getByText("Verification & audit trail", { exact: false }).first().click();
  await page.waitForTimeout(1200);
  let trail = "";
  for (let tries = 0; tries < 3; tries++) {
    trail = await bodyText(page);
    if (/General Note 3/i.test(trail)) break;
    await page
      .getByText("Colorado requirements", { exact: false })
      .last()
      .click()
      .catch(() => {});
    await page.waitForTimeout(900);
  }
  assert(
    "1a. Colorado row expanded (body citations visible)",
    /CDOT S-630-1 \(July 2026\) Sheet 2, General Note 3/i.test(trail),
  );

  // Defect-class scan over the whole rendered page, excluding the one
  // deliberate occurrence by its exact text rather than by DOM
  // geometry: JurisdictionSection's statewide-baseline line
  // ("… baseline · MUTCD + Colorado Supplement only.") is a true
  // legal-layer claim (01-FINDINGS F1) and NOT this defect class.
  // After removing that exact phrase, no Supplement attribution may
  // remain anywhere — including the expanded Colorado row body where
  // the pre-fix chip lived.
  fs.writeFileSync(path.join(OUT, "page-text.txt"), trail);
  const scanText = trail.replace(/MUTCD \+ Colorado Supplement/g, "");

  assert(
    '1b. expanded-body chip reads "CDOT S-630-1 · STANDARD PLAN"',
    /CDOT S-630-1 · STANDARD PLAN/i.test(trail),
  );
  assert(
    "1c. defect-class guard: /colorado supplement/i and /CO SUPPLEMENT/i nowhere outside the deliberate baseline phrase",
    !/colorado supplement/i.test(scanText) && !/CO SUPPLEMENT/i.test(scanText),
  );
  assert(
    '1d. control: JurisdictionSection statewide "MUTCD + Colorado Supplement" line still renders',
    /MUTCD \+ Colorado Supplement/.test(trail),
  );

  await page.screenshot({
    path: path.join(OUT, "01-colorado-row-expanded.png"),
    fullPage: true,
  });
  log("screenshot: 01-colorado-row-expanded.png");

  await ctx.close();
  await browser.close();

  lines.push(`\n**Total failures: ${failures}**\n`);
  fs.writeFileSync(path.join(OUT, "assertions-raw.md"), lines.join("\n"));
  process.exit(failures === 0 ? 0 : 1);
})();
