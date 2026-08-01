/**
 * Arc 2 live-site verification — #185, #192, #187, #196, #189-3, and the
 * #197 OutputCards instance, against https://www.conestruct.com/sandbox.
 * READ-ONLY: no accounts, no plans saved, nothing deleted.  Generate
 * clicks are stateless POST /api/render/* calls (no DB writes).
 * #183 is NOT attempted — it requires a saved DB row (reported blocked).
 *
 * Outputs into ./out2: screenshots, quote-after-edit.xlsx, assertions log.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out2");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const ORIGIN = "https://www.conestruct.com";
const COLFAX = { lat: "39.73997", lng: "-104.96632" };
const PARK = { lat: "39.7312", lng: "-104.9665" };

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
  (await page.locator(".status-bar").first().textContent().catch(() => "")) ?? "";

async function openPickerWithCoords(page, coords, reopen = false) {
  const btn = reopen
    ? page.getByRole("button", { name: /Edit Location & Corridor/ })
    : page.getByRole("button", { name: "Pick Location on Map" });
  await btn.click();
  await page.getByRole("dialog", { name: "Define work zone" }).waitFor();
  const toggle = page.getByText(/enter coordinates manually/i);
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByLabel("Latitude").fill(coords.lat);
  await page.getByLabel("Longitude").fill(coords.lng);
}

const saveBtn = (page) => page.getByRole("button", { name: "Save & Close" });

// Pick the TWO-WAY Colfax candidate (not the one-way eastbound couplet)
// so the flagger multilane relays arm the #86 gate.
async function pickTwoWayColfax(page) {
  const header = page.getByText(/Which road\? · \d+ detected/);
  await header.waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await header.isVisible().catch(() => false))) return null;
  const rows = page.locator("button", { hasText: "m from pin" });
  const colfax = rows.filter({ hasText: /colfax/i });
  const n = await colfax.count();
  let target = null;
  for (let i = 0; i < n; i++) {
    const t = (await colfax.nth(i).textContent()) ?? "";
    if (!/eastbound|westbound/i.test(t)) {
      target = colfax.nth(i);
      break;
    }
  }
  if (!target) target = colfax.first();
  const label = ((await target.textContent()) ?? "").replace(/\s+/g, " ").trim();
  await target.click();
  log(`candidate picked: "${label}"`);
  return label;
}

async function setSpeedViaStrip(page, value) {
  await page.getByRole("button", { name: /Edit Speed/i }).click();
  await page.getByLabel("Speed").selectOption(String(value));
}

const declinedRe = /PLAN DECLINED|INVALID INPUT/;
async function waitDeclined(page, timeout) {
  await page.waitForFunction(
    () =>
      /PLAN DECLINED|INVALID INPUT/.test(
        document.querySelector(".status-bar")?.textContent ?? "",
      ),
    null,
    { timeout },
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ======================================================================
  // CONTEXT A — #192 dim-in-place + #185 quote invalidation + XLSX +
  //             #192 refusal-over-COMPUTING (post-generate, geometry 400)
  // ======================================================================
  lines.push("## Context A — #192 keep-mounted + #185 quote + refusal precedence\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    let bdDelay = 0;
    let quotePost = null;
    await page.route("**/api/render/device-breakdown", async (route) => {
      if (bdDelay > 0) {
        log(`intercepted device-breakdown — delaying ${bdDelay} ms`);
        await new Promise((r) => setTimeout(r, bdDelay));
      }
      await route.continue();
    });
    page.on("request", (req) => {
      if (req.url().includes("/api/render/quote") && !req.url().includes("breakdown")) {
        quotePost = req.postData();
      }
    });
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Generate plan" }).click();
    await page.locator(".hero").waitFor({ timeout: 60000 });
    log("generated (default sandbox scenario); hero mounted");

    // ---- #192: post-generate edit dims in place under the ribbon.
    bdDelay = 4000;
    await setSpeedViaStrip(page, 35);
    const ribbon = page.getByText(/Recomputing for the edited input/);
    await ribbon.waitFor({ timeout: 3000 });
    assert("192a: recomputing ribbon renders on a post-generate edit", true);
    assert(
      "192b: no 'Generating…' empty-state swap — subtree stays mounted",
      (await page.getByText("Generating…").count()) === 0,
    );
    assert(
      "192c: results dim (.results-stale) while the answer is in flight",
      (await page.locator(".results-stale").count()) > 0,
    );
    assert(
      "192d: hero (previous answer) still on screen under the dim",
      (await page.locator(".hero").count()) > 0,
    );
    await shot(page, "a-192-recomputing-dim.png");
    await ribbon.waitFor({ state: "hidden", timeout: 30000 });
    assert(
      "192e: settle clears the ribbon and the dim",
      (await page.locator(".results-stale").count()) === 0,
    );
    bdDelay = 0;

    // ---- #185: preview → edit → stale note → re-preview → XLSX agreement.
    await page.getByRole("button", { name: /Pricing quote/ }).click();
    await page.getByRole("button", { name: "Preview breakdown" }).click();
    await page.getByText("Total estimate").waitFor({ timeout: 60000 });
    await shot(page, "a-185-previewed.png", true);

    await page.getByLabel("Overhead (%)").fill("20");
    await page.waitForTimeout(300);
    assert(
      "185a: settings edit replaces figures with the re-preview state",
      (await page.getByText(/Inputs changed/).count()) > 0 &&
        (await page.getByText(/Preview again for current totals/).count()) > 0,
    );
    assert(
      "185b: dollar figures no longer render as current",
      (await page.getByText("Total estimate").count()) === 0,
    );
    assert(
      "185c: collapsed headline resets to its unset note",
      (await page.getByText(/expand to configure & preview/).count()) > 0,
    );
    await shot(page, "a-185-inputs-changed.png", true);

    await page.getByRole("button", { name: "Preview breakdown" }).click();
    await page.getByText("Total estimate").waitFor({ timeout: 60000 });
    // The TOTAL ESTIMATE row lives inside the collapsible Markup group.
    await page.getByRole("button", { name: /Markup/ }).first().click();
    await page.getByText("TOTAL ESTIMATE").first().waitFor({ timeout: 10000 });
    // The 2dp figure ADJACENT to the "TOTAL ESTIMATE" label — not the
    // last currency match in the panel (that's the markup group header).
    const totalRow = await page
      .getByText("TOTAL ESTIMATE")
      .locator("xpath=ancestor::tr[1]")
      .first()
      .textContent();
    const totalMatch = (totalRow ?? "").match(/\$[\d,]+\.\d{2}/);
    const screenTotal = totalMatch ? totalMatch[0] : null;
    assert("185d: re-preview renders fresh figures", screenTotal !== null, `on-screen 2dp total: ${screenTotal}`);
    await shot(page, "a-185-repreviewed.png", true);

    // XLSX: let the page issue its own download (captures the exact body
    // it sends), then re-issue the identical POST to capture the bytes.
    await page.getByRole("button", { name: /Download Quote \(XLSX\)/ }).click();
    await page.waitForTimeout(2500);
    assert("185e: the page issued the quote POST", quotePost !== null);
    const rq = await ctx.request.post(`${ORIGIN}/api/render/quote`, {
      data: JSON.parse(quotePost),
      timeout: 120000,
    });
    const body = await rq.body();
    fs.writeFileSync(path.join(OUT, "quote-after-edit.xlsx"), body);
    fs.writeFileSync(path.join(OUT, "screen-total.txt"), String(screenTotal ?? ""));
    log(`XLSX captured via identical re-POST: HTTP ${rq.status()}, ${body.length} bytes -> quote-after-edit.xlsx`);
    log("185f: screen/file cent agreement parsed post-run (parse-quote-xlsx.py)");

    // ---- #192 precedence, post-generate: shrink the work zone to 50 ft
    // (geometry taper floor -> backend 400) with the breakdown throttled;
    // the refusal must surface while the recompute is still in flight.
    bdDelay = 6000;
    await page.getByRole("button", { name: "Edit Work zone" }).click();
    await page.locator("#strip-worklen").fill("50");
    await page.keyboard.press("Tab");
    await waitDeclined(page, 5000);
    const ribbonStillUp =
      (await page.getByText(/Recomputing for the edited input/).count()) > 0;
    const s = await strip(page);
    assert(
      "192f: refusal/inputError surfaces while the recompute is still in flight",
      declinedRe.test(s) && ribbonStillUp,
      `ribbon in flight: ${ribbonStillUp}; strip: "${s.slice(0, 70)}…"`,
    );
    assert("192g: COMPUTING does not mask it", !/COMPUTING/.test(s));
    await shot(page, "a-192-declined-over-computing.png");
    bdDelay = 0;
    await ctx.close();
  }

  // ======================================================================
  // CONTEXT B — E Colfax flagger #86 refusal → #187 audit honesty +
  //             #196 confirm-tick window (pre-generate flow)
  // ======================================================================
  lines.push("\n## Context B — #86 refusal → #187 audit honesty + #196 window\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    let auditDelay = 0;
    await page.route("**/api/render/audit", async (route) => {
      if (auditDelay > 0) {
        log(`intercepted audit — delaying ${auditDelay} ms`);
        await new Promise((r) => setTimeout(r, auditDelay));
      }
      await route.continue();
    });
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Flagger lane closure", { exact: true }).click();
    log("kind: flagger lane closure (pre-generate flow)");

    await openPickerWithCoords(page, COLFAX);
    const picked = await pickTwoWayColfax(page);
    await saveBtn(page).click();
    await waitDeclined(page, 60000);
    const stripText = await strip(page);
    log(`#86 refusal settled; strip: "${stripText.slice(0, 100)}"`);
    assert(
      "B-86: the E Colfax two-way relays arm a refusal (PLAN DECLINED)",
      /PLAN DECLINED/.test(stripText),
      `picked: ${picked}`,
    );
    await shot(page, "b-86-refusal-settled.png");

    // #187 — audit rows honest under the decline.
    const chip = page.getByText("Verification & audit trail");
    await chip.waitFor({ timeout: 15000 });
    if ((await page.getByText("↓ Audit PDF").count()) === 0) await chip.click();
    await page.getByText("↓ Audit PDF").waitFor({ timeout: 15000 });
    assert(
      "187a: declined chip + banner present",
      (await page.getByText(/unavailable — generation declined/).count()) > 0 &&
        (await page
          .getByText(/Audit trail unavailable while generation is declined/)
          .count()) > 0,
    );
    assert(
      "187b: rows blank with a stated reason, never 'Computing…'",
      (await page
        .getByText(/Values unavailable — the audit for this input did not succeed/)
        .count()) > 0 && (await page.getByText("Computing…").count()) === 0,
    );
    const bodyText = (await page.locator("body").textContent()) ?? "";
    assert(
      "187c: no cited '= N ft' value renders anywhere under the decline",
      !/= \d[\d,]* ft/.test(bodyText),
    );
    const checkGlyphs = await page.locator("span.check").count();
    assert("187d: no ✓ check rows under the decline", checkGlyphs === 0, `span.check count: ${checkGlyphs}`);
    const pdfBtn = page.getByText("↓ Audit PDF");
    assert(
      "187e: Audit PDF disabled with a declined reason",
      await pdfBtn.isDisabled(),
      `title: "${await pdfBtn.getAttribute("title")}"`,
    );
    await shot(page, "b-187-audit-declined-blank.png", true);

    // #196 — the confirm-tick window.
    const generateBtn = page.getByRole("button", { name: "Generate plan" });
    assert("196a: settled refusal gates Generate", await generateBtn.isDisabled());
    const confirmRow = page.getByRole("checkbox", {
      name: /one through lane in each direction|carries two-way traffic/,
    });
    const rowCount = await confirmRow.count();
    assert("196b: confirm affordance row on screen", rowCount > 0, `rows: ${rowCount}`);

    auditDelay = 6000;
    await confirmRow.first().click();
    await page.waitForTimeout(800); // inside the widened window
    assert(
      "196c: THE window — Generate stays gated while the re-check is in flight",
      await generateBtn.isDisabled(),
    );
    assert(
      "196d: the gate names itself",
      (await page.getByText(/Re-checking the declined input/).count()) > 0,
    );
    // COMPUTING must not appear pre-generate either during the window.
    assert("196/192: no COMPUTING during the window", !/COMPUTING/.test(await strip(page)));
    await shot(page, "b-196-window-gated.png");
    auditDelay = 0;

    await page.waitForFunction(
      () => {
        const s2 = document.querySelector(".status-bar")?.textContent ?? "";
        return !/VERIFYING|COMPUTING/.test(s2);
      },
      null,
      { timeout: 90000 },
    );
    const declined = declinedRe.test(await strip(page));
    const disabled = await generateBtn.isDisabled();
    assert(
      "196e: settled CTA state matches the settled verdict",
      declined === disabled,
      `declined=${declined} disabled=${disabled}; strip: "${(await strip(page)).slice(0, 80)}"`,
    );
    await shot(page, "b-196-settled.png");
    await ctx.close();
  }

  // ======================================================================
  // CONTEXT C — #189-3 settled-null save clears relays (form evidence)
  // ======================================================================
  lines.push("\n## Context C — #189-3 relay clear on settled-null save\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByText("Flagger lane closure", { exact: true }).click();
    await openPickerWithCoords(page, COLFAX);
    await pickTwoWayColfax(page);
    await saveBtn(page).click();
    const confirmRow = page.getByRole("checkbox", {
      name: /one through lane in each direction|carries two-way traffic/,
    });
    await confirmRow.first().waitFor({ timeout: 30000 });
    assert(
      "189-3a: relays applied — confirm affordance renders after the Colfax save",
      true,
    );
    await shot(page, "c-1893-relays-armed.png");

    await openPickerWithCoords(page, PARK, true);
    await page.getByText(/No road detected within 30 m/).waitFor({ timeout: 30000 });
    await saveBtn(page).click();
    await page.waitForTimeout(800);
    assert(
      "189-3b: settled-null save at the new pin clears the relays — affordance gone",
      (await confirmRow.count()) === 0,
    );
    await page
      .waitForFunction(
        () =>
          !/PLAN DECLINED/.test(
            document.querySelector(".status-bar")?.textContent ?? "",
          ),
        null,
        { timeout: 30000 },
      )
      .catch(() => {});
    assert(
      "189-3c: strip no longer declines (nothing detected = nothing to refuse)",
      !/PLAN DECLINED/.test(await strip(page)),
      `strip: "${(await strip(page)).slice(0, 80)}"`,
    );
    await shot(page, "c-1893-relays-cleared.png");
    await ctx.close();
  }

  // ======================================================================
  // CONTEXT D — #197 OutputCards error clears on input change
  // ======================================================================
  lines.push("\n## Context D — #197 download-error stamp\n");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    let failPdf = false;
    await page.route("**/api/render/pdf", async (route) => {
      if (failPdf) {
        log("intercepted /api/render/pdf — fulfilling synthetic 400 (never reached the server)");
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            detail: { message: "Synthetic validation error for the live check." },
          }),
        });
        return;
      }
      await route.continue();
    });
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Generate plan" }).click();
    await page.locator(".hero").waitFor({ timeout: 60000 });

    failPdf = true;
    await page
      .locator(".dl-card")
      .first()
      .getByRole("button", { name: "Download PDF" })
      .click();
    await page
      .getByText("Synthetic validation error for the live check.")
      .waitFor({ timeout: 10000 });
    assert(
      "197a: download error renders for the scenario it answered",
      (await page.getByText("Try again").count()) > 0,
    );
    await shot(page, "d-197-error-shown.png");

    await setSpeedViaStrip(page, 40);
    await page.waitForTimeout(400);
    assert(
      "197b: the scenario edit drops the stale error and its Try-again label",
      (await page
        .getByText("Synthetic validation error for the live check.")
        .count()) === 0 && (await page.getByText("Try again").count()) === 0,
    );
    await shot(page, "d-197-error-cleared.png");
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "assertions.md"),
    lines.join("\n") +
      `\n\n**Result: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}**\n`,
  );
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  lines.push(`\n**ABORTED**: ${err.stack}`);
  fs.writeFileSync(path.join(OUT, "assertions.md"), lines.join("\n"));
  console.error(err);
  process.exit(2);
});
