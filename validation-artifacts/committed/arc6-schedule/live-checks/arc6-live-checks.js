/**
 * Arc 6 live-site verification — #188 + #199 + #206 against
 * https://www.conestruct.com/sandbox.  READ-ONLY: no accounts, no DB
 * writes, no plan saves.  Generate clicks are the sandbox's client-side
 * stage flip; every POST is the page's own stateless render call.
 *
 * #199: 1. cold load presents "Not set" and writes no schedule;
 *       2. pin + class, no schedule → not-evaluated, no verdict;
 *       3. residual times under "Not set" → not-evaluated, no verdict.
 * #188: 4. Denver arterial 20:00→05:00 enterable, POSTs, verdict
 *          INSIDE with the overnight note; band overlay two segments;
 *       5. stranded-end regression: start moved past end displays as a
 *          legal overnight and the POST matches the display;
 *       6. strip cell reads "8:00 PM–5:00 AM (+1 day)".
 * #206: 7. Denver day shift 9:00–15:00 → INSIDE (false-outside gone);
 *       8. Denver 10:00–16:00 → genuine violation citing the
 *          alternative-window set;
 *       9. Greeley 7:30–15:00 → still outside the inner envelope
 *          (composition change didn't loosen nested envelopes).
 *
 * Run: EXPECTED_SHA=$(git rev-parse origin/main) node arc6-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out6");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";
const WORK_DATE = "2026-08-05"; // Wednesday — weekday windows

const PINS = {
  // Quiet Denver-side pin (Arc 4/5's null-key spot) — suggests Denver.
  denver: { lat: "39.7266", lng: "-104.9532" },
  greeley: { lat: "40.404292", lng: "-104.715863" },
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

// React-compatible write into an input (Arc 4 helper).
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

// Track the page's own /device-breakdown POSTs: request schedule +
// response hours_eval, in order.  Attached before any interaction.
function trackBreakdown(page, record) {
  page.on("response", async (res) => {
    const req = res.request();
    if (!req.url().includes("device-breakdown") || req.method() !== "POST")
      return;
    let scenario = null;
    try {
      const body = JSON.parse(req.postData() ?? "{}");
      scenario = body.scenario ?? body;
    } catch {}
    let hoursEval = null;
    let status = res.status();
    try {
      const json = await res.json();
      hoursEval = json?.jurisdiction?.hours_eval ?? null;
    } catch {}
    record.push({
      http_status: status,
      schedule: scenario?.schedule ?? null,
      street_class: scenario?.street_class ?? null,
      jurisdiction_key: scenario?.jurisdiction_key ?? null,
      hours_eval: hoursEval,
    });
  });
}

const last = (arr) => arr[arr.length - 1];
async function settle(page) {
  // 350 ms debounce + request round-trip.
  await page.waitForTimeout(1400);
}

async function freshPage(browser, record) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 2600 },
  });
  const page = await ctx.newPage();
  trackBreakdown(page, record);
  await page.goto(SITE, { waitUntil: "networkidle" });
  return { ctx, page };
}

async function confirmJurisdiction(page, name, key) {
  await page.waitForSelector(".jbar-suggest.live", { timeout: 30000 });
  await page.getByRole("button", { name: `Confirm ${name}` }).click();
  await page.waitForFunction(
    (k) => document.querySelector("select#jl-jurisdiction")?.value === k,
    key,
    { timeout: 20000 },
  );
}

async function setClassArterial(page) {
  await page
    .getByRole("group", { name: "Street classification" })
    .getByRole("button", { name: "Arterial" })
    .click();
}

// Setup-panel schedule entry (ScheduleField).
async function chooseMode(page, label) {
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function setTimes(page, start, end) {
  if (start != null)
    await page.locator("#sched-start").selectOption(String(start));
  if (end != null) await page.locator("#sched-end").selectOption(String(end));
}
async function setSingleDay(page, start, end) {
  await chooseMode(page, "Single day");
  await page.locator("#sched-date").waitFor({ timeout: 10000 });
  await setInput(page.locator("#sched-date"), WORK_DATE);
  await page.waitForTimeout(200);
  await setTimes(page, start, end);
}

const hoursHead = (page, name) =>
  page.getByRole("button", { name: new RegExp(`work hours — ${name}`, "i") });
const headText = async (page, name) =>
  ((await hoursHead(page, name).textContent().catch(() => "")) ?? "").replace(
    /\s+/g,
    " ",
  );

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

  // ── Check 1 (#199): cold load — "Not set" presented, nothing written ─
  const coldPosts = [];
  {
    const { ctx, page } = await freshPage(browser, coldPosts);
    const notSet = page.getByRole("button", { name: "Not set", exact: true });
    assert(
      "1a. cold load: 'Not set' chip presented as selected",
      (await notSet.getAttribute("aria-pressed")) === "true",
    );
    assert(
      "1b. 'Single day' not asserted",
      (await page
        .getByRole("button", { name: "Single day", exact: true })
        .getAttribute("aria-pressed")) === "false",
    );
    assert(
      "1c. no date/time inputs mounted for the unentered schedule",
      (await page.locator("#sched-date").count()) === 0 &&
        (await page.locator("#sched-start").count()) === 0,
    );
    await settle(page);
    const withSchedule = coldPosts.filter((p) => p.schedule != null);
    assert(
      "1d. no fresh POST carries a schedule key (display-only default)",
      withSchedule.length === 0,
      `${coldPosts.length} breakdown POST(s), ${withSchedule.length} with schedule`,
    );
    await shot(page, "01-cold-notset.png", true);
    await ctx.close();
  }

  // ── Denver context: checks 2, 7, 8, 4, 5, 3, 6 in sequence ───────────
  const posts = [];
  {
    const { ctx, page } = await freshPage(browser, posts);
    await setPinManually(page, PINS.denver);
    await confirmJurisdiction(page, "Denver", "denver");
    await setClassArterial(page);
    await settle(page);

    // Check 2 (#199): no schedule → not-evaluated, no verdict.
    let head = await headText(page, "denver");
    assert(
      "2a. hours chip (no schedule): 'not checked', no verdict",
      /not checked/i.test(head) &&
        !/inside window/i.test(head) &&
        !/outside window/i.test(head),
      head.slice(0, 160),
    );
    const p2 = last(posts.filter((p) => p.jurisdiction_key === "denver"));
    assert(
      "2b. backend hours_eval is the honest unknown arm",
      p2?.hours_eval?.status === "unknown" &&
        p2?.hours_eval?.violations?.length === 0,
      JSON.stringify(p2?.hours_eval),
    );
    await shot(page, "02-denver-noschedule.png", true);

    // Check 7 (#206): compliant day shift → INSIDE, false-outside gone.
    await setSingleDay(page, 9, 15);
    await settle(page);
    await page.waitForFunction(
      () =>
        /inside window|outside window/i.test(
          document.body.textContent ?? "",
        ),
      null,
      { timeout: 45000 },
    );
    head = await headText(page, "denver");
    assert(
      "7a. Denver 9:00–15:00 weekday arterial: INSIDE",
      /inside window/i.test(head),
      head.slice(0, 160),
    );
    assert(
      "7b. the pre-fix false 'outside window · review schedule' appears nowhere",
      !/outside window · review schedule/i.test(
        (await page.evaluate(() => document.body.textContent)) ?? "",
      ),
    );
    const p7 = last(posts.filter((p) => p.schedule?.start_time === 9));
    assert(
      "7c. payload-level: hours_eval inside, zero violations",
      p7?.hours_eval?.status === "inside" &&
        p7?.hours_eval?.violations?.length === 0,
      JSON.stringify(p7?.schedule),
    );
    await shot(page, "07-denver-day-inside.png", true);

    // Check 8 (#206): genuine violation cites the alternative set.
    await setTimes(page, 10, 16);
    await settle(page);
    await page.waitForFunction(
      () => /outside window/i.test(document.body.textContent ?? ""),
      null,
      { timeout: 45000 },
    );
    const body8 = (await page.evaluate(() => document.body.textContent)) ?? "";
    assert(
      "8a. Denver 10:00–16:00: OUTSIDE (union is not amnesty)",
      /outside window · review schedule/i.test(body8),
    );
    assert(
      "8b. violation names the alternative-window set",
      /0\.5 h falls outside the permitted 8:30 AM–3:30 PM \/ 8:00 PM–12:00 AM \/ 12:00 AM–5:00 AM windows/i.test(
        body8,
      ),
      (body8.match(/0\.5 h falls outside[^.]*/) ?? ["copy missing"])[0].slice(
        0,
        200,
      ),
    );
    const p8 = last(posts.filter((p) => p.schedule?.end_time === 16));
    assert(
      "8c. payload-level: one violation, 0.5 h, 3-window alternatives list",
      p8?.hours_eval?.violations?.length === 1 &&
        p8?.hours_eval?.violations[0]?.outside_hours === 0.5 &&
        p8?.hours_eval?.violations[0]?.windows?.length === 3,
      JSON.stringify(p8?.hours_eval?.violations?.[0] ?? null).slice(0, 220),
    );
    await shot(page, "08-denver-genuine-violation.png", true);

    // Check 4 (#188): overnight 20:00→05:00 — enterable, POSTs, INSIDE.
    const endLabels = await page
      .locator("#sched-end option")
      .evaluateAll((els) => els.map((o) => o.textContent));
    // Set the start first so the labels reflect start=20.
    await setTimes(page, 20, null);
    const endLabels20 = await page
      .locator("#sched-end option")
      .evaluateAll((els) => els.map((o) => o.textContent));
    assert(
      "4a. end select offers '5:00 AM (next day)' with start 20:00",
      endLabels20.includes("5:00 AM (next day)"),
      `options: ${endLabels20.length} (was ${endLabels.length})`,
    );
    await setTimes(page, null, 5);
    await settle(page);
    await page.waitForFunction(
      () => /inside window/i.test(document.body.textContent ?? ""),
      null,
      { timeout: 45000 },
    );
    const p4 = last(
      posts.filter(
        (p) => p.schedule?.start_time === 20 && p.schedule?.end_time === 5,
      ),
    );
    assert(
      "4b. 20:00→05:00 POSTs and returns 200 (no 422)",
      p4?.http_status === 200,
      JSON.stringify(p4?.schedule),
    );
    assert(
      "4c. verdict INSIDE with the overnight note",
      p4?.hours_eval?.status === "inside" &&
        /overnight/.test(p4?.hours_eval?.note ?? ""),
      JSON.stringify(p4?.hours_eval),
    );
    head = await headText(page, "denver");
    assert(
      "4d. chip renders 'inside window ✓' for the night shift",
      /inside window/i.test(head),
      head.slice(0, 160),
    );
    // Band overlay: ensure the chip is expanded (check 8's auto-expand
    // may have left it open — a blind click would collapse it), then
    // count overlay segments.
    if (
      (await hoursHead(page, "denver").getAttribute("aria-expanded")) !==
      "true"
    ) {
      await hoursHead(page, "denver").click();
    }
    await page.waitForTimeout(300);
    const overlays = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".border-x-2"));
      return els.map((e) => ({ left: e.style.left, width: e.style.width }));
    });
    assert(
      "4e. band overlay renders TWO segments (20→24 and 0→5)",
      overlays.length === 2 &&
        overlays.some((o) => o.left === "0%") &&
        overlays.every((o) => !o.width.startsWith("-")),
      JSON.stringify(overlays),
    );
    await shot(page, "04-denver-overnight-inside.png", true);

    // Check 5 (#188): start moved past the end — display == POST.
    await setTimes(page, 8, 10);
    await settle(page);
    await setTimes(page, 11, null);
    await settle(page);
    const endSel = page.locator("#sched-end");
    const endShown = await endSel.evaluate(
      (el) => el.selectedOptions[0]?.textContent ?? "(blank)",
    );
    assert(
      "5a. end select displays the wrap, not a blank",
      endShown === "10:00 AM (next day)",
      endShown,
    );
    const p5 = last(posts.filter((p) => p.schedule?.start_time === 11));
    assert(
      "5b. POST matches the display: {11, 10}, no stale contradiction",
      p5?.schedule?.end_time === 10 && p5?.http_status === 200,
      JSON.stringify(p5?.schedule),
    );
    await shot(page, "05-stranded-end-wrap.png");

    // Check 3 (#199): residual times under "Not set" → not evaluated.
    await chooseMode(page, "Not set");
    await settle(page);
    await page.waitForFunction(
      () => /not checked/i.test(document.body.textContent ?? ""),
      null,
      { timeout: 45000 },
    );
    head = await headText(page, "denver");
    assert(
      "3a. 'Not set' after entered times: chip reads 'not checked', no verdict",
      /not checked/i.test(head) &&
        !/inside window/i.test(head) &&
        !/outside window/i.test(head),
      head.slice(0, 160),
    );
    const p3 = last(posts.filter((p) => p.schedule?.date_mode === "tbd"));
    assert(
      "3b. residual times ride the payload yet the backend refuses to judge them",
      p3?.schedule?.start_time === 11 &&
        p3?.schedule?.end_time === 10 &&
        p3?.hours_eval?.status === "unknown" &&
        /not evaluated/.test(p3?.hours_eval?.note ?? ""),
      JSON.stringify({ schedule: p3?.schedule, hours_eval: p3?.hours_eval }),
    );
    await shot(page, "03-tbd-residual-notevaluated.png", true);

    // Check 6 (#188): strip cell labels the overnight "(+1 day)".
    await setSingleDay(page, 20, 5);
    await settle(page);
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
    await page.getByRole("button", { name: /Generate plan/ }).click();
    await page.waitForSelector(".hero", { timeout: 60000 });
    const hoursCell =
      (await page
        .getByLabel("Edit Hours")
        .textContent()
        .catch(() => "")) ?? "";
    assert(
      "6a. strip cell reads '8:00 PM–5:00 AM (+1 day)'",
      hoursCell.includes("8:00 PM–5:00 AM (+1 day)"),
      hoursCell.replace(/\s+/g, " ").slice(0, 120),
    );
    await shot(page, "06-strip-plus-one-day.png");
    await ctx.close();
  }

  // ── Check 9 (#206): Greeley nested envelope stays cumulative ─────────
  const gposts = [];
  {
    const { ctx, page } = await freshPage(browser, gposts);
    await setPinManually(page, PINS.greeley);
    await confirmJurisdiction(page, "Greeley", "greeley");
    await setClassArterial(page);
    await setSingleDay(page, 7.5, 15);
    await settle(page);
    await page.waitForFunction(
      () => /outside window/i.test(document.body.textContent ?? ""),
      null,
      { timeout: 45000 },
    );
    const body9 = (await page.evaluate(() => document.body.textContent)) ?? "";
    assert(
      "9a. Greeley 7:30–15:00 arterial: OUTSIDE the inner envelope",
      /outside window · review schedule/i.test(body9),
    );
    assert(
      "9b. violation is the inner 8:30 AM–4:00 PM window, 1 h",
      /1 h falls outside the permitted 8:30 AM–4:00 PM window/i.test(body9),
      (body9.match(/1 h falls outside[^.]*/) ?? ["copy missing"])[0].slice(
        0,
        160,
      ),
    );
    const p9 = last(gposts.filter((p) => p.schedule?.start_time === 7.5));
    assert(
      "9c. payload-level: exactly one violation, 1.0 h (outer envelope satisfied)",
      p9?.hours_eval?.violations?.length === 1 &&
        p9?.hours_eval?.violations[0]?.outside_hours === 1,
      JSON.stringify(p9?.hours_eval?.violations ?? null).slice(0, 220),
    );
    await shot(page, "09-greeley-cumulative.png", true);
    await ctx.close();
  }

  // Payload captures for the evidence pack (checks 1, 4, 5 + context).
  fs.writeFileSync(
    path.join(OUT, "payload-captures.json"),
    JSON.stringify(
      {
        cold_load_posts: coldPosts,
        denver_posts: posts,
      },
      null,
      2,
    ) + "\n",
  );

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
