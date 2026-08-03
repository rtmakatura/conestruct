// Arc 9 Step-2 repro, #132: nav status dot. Read-only prod screenshot of the
// nav bar; also dump the dot's computed style + the fact it has no state props.
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto("https://www.conestruct.com/sandbox", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const nav = page.locator("nav");
  await nav.screenshot({ path: process.env.OUT + "\\repro132-nav-color.png" });
  const dot = nav.locator("span.animate-pulse").first();
  console.log("dot count in nav:", await nav.locator("span.animate-pulse").count());
  console.log(await dot.evaluate((el) => {
    const cs = getComputedStyle(el);
    return JSON.stringify({
      background: cs.backgroundColor,
      w: cs.width, h: cs.height,
      animation: cs.animationName,
      text: el.textContent,
      siblingText: el.parentElement.textContent.trim(),
    });
  }));
  await browser.close();
})();
