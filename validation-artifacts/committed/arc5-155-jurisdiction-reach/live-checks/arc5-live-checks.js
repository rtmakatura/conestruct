/**
 * Arc 5 live-site verification — #155 + #156 against
 * https://www.conestruct.com/sandbox.  READ-ONLY: no accounts, no DB
 * writes, no plan saves.  Generate clicks are the sandbox's client-side
 * stage flip; markdown downloads hit the stateless /render/markdown
 * proxy (pure render, no persistence) — same footprint as prior arcs.
 *
 * #155 checks:
 *   1. Greeley pin (40.404292, -104.715863) → suggest slot offers
 *      Greeley with Confirm; Confirm lands jurisdiction_key (section
 *      shows Greeley active, record content not baseline).
 *   2. Thornton pin (39.8680, -104.9847) → same shape.
 *   3. Lakewood control (39.7113, -105.0815) → unchanged healthy path.
 *   4. Northglenn near-boundary (39.886, -104.9811) → jigsaw warning
 *      names Thornton at ~292 ft; NO suggestion set (suggest-never-set
 *      observable at the surface).
 *   5. Dropdown carries Greeley + Thornton entries with proper labels.
 *   6. County-copy honesty at the unincorporated-Arapahoe pocket
 *      (39.5790, -104.8600 — outside every mapped place): new copy
 *      names the county + "outside the mapped municipal boundaries",
 *      never asserts "unincorporated".
 *
 * #156 checks:
 *   7. Greeley confirmed → crew narrative (page's own /api/render/
 *      markdown POST) renders "Jurisdiction: Greeley", not CDOT.
 *   8. Null-key control: pin set, suggestion NOT confirmed → header
 *      renders CDOT.
 *
 * Outputs into ./out5: screenshots + assertions log + captured
 * narrative headers.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out5");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

const PINS = {
  greeley: { lat: "40.404292", lng: "-104.715863" },
  thornton: { lat: "39.8680", lng: "-104.9847" },
  lakewood: { lat: "39.7113", lng: "-105.0815" },
  northglenn: { lat: "39.886", lng: "-104.9811" },
  arapahoePocket: { lat: "39.5790", lng: "-104.8600" },
  // Quiet Denver-side pin for the null-key control (suggestion offered,
  // deliberately NOT confirmed) — same spot Arc 4 used for Generate.
  quiet: { lat: "39.7266", lng: "-104.9532" },
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
async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: full });
  log(`screenshot: ${name}`);
}

const bodyText = async (page) =>
  (await page.evaluate(() => document.body.textContent)) ?? "";
const generateBtn = (page) =>
  page.getByRole("button", { name: /Generate plan/ });

// React-compatible write into a number input (Arc 4 helper).
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
const coordInput = (page, i) =>
  page.locator('input[type="number"][step="0.000001"]').nth(i);
async function setPinManually(page, coords) {
  await page.getByRole("button", { name: "Enter manually" }).click();
  await coordInput(page, 0).waitFor({ timeout: 5000 });
  await setInput(coordInput(page, 0), coords.lat);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Edit manually" }).click();
  await coordInput(page, 1).waitFor({ timeout: 5000 });
  await setInput(coordInput(page, 1), coords.lng);
}

const suggestSlot = (page) => page.locator(".jbar-suggest").first();
async function waitSuggestLive(page) {
  await page.waitForSelector(".jbar-suggest.live", { timeout: 30000 });
}
const suggestText = async (page) =>
  ((await suggestSlot(page).textContent().catch(() => "")) ?? "").replace(
    /\s+/g,
    " ",
  );
const jurisdictionSelect = (page) => page.locator("select#jl-jurisdiction");
const authLine = async (page) =>
  (
    (await page.locator(".jctl .jbar-auth").first().textContent().catch(() => "")) ??
    ""
  ).replace(/\s+/g, " ");

// One pin → suggest → (optionally confirm) flow in a fresh context.
async function suggestAt(browser, coords) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 2400 },
  });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "networkidle" });
  await setPinManually(page, coords);
  await waitSuggestLive(page);
  return { ctx, page };
}

// Capture the crew-narrative markdown through the page's OWN download
// POST: click "Download .md", intercept the request the page fires, and
// replay its exact payload with an in-page fetch (the download stream's
// body is not readable from waitForResponse).  Same origin, same
// session, byte-identical payload — a stateless render, nothing
// persisted.
async function captureNarrative(page) {
  const reqPromise = page.waitForRequest(
    (r) =>
      r.url().includes("/api/render/markdown") && r.method() === "POST",
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "Download .md" }).click();
  const req = await reqPromise;
  const payload = req.postData();
  return page.evaluate(async (body) => {
    const res = await fetch("/api/render/markdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return { status: res.status, text: await res.text() };
  }, payload);
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

  // ── Check 1: Greeley pin → suggest → Confirm → key lands ─────────────
  {
    const { ctx, page } = await suggestAt(browser, PINS.greeley);
    const s = await suggestText(page);
    assert(
      "1a. Greeley pin: suggest slot offers Greeley",
      /Pin suggests:\s*Greeley/.test(s),
      s.slice(0, 160),
    );
    const confirm = page.getByRole("button", { name: "Confirm Greeley" });
    assert("1b. Confirm Greeley button present", (await confirm.count()) === 1);
    assert(
      "1c. reason cites Greeley municipal limits + TIGER (not county copy)",
      /inside Greeley municipal limits/.test(s) && /TIGER/.test(s),
      s.slice(0, 200),
    );
    assert(
      "1d. no 'unincorporated Weld County' falsehood anywhere",
      !/unincorporated/.test(await bodyText(page)),
    );
    await shot(page, "01a-greeley-suggested.png", true);

    await confirm.click();
    await page.waitForFunction(
      () =>
        /Pin agrees with your selection/.test(
          document.querySelector(".jbar-suggest")?.textContent ?? "",
        ),
      null,
      { timeout: 20000 },
    );
    assert(
      "1e. select shows greeley as the active jurisdiction_key",
      (await jurisdictionSelect(page).inputValue()) === "greeley",
    );
    // Record content (name + authority + terms), not the baseline line.
    await page.waitForFunction(
      () => {
        const t =
          document.querySelector(".jctl .jbar-auth")?.textContent ?? "";
        return /Greeley/.test(t) && !/Statewide baseline/.test(t);
      },
      null,
      { timeout: 20000 },
    );
    const auth = await authLine(page);
    assert(
      "1f. jurisdiction section renders the Greeley record (authority + terms), not baseline",
      /Greeley/.test(auth) && /calls this plan a/.test(auth),
      auth.slice(0, 160),
    );
    await shot(page, "01b-greeley-confirmed.png", true);

    // ── Check 7 (#156): crew narrative names Greeley ───────────────────
    const gen = generateBtn(page);
    await page.waitForFunction(
      () => {
        const b = Array.from(document.querySelectorAll("button")).find((x) =>
          /Generate plan/.test(x.textContent ?? ""),
        );
        return !!b && !b.disabled;
      },
      null,
      { timeout: 30000 },
    );
    await gen.click();
    await page.waitForSelector(".hero", { timeout: 60000 });
    const nar = await captureNarrative(page);
    fs.writeFileSync(path.join(OUT, "07-greeley-narrative.md"), nar.text);
    assert("7a. markdown download returned 200", nar.status === 200);
    assert(
      "7b. header renders 'Jurisdiction: Greeley'",
      /\*\*Jurisdiction:\*\* Greeley/.test(nar.text),
      (nar.text.match(/\*\*Jurisdiction:\*\*[^\n]*/) ?? ["header missing"])[0],
    );
    assert(
      "7c. header does NOT say CDOT",
      !/\*\*Jurisdiction:\*\* CDOT/.test(nar.text),
    );
    await shot(page, "07-greeley-generated.png", true);
    await ctx.close();
  }

  // ── Check 2: Thornton pin → same shape ───────────────────────────────
  {
    const { ctx, page } = await suggestAt(browser, PINS.thornton);
    const s = await suggestText(page);
    assert(
      "2a. Thornton pin: suggest slot offers Thornton",
      /Pin suggests:\s*Thornton/.test(s),
      s.slice(0, 160),
    );
    const confirm = page.getByRole("button", { name: "Confirm Thornton" });
    assert("2b. Confirm Thornton button present", (await confirm.count()) === 1);
    assert(
      "2c. no 'does not carry' falsehood",
      !/does not carry/.test(s),
      s.slice(0, 200),
    );
    await confirm.click();
    await page.waitForFunction(
      () => {
        const t =
          document.querySelector(".jctl .jbar-auth")?.textContent ?? "";
        return /Thornton/.test(t) && !/Statewide baseline/.test(t);
      },
      null,
      { timeout: 20000 },
    );
    assert(
      "2d. select shows thornton; record content renders",
      (await jurisdictionSelect(page).inputValue()) === "thornton",
      await authLine(page),
    );
    await shot(page, "02-thornton-confirmed.png", true);
    await ctx.close();
  }

  // ── Check 3: Lakewood control — unchanged healthy path ───────────────
  {
    const { ctx, page } = await suggestAt(browser, PINS.lakewood);
    const s = await suggestText(page);
    assert(
      "3a. Lakewood control still suggests Lakewood (inside)",
      /Pin suggests:\s*Lakewood/.test(s) &&
        /inside Lakewood municipal limits/.test(s),
      s.slice(0, 200),
    );
    assert(
      "3b. Confirm Lakewood offered",
      (await page.getByRole("button", { name: "Confirm Lakewood" }).count()) ===
        1,
    );
    await shot(page, "03-lakewood-control.png");
    await ctx.close();
  }

  // ── Check 4: Northglenn near-boundary — warning, no suggestion set ───
  {
    const { ctx, page } = await suggestAt(browser, PINS.northglenn);
    const s = await suggestText(page);
    assert(
      "4a. unsupported_area names Northglenn",
      /Pin is in Northglenn/.test(s),
      s.slice(0, 240),
    );
    assert(
      "4b. jigsaw warning names Thornton at ~292 ft",
      /2\d\d ft from the Thornton boundary/.test(s) && /jigsawed/.test(s),
      (s.match(/\d+ ft from the Thornton boundary/) ?? ["not found"])[0],
    );
    assert(
      "4c. no suggestion offered (no Confirm button) — suggest-never-set",
      (await page.locator("button.confirm").count()) === 0,
    );
    assert(
      "4d. jurisdiction_key untouched (select empty, baseline line shown)",
      (await jurisdictionSelect(page).inputValue()) === "" &&
        /Statewide baseline/.test(await authLine(page)),
    );
    await shot(page, "04-northglenn-jigsaw.png", true);
    await ctx.close();
  }

  // ── Check 5: dropdown carries Greeley + Thornton with labels ─────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 2000 },
    });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: "networkidle" });
    const options = await jurisdictionSelect(page)
      .locator("option")
      .evaluateAll((els) =>
        els.map((o) => ({ value: o.value, label: o.textContent.trim() })),
      );
    log(`dropdown options: ${JSON.stringify(options)}`);
    const greeley = options.find((o) => o.value === "greeley");
    const thornton = options.find((o) => o.value === "thornton");
    assert(
      "5a. dropdown has greeley with label 'Greeley' (not a raw key)",
      !!greeley && greeley.label === "Greeley",
      JSON.stringify(greeley),
    );
    assert(
      "5b. dropdown has thornton with label 'Thornton'",
      !!thornton && thornton.label === "Thornton",
      JSON.stringify(thornton),
    );
    await shot(page, "05-dropdown.png");
    await ctx.close();
  }

  // ── Check 6: county-copy honesty at the Arapahoe pocket ──────────────
  {
    const { ctx, page } = await suggestAt(browser, PINS.arapahoePocket);
    const s = await suggestText(page);
    assert(
      "6a. county copy names Arapahoe County + 'outside the mapped municipal boundaries'",
      /Arapahoe County, outside the mapped municipal boundaries/.test(s),
      s.slice(0, 260),
    );
    assert(
      "6b. no 'unincorporated' assertion anywhere in the slot",
      !/unincorporated/.test(s),
    );
    await shot(page, "06-county-copy.png", true);
    await ctx.close();
  }

  // ── Check 8 (#156): null-key control — header renders CDOT ───────────
  {
    const { ctx, page } = await suggestAt(browser, PINS.quiet);
    // A suggestion may be offered (Denver) — deliberately NOT confirmed.
    const sel = await jurisdictionSelect(page).inputValue();
    assert("8a. jurisdiction_key still null (select empty)", sel === "");
    await page.waitForFunction(
      () => {
        const b = Array.from(document.querySelectorAll("button")).find((x) =>
          /Generate plan/.test(x.textContent ?? ""),
        );
        return !!b && !b.disabled;
      },
      null,
      { timeout: 30000 },
    );
    await generateBtn(page).click();
    await page.waitForSelector(".hero", { timeout: 60000 });
    const nar = await captureNarrative(page);
    fs.writeFileSync(path.join(OUT, "08-nullkey-narrative.md"), nar.text);
    assert("8b. markdown download returned 200", nar.status === 200);
    assert(
      "8c. null key → header renders CDOT (honest baseline)",
      /\*\*Jurisdiction:\*\* CDOT/.test(nar.text),
      (nar.text.match(/\*\*Jurisdiction:\*\*[^\n]*/) ?? ["header missing"])[0],
    );
    await shot(page, "08-nullkey-generated.png", true);
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
