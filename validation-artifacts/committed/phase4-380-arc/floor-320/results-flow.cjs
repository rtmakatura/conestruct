// Shared: open /sandbox, pick N Broadway SB (39.73370, -104.98753), shoulder
// work, confirm, Generate, open every disclosure.  Returns { ctx, page }.
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate } = require(`${REPO}/scripts/gate.cjs`);

async function openAll(page) {
  let opened = 0;
  for (let round = 0; round < 5; round += 1) {
    const closed = page.locator('[aria-expanded="false"]:visible');
    const n = await closed.count();
    if (!n) break;
    for (let i = 0; i < n; i += 1) {
      try {
        const el = closed.nth(0);
        await el.scrollIntoViewIfNeeded({ timeout: 2000 });
        await el.click({ timeout: 3000 });
        opened += 1;
        await page.waitForTimeout(400);
      } catch {
        break;
      }
    }
  }
  return opened;
}

async function toResults(browser, site, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w <= 480 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
  await applyGate(ctx, site);
  const page = await ctx.newPage();
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
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
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-shoulder")).click();
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  const gen = page.getByRole("button", { name: /Generate plan/ }).first();
  // The local stack's road lookup can come back without a speed (production
  // measures 30 mph here); set the same 30 so both runs plan the same road.
  for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) {
    const sp = page.locator("#what-speed");
    if (i % 5 === 0 && (await sp.count()) && (await sp.inputValue().catch(() => "x")) === "") {
      await sp.selectOption("30").catch(() => {});
    }
    await page.waitForTimeout(1000);
  }
  await gen.click();
  await page.waitForTimeout(30000);
  const opened = await openAll(page);
  const table = page.locator(".device-table");
  for (let i = 0; i < 30 && (await table.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  return { ctx, page, opened };
}

module.exports = { toResults, openAll };
