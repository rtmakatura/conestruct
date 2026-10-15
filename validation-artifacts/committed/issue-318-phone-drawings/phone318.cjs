// #318 (R149): the Plan sheet card's phone line, in a browser.
//
//   node phone318.cjs <outDir> <base> [widths]
//
// Generates a shoulder plan on N Broadway SB, then at each width:
//   ≤480: opens the "4 files" row, reads whether the line shows and its
//         text, the Plan sheet card's controls' sizes, and screenshots it;
//   1440: screenshots the downloads row and the results column for a
//         pixel comparison against another run.
const fs = require("fs");
const path = require("path");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , OUT, BASE, W] = process.argv;
const WIDTHS = (W || "360,320,1440").split(",").map(Number);
const PIN = { lat: "39.73370", lng: "-104.98753" };
fs.mkdirSync(OUT, { recursive: true });
const rows = [];

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const phone = width <= 480;
    const ctx = await browser.newContext({
      viewport: { width, height: phone ? 800 : 1000 },
      deviceScaleFactor: 2,
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
    });
    await applyGate(ctx, BASE);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await (await hook(page, "where-open-picker")).click();
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /enter coordinates manually/i }).click();
    await page.waitForTimeout(1200);
    await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
    await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
    const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
    for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
    const cand = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
    if ((await page.getByText(/Which road\?/).count()) > 0 && (await cand.count()) > 0) await cand.click();
    await page.waitForTimeout(2500);
    const save = page.getByRole("button", { name: /Save & Close/ });
    for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
    await save.click();
    await page.waitForTimeout(5000);
    await (await hook(page, "kind-chip-shoulder")).click();
    await page.waitForTimeout(2500);
    const side = page.locator('[data-testid="side-option"]').first();
    for (let i = 0; i < 20 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
    if (await side.count()) await side.click();
    await page.waitForTimeout(2000);
    await (await hook(page, "where-confirm")).click();
    await page.waitForTimeout(9000);
    const gen = page.getByRole("button", { name: /Generate plan/ }).first();
    for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) await page.waitForTimeout(1000);
    await gen.click({ timeout: 5000 });
    for (let i = 0; i < 150; i++) {
      if ((await page.locator(".dls").count()) && !(await page.locator(".working-band").count()) && !(await page.locator(".results-stale").count())) break;
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(3000);
    if (phone) {
      const toggle = page.locator('[aria-controls="dl-cards"]').first();
      if (await toggle.count()) await toggle.click();
      await page.waitForTimeout(1200);
    }
    const m = await page.evaluate(() => {
      const note = document.querySelector('[data-testid="dl-phone-note"]');
      const cardEl = note ? note.closest(".dl-card") : null;
      const controls = cardEl
        ? Array.from(cardEl.querySelectorAll("button, a")).map((b) => {
            const r = b.getBoundingClientRect();
            return { text: (b.textContent || "").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
          })
        : [];
      return {
        notePresent: !!note,
        noteShown: note ? getComputedStyle(note).display !== "none" && note.getBoundingClientRect().height > 0 : false,
        noteText: note ? note.textContent.trim() : null,
        cardTitle: cardEl ? cardEl.querySelector("h3")?.textContent : null,
        controls,
        otherCardsWithNote: Array.from(document.querySelectorAll(".dl-card")).filter((c) => c.querySelector('[data-testid="dl-phone-note"]')).length,
      };
    });
    const row = { width, ...m };
    rows.push(row);
    console.log(JSON.stringify(row));
    if (phone) {
      const c = page.locator('[data-testid="dl-phone-note"]').locator("xpath=ancestor::div[contains(@class,'dl-card')]").first();
      if (await c.count()) {
        await c.scrollIntoViewIfNeeded();
        await c.screenshot({ path: path.join(OUT, `plan-card-${width}.png`) });
      }
    } else {
      const dls = page.locator(".dls").first();
      await dls.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await dls.screenshot({ path: path.join(OUT, `dls-${width}.png`) });
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  await browser.close();
})();
