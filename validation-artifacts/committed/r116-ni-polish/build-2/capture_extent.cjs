// R116 item 2 build (R117 Q2), on a local build of this branch: the
// WHERE band's extent as a WHAT-style row with the five lengths in its
// popover.  The plan is ../capture_r116.cjs's (N Broadway SB near E 12th
// Ave, Denver, near-intersection, 500 ft).  After Generate the Setup box's
// Length cell reopens WHERE at the field.  At 1440 and 390, into AUDIT_OUT:
//   extent-<w>.png        the row, popover closed
//   extent-<w>-open.png   the row with its popover open (marker clicked)
//   facts-<w>.json        the marker word, the popover's lines, the row's
//                         box, and the marker's hit box
// Usage: GATE_BYPASS_TOKEN=... AUDIT_SITE=http://localhost:3108/sandbox
//        AUDIT_OUT=<dir> node capture_extent.cjs
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const { toPlan } = require("../capture_r116.cjs");

const SITE = process.env.AUDIT_SITE || "http://localhost:3108/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);

async function run(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await toPlan(page);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(1500);
  await (await hook(page, "setup-link-extent")).click();
  await page.waitForTimeout(4000);
  const cell = page.locator('[data-testid="cell-worklen"]');
  await cell.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  const row = cell.locator("xpath=ancestor::div[contains(@class,'a-cols')][1]");
  await row.screenshot({ path: path.join(OUT, `extent-${w}.png`) });
  const marker = page.locator('[data-testid="info-toggle-worklen"]');
  await marker.click();
  await page.waitForTimeout(500);
  const b = await row.boundingBox();
  const pop = await page.locator('[data-testid="info-worklen"]').boundingBox();
  const bottom = Math.max(b.y + b.height, pop ? pop.y + pop.height : 0);
  await page.screenshot({
    path: path.join(OUT, `extent-${w}-open.png`),
    clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: Math.min(b.width + 16, w), height: bottom - b.y + 16 },
  });
  const facts = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="info-toggle-worklen"]');
    const mb = m.getBoundingClientRect();
    return {
      marker: m.textContent,
      markerBox: [Math.round(mb.width), Math.round(mb.height)],
      popover: [...document.querySelectorAll('[data-testid="info-worklen"] .tr-prov')].map((e) => e.textContent),
      oldLineVisible: [...document.querySelectorAll(".a-cell-ctl")].some((e) =>
        (e.textContent ?? "").includes("the extent the plan is built for"),
      ),
    };
  });
  fs.writeFileSync(path.join(OUT, `facts-${w}.json`), JSON.stringify(facts, null, 2));
  console.log(`${w}: ${JSON.stringify(facts)}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
