// R126 / R127 r126-speed-guess, on a local stack of the branch (AUDIT_SITE:
// next dev of the worktree, its backend on :8126).  Three pins, each through
// the picker, Shoulder work, the first side, Confirm, at 1440 and 390:
//   cherry   N Cherry St, Hilltop (39.71740, -104.93380): residential, no
//            maxspeed -> the speed is guessed at 25, "⚠ from the road"
//   broadway N Broadway SB (39.73370, -104.98753): maxspeed 30 -> measured
//   noroad   Ferril Lake, City Park (39.74810, -104.95610): no road within
//            30 m -> "◌ not set", the checks held, Generate blocked
// Writes <pin>-<w>.png (the WHAT band) and facts-<pin>-<w>.json (the Speed
// row's value, marker and line; the header; the Generate reason; scroll;
// page errors).
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE || "http://localhost:3126/sandbox";
const OUT = process.env.AUDIT_OUT;
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const PINS = {
  cherry: { lat: "39.71740", lng: "-104.93380" },
  broadway: { lat: "39.73370", lng: "-104.98753" },
  noroad: { lat: "39.74810", lng: "-104.95610" },
};

async function run(browser, name, w, h) {
  const pin = PINS[name];
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(pin.lat);
  await page.getByPlaceholder(/^Longitude/).fill(pin.lng);
  const save = page.getByRole("button", { name: /Save & Close/ });
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const pick = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await pick.count()) > 0) await pick.click();
  await page.waitForTimeout(2500);
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-shoulder")).click();
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(8000);
  await page.mouse.move(1, 1);
  const band = page.locator('[data-testid="what-group-road"]').locator("xpath=ancestor::section[1]");
  const target = (await band.count()) ? band : page.locator("#what-speed").locator("xpath=ancestor::div[contains(@class,'a-cols')][1]");
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await target.screenshot({ path: path.join(OUT, `${name}-${w}.png`) });
  const facts = await page.evaluate(() => {
    const sel = document.getElementById("what-speed");
    return {
      value: sel?.value ?? null,
      shown: sel?.selectedOptions?.[0]?.textContent ?? null,
      marker: document.querySelector('[data-testid="info-toggle-speed"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      line: document.querySelector('[data-testid="prov-speed"]')?.textContent?.trim() ?? null,
      header: [...document.querySelectorAll("*")].map((e) => e.childElementCount === 0 ? e.textContent : "").find((t) => /guess|prefilled from the road|nothing detected/.test(t ?? "")) ?? null,
      cta: document.querySelector('[data-testid="cta-reason"]')?.textContent ?? null,
      generateDisabled: [...document.querySelectorAll("button")].find((b) => /Generate plan/.test(b.textContent ?? ""))?.disabled ?? null,
      scroll: [document.documentElement.scrollWidth, innerWidth],
    };
  });
  facts.errors = errors;
  fs.writeFileSync(path.join(OUT, `facts-${name}-${w}.json`), JSON.stringify(facts, null, 2));
  console.log(name, w, JSON.stringify(facts));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const name of ["cherry", "broadway", "noroad"]) {
    await run(browser, name, 1440, 1000);
    await run(browser, name, 390, 844);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
