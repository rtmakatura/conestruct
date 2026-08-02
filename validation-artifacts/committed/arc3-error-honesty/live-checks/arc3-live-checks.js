/**
 * Arc 3 live-site verification — #184 + #182 against
 * https://www.conestruct.com/sandbox.  READ-ONLY: no accounts, no DB
 * writes.  Synthetic failures via route interception ONLY (the 502/429
 * checks fulfill responses client-side; no real 429 is ever induced
 * against the shared limiter buckets).  The 422 checks use the REAL
 * backend path — a 422 is a stateless validation answer.
 *
 * Outputs into ./out3: screenshots + assertions log.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out3");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
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
async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: full });
  log(`screenshot: ${name}`);
}

const strip = async (page) =>
  (await page.locator(".status-bar").first().textContent().catch(() => "")) ??
  "";
const bodyText = async (page) =>
  (await page.evaluate(() => document.body.textContent)) ?? "";
const retryCount = (page) =>
  page.getByRole("button", { name: /^Retry$/ }).count();

// React-compatible write into a range/number input: native value setter +
// an 'input' event (React reads e.target.value off the native event).
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
const speedRange = (page) =>
  page.locator('input[type="range"][max="75"]').first();

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

  // ── Context A: real backend, no interception (#184 checks 1–3) ───────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 2000 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "networkidle" });

    // Check 1 — mirrored 4×14: INVALID INPUT agreeing with the form.
    await page.getByRole("button", { name: "4", exact: true }).first().click();
    await setInput(laneWidthRange(page), 14);
    await waitStrip(page, /INVALID INPUT/, 15000);
    const s1 = await strip(page);
    assert(
      "1a. strip INVALID INPUT with the form's own message",
      /INVALID INPUT/.test(s1) && /wider than the plan sheet can draw/.test(s1),
      s1.slice(0, 120),
    );
    const b1 = await bodyText(page);
    assert(
      "1b. VERIFICATION UNAVAILABLE nowhere",
      !/VERIFICATION UNAVAILABLE/.test(b1),
    );
    // Inline form error carries the same sentence → two agreeing voices.
    const inlineCount = await page
      .getByText(/wider than the plan sheet can draw/)
      .count();
    assert("1c. form inline error agrees (strip + inline)", inlineCount >= 2);
    assert("1d. no Retry anywhere", (await retryCount(page)) === 0);
    await shot(page, "01-mirrored-422-invalid-input.png");

    // Check 2 — REAL non-mirrored 422 (workZoneSpeed > posted, reachable
    // because the number input's max attribute is advisory — no clamp in
    // onChange).  PRE-generate, while the full form is still mounted.
    // Restore the drawable combo first so the mirrored error doesn't
    // outrank it.
    await setInput(laneWidthRange(page), 10.5);
    await waitStrip(page, /VERIFIED|CAUTION/, 30000);
    await page
      .getByText("Apply work-zone speed reduction")
      .click();
    const wz = page.locator("#sh-wz-speed");
    await wz.waitFor({ timeout: 5000 });
    const posted = await speedRange(page).inputValue();
    await setInput(wz, Number(posted) + 5);
    await waitStrip(page, /PLAN DECLINED/, 20000);
    const s2 = await strip(page);
    const b2 = await bodyText(page);
    const sentence = new RegExp(
      `workZoneSpeed \\(${Number(posted) + 5}\\) must be <= posted speed \\(${posted}\\)`,
    );
    assert(
      "2a. non-mirrored 422 → PLAN DECLINED with the validator's sentence",
      /PLAN DECLINED/.test(s2) && sentence.test(s2),
      s2.slice(0, 140),
    );
    const occurrences = (b2.match(new RegExp(sentence.source, "g")) || [])
      .length;
    assert("2b. sentence rendered exactly once", occurrences === 1, `count=${occurrences}`);
    assert("2c. no Retry anywhere", (await retryCount(page)) === 0);
    assert(
      "2d. not presented as an outage",
      !/VERIFICATION UNAVAILABLE|HTTP 502/.test(b2),
    );
    await shot(page, "02-nonmirrored-422-plan-declined.png", true);

    // Check 3 — device chip's declined arm needs Zone 3 mounted (post-
    // generate; the setup form collapses to the strip there, so the
    // lane-width slider is gone).  Drive a REAL backend 400 through the
    // strip's Edit Work zone → 50 ft (the geometry taper floor — the
    // chip's declined arm is status-based, any 400).  Clear the wz-speed
    // reduction first.
    await page.getByText("Apply work-zone speed reduction").click();
    await waitStrip(page, /VERIFIED|CAUTION/, 30000);
    await page.getByRole("button", { name: /Generate plan/ }).click();
    await page.waitForSelector(".hero", { timeout: 60000 });
    await page.getByRole("button", { name: "Edit Work zone" }).click();
    await page.locator("#strip-worklen").fill("50");
    await page.keyboard.press("Tab");
    await waitStrip(page, /PLAN DECLINED/, 20000);
    // Wait for the DEVICE fetch to settle too (the audit chip's declined
    // line lands first; the chip assertions must not race it).
    await page.waitForFunction(
      () =>
        /Device schedule unavailable while generation is declined/.test(
          document.body.textContent ?? "",
        ),
      null,
      { timeout: 20000 },
    );
    const b3 = await bodyText(page);
    assert(
      "3a. device chip declined line (real geometry 400)",
      /Device schedule unavailable while generation is declined/.test(b3),
    );
    assert("3b. no Retry anywhere under declined", (await retryCount(page)) === 0);
    await shot(page, "03-device-chip-declined.png", true);
    await ctx.close();
  }

  // ── Context B: synthetic 502 control (#184 check 4) ───────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "networkidle" });
    await waitStrip(page, /VERIFIED|CAUTION/, 30000);
    await page.route("**/api/render/audit", (route) =>
      route.fulfill({ status: 502, contentType: "text/plain", body: "Audit trail failed" }),
    );
    await setInput(speedRange(page), 45);
    await waitStrip(page, /VERIFICATION UNAVAILABLE/, 15000);
    const b4 = await bodyText(page);
    assert(
      "4a. genuine 5xx keeps UNAVAILABLE + failed line",
      /VERIFICATION UNAVAILABLE/.test(b4) && /Audit trail failed/.test(b4),
    );
    assert("4b. Retry offered for the 5xx", (await retryCount(page)) >= 1);
    await shot(page, "04-synthetic-502-unavailable-retry.png", true);
    await ctx.close();
  }

  // ── Context C: debounce timeline (#182 checks 5–6) ────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await ctx.newPage();
    let auditN = 0;
    let bdN = 0;
    let lastAuditBody = "";
    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("/api/render/audit")) {
        auditN++;
        lastAuditBody = req.postData() ?? "";
      }
      if (u.includes("/api/render/device-breakdown")) bdN++;
    });
    await page.goto(SITE, { waitUntil: "networkidle" });
    await waitStrip(page, /VERIFIED|CAUTION/, 30000);
    await page.waitForTimeout(500); // quiet period → next edit is leading

    // Check 5 — scripted 12-step drag, ~150 ms cadence (~1.8 s total).
    const a0 = auditN;
    const b0 = bdN;
    const steps = [70, 65, 70, 65, 70, 65, 70, 65, 70, 65, 70, 55];
    for (const v of steps) {
      await setInput(speedRange(page), v);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(600); // trailing window settles
    const auditDuring = auditN - a0;
    const bdDuring = bdN - b0;
    log(
      `request counts for the 12-step drag: audit=${auditDuring}, device-breakdown=${bdDuring} (pre-fix: 12 + 12)`,
    );
    assert(
      "5a. ≤2 audit requests for a 12-step drag (leading + trailing)",
      auditDuring <= 2,
      `audit=${auditDuring}`,
    );
    assert(
      "5b. ≤2 device-breakdown requests for the same drag",
      bdDuring <= 2,
      `bd=${bdDuring}`,
    );
    assert(
      "5c. trailing request carries the FINAL value",
      lastAuditBody.includes('"speed":55'),
      lastAuditBody.slice(0, 80),
    );

    // Check 6 — discrete edit fires immediately.
    await page.waitForTimeout(600);
    const a1 = auditN;
    await setInput(speedRange(page), 60);
    await page.waitForTimeout(150);
    assert(
      "6. discrete edit dispatches within 150 ms (leading edge)",
      auditN === a1 + 1,
      `audit +${auditN - a1}`,
    );
    await ctx.close();
  }

  // ── Context D: synthetic 429 voice + Retry bypass (#182 checks 7–8) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await ctx.newPage();
    let auditN = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/render/audit")) auditN++;
    });
    await page.goto(SITE, { waitUntil: "networkidle" });
    await waitStrip(page, /VERIFIED|CAUTION/, 30000);
    await page.route("**/api/render/audit", (route) =>
      route.fulfill({ status: 429, contentType: "text/plain", body: "Too many requests" }),
    );
    await page.waitForTimeout(500);
    await setInput(speedRange(page), 50);
    await waitStrip(page, /VERIFICATION PAUSED/, 15000);
    const b7 = await bodyText(page);
    assert(
      "7a. 429 renders VERIFICATION PAUSED + 'too many updates' on the strip",
      /VERIFICATION PAUSED/.test(b7) && /too many updates in the last minute/.test(b7),
    );
    assert("7b. panel paused line", /Audit trail paused/.test(b7));
    assert(
      "7c. outage voice nowhere",
      !/VERIFICATION UNAVAILABLE/.test(b7) && !/Audit trail failed/.test(b7),
    );
    assert("7d. Retry present", (await retryCount(page)) >= 1);
    await shot(page, "07-synthetic-429-paused.png", true);

    // Check 8 — lift the intercept; Retry bypasses the debounce.
    await page.unroute("**/api/render/audit");
    const a2 = auditN;
    await page.getByRole("button", { name: /^Retry$/ }).first().click();
    await page.waitForTimeout(200);
    assert(
      "8a. Retry re-fetches immediately (no debounce delay)",
      auditN === a2 + 1,
      `audit +${auditN - a2}`,
    );
    await waitStrip(page, /VERIFIED|CAUTION|VERIFYING/, 30000);
    await waitStrip(page, /VERIFIED|CAUTION/, 30000);
    assert(
      "8b. recovery — strip settles on a real verdict",
      /VERIFIED/.test(await strip(page)),
      (await strip(page)).slice(0, 80),
    );
    await shot(page, "08-retry-recovery.png");
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
