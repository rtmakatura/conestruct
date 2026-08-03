/**
 * Arc 7 live-site verification — #193 against
 * https://www.conestruct.com/sandbox.  READ-ONLY: no accounts, no DB
 * writes, no plan saves.  Generate clicks are the sandbox's client-side
 * stage flip; synthetic failures via route interception only.
 *
 * Focus policy:  1. keyboard Generate → focus on results zone, Tab
 *                   proceeds into the package;
 *                2. armed error settle → focus on the zone holding the
 *                   alert, no scroll;
 *                3. strip editor close restores its cell; a deliberate
 *                   move to another cell is not overridden;
 *                4. Reopen → focus on the Setup zone;
 *                5. picker first save (opener detached) → focus on the
 *                   location block fallback, not <body>;
 *                6. background debounce settle never moves focus.
 * Announcements: 7. role=status announces "Plan generated — N devices,
 *                   M types." with the hero's counts; a repeat Generate
 *                   re-announces;
 *                8. breakdown-failed ribbon and bundle error carry
 *                   role=alert.
 * Measured WCAG: 9. @axe-core/playwright scans pre- and post-generate,
 *                   violations reported by criterion;
 *               10. keyboard tab-walk post-generate: stop log, no trap,
 *                   no dead-end.
 *
 * Run: EXPECTED_SHA=$(git rev-parse origin/main) \
 *      NODE_PATH=<scratch>/pw/node_modules node arc7-live-checks.js
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out7");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

// Quiet Denver-side pin (Arc 4/5/6's spot).
const PIN = { lat: "39.7266", lng: "-104.9532" };

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

async function settle(page) {
  // 350 ms debounce + request round-trip.
  await page.waitForTimeout(1400);
}

// Where is focus?  Everything the assertions need, in one evaluate.
async function activeDesc(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const zone = el && el.closest ? el.closest("section.zone") : null;
    return {
      tag: el ? el.tagName : null,
      id: el && el.id ? el.id : null,
      label: el && el.getAttribute ? el.getAttribute("aria-label") : null,
      text: el ? (el.textContent || "").replace(/\s+/g, " ").slice(0, 70) : "",
      isBody: el === document.body,
      isSection: !!el && el.tagName === "SECTION",
      zoneTitle: zone
        ? (zone.querySelector(".zone-title") || {}).textContent || null
        : null,
      tabindex: el && el.getAttribute ? el.getAttribute("tabindex") : null,
    };
  });
}

async function liveRegions(page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll("[aria-live], [role='status'], [role='alert']"),
    ).map((el) => ({
      role: el.getAttribute("role"),
      live: el.getAttribute("aria-live"),
      text: (el.textContent || "").trim().slice(0, 120),
    })),
  );
}

const scrollCount = (page) => page.evaluate(() => window.__scrolls || 0);

async function freshPage(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 2600 },
  });
  // Scroll spy for the no-scroll-on-error assertion.
  await ctx.addInitScript(() => {
    const orig = Element.prototype.scrollIntoView;
    window.__scrolls = 0;
    Element.prototype.scrollIntoView = function (...args) {
      window.__scrolls += 1;
      return orig ? orig.apply(this, args) : undefined;
    };
  });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "networkidle" });
  return { ctx, page };
}

async function generateArmed(page) {
  const btn = page.getByRole("button", { name: "Generate plan" });
  await btn.focus();
  await page.keyboard.press("Enter");
  await settle(page);
}

async function axeScan(page, name) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const compact = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    tags: v.tags.filter((t) => /^wcag/.test(t)),
    help: v.help,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      html: n.html.slice(0, 160),
    })),
  }));
  fs.writeFileSync(
    path.join(OUT, `${name}.json`),
    JSON.stringify(compact, null, 2),
  );
  log(
    `axe ${name}: ${compact.length} violation rule(s) — ${
      compact.map((v) => `${v.id}[${v.impact}]×${v.nodes.length}`).join(", ") ||
      "none"
    }`,
  );
  return compact;
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

  // ── Main context: checks 1, 7, 10, 3, 6, 4, 2, 8 in sequence ─────────
  {
    const { ctx, page } = await freshPage(browser);
    await setPinManually(page, PIN);
    await settle(page);

    // Axe pre-generate (check 9a) — pinned setup page.
    const axePre = await axeScan(page, "axe-pre-generate");

    // Check 1 — keyboard Generate.
    const regionsBefore = await liveRegions(page);
    await generateArmed(page);
    let d = await activeDesc(page);
    assert(
      "1a. keyboard Generate: focus lands on the results zone",
      d.isSection && (d.zoneTitle || "").includes("MHT package"),
      JSON.stringify(d),
    );
    await shot(page, "01-post-generate-focus.png", true);

    // Check 7a — status region announces with the hero's counts.
    const regionsAfter = await liveRegions(page);
    const heroNums = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".hero .num")).map((n) =>
        (n.textContent || "").trim(),
      ),
    );
    const status = regionsAfter.find((r) => r.role === "status");
    const expected = `Plan generated — ${heroNums[0]} devices, ${heroNums[1]} types.`;
    assert(
      "7a. role=status announces the package with the hero's counts",
      !!status && status.text === expected,
      `region="${status ? status.text : "(none)"}" hero=[${heroNums.join(",")}]`,
    );
    fs.writeFileSync(
      path.join(OUT, "regions-before-after-generate.json"),
      JSON.stringify({ before: regionsBefore, after: regionsAfter }, null, 2),
    );

    // Check 1b — next Tab proceeds into the package, not the nav.
    await page.keyboard.press("Tab");
    d = await activeDesc(page);
    assert(
      "1b. next Tab proceeds into the results zone (not the nav logo)",
      (d.zoneTitle || "").includes("MHT package"),
      JSON.stringify(d),
    );

    // Check 10 — tab-walk from here: log stops, no trap, no dead-end.
    const stops = [d];
    let doubleBody = false;
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const s = await activeDesc(page);
      stops.push(s);
      if (s.isBody && stops[stops.length - 2].isBody) doubleBody = true;
      // Stop once we wrap back to the first stop's element.
      if (
        i > 2 &&
        s.text === stops[0].text &&
        s.tag === stops[0].tag &&
        s.label === stops[0].label
      )
        break;
    }
    fs.writeFileSync(
      path.join(OUT, "tab-walk.json"),
      JSON.stringify(stops, null, 2),
    );
    assert(
      "10a. tab-walk: no dead-end (never two consecutive <body> stops)",
      !doubleBody,
      `${stops.length} stops logged`,
    );
    assert(
      "10b. tab-walk: package content reachable by keyboard",
      stops.filter((s) => (s.zoneTitle || "").includes("MHT package")).length >
        1,
    );

    // Axe post-generate (check 9b).
    const axePost = await axeScan(page, "axe-post-generate");
    void axePre;
    void axePost;

    // Check 3a — strip editor close restores its cell.
    await page.getByRole("button", { name: "Edit Speed" }).click();
    d = await activeDesc(page);
    assert(
      "3a-i. speed editor opens focused (autoFocus in)",
      d.id === "strip-speed",
      JSON.stringify(d),
    );
    await page.locator("#strip-speed").selectOption("35");
    d = await activeDesc(page);
    assert(
      "3a-ii. closing via selection restores the Speed cell button",
      d.label === "Edit Speed",
      JSON.stringify(d),
    );
    await shot(page, "03-strip-restore.png");

    // Check 3b — deliberate move to another cell is not overridden.
    await page.getByRole("button", { name: "Edit Work zone" }).click();
    await page.locator("#strip-worklen").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Edit Speed" }).click();
    await page.waitForTimeout(300);
    d = await activeDesc(page);
    assert(
      "3b. deliberate move: focus sits in the newly opened Speed editor, not yanked back",
      d.id === "strip-speed",
      JSON.stringify(d),
    );
    await page.locator("#strip-speed").selectOption("35");

    // Check 6 — background settle never moves focus.
    await page.getByRole("button", { name: "Edit Work zone" }).click();
    await page.locator("#strip-worklen").waitFor({ timeout: 10000 });
    await page.keyboard.press("End");
    await page.keyboard.type("0"); // workLen edit → debounced refetch
    await settle(page);
    await settle(page);
    d = await activeDesc(page);
    assert(
      "6. background debounce settle: focus stays in the strip input",
      d.id === "strip-worklen",
      JSON.stringify(d),
    );

    // Check 4 — Reopen focuses the Setup zone.
    await page.getByRole("button", { name: /Edit full setup/ }).click();
    await page.waitForTimeout(400);
    d = await activeDesc(page);
    assert(
      "4. Reopen: focus lands on the Setup zone section",
      d.isSection && /Describe the work zone|Scenario/.test(d.text),
      JSON.stringify(d),
    );
    await shot(page, "04-reopen-focus.png");

    // Check 7b — repeat Generate re-announces (cleared at click).
    await generateArmed(page);
    const regionsRepeat = await liveRegions(page);
    const statusRepeat = regionsRepeat.find((r) => r.role === "status");
    assert(
      "7b. repeat Generate re-announces the package",
      !!statusRepeat && /^Plan generated — \d+ devices, \d+ types\.$/.test(
        statusRepeat.text,
      ),
      `region="${statusRepeat ? statusRepeat.text : "(none)"}"`,
    );

    // Check 2 + 8a — armed error settle: focus on the alert's zone, no
    // scroll, ribbon is role=alert.  Synthetic 500 via interception.
    // Run-1 probe bug: intercepting and then clicking Generate never
    // produced an error — the breakdown was already settled ready, so
    // the click legitimately staged to post (scroll + focus correct).
    // The error state must be SETTLED before the armed click: a strip
    // edit under interception fails the refetch first (its ribbon is
    // 8a), then reopen → Generate arms into the settled error.
    await page.route("**/api/render/device-breakdown", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.getByRole("button", { name: "Edit Speed" }).click();
    await page.locator("#strip-speed").selectOption("40");
    await settle(page);
    await settle(page);
    const alertRibbonBg = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[role="alert"]')).find(
        (n) => (n.textContent || "").includes("Device breakdown failed"),
      );
      return el ? el.textContent.trim().slice(0, 100) : null;
    });
    assert(
      "8a-i. background failure: breakdown ribbon renders with role=alert",
      alertRibbonBg != null,
      alertRibbonBg || "",
    );
    d = await activeDesc(page);
    assert(
      "8a-ii. the background error settle did not move focus (strip cell keeps it)",
      d.label === "Edit Speed",
      JSON.stringify(d),
    );
    await page.getByRole("button", { name: /Edit full setup/ }).click();
    await page.waitForTimeout(400);
    const scrollsBefore = await scrollCount(page);
    await generateArmed(page);
    await settle(page);
    d = await activeDesc(page);
    assert(
      "2a. armed error settle: focus lands on the results zone (holding the alert)",
      d.isSection && (d.zoneTitle || "").includes("MHT package"),
      JSON.stringify(d),
    );
    const scrollsAfter = await scrollCount(page);
    assert(
      "2b. no scroll fired on the error settle",
      scrollsAfter === scrollsBefore,
      `scrollIntoView count ${scrollsBefore} → ${scrollsAfter}`,
    );
    const alertRibbon = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[role="alert"]')).find(
        (n) => (n.textContent || "").includes("Device breakdown failed"),
      );
      return el ? el.textContent.trim().slice(0, 100) : null;
    });
    assert(
      "8a-iii. the ribbon (role=alert) is on screen at the armed error settle",
      alertRibbon != null,
      alertRibbon || "",
    );
    await shot(page, "02-error-focus-alert.png", true);
    await page.unroute("**/api/render/device-breakdown");

    // Check 8b — bundle failure announces via role=alert.
    await page.getByRole("button", { name: /Edit full setup/ }).click();
    await page.waitForTimeout(400);
    await generateArmed(page);
    await page.route("**/api/render/bundle", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.getByRole("button", { name: /All \(\.zip\)/ }).click();
    await page.waitForTimeout(600);
    const bundleAlert = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[role="alert"]')).find(
        (n) => (n.textContent || "").includes("Bundle failed"),
      );
      return el ? el.textContent.trim() : null;
    });
    assert(
      "8b. bundle failure carries role=alert",
      bundleAlert === "Bundle failed (500)",
      bundleAlert || "(none)",
    );
    await page.unroute("**/api/render/bundle");

    await ctx.close();
  }

  // ── Picker context: check 5 (detached-opener fallback) ────────────────
  {
    const { ctx, page } = await freshPage(browser);
    await page
      .getByRole("button", { name: /Pick Location on Map/ })
      .click();
    await page.getByRole("dialog").waitFor({ timeout: 20000 });
    const canvas = page.locator(".mapboxgl-canvas");
    let saved = false;
    try {
      await canvas.waitFor({ timeout: 30000 });
      await page.waitForTimeout(3000); // map settle
      await canvas.click({ position: { x: 400, y: 300 } });
      // Single candidate auto-picks; multi-candidate needs a pick.
      const save = page.getByRole("button", { name: "Save & Close" });
      for (let i = 0; i < 30 && !(await save.isEnabled()); i++) {
        const picks = page.locator(".road-candidate, [class*=candidate]");
        if ((await picks.count()) > 0 && !(await save.isEnabled())) {
          await picks
            .first()
            .click()
            .catch(() => {});
        }
        await page.waitForTimeout(1000);
      }
      if (await save.isEnabled()) {
        await save.click();
        await page.waitForTimeout(800);
        saved = true;
      }
    } catch (e) {
      log(`picker flow exception: ${String(e).slice(0, 140)}`);
    }
    if (saved) {
      const d = await activeDesc(page);
      assert(
        "5. picker first save (opener detached): focus on the location block, not <body>",
        !d.isBody && d.tag === "DIV" && d.tabindex === "-1",
        JSON.stringify(d),
      );
      await shot(page, "05-picker-fallback-focus.png");
    } else {
      failures++;
      log(
        "**FAIL** — 5. BLOCKED: could not complete a map-click save in headless (Save & Close never enabled)",
      );
      await shot(page, "05-picker-blocked.png", true);
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "assertions-raw.md"), lines.join("\n"));
  console.log(`DONE — failures: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
