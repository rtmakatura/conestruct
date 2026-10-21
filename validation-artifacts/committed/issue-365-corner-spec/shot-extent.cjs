// #365 evidence: screenshot each extent panel extent-crop.mts wrote.
//   node shot-extent.cjs <extent.html> <outPrefix>
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { pathToFileURL } = require("node:url");

const [, , HTML, OUT] = process.argv;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 700 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(HTML).href);
  const figs = page.locator("figure");
  for (const [i, name] of ["before", "after"].entries()) {
    await figs.nth(i).screenshot({ path: `${OUT}-${name}.png` });
  }
  await browser.close();
})();
