// R116 item 1 build (R117 Q1a-d, R118), on a local build of this branch:
// the frontend (next dev, AUDIT_SITE) talking to this branch's backend
// (uvicorn, MODAL_RENDER_URL), so the new `raised` / `device_label` wire
// fields are real.  The plan is ../capture_r116.cjs's (N Broadway SB near
// E 12th Ave, Denver).  At 1440 and 390, writes into AUDIT_OUT:
//   needs-you-<w>.png   the NEEDS YOU section (the met rule is gone from it)
//   hero-<w>.png        the counts hero ("+N jurisdiction-required" gone)
//   checked-<w>.png     Plan reference's "Checked & passed", opened, with
//                       the met rule as a checked row
//   page-<w>.png        the whole results page
//   facts-<w>.json      the texts read off the page
// Usage: GATE_BYPASS_TOKEN=... AUDIT_SITE=http://localhost:3108/sandbox
//        AUDIT_OUT=<dir> node capture_ny.cjs
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const { toPlan } = require("../capture_r116.cjs");

const SITE = process.env.AUDIT_SITE || "http://localhost:3108/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);

async function shot(page, sel, file) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  await el.screenshot({ path: path.join(OUT, file) });
}

async function run(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await toPlan(page);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `page-${w}.png`), fullPage: true });
  await shot(page, "section.needs-you", `needs-you-${w}.png`);
  await shot(page, ".hero", `hero-${w}.png`);
  const chip = page.getByRole("button", { name: /Checked & passed/ }).first();
  await chip.click();
  await page.waitForTimeout(800);
  // The disclosure's own container: the button's parent.
  const box = chip.locator("xpath=..");
  await box.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  await box.screenshot({ path: path.join(OUT, `checked-${w}.png`) });
  const facts = await page.evaluate(() => ({
    needsYou: document.querySelector("section.needs-you")?.textContent ?? null,
    hero: document.querySelector(".hero")?.textContent ?? null,
    checkedHasMetRow: (document.body.textContent ?? "").includes("Arrow board required"),
    rawKeysAnywhere: /add_device|arrow_board/.test(document.body.textContent ?? ""),
  }));
  fs.writeFileSync(path.join(OUT, `facts-${w}.json`), JSON.stringify(facts, null, 2));
  console.log(`${w}: ${JSON.stringify({ ...facts, needsYou: facts.needsYou?.slice(0, 160), hero: facts.hero?.slice(0, 120) })}`);
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
