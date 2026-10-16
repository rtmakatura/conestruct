// Download-button look: generate a shoulder plan on <base> at <width>,
// screenshot the output cards, and measure every .dl-btn (height, label
// lines).   node capdl.cjs <outPrefix> <base> <width>
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , OUT, BASE, W] = process.argv;
const width = Number(W);

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  await applyGate(ctx, BASE);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.73370");
  await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
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
  const conf = page.locator('[data-testid="where-confirm"]');
  if (await conf.count()) { await conf.first().click(); await page.waitForTimeout(6000); }
  const gen = page.getByRole("button", { name: /Generate plan/ }).first();
  for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await gen.click({ timeout: 5000 });
  for (let i = 0; i < 150; i++) {
    if ((await page.locator(".dls").count()) && !(await page.locator(".working-band").count())) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(3000);
  const files = page.locator(".dl-files").first();
  if ((await files.count()) && (await files.isVisible()) && (await files.getAttribute("aria-expanded")) !== "true") {
    await files.click();
    await page.waitForTimeout(1000);
  }
  const dls = page.locator(".dls").first();
  await dls.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await dls.screenshot({ path: `${OUT}.png` });
  const buttons = await page.$$eval(".dls .dl-btn", (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      // Lines of the label text alone (the arrow span sits on its own baseline).
      const text = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      const range = document.createRange();
      if (text) range.selectNodeContents(text);
      const lines = text ? new Set([...range.getClientRects()].map((q) => Math.round(q.top))).size : 0;
      return { label: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), lines };
    }),
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(JSON.stringify({ width, overflow, buttons }));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
