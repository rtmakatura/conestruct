// R120 prod check: a stored left side the backend no longer offers.
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const SITE = "https://www.conestruct.com/sandbox";
const OUT = path.join(__dirname, "out");
gateHeaders(SITE);
const PIN = { lat: 39.7337, lng: -104.98753 };

async function sides(page) {
  return page.evaluate(() => ({
    options: [...document.querySelectorAll('[data-testid="side-option"]')].map((e) => [e.textContent, e.getAttribute("aria-checked")]),
    stale: document.querySelector('[data-testid="side-control-stale"]')?.textContent ?? null,
    note: document.querySelector('[data-testid="side-control-note"]')?.textContent ?? null,
    kinds: [...document.querySelectorAll('[data-testid^="kind-chip-"]')].map((e) => [e.dataset.testid, e.getAttribute("aria-pressed")]),
  }));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const shas = [];
  const geo = [];
  page.on("response", async (r) => { if (r.url().includes("/api/render/corridor-geometry")) { let b = ""; try { b = await r.text(); } catch {} let side = null; try { side = JSON.parse(r.request().postData()).scenario.meta.work?.side ?? null; } catch {} geo.push({ t: Date.now(), status: r.status(), side, body: b.slice(0, 400) }); } });
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat.toFixed(5));
  await page.getByPlaceholder(/^Longitude/).fill(String(PIN.lng));
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  for (let i = 0; i < 90; i += 1) { if ((await candidate.count()) > 0 || (await save.isEnabled())) break; await page.waitForTimeout(1000); }
  if ((await candidate.count()) > 0) { await candidate.click(); await page.waitForTimeout(2500); }
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-shoulder")).click();
  await page.waitForTimeout(6000);
  const opt = page.locator('[data-testid="side-option"]');
  for (let i = 0; i < 40 && (await opt.count()) < 2; i += 1) await page.waitForTimeout(1000);
  const s1 = await sides(page);
  console.log("shoulder:", JSON.stringify(s1));
  const east = opt.filter({ hasText: /East side/ }).first();
  await east.click();
  await page.waitForTimeout(4000);
  // re-open WHERE if the band moved on
  if ((await page.locator('[data-testid="kind-chip-flagger_lane_closure"]').count()) === 0) {
    const o = page.locator('[data-testid="where-open"], [data-testid="band-head-where"]').first();
    if (await o.count()) await o.click();
    await page.waitForTimeout(2000);
  }
  const s2 = await sides(page);
  console.log("after east:", JSON.stringify(s2));
  await (await hook(page, "kind-chip-flagger_lane_closure")).click();
  await page.waitForTimeout(8000);
  const s3 = await sides(page);
  console.log("after flagger:", JSON.stringify(s3));
  const ctl = page.locator('[data-testid="side-control"]').first();
  await ctl.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await ctl.screenshot({ path: path.join(OUT, "side-control-stale.png") });
  console.log("geometry responses (last 4):", JSON.stringify(geo.slice(-4), null, 1));
  await page.screenshot({ path: path.join(OUT, "page-after-kind-switch.png"), fullPage: false });
  fs.writeFileSync(path.join(OUT, "facts.json"), JSON.stringify({ s1, s2, s3, geo }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
