// Renders each R96 mockup (what, setup, needsyou) to <name>-<width>.png at
// 1440 and 390, full page.  Usage: node render.cjs  (from anywhere)
const path = require("path");
const { chromium } = require("C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const name of ["what", "setup", "needsyou"]) {
      await page.goto("file:///" + path.join(__dirname, `${name}.html`).replace(/\\/g, "/"));
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(__dirname, `${name}-${width}.png`), fullPage: true });
      // The proposed block's own height (the first block on the page, not
      // the notes or the extra states below it), for the checkpoint.
      const first = page.locator("section.band, .setup, section.ny").first();
      const h = await first.evaluate((e) => Math.round(e.getBoundingClientRect().height));
      console.log(`wrote ${name}-${width}.png  first block ${h} px tall`);
    }
    await page.close();
  }
  await browser.close();
})();
