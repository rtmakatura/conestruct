// #291 / R148: what the WHAT band shows for the road type at a pin.
//   node probe291.cjs <outDir> <base> <lat> <lng> [widths]
const fs = require("fs");
const path = require("path");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , OUT, BASE, LAT, LNG, W] = process.argv;
const WIDTHS = (W || "1440,360").split(",").map(Number);
fs.mkdirSync(OUT, { recursive: true });
const rows = [];

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width >= 1440 ? 1000 : 800 }, deviceScaleFactor: 2 });
    await applyGate(ctx, BASE);
    const page = await ctx.newPage();
    const sent = [];
    page.on("request", (rq) => {
      if (/\/api\/render\/audit$/.test(new URL(rq.url()).pathname)) {
        try { sent.push(JSON.parse(rq.postData() || "{}").scenario); } catch {}
      }
    });
    const audits = [];
    page.on("response", async (r) => {
      if (/\/api\/render\/audit$/.test(new URL(r.url()).pathname) && r.status() === 200) {
        const j = await r.json().catch(() => ({}));
        audits.push(j.input_guesses ?? null);
      }
    });
    await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await (await hook(page, "where-open-picker")).click();
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /enter coordinates manually/i }).click();
    await page.waitForTimeout(1200);
    await page.getByPlaceholder(/^Latitude/).fill(LAT);
    await page.getByPlaceholder(/^Longitude/).fill(LNG);
    const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
    for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
    const cand = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway|unclassified)/ }).first();
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
    await (await hook(page, "where-confirm")).click();
    await page.waitForTimeout(9000);
    const road = page.locator('[data-testid="what-group-road"]').first();
    const text = (await road.count()) ? (await road.textContent()).replace(/\s+/g, " ").trim() : null;
    const select = await page.evaluate(() => {
      const s = document.querySelector("#what-roadType, #what-road-type, select[name='roadType']");
      return s ? { id: s.id, value: s.value, disabled: s.disabled } : null;
    });
    if (await road.count()) {
      await road.scrollIntoViewIfNeeded();
      await road.screenshot({ path: path.join(OUT, `road-group-${width}.png`) });
    }
    const last = sent.slice(-1)[0] || {};
    const row = { width, text, select, sentRoadType: last.roadType ?? null, sentGuesses: last.guesses ?? null, auditGuesses: audits.slice(-1)[0] ?? null };
    rows.push(row);
    console.log(JSON.stringify(row).slice(0, 900));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  await browser.close();
})();
