/**
 * Arc 13 live checks — #51 (plaque values from the shared helper) +
 * #98 (federal citations single-sourced), verified on production.
 * READ-ONLY: no accounts, no DB writes, no plan saves; passive
 * observation only.
 *
 * Scope (the Arc 13 GO's "honest minimum", run belatedly at Arc 14's
 * GO after handoff wrongly recorded it done):
 *
 *   gate. healthz == origin/main == served bundle (abort on mismatch;
 *         mid-propagation pause-and-retry is the runner's job, not
 *         this script's — it aborts, the runner re-runs)
 *   1.   one freeway shoulder plan (the arc13 baseline scenario:
 *        freeway / 65 mph / 3 lanes / 1,000 ft — same numbers as
 *        FREEWAY_SHOULDER in dump_arc13_surfaces.py, entered through
 *        the real form) — audit trail:
 *        1a. taper cite chip "MUTCD § 6B.08" + footer "TABLE 6B-3"
 *        1b. buffer cite chip "MUTCD § 6B.06"
 *        1c. spacing cite chip "MUTCD § 6K.01"
 *        1d. taper source prose byte-equal to the committed
 *            after-98.json baseline (whitespace-normalized contains)
 *        1e. audit sign table renders the #51 plaque values:
 *            "NEXT 1,862 FT (under W21-5aR at A)" and
 *            "NEXT 1 MILE (under second W21-5aR)"
 *   2.   crew narrative .md (Download .md through the real UI):
 *        2a. W16-2a schedule row == committed baseline row
 *        2b. W7-3a schedule row == committed baseline row
 *        2c. cross-surface: the narrative's plaque VALUES equal the
 *            audit sign table's (suffixes differ by design)
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=<pw>/node_modules node arc13-live-check.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out13");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";
const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" }; // arc12 control pin

// Committed baselines (after-98.json freeway_shoulder_g1_plaques +
// after-98-freeway-narrative.md) — restated here verbatim so a drift
// on prod fails against the tracked values, not a re-fetch.
const BASE = {
  taperSource:
    "MUTCD 11th Ed. Sec 6B.08, Table 6B-3. Shoulder closures use L/3 per Sec 6B.08 (Table 6B-3).",
  auditW16: "NEXT 1,862 FT (under W21-5aR at A)",
  auditW7: "NEXT 1 MILE (under second W21-5aR)",
  mdW16: "| W16-2a | NEXT 1,862 FT (under upstream W21-5aR) | 1,000 ft upstream |",
  mdW7: "| W7-3a | NEXT 1 MILE (under downstream W21-5aR) | 750 ft upstream |",
  value16: "NEXT 1,862 FT",
  value7: "NEXT 1 MILE",
};

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
const norm = (s) => (s ?? "").replace(/\s+/g, " ");
const bodyText = async (page) =>
  norm(await page.locator("body").textContent().catch(() => ""));

// React-controlled range/select inputs need the native setter + input
// event; Playwright fill() rejects type=range.
async function setReactValue(page, selector, value) {
  await page.$eval(
    selector,
    (el, v) => {
      const proto =
        el instanceof HTMLSelectElement
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    String(value),
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
  assert("gate. healthz == origin/main == served bundle", true, hz.sha.slice(0, 7));
  await gate.close();

  // ── The freeway shoulder plan ─────────────────────────────────────
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
    const t = norm(await page.getByRole("dialog").textContent().catch(() => ""));
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

  // Baseline scenario, entered as the operator would (manual-supersede
  // over the Lakewood detection is the #112 convention): freeway
  // (divided derives), 65 mph, 3 lanes per direction, 1,000 ft zone.
  // Work type stays at the form default (utility_locate — the baseline
  // payload's value). Lane width stays at the 12 ft default unless the
  // drawable-width gate blocks Generate; the plaque values and every
  // asserted cite string are lane-width-independent (shoulder taper
  // L/3 uses shoulder width; stations use A + taper + buffer).
  await setReactValue(page, "#sh-road-type", "freeway");
  await page.waitForTimeout(300);
  await setReactValue(page, "#sh-speed", "65");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "3", exact: true }).click();
  await setReactValue(page, "#sh-work-len", "1000");
  await page.waitForTimeout(600);
  log("scenario set: freeway / 65 mph / 3 lanes / 1,000 ft");

  const gen = page.getByRole("button", { name: /Generate/ }).first();
  // Drawable-width fallback (arc12 precedent at this pin).
  for (const w of ["11", "10.5", "10", "9.5", "9"]) {
    await page.waitForFunction(
      () => {
        const s = document.querySelector(".status-bar")?.textContent ?? "";
        return !/VERIFYING|COMPUTING/.test(s);
      },
      null,
      { timeout: 90000 },
    );
    if (await gen.isEnabled().catch(() => false)) break;
    await setReactValue(page, "#sh-lane-width", w);
    await page.waitForTimeout(600);
    log(`lane width narrowed to ${w} ft (drawable-width gate)`);
  }
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

  // ── 1. audit trail: cite chips + source prose + sign table ────────
  await page.getByText("Verification & audit trail", { exact: false }).first().click();
  await page.waitForTimeout(1500);
  // The trail renders as accordion rows (row 01 open by default; the
  // taper source prose and the advance sign table live in expanded
  // bodies).  Clicking a row toggles it, so a blanket expand-all can
  // collapse the default-open row — instead scan the UNION of page
  // text: once as-opened, then once after each row click, so every
  // row's expanded body is captured regardless of single-open
  // accordion behavior.  All assertions below are positive
  // (contains-checks), so the union is sound.
  let trail = await bodyText(page);
  for (const title of [
    "Taper length calculation",
    "Buffer space calculation",
    "Channelizing device spacing",
    "Advance warning sign set",
    "Colorado requirements",
  ]) {
    await page.getByText(title, { exact: false }).last().click().catch(() => {});
    await page.waitForTimeout(700);
    trail += " " + (await bodyText(page));
    if (title === "Advance warning sign set") {
      await page.screenshot({
        path: path.join(OUT, "02-advance-sign-table.png"),
        fullPage: true,
      });
      log("screenshot: 02-advance-sign-table.png");
    }
  }
  fs.writeFileSync(path.join(OUT, "page-text.txt"), trail);

  // Chips render uppercase — match case-insensitively on the cite and
  // footer content the #98 constants feed.
  assert('1a. taper cite chip "MUTCD § 6B.08" + footer "TABLE 6B-3"',
    /MUTCD § 6B\.08/i.test(trail) && /TABLE 6B-3/i.test(trail));
  assert('1b. buffer cite chip "MUTCD § 6B.06"', /MUTCD § 6B\.06/i.test(trail));
  assert('1c. spacing cite chip "MUTCD § 6K.01"', /MUTCD § 6K\.01/i.test(trail));
  // The web trail deliberately renders section `source` prose only for
  // geometry/approaches (AuditTrail.tsx); the taper/buffer/spacing
  // source sentences serve through the audit PDF ("↓ Audit PDF",
  // audit_blocks.py renders "Source: {taper.source}").  1d therefore
  // checks the PDF — the surface a user actually receives the prose on.
  let auditPdfText = "";
  const pdfBtn = page.getByText(/Audit PDF/, { exact: false }).first();
  if (await pdfBtn.isVisible().catch(() => false)) {
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      pdfBtn.click(),
    ]);
    const pdfDest = path.join(OUT, "served-audit.pdf");
    await dl.saveAs(pdfDest);
    log(`downloaded: served-audit.pdf (${fs.statSync(pdfDest).size} B)`);
    const { execFileSync } = require("child_process");
    auditPdfText = norm(
      execFileSync(
        "python",
        [
          "-c",
          "import sys,pypdf;print(' '.join(p.extract_text() for p in pypdf.PdfReader(sys.argv[1]).pages))",
          pdfDest,
        ],
        { encoding: "utf-8" },
      ),
    );
    fs.writeFileSync(path.join(OUT, "served-audit-pdf-text.txt"), auditPdfText);
  } else {
    log("Audit PDF button not found — 1d will fail below");
  }
  assert("1d. taper source prose (audit PDF surface) == committed after-98 baseline",
    auditPdfText.includes(BASE.taperSource));
  assert(`1e. audit sign table: "${BASE.auditW16}" + "${BASE.auditW7}"`,
    trail.includes(BASE.auditW16) && trail.includes(BASE.auditW7));

  await page.screenshot({
    path: path.join(OUT, "01-freeway-audit-trail.png"),
    fullPage: true,
  });
  log("screenshot: 01-freeway-audit-trail.png");

  // ── 2. crew narrative .md ─────────────────────────────────────────
  const mdBtn = page.getByRole("button", { name: /Download \.md/ }).first();
  let served = "";
  if (await mdBtn.isVisible().catch(() => false)) {
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      mdBtn.click(),
    ]);
    const dest = path.join(OUT, "served-freeway-narrative.md");
    await dl.saveAs(dest);
    log(`downloaded: served-freeway-narrative.md (${fs.statSync(dest).size} B)`);
    served = fs.readFileSync(dest, "utf-8");
  } else {
    failures++;
    log("**FAIL** — Download .md button not found (narrative surface unreachable)");
  }
  const servedN = norm(served);
  assert("2a. narrative W16-2a schedule row == committed baseline row",
    servedN.includes(norm(BASE.mdW16)));
  assert("2b. narrative W7-3a schedule row == committed baseline row",
    servedN.includes(norm(BASE.mdW7)));
  assert("2c. cross-surface: narrative plaque VALUES equal the audit sign table's",
    servedN.includes(`${BASE.value16} (under upstream W21-5aR)`) &&
      servedN.includes(`${BASE.value7} (under downstream W21-5aR)`) &&
      trail.includes(BASE.auditW16) &&
      trail.includes(BASE.auditW7));

  await ctx.close();
  await browser.close();

  lines.push(`\n**Total failures: ${failures}**\n`);
  fs.writeFileSync(path.join(OUT, "assertions-raw.md"), lines.join("\n"));
  process.exit(failures === 0 ? 0 : 1);
})();
