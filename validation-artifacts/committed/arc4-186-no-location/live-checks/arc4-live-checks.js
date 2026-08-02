/**
 * Arc 4 live-site verification — #186 against
 * https://www.conestruct.com/sandbox.  READ-ONLY: no accounts, no DB
 * writes, no plan saves.  The one Generate click (check 6) is the
 * sandbox's client-side stage flip — no persistence (same as the Arc 3
 * run's check 3).
 *
 * Checks:
 *   1. Fresh cold load → AWAITING LOCATION strip (chromeless, no
 *      verdict, no READY anywhere), Generate disabled with the stated
 *      reason.
 *   2. Disabled Generate click → no request fires, no post-generate
 *      package renders.
 *   3. Pre-pin liveness — 4×14 combo: INVALID INPUT outranks AWAITING
 *      LOCATION; restoring valid inputs returns to AWAITING, never a
 *      verdict.
 *   4. Picker pin (E Colfax) + Save → strip leaves AWAITING for a real
 *      verification state; Generate's gate matches whatever downstream
 *      state the detection produced (verdict → enabled, refusal/confirm
 *      → disabled with that reason, never the location reason).
 *   5. Manual-entry hole — latitude alone keeps AWAITING + disabled
 *      Generate (both-coordinates rule); adding longitude flips.
 *   6. Post-pin unchanged — quiet pin (manual coords, no detection
 *      facts, away from the refusal spot) → verdict + Generate renders
 *      the package.
 *
 * Outputs into ./out4: screenshots + assertions log.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out4");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

const COLFAX = { lat: "39.73997", lng: "-104.96632" };
// Quiet residential segment near Congress Park — plain two-lane local
// street, nowhere near the multilane refusal spot.
const QUIET = { lat: "39.7266", lng: "-104.9532" };

const AWAITING = "AWAITING LOCATION · pick a location on the map to verify this plan";
const REASON = "Set a location first — pick on map or enter manually.";

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

const stripEl = (page) => page.locator(".status-bar").first();
const strip = async (page) =>
  (await stripEl(page).textContent().catch(() => "")) ?? "";
const bodyText = async (page) =>
  (await page.evaluate(() => document.body.textContent)) ?? "";
const generateBtn = (page) =>
  page.getByRole("button", { name: /Generate plan/ });

async function waitStrip(page, re, timeout) {
  await page.waitForFunction(
    (src) =>
      new RegExp(src).test(
        document.querySelector(".status-bar")?.textContent ?? "",
      ),
    re.source,
    { timeout },
  );
}

// React-compatible write into a range/number input.
async function setInput(locator, value) {
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

const laneWidthRange = (page) =>
  page.locator('input[type="range"][max="14"]').first();
// Sidebar ManualFallback coordinate fields (step 0.000001 is unique to
// them).  Re-query by index each time — entering latitude alone flips
// the Location section to LocationSummary, remounting the panel.
const coordInput = (page, i) =>
  page.locator('input[type="number"][step="0.000001"]').nth(i);

// Picker helpers (Arc 1 pattern).
async function openPickerWithCoords(page, coords) {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(coords.lat);
  await page.getByLabel("Longitude").fill(coords.lng);
}
async function pickCandidateIfAsked(page) {
  const header = page.getByText(/Which road\? · \d+ detected/);
  if (await header.isVisible().catch(() => false)) {
    const rows = page.locator("button", { hasText: "m from pin" });
    const colfax = rows.filter({ hasText: /colfax/i });
    const target = (await colfax.count()) > 0 ? colfax.first() : rows.first();
    const label = (await target.textContent())?.replace(/\s+/g, " ").trim();
    await target.click();
    log(`candidate picker shown; picked: "${label}"`);
    return true;
  }
  return false;
}

// Manual coordinate entry from a fresh (no-pin) sidebar: "Enter
// manually" reveals the fallback; typing latitude flips the section to
// LocationSummary (pre-existing hasPin || sentinel — untouched by #186),
// so longitude needs the summary's "Edit manually" reopen.
async function enterLatitudeOnly(page, lat) {
  await page.getByRole("button", { name: "Enter manually" }).click();
  await coordInput(page, 0).waitFor({ timeout: 5000 });
  await setInput(coordInput(page, 0), lat);
}
async function thenLongitude(page, lng) {
  await page.getByRole("button", { name: "Edit manually" }).click();
  await coordInput(page, 1).waitFor({ timeout: 5000 });
  await setInput(coordInput(page, 1), lng);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Build gate ────────────────────────────────────────────────────────
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
    console.log("GATE MISMATCH — aborting");
    process.exit(2);
  }
  assert("build gate: healthz == origin/main == served bundle", true, hz.sha);
  await gate.close();

  // ── Context A: fresh-load honesty + pre-pin liveness (checks 1–3) ────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 2000 },
    });
    const page = await ctx.newPage();
    const requests = [];
    page.on("request", (req) => requests.push(req.url()));
    await page.goto(SITE, { waitUntil: "networkidle" });

    // Check 1 — fresh cold load.
    const s1 = await strip(page);
    assert(
      "1a. strip renders the AWAITING LOCATION copy verbatim",
      s1.trim() === AWAITING,
      s1.slice(0, 120),
    );
    const cls = (await stripEl(page).getAttribute("class")) ?? "";
    assert(
      "1b. strip is the chromeless no-verdict treatment (idle unavail)",
      /\bidle\b/.test(cls) && /\bunavail\b/.test(cls),
      cls,
    );
    const b1 = await bodyText(page);
    assert("1c. READY nowhere in the DOM", !/READY/.test(b1));
    assert(
      "1d. no verdict voice anywhere (VERIFIED / CAUTION pill / INVALID INPUT / PLAN DECLINED)",
      !/VERIFIED/.test(b1) &&
        !/INVALID INPUT/.test(b1) &&
        !/PLAN DECLINED/.test(b1),
    );
    assert("1e. Generate disabled", await generateBtn(page).isDisabled());
    assert(
      "1f. disabled reason is the stated sentence (title attribute)",
      (await generateBtn(page).getAttribute("title")) === REASON,
      `title="${await generateBtn(page).getAttribute("title")}"`,
    );
    assert(
      "1g. reason also visible as text under the CTA",
      (await page.getByText(REASON, { exact: true }).count()) >= 1,
    );
    await shot(page, "01-fresh-load-awaiting.png", true);

    // Check 2 — disabled Generate fires nothing.
    const before = requests.length;
    await generateBtn(page).click({ force: true }); // real mouse click; the disabled control must swallow it
    await page.waitForTimeout(1000);
    // Filter to API traffic: Next.js prefetches footer links (?_rsc= GETs
    // to /terms, /privacy) on its own schedule — background chrome, not an
    // effect of the click.  The check is "no render/PDF POST"; asserting
    // no /api/ request of any kind subsumes it.
    const fired = requests.slice(before).filter((u) => u.includes("/api/"));
    assert(
      "2a. no API request of any kind from the click (render/PDF included)",
      fired.length === 0,
      fired.length ? fired.join(", ").slice(0, 200) : "0 API requests",
    );
    const b2 = await bodyText(page);
    assert(
      "2b. no post-generate package (results hero absent)",
      !/Total devices/.test(b2),
    );

    // Check 3 — pre-pin liveness: INVALID INPUT outranks AWAITING.
    await page.getByRole("button", { name: "4", exact: true }).first().click();
    await setInput(laneWidthRange(page), 14);
    await waitStrip(page, /INVALID INPUT/, 15000);
    const s3 = await strip(page);
    assert(
      "3a. 4×14 without a pin → INVALID INPUT outranks AWAITING LOCATION",
      /INVALID INPUT/.test(s3) && !/AWAITING LOCATION/.test(s3),
      s3.slice(0, 120),
    );
    assert(
      "3b. still no verdict while invalid (READY nowhere)",
      !/READY/.test(await bodyText(page)),
    );
    await shot(page, "03a-prepin-invalid-outranks.png");

    // Restore valid inputs → back to AWAITING, never a verdict.
    await setInput(laneWidthRange(page), 10.5);
    await waitStrip(page, /AWAITING LOCATION/, 15000);
    await page.waitForTimeout(800); // let any in-flight fetch settle
    const s3b = await strip(page);
    const b3 = await bodyText(page);
    assert(
      "3c. valid-again inputs return the strip to AWAITING LOCATION",
      /AWAITING LOCATION/.test(s3b),
      s3b.slice(0, 120),
    );
    assert(
      "3d. the settled clean audit never surfaces as a verdict (READY/VERIFIED nowhere)",
      !/READY/.test(b3) && !/VERIFIED/.test(b3),
    );
    await shot(page, "03b-prepin-restored-awaiting.png");
    await ctx.close();
  }

  // ── Context B: set-location-enables via the picker (check 4) ─────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 2000 },
    });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "networkidle" });
    await openPickerWithCoords(page, COLFAX);
    await page
      .getByText(/Which road\?|Speed limit \(mph\)/)
      .first()
      .waitFor({ timeout: 30000 });
    await pickCandidateIfAsked(page);
    const save = page.getByRole("button", { name: "Save & Close" });
    await page.waitForFunction(
      () => {
        const b = Array.from(document.querySelectorAll("button")).find((x) =>
          /Save & Close/.test(x.textContent ?? ""),
        );
        return !!b && !b.disabled;
      },
      null,
      { timeout: 20000 },
    );
    await page.waitForTimeout(300);
    await save.click();

    // The strip must leave AWAITING for a REAL verification state.
    await page.waitForFunction(
      () =>
        !/AWAITING LOCATION/.test(
          document.querySelector(".status-bar")?.textContent ?? "",
        ),
      null,
      { timeout: 20000 },
    );
    await waitStrip(
      page,
      /VERIFIED|CAUTION|INVALID INPUT|PLAN DECLINED|FLAGGER|REFUSED/,
      30000,
    ).catch(() => {});
    const s4 = await strip(page);
    assert(
      "4a. after Save the strip is a real verification state, not AWAITING",
      !/AWAITING LOCATION/.test(s4) && s4.trim().length > 0,
      s4.slice(0, 140),
    );
    const gDisabled = await generateBtn(page).isDisabled();
    const gTitle = (await generateBtn(page).getAttribute("title")) ?? "";
    log(
      `downstream state at E Colfax: strip="${s4.slice(0, 120)}" generateDisabled=${gDisabled} title="${gTitle}"`,
    );
    if (!gDisabled) {
      assert(
        "4b. Generate enabled ↔ strip carries a verdict (detection produced no gate)",
        /VERIFIED|CAUTION/.test(s4),
        s4.slice(0, 120),
      );
    } else {
      assert(
        "4b. Generate gated ↔ by a downstream detection-fact reason, never the location reason",
        gTitle.length > 0 && gTitle !== REASON,
        `title="${gTitle}"`,
      );
    }
    await shot(page, "04-colfax-saved-downstream.png", true);
    await ctx.close();
  }

  // ── Context C: manual-entry hole (check 5) ───────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 2000 },
    });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "networkidle" });

    // Latitude alone is not a location.
    await enterLatitudeOnly(page, COLFAX.lat);
    await page.waitForTimeout(800); // debounce + any refetch settles
    const s5 = await strip(page);
    assert(
      "5a. latitude alone keeps AWAITING LOCATION (both-coordinates rule)",
      /AWAITING LOCATION/.test(s5),
      s5.slice(0, 120),
    );
    assert(
      "5b. Generate still disabled with the location reason",
      (await generateBtn(page).isDisabled()) &&
        (await generateBtn(page).getAttribute("title")) === REASON,
    );
    assert(
      "5c. no verdict leaked (READY/VERIFIED nowhere)",
      !/READY|VERIFIED/.test(await bodyText(page)),
    );
    await shot(page, "05a-lat-only-still-awaiting.png", true);

    // Longitude completes the pair → flips.
    await thenLongitude(page, COLFAX.lng);
    await waitStrip(page, /VERIFIED|CAUTION/, 20000);
    const s5b = await strip(page);
    assert(
      "5d. adding longitude flips the strip to a real verdict",
      /VERIFIED|CAUTION/.test(s5b) && !/AWAITING LOCATION/.test(s5b),
      s5b.slice(0, 120),
    );
    assert("5e. Generate enabled", await generateBtn(page).isEnabled());
    await shot(page, "05b-both-coords-verdict.png");
    await ctx.close();
  }

  // ── Context D: post-pin unchanged (check 6) ──────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 2000 },
    });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "networkidle" });
    await enterLatitudeOnly(page, QUIET.lat);
    await page.waitForTimeout(500);
    await thenLongitude(page, QUIET.lng);
    await waitStrip(page, /VERIFIED|CAUTION/, 20000);
    const s6 = await strip(page);
    assert(
      "6a. quiet pin → a verdict renders",
      /VERIFIED|CAUTION/.test(s6),
      s6.slice(0, 120),
    );
    await generateBtn(page).click();
    await page.waitForSelector(".hero", { timeout: 60000 });
    assert(
      "6b. Generate produces the package as before (results hero rendered)",
      /Total devices/.test(await bodyText(page)),
    );
    await shot(page, "06-quiet-pin-generated.png", true);
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "assertions-raw.md"),
    lines.join("\n") + "\n",
  );
  console.log(`\nDONE — failures: ${failures}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  fs.writeFileSync(
    path.join(OUT, "assertions-raw.md"),
    lines.join("\n") + `\n- SCRIPT ERROR: ${e?.message}\n`,
  );
  process.exit(3);
});
