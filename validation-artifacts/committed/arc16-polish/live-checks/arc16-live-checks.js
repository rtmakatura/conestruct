/**
 * Arc 16 live checks — polish trio (#200 junction + normalizations,
 * #201 strip placement, #166 modal scale) verified on production.
 * READ-ONLY: no accounts, no DB writes, no plan saves; one plan is
 * GENERATED (transient, sandbox) but never saved.
 *
 * Scope (the arc16 GO's live-check set):
 *
 *   gate. healthz == origin/main == served bundle (abort on mismatch;
 *         mid-propagation pause-and-retry is the runner's job)
 *   1.  junction rule present in the SERVED css:
 *       .check-row + :not(.check-row) { margin-top: 12px }
 *   2.  strip adjacency (#201, computed DOM): the jurisdiction
 *       suggestion strip lives inside the same .jctl-field as the
 *       jurisdiction select, follows it, computed margin-top 12px and
 *       padding-left 0 (x-inset inherited from the field)
 *   3.  five #200 normalizations at token value where reachable:
 *       3a. generate footer padding 24/24 (DOM)
 *       3b. scenario-picker block padding-bottom 16 (DOM)
 *       3c. .empty-state padding-y 24 / margin-bottom 24 (DOM if
 *           mounted, else served-CSS assertion)
 *       3d. quote-settings grid margin-bottom 16 (DOM, post-generate)
 *       3e. jurisdiction delta-legend gap 16 (DOM if rendered at the
 *           Lakewood pin, else honestly reported unreachable)
 *   4.  modal gutter (#166, computed DOM): header/footer padding-x 24
 *   5.  axe wcag2a/aa: generator page AND open modal — Arc 7
 *       zero-violation baseline on touched surfaces
 *   6.  Rule 13 on the moved strips: glyph/text channel present
 *       (never hue alone); color + grayscale screenshot pair
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=conestruct/site/node_modules node arc16-live-checks.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// axe-core injected directly (no @axe-core/playwright wrapper installed;
// same engine, same tags).
const AXE_SRC = fs.readFileSync(
  require.resolve("axe-core/axe.min.js"),
  "utf-8",
);
async function runAxe(page) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    }),
  );
  return res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
}

const OUT = path.join(__dirname, "out16");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";
const LAKEWOOD = { lat: "39.7113", lng: "-105.0815" }; // arc house pin

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
const px = (v) => Math.round(parseFloat(v));

async function styleOf(page, handle, props) {
  return handle.evaluate((el, ps) => {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of ps) out[p] = cs[p];
    return out;
  }, props);
}

async function openPickerWithCoords(page, coords) {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
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
    log("**ABORT** — build gate mismatch (runner: pause and retry if mid-propagation)");
    process.exit(2);
  }
  assert("gate. healthz == origin/main == served bundle", true, hz.sha.slice(0, 7));

  // ── 1. junction rule in the served CSS ────────────────────────────
  const cssUrls = await gp.evaluate(() =>
    Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(
      (l) => l.href,
    ),
  );
  let cssBlob = await gp.evaluate(() =>
    Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n"),
  );
  for (const u of cssUrls) cssBlob += await (await gp.request.get(u)).text();
  const junction = /\.check-row\s*\+\s*:not\(\.check-row\)\s*\{[^}]*margin-top:\s*12px/.test(
    cssBlob,
  );
  assert("1. served CSS carries the junction rule (12px row step)", junction);
  const emptyStateCss = /\.empty-state\s*\{[^}]*padding:\s*24px[^}]*margin-bottom:\s*24px/.test(
    cssBlob,
  ) || (/\.empty-state\s*\{[^}]*padding:\s*24px/.test(cssBlob) &&
        /\.empty-state\s*\{[^}]*margin-bottom:\s*24px/.test(cssBlob));
  await gate.close();

  // ── Main context ──────────────────────────────────────────────────
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1800 },
  });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // ── 2. #201 strip adjacency, computed ─────────────────────────────
  const quiet = page.getByText(/drop a site pin for a jurisdiction suggestion/i).first();
  await quiet.waitFor({ timeout: 15000 });
  const adjacency = await quiet.evaluate((el) => {
    const strip = el.closest(".jbar-suggest");
    const field = strip?.closest(".jctl-field") ?? null;
    const select = document.getElementById("jl-jurisdiction");
    const selectField = select?.closest(".jctl-field") ?? null;
    const cs = strip ? getComputedStyle(strip) : null;
    return {
      sameField: !!field && field === selectField,
      follows: !!select && !!strip
        ? !!(select.compareDocumentPosition(strip) &
            Node.DOCUMENT_POSITION_FOLLOWING)
        : false,
      marginTop: cs?.marginTop ?? "",
      paddingLeft: cs?.paddingLeft ?? "",
      glyphText: (strip?.textContent ?? "").trim(),
    };
  });
  assert(
    "2a. jurisdiction strip inside the select's .jctl-field, after it",
    adjacency.sameField && adjacency.follows,
  );
  assert(
    "2b. strip computed margin-top 12px, padding-left 0",
    px(adjacency.marginTop) === 12 && px(adjacency.paddingLeft) === 0,
    `mt=${adjacency.marginTop} pl=${adjacency.paddingLeft}`,
  );
  // ── 6. Rule 13 on the moved strip ─────────────────────────────────
  assert(
    "6a. moved strip carries glyph+text channels (never hue alone)",
    /◌/.test(adjacency.glyphText) && /drop a site pin/i.test(adjacency.glyphText),
    JSON.stringify(adjacency.glyphText.slice(0, 60)),
  );
  const jctl = page.locator(".jctl").first();
  await jctl.screenshot({ path: path.join(OUT, "01-jctl-strips-color.png") });
  await page.addStyleTag({ content: ".jctl { filter: grayscale(1); }" });
  await jctl.screenshot({ path: path.join(OUT, "02-jctl-strips-grayscale.png") });
  await page.addStyleTag({ content: ".jctl { filter: none; }" });
  log("screenshots: 01/02 jctl strips color + grayscale (Rule 13 pair)");

  // ── 3a/3b. footer + scenario picker, computed ─────────────────────
  const genBtn = page.locator(".generate-btn").first();
  const footPad = await genBtn.evaluate((el) => {
    const wrap = el.parentElement;
    const cs = getComputedStyle(wrap);
    return { pt: cs.paddingTop, pb: cs.paddingBottom };
  });
  assert(
    "3a. generate footer padding 24/24 (section)",
    px(footPad.pt) === 24 && px(footPad.pb) === 24,
    `pt=${footPad.pt} pb=${footPad.pb}`,
  );
  const pickerPad = await page.evaluate(() => {
    const tag = Array.from(document.querySelectorAll("span")).find(
      (s) => s.textContent === "Scenario",
    );
    const body = tag?.closest("div")?.nextElementSibling;
    return body ? getComputedStyle(body).paddingBottom : null;
  });
  assert(
    "3b. scenario-picker block padding-bottom 16 (block)",
    pickerPad !== null && px(pickerPad) === 16,
    `pb=${pickerPad}`,
  );

  // ── 3c. empty-state ───────────────────────────────────────────────
  const es = page.locator(".empty-state").first();
  if (await es.isVisible().catch(() => false)) {
    const esCs = await styleOf(page, es, [
      "paddingTop",
      "paddingBottom",
      "marginBottom",
    ]);
    assert(
      "3c. .empty-state 24px inset-y + 24px margin (section) [DOM]",
      px(esCs.paddingTop) === 24 &&
        px(esCs.paddingBottom) === 24 &&
        px(esCs.marginBottom) === 24,
      JSON.stringify(esCs),
    );
  } else {
    assert(
      "3c. .empty-state 24px inset + margin (section) [served CSS — not mounted pre-generate]",
      emptyStateCss,
    );
  }

  // ── 5 (first half). axe on the pre-generate page ──────────────────
  {
    const compact = await runAxe(page);
    fs.writeFileSync(
      path.join(OUT, "axe-generator.json"),
      JSON.stringify(compact, null, 2),
    );
    assert(
      "5a. axe zero violations — generator page (Arc 7 baseline)",
      compact.length === 0,
      compact.length ? `${compact.length} finding(s) — axe-generator.json` : "0",
    );
    // Context for the known finding, measured not asserted (Rule 13):
    // the quiet band's faint text computes ~3.8:1 vs the 4.5:1 AA
    // floor.  Every color/opacity involved is untouched by arc16 (the
    // diff has zero color lines); prior axe passes ran post-generate,
    // where the quiet band never renders — this is the first scan of
    // the pre-pin state.  Disposition: Ryan (coda fix or triage).
    if (compact.some((v) => v.id === "color-contrast"))
      log(
        "5a note: color-contrast on .jbar-suggest quiet text — PRE-EXISTING (colors/opacity byte-identical pre-arc; state newly scanned)",
      );
  }

  // ── 4. modal gutter + axe on the open modal ───────────────────────
  await openPickerWithCoords(page, LAKEWOOD);
  await page.waitForTimeout(1500);
  const dialog = page.getByRole("dialog", { name: "Define work zone" });
  const gutters = await dialog.evaluate((d) => {
    const h2 = d.querySelector("h2");
    const header = h2 ? h2.closest("div").parentElement : null;
    const els = [header].filter(Boolean);
    return els.map((el) => {
      const cs = getComputedStyle(el);
      return { pl: cs.paddingLeft, pr: cs.paddingRight };
    });
  });
  assert(
    "4a. modal header gutter padding-x 24 (section, was 20)",
    gutters.length > 0 && gutters.every((g) => px(g.pl) === 24 && px(g.pr) === 24),
    JSON.stringify(gutters),
  );
  // The input's own .field-input 12px inset is a parked control value —
  // the gutter under test is the coord GRID's px-6, further up the chain.
  const latPad = await page.getByLabel("Latitude").evaluate((el) => {
    let n = el.parentElement;
    while (n && n.getAttribute?.("role") !== "dialog") {
      const cs = getComputedStyle(n);
      if (cs.paddingLeft === "24px") return cs.paddingLeft;
      n = n.parentElement;
    }
    return null;
  });
  assert(
    "4b. coord-grid gutter padding-left 24 (an ancestor inside the dialog)",
    latPad !== null && px(latPad) === 24,
    `pl=${latPad}`,
  );
  await dialog.screenshot({ path: path.join(OUT, "03-modal-open.png") });
  {
    const compact = await runAxe(page);
    fs.writeFileSync(
      path.join(OUT, "axe-modal.json"),
      JSON.stringify(compact, null, 2),
    );
    assert(
      "5b. axe zero violations — open modal",
      compact.length === 0,
      compact.length ? `${compact.length} finding(s) — axe-modal.json` : "0",
    );
  }

  // ── set pin, save, generate — reach 3d/3e surfaces ────────────────
  await pickAnyCandidate(page);
  const saved = await saveWhenReady(page);
  log(saved ? "picker saved (Lakewood pin)" : "picker save unavailable");
  if (saved) {
    const gen = page.getByRole("button", { name: /Generate/ }).first();
    for (let i = 0; i < 30 && !(await gen.isEnabled().catch(() => false)); i++) {
      await page.waitForTimeout(1000);
    }
    // The Lakewood pin relays 4×12ft lanes + 10ft shoulder — the plan-
    // sheet width gate blocks with "use 10.5 ft or less".  Follow the
    // recovery affordance through the real form (React range needs the
    // native setter + input event).
    if (!(await gen.isEnabled().catch(() => false))) {
      const strip =
        (await page.locator(".status-bar").first().textContent().catch(() => "")) ?? "";
      if (/wider than the plan sheet/i.test(strip)) {
        log("width gate fired (honest 400) — following its recovery: lane width -> 10.5");
        const done = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll(".field-label-row"));
          const row = rows.find((r) => /Lane width/i.test(r.textContent ?? ""));
          const input = row?.parentElement?.querySelector('input[type="range"]');
          if (!input) return false;
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          ).set;
          setter.call(input, "10.5");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        });
        log(done ? "lane width set to 10.5 through the form" : "lane-width slider not found");
        for (let i = 0; i < 45 && !(await gen.isEnabled().catch(() => false)); i++) {
          await page.waitForTimeout(1000);
        }
      }
    }
    if (await gen.isEnabled().catch(() => false)) {
      await gen.click();
      await page
        .waitForFunction(
          () =>
            Array.from(document.querySelectorAll("button")).some((b) =>
              /Download/i.test(b.textContent ?? ""),
            ),
          null,
          { timeout: 90000 },
        )
        .catch(() => {});
      // 3d. quote-settings grid mb 16
      const quoteMb = await page.evaluate(() => {
        const lbl = Array.from(document.querySelectorAll("*")).find(
          (el) =>
            el.children.length === 0 && /Duration \(days\)/.test(el.textContent ?? ""),
        );
        const grid = lbl?.closest(".grid");
        return grid ? getComputedStyle(grid).marginBottom : null;
      });
      assert(
        "3d. quote-settings grid margin-bottom 16 (block)",
        quoteMb !== null && px(quoteMb) === 16,
        `mb=${quoteMb}`,
      );
      // 3e. delta-legend gap 16 (renders only when the jurisdiction
      // panel shows count-affecting deltas at this pin)
      const legendGap = await page.evaluate(() => {
        const item = Array.from(document.querySelectorAll("span")).find((s) =>
          /Changes device count/i.test(s.textContent ?? ""),
        );
        const row = item?.parentElement;
        return row ? getComputedStyle(row).gap : null;
      });
      if (legendGap !== null) {
        assert("3e. delta-legend gap 16 (block)", px(legendGap) === 16, `gap=${legendGap}`);
      } else {
        log(
          "3e. delta legend not rendered at this pin/scenario — unreachable read-only; covered by diff + mounted suite (stated, not silently skipped)",
        );
      }
      await page.screenshot({
        path: path.join(OUT, "04-post-generate.png"),
        fullPage: false,
      });
    } else {
      log("generate stayed disabled — 3d/3e unreachable this run (stated)");
    }
  }

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "assertions-raw.md"),
    `# Arc 16 live checks — raw log\n\n${lines.join("\n")}\n\nFailures: ${failures}\n`,
  );
  console.log(`\nDone. Failures: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
