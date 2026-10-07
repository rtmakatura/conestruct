// R106 (setup-what-redesign, branch setup-box-r106) — the Setup box after
// Generate, at 1440 and 390, on a local build of the branch (AUDIT_SITE).
// The route is build-1/capture_what.cjs's (the declutter arc's), then
// GENERATE PLAN.  Writes:
//   setup-<w>.png        the results-head slot with the Setup box in it
//   setup-<w>-facts.json what the box said, and the P1 measure: the slot's
//                        height IN FLIGHT (the reserve) against its height
//                        once the box forms at the settle, and the box's
//                        cell heights
// Usage: GATE_BYPASS_TOKEN=... AUDIT_SITE=http://localhost:3108/sandbox
//        AUDIT_OUT=<dir> node capture_setup.cjs
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE || "http://localhost:3108/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const PIN = { lat: "39.74020", lng: "-104.95600" };

async function toWhat(page) {
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page
    .locator("button")
    .filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ })
    .first();
  for (let i = 0; i < 90; i += 1) {
    if ((await candidate.count()) > 0 || (await save.isEnabled())) break;
    await page.waitForTimeout(1000);
  }
  if ((await candidate.count()) > 0) {
    await candidate.click();
    await page.waitForTimeout(2500);
  }
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(3000);
  const len = page.locator("#band-worklen");
  if (await len.count()) {
    await len.fill("1000");
    await len.blur();
  }
  await (await hook(page, "kind-chip-shoulder")).click();
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
}

async function run(width, height) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await toWhat(page);
  await (await hook(page, "generate-plan")).click();
  // In flight: the slot is mounted and empty — the reserve.
  let inFlight = null;
  for (let i = 0; i < 40 && inFlight === null; i += 1) {
    inFlight = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="results-head-slot"]');
      if (!s || s.querySelector('[data-testid="fact-setup"]')) return null;
      return Math.round(s.getBoundingClientRect().height * 100) / 100;
    });
    if (inFlight === null) await page.waitForTimeout(100);
  }
  for (let i = 0; i < 150; i += 1) {
    await page.waitForTimeout(1000);
    if (
      (await page.locator(".working-band").count()) === 0 &&
      (await page.locator('[data-testid="fact-setup"]').count()) > 0
    )
      break;
  }
  await page.waitForTimeout(3000);
  const facts = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="results-head-slot"]');
    const box = document.querySelector('[data-testid="fact-setup"]');
    const r = (e) => Math.round(e.getBoundingClientRect().height * 100) / 100;
    return {
      settledSlotH: s ? r(s) : null,
      boxH: box ? r(box) : null,
      cells: [...document.querySelectorAll('[data-testid="setup-values"] > .a-setupcell')].map((c) => ({
        label: c.querySelector(".a-setup-k")?.textContent,
        value: [...c.querySelectorAll(".a-setup-v")].map((v) => v.textContent).join(" "),
        h: r(c),
        button: c.tagName === "BUTTON" || c.querySelectorAll("button").length,
      })),
      hint: document.querySelector('[data-testid="setup-links-hint"]')?.textContent ?? null,
      warnGlyphs: (box?.textContent ?? "").includes("⚠"),
    };
  });
  facts.inFlightSlotH = inFlight;
  console.log(`${width} facts: ${JSON.stringify(facts)}`);
  fs.writeFileSync(path.join(OUT, `setup-${width}-facts.json`), JSON.stringify(facts, null, 2));
  const slot = page.locator('[data-testid="results-head-slot"]').first();
  await slot.scrollIntoViewIfNeeded();
  // The pointer is left wherever GENERATE was; park it off the box so no
  // cell is drawn in its hover state.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  await slot.screenshot({ path: path.join(OUT, `setup-${width}.png`) });
  console.log(`wrote setup-${width}.png`);
  await browser.close();
}

(async () => {
  await run(1440, 1000);
  await run(390, 844);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
