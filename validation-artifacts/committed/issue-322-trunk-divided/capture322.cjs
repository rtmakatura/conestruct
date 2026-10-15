// #322: capture the scenario the site really sends for a near-intersection
// plan on a pin, so the before/after can be generated from it.
//
//   node capture322.cjs <outFile> <base> <lat> <lng>
//
// Pins the road, takes the "Lane closure near intersection" chip and the
// first side, and saves the last /api/render/corridor-geometry request's
// scenario: the frontend's own relays (carriageway, divided, roadType,
// lanes...) exactly as they go on the wire.  The cross street is NOT
// marked here (the picker marks it by a map click); the caller adds it.
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , OUT, BASE, LAT, LNG] = process.argv;

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await applyGate(ctx, BASE);
  const page = await ctx.newPage();
  const sent = [];
  page.on("request", (rq) => {
    if (/\/api\/render\/corridor-geometry$/.test(new URL(rq.url()).pathname)) {
      try { sent.push(JSON.parse(rq.postData() || "{}").scenario); } catch {}
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
  const cand = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await cand.count()) > 0) await cand.click();
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(5000);
  await (await hook(page, "kind-chip-near_intersection")).click();
  await page.waitForTimeout(5000);
  const last = sent.filter((s) => s && s.kind === "near_intersection").slice(-1)[0] || null;
  fs.writeFileSync(OUT, JSON.stringify(last, null, 1));
  console.log(last ? `captured: kind ${last.kind}, carriageway ${JSON.stringify(last.carriageway ?? null)}, divided ${last.divided}, roadType ${last.roadType}, lanes ${last.lanes}` : "no near_intersection request captured");
  await browser.close();
})();
