/**
 * s2-arc1 live checks (Refs #198, #123) — production /sandbox, headless,
 * READ-ONLY: transient picker/form state only, nothing saved server-side.
 *
 * Scope (from the GO):
 *   F3 — in-modal lanes clamp annotation + seam clamped note
 *   F1 — changed-detection re-pick names the laneWidth overwrite
 *   F2 — flagger picker lanes/divided overrides -> skipped notes
 *   F4 — picker-lowered speed clears the reduction with a note, no 400
 *   #123 — divided rationale/value agreement measured on real roads
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=conestruct/site/node_modules node s2a1-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const AXE_SRC = fs.readFileSync(
  require.resolve("axe-core/axe.min.js"),
  "utf-8",
);
async function runAxe(page, outName) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    }),
  );
  const compact = res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  fs.writeFileSync(
    path.join(OUT, outName),
    JSON.stringify(compact, null, 2),
  );
  return compact;
}

const OUT = path.join(__dirname, "outS2A1");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" }; // arc house pin
const GREELEY = { lat: "40.404292", lng: "-104.715863" }; // changed re-pick
const COLFAX = { lat: "39.7400", lng: "-104.9663" }; // low posted speed
// #123 probes: a primary couplet control + candidate lower-class one-ways.
const ONEWAY_PROBES = [
  { name: "Lincoln St (primary couplet control)", lat: "39.7337", lng: "-104.9866" },
  { name: "E 13th Ave", lat: "39.7368", lng: "-104.9750" },
  { name: "E 14th Ave", lat: "39.7403", lng: "-104.9749" },
];

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
async function pickAnyCandidate(page) {
  await waitDetection(page);
  const rows = page.locator("button", { hasText: "m from pin" });
  if ((await rows.count()) > 0) {
    await rows.first().click();
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
function fieldRow(page, label) {
  return page
    .getByRole("dialog")
    .locator("div.grid", { hasText: label })
    .last();
}
async function freshPage(ctx) {
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "networkidle" });
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2000 } });

  // ── Gate ──────────────────────────────────────────────────────────
  const gp = await ctx.newPage();
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
    log("**ABORT** — build gate mismatch (runner: pause and retry if mid-propagation)");
    process.exit(2);
  }
  assert("gate. healthz == origin/main == served bundle", true, hz.sha.slice(0, 7));
  await gp.close();

  // ── F3 + F1 (one page: clamp in-modal + at seam, then re-pick) ────
  {
    const page = await freshPage(ctx);
    await openPickerWithCoords(page, LAKEWOOD, /Pick Location on Map/);
    const picked = await pickAnyCandidate(page);
    log(picked ? "Lakewood candidate picked" : "no candidate at Lakewood pin");

    // F3: enter 6 in the lanes editor -> in-modal annotation.
    const lanesInput = fieldRow(page, "Lanes per direction").locator(
      'input[type="number"]',
    );
    await lanesInput.fill("6");
    await page.waitForTimeout(400);
    const modalText = (
      (await page.getByRole("dialog").textContent()) ?? ""
    ).replace(/\s+/g, " ");
    assert(
      "F3a. in-modal clamp annotation on the lanes row",
      /plans draw at most 4 lanes per direction\. Plan will use 4\./.test(modalText),
    );
    await page
      .getByRole("dialog")
      .screenshot({ path: path.join(OUT, "01-f3-modal-clamp-note.png") })
      .catch(() => {});
    {
      const ax = await runAxe(page, "axe-modal-clamp-note.json");
      assert(
        "AX1. axe zero violations — open modal with the clamp annotation",
        ax.length === 0,
        ax.length ? `${ax.length} finding(s) — axe-modal-clamp-note.json` : "0",
      );
    }

    const saved = await saveWhenReady(page);
    log(saved ? "picker saved (Lakewood + lanes=6 override)" : "save unavailable");
    const f3note = page.getByText(/Lanes 4\/direction \(clamped from 6 manual entry/);
    assert("F3b. seam clamped note visible after save", await f3note.isVisible().catch(() => false));
    await page.screenshot({ path: path.join(OUT, "02-f3-seam-note.png"), fullPage: false }).catch(() => {});
    {
      const ax = await runAxe(page, "axe-seam-notes.json");
      assert(
        "AX2. axe zero violations — page with seam handoff notes visible",
        ax.length === 0,
        ax.length ? `${ax.length} finding(s) — axe-seam-notes.json` : "0",
      );
    }

    // F1: manual lane width 10.5 via the real form range, then a CHANGED
    // detection (Thornton) re-imposes 12 — the overwrite must be named.
    await page.evaluate(() => {
      const el = document.getElementById("sh-lane-width");
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(el, "10.5");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(400);
    await openPickerWithCoords(page, GREELEY, /Edit Location & Corridor/);
    const picked2 = await pickAnyCandidate(page);
    log(picked2 ? "Greeley candidate picked (changed detection)" : "no candidate at Greeley pin");
    if (!picked2) {
      // A null-road save clears detection instead of re-applying — the
      // note correctly has nothing to name.  Runner must not save that.
      assert("F1. changed-detection laneWidth overwrite named at the seam", false, "no second candidate — pin needs adjusting");
    }
    const saved2 = picked2 ? await saveWhenReady(page) : false;
    log(saved2 ? "picker saved (Greeley)" : "second save skipped/unavailable");
    const f1note = page.getByText(/Lane width set to 12 ft \(OSM detection — was 10\.5 ft\)\./);
    assert("F1. changed-detection laneWidth overwrite named at the seam", await f1note.isVisible().catch(() => false));
    // Log (not assert) any sibling family-1 notes this pin change produced.
    const pageText = ((await page.textContent("body")) ?? "").replace(/\s+/g, " ");
    const sibling = pageText.match(/Lanes set to \d\/direction \([^)]+\)\./);
    if (sibling) log(`F1 sibling note also visible: "${sibling[0]}"`);
    await page.screenshot({ path: path.join(OUT, "03-f1-seam-note.png"), fullPage: false }).catch(() => {});
    await page.close();
  }

  // ── F2: flagger kind, picker lanes/divided overrides -> skipped ───
  {
    const page = await freshPage(ctx);
    await page.getByText("Flagger lane closure").click();
    await page.waitForTimeout(400);
    await openPickerWithCoords(page, LAKEWOOD, /Pick Location on Map/);
    let picked = await pickAnyCandidate(page);
    if (!picked) {
      // Transient detection flake — re-enter the coords to retrigger.
      log("no candidate (flagger) — one retry");
      await page.getByLabel("Latitude").fill(LAKEWOOD.lat);
      await page.getByLabel("Longitude").fill(LAKEWOOD.lng);
      picked = await pickAnyCandidate(page);
    }
    log(picked ? "Lakewood candidate picked (flagger)" : "no candidate (flagger) after retry");
    if (!picked) {
      assert("F2a. lanes override skipped note (flagger has no lane count)", false, "no candidate after retry");
      assert("F2b. divided override skipped note (flagger has no divided toggle)", false, "no candidate after retry");
    } else {
    const lanesInput = fieldRow(page, "Lanes per direction").locator(
      'input[type="number"]',
    );
    await lanesInput.fill("3");
    // Toggle divided to the opposite of the detected value so an
    // override registers.
    const dividedRow = fieldRow(page, "Divided");
    const dividedOn = await dividedRow
      .getByRole("button", { name: "Divided", exact: true })
      .evaluate((b) => b.className.includes("--act"))
      .catch(() => null);
    await dividedRow
      .getByRole("button", { name: dividedOn ? "Undivided" : "Divided", exact: true })
      .click()
      .catch(() => log("divided toggle not clickable — logged, lanes note still asserted"));
    await page.waitForTimeout(300);
    const saved = await saveWhenReady(page);
    log(saved ? "picker saved (flagger + lanes/divided overrides)" : "save unavailable");

    assert(
      "F2a. lanes override skipped note (flagger has no lane count)",
      await page
        .getByText(/Lanes setting 3\/direction from the picker not applied — flagger plans don't take a lane count\./)
        .isVisible()
        .catch(() => false),
    );
    assert(
      "F2b. divided override skipped note (flagger has no divided toggle)",
      await page
        .getByText(/Divided setting from the picker not applied — flagger plans don't take a divided toggle\./)
        .isVisible()
        .catch(() => false),
    );
    await page.screenshot({ path: path.join(OUT, "04-f2-skipped-notes.png"), fullPage: false }).catch(() => {});
    }
    await page.close();
  }

  // ── F4: standing reduction cleared by a low detected speed ────────
  {
    const page = await freshPage(ctx);
    // Default shoulder speed 65 -> reduction toggles on at 55.
    await page.getByText("Apply work-zone speed reduction").click();
    await page.waitForTimeout(300);
    const wzInput = page.locator("#sh-wz-speed");
    const wzBefore = await wzInput.inputValue().catch(() => null);
    log(`reduction enabled at ${wzBefore} mph (posted 65)`);

    await openPickerWithCoords(page, COLFAX, /Pick Location on Map/);
    const picked = await pickAnyCandidate(page);
    const modalText = (
      (await page.getByRole("dialog").textContent().catch(() => "")) ?? ""
    ).replace(/\s+/g, " ");
    const detectedSpeed = modalText.match(/maxspeed=(\d+)/)?.[1] ?? "unmeasured";
    log(
      picked
        ? `Colfax candidate picked (detected maxspeed tag: ${detectedSpeed})`
        : "no candidate at Colfax pin",
    );
    const saved = await saveWhenReady(page);
    log(saved ? "picker saved (Colfax)" : "save unavailable");

    const clearedNote = page.getByText(new RegExp(`Work-zone speed reduction removed \\(was ${wzBefore} mph`));
    const noteVisible = await clearedNote.isVisible().catch(() => false);
    if (!noteVisible) {
      // Honest branch: if the detected posted speed was >= the
      // reduction, the clear correctly does not fire — report measured
      // state rather than a false FAIL.
      const speedNow = await page
        .locator("#sh-speed, input#sh-speed")
        .inputValue()
        .catch(() => null);
      log(
        `cleared note not visible — form speed now ${speedNow}; reduction row state follows`,
      );
    }
    assert("F4a. cleared note names the dropped reduction", noteVisible);
    const wzStillOn = await wzInput.isVisible().catch(() => false);
    assert("F4b. reduction input gone (workZoneSpeed cleared)", !wzStillOn);
    const bodyText = ((await page.textContent("body")) ?? "").replace(/\s+/g, " ");
    assert(
      "F4c. no INVALID INPUT / workZoneSpeed 400 on the strip",
      !/workZoneSpeed \(\d+\) must be <= posted speed/.test(bodyText),
    );
    await page.screenshot({ path: path.join(OUT, "05-f4-cleared-note.png"), fullPage: false }).catch(() => {});
    await page.close();
  }

  // ── #123: divided rationale/value agreement on real roads ─────────
  {
    for (const probe of ONEWAY_PROBES) {
      const page = await freshPage(ctx);
      await openPickerWithCoords(page, probe, /Pick Location on Map/);
      const picked = await pickAnyCandidate(page);
      if (!picked) {
        log(`#123 ${probe.name}: no candidate — skipped (measured, not asserted)`);
        await page.close();
        continue;
      }
      const dividedRow = fieldRow(page, "Divided");
      // The provenance sentence lives in the token's title attribute as
      // "source · confidence · rawData" — read ALL titles in the row and
      // keep the one carrying the separator (the pip block has its own
      // bare-confidence title, which the first run wrongly matched).
      const allTitles = await dividedRow
        .locator("[title]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("title")))
        .catch(() => []);
      const provTitle = allTitles.find((t) => t && t.includes("·")) ?? null;
      log(`#123 ${probe.name}: row titles=${JSON.stringify(allTitles)}`);
      const dividedShown = await dividedRow
        .getByRole("button", { name: "Divided", exact: true })
        .evaluate((b) => /--act/.test(b.className))
        .catch(() => null);
      const undividedShown = await dividedRow
        .getByRole("button", { name: "Undivided", exact: true })
        .evaluate((b) => /--act/.test(b.className))
        .catch(() => null);
      const value =
        dividedShown === true ? "divided" : undividedShown === true ? "undivided" : "unreadable";
      const oneway = provTitle?.match(/oneway=(\w+)/)?.[1] ?? "unread";
      log(
        `#123 ${probe.name}: value=${value}, oneway=${oneway}, provenance="${provTitle}"`,
      );
      if (provTitle !== null && value !== "unreadable") {
        assert(
          `#123. ${probe.name}: couplet claim never accompanies an undivided value`,
          !(value === "undivided" && /couplet/.test(provTitle)),
          `${value}, oneway=${oneway} / ${/couplet/.test(provTitle) ? "couplet claimed" : "no couplet claim"}`,
        );
      } else {
        log(`#123 ${probe.name}: provenance tooltip unreadable — stated, covered by the unit fixture`);
      }
      await dividedRow.screenshot({ path: path.join(OUT, `06-123-${probe.lat}.png`) }).catch(() => {});
      await page.close();
    }
  }

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "assertions-raw.md"),
    `# s2-arc1 live checks — raw log\n\n${lines.join("\n")}\n\nFailures: ${failures}\n`,
  );
  console.log(`\nDone. Failures: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
