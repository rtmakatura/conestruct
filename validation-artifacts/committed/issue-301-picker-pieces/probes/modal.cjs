const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const SITE = "https://www.conestruct.com/sandbox";
const OUT = path.join(__dirname, "shots");
gateHeaders(SITE);
async function run(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, `${w}-0-band-empty.png`), fullPage: true });
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, `${w}-1-modal-open.png`) });
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.73370");
  await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  for (let i = 0; i < 90; i += 1) { if ((await candidate.count()) > 0 || (await save.isEnabled())) break; await page.waitForTimeout(1000); }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, `${w}-2-candidates.png`) });
  if ((await candidate.count()) > 0) { await candidate.click(); await page.waitForTimeout(3500); }
  await page.screenshot({ path: path.join(OUT, `${w}-3-picked.png`) });
  // full modal text dump
  const text = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]') || document.body;
    return d.innerText;
  });
  fs.writeFileSync(path.join(OUT, `${w}-modal-text.txt`), text);
  // scroll the dialog to capture the rest
  await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); if (d) { const sc = [...d.querySelectorAll("*")].find(e => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== "visible"); if (sc) sc.scrollTop = sc.scrollHeight; } });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${w}-4-picked-scrolled.png`) });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, `${w}-5-band-after-save.png`), fullPage: true });
  const bandText = await page.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText);
  fs.writeFileSync(path.join(OUT, `${w}-band-text.txt`), bandText);
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
