// Phase 4 / R143 — the phone fit check.  The supported floor is 320 px and
// the one test size is 360×800 (DESIGN-SPACING.md "Supported sizes"); at
// both, no stage of /sandbox may scroll sideways.
//
// Drives every stage the way a person does, at 320×800 and 360×800 as a
// phone (isMobile, touch):
//   empty            the page before a pin
//   picker           coordinates typed (N Broadway SB, 39.73370, -104.98753),
//                    the road picked
//   picker-moved     the map zoomed twice, panned, the pin moved by a tap
//   where            the road saved, Shoulder work, a side picked
//   what-shoulder    WHAT after Confirm
//   what-flagger     the same road as a flagger lane closure
//   what-near        near an intersection, the crossing marked on the map
//   results          Generate, every disclosure opened
// At each: the page's scroll width against the SCREEN's width (a phone
// widens its layout to fit wide content, so innerWidth is not the test)
// and the outermost elements past the right edge.  Exits 1 on any
// sideways scroll; writes fit-<w>.json and <stage>-<w>.png to FIT_OUT.
//
// Run from the repo root (gated sites need GATE_BYPASS_TOKEN):
//   node scripts/verify-phone-fit.cjs                     (production)
//   FIT_SITE=http://localhost:3000/sandbox node scripts/verify-phone-fit.cjs
//   FIT_WIDTHS=320 FIT_OUT=out node scripts/verify-phone-fit.cjs
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const { hook } = require("./live-check.cjs");
const { applyGate, gateHeaders } = require("./gate.cjs");

const SITE = process.env.FIT_SITE || "https://www.conestruct.com/sandbox";
const WIDTHS = (process.env.FIT_WIDTHS || "320,360").split(",").map(Number);
const OUT = process.env.FIT_OUT || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);

async function fit(page) {
  return page.evaluate(() => {
    const W = Math.min(innerWidth, screen.width);
    const past = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.right > W + 0.5)) return false;
        // Visually hidden (screen-reader-only) content is clipped to 1 px.
        for (let a = el; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          const b = a.getBoundingClientRect();
          if (s.overflow === "hidden" && b.width <= 1) return false;
        }
        return !el.parentElement || el.parentElement.getBoundingClientRect().right <= W + 0.5;
      })
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").trim().split(/\s+/).slice(0, 2).join(".")} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { scrollWidth: document.documentElement.scrollWidth, screen: screen.width, past };
  });
}

async function start(browser, w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  return { ctx, page };
}

async function pickRoad(page) {
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.73370");
  await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const pick = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await pick.count()) > 0) {
    await pick.scrollIntoViewIfNeeded();
    await pick.click();
  }
  await page.waitForTimeout(2500);
}

async function saveRoad(page) {
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
}

async function pickSide(page) {
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
}

async function confirm(page) {
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
}

async function openAll(page) {
  for (let round = 0; round < 5; round += 1) {
    const closed = page.locator('[aria-expanded="false"]:visible');
    const n = await closed.count();
    if (!n) break;
    for (let i = 0; i < n; i += 1) {
      try {
        const el = closed.nth(0);
        await el.scrollIntoViewIfNeeded({ timeout: 2000 });
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(400);
      } catch {
        break;
      }
    }
  }
}

(async () => {
  const browser = await chromium.launch();
  const failures = [];
  for (const w of WIDTHS) {
    const out = {};
    const check = async (page, stage) => {
      await page.mouse.move(1, 1).catch(() => {});
      await page.waitForTimeout(600);
      out[stage] = await fit(page);
      if (OUT) await page.screenshot({ path: path.join(OUT, `${stage}-${w}.png`), fullPage: true });
      const ok = out[stage].scrollWidth <= out[stage].screen;
      console.log(`${w} ${stage.padEnd(14)} ${ok ? "fits" : "SCROLLS"} scroll=${out[stage].scrollWidth} screen=${out[stage].screen}${out[stage].past.length ? " past: " + out[stage].past.join(", ") : ""}`);
      if (!ok) failures.push(`${w} ${stage}`);
    };
    {
      const { ctx, page } = await start(browser, w);
      await check(page, "empty");
      await pickRoad(page);
      await check(page, "picker");
      const zin = page.locator(".mapboxgl-ctrl-zoom-in").first();
      if (await zin.count()) {
        await zin.click();
        await page.waitForTimeout(800);
        await zin.click();
        await page.waitForTimeout(1500);
      }
      const box = await page.locator(".mapboxgl-canvas").first().boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(1500);
      await page.mouse.click(box.x + box.width / 2 + 10, box.y + box.height / 2 + 5);
      await page.waitForTimeout(6000);
      await check(page, "picker-moved");
      await ctx.close();
    }
    {
      const { ctx, page } = await start(browser, w);
      await pickRoad(page);
      await saveRoad(page);
      await (await hook(page, "kind-chip-shoulder")).click();
      await pickSide(page);
      await check(page, "where");
      await confirm(page);
      await check(page, "what-shoulder");
      const gen = page.getByRole("button", { name: /Generate plan/ }).first();
      for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) {
        const sp = page.locator("#what-speed");
        if (i % 5 === 0 && (await sp.count()) && (await sp.inputValue().catch(() => "x")) === "") {
          await sp.selectOption("30").catch(() => {});
        }
        await page.waitForTimeout(1000);
      }
      await gen.click();
      await page.waitForTimeout(30000);
      await openAll(page);
      await page.waitForTimeout(1500);
      await check(page, "results");
      await ctx.close();
    }
    {
      const { ctx, page } = await start(browser, w);
      await pickRoad(page);
      await saveRoad(page);
      await (await hook(page, "kind-chip-flagger_lane_closure")).click();
      await pickSide(page);
      await confirm(page);
      await check(page, "what-flagger");
      await ctx.close();
    }
    {
      const { ctx, page } = await start(browser, w);
      await pickRoad(page);
      await saveRoad(page);
      await (await hook(page, "kind-chip-near_intersection")).click();
      const mark = page.locator('[data-testid="side-control-mark"]');
      for (let i = 0; i < 60 && (await mark.count()) === 0; i += 1) await page.waitForTimeout(1000);
      await mark.click();
      await page.waitForTimeout(7000);
      const box = await page.locator(".mapboxgl-canvas").first().boundingBox();
      await page.mouse.click(box.x + box.width / 2 + 35, box.y + box.height / 2 - 20);
      await page.waitForTimeout(2000);
      const looking = page.getByText(/Looking up the cross street/);
      for (let i = 0; i < 90 && (await looking.count()) > 0; i += 1) await page.waitForTimeout(1000);
      await saveRoad(page);
      await pickSide(page);
      await confirm(page);
      await check(page, "what-near");
      await ctx.close();
    }
    if (OUT) fs.writeFileSync(path.join(OUT, `fit-${w}.json`), JSON.stringify(out, null, 2));
  }
  await browser.close();
  if (failures.length) {
    console.error(`FIT CHECK FAILED: ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log(`FIT CHECK PASSED at ${WIDTHS.join(" and ")} px`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
