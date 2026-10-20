// #345 production check, the form side: on /sandbox, pin I-25 (4 lanes per
// direction), shoulder work, then set lanes to 3 and lane width to 11 ft on
// the form.  The audit request must still carry roadLanesPerDirection: 4,
// and the audit must return the freeway-minimum note.
//   node browser345.cjs <outPrefix> <base>
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const fs = require("fs");
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , OUT, BASE] = process.argv;

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await applyGate(ctx, BASE);
  const page = await ctx.newPage();
  const audits = [];
  page.on("request", (q) => {
    if (!q.url().includes("/api/render/audit")) return;
    try {
      const b = JSON.parse(q.postData() || "{}");
      const s = b.scenario || b;
      audits.push({ req: { kind: s.kind, roadType: s.roadType, lanes: s.lanes, laneWidth: s.laneWidth, roadLanesPerDirection: s.roadLanesPerDirection } });
    } catch (e) {}
  });
  page.on("response", async (r) => {
    if (!r.url().includes("/api/render/audit")) return;
    const last = audits[audits.length - 1];
    if (!last) return;
    last.status = r.status();
    try {
      const j = await r.json();
      const items = (j.pending_verification && j.pending_verification.items) || [];
      const it = items.find((i) => i.kind === "lanes_drawn_below_road");
      last.note = it ? it.label : null;
      if (r.status() >= 400) last.detail = JSON.stringify(j).slice(0, 300);
    } catch (e) {}
  });
  await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.68539");
  await page.getByPlaceholder(/^Longitude/).fill("-104.96427");
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const cand = page.locator("button").filter({ hasText: /South Valley Highway Southeast \(freeway/i }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await cand.count()) > 0) await cand.click();
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  if (!(await save.isEnabled())) {
    await page.screenshot({ path: `${OUT}-picker.png` });
    console.log(JSON.stringify({ picker: (await page.locator("[role=dialog]").first().innerText().catch(() => "")).slice(0, 1500) }));
    await browser.close();
    return;
  }
  await save.click();
  await page.waitForTimeout(5000);
  await (await hook(page, "kind-chip-shoulder")).click();
  await page.waitForTimeout(2500);
  const sides = page.locator('[data-testid="side-option"]');
  for (let i = 0; i < 30 && (await sides.count()) < 1; i += 1) await page.waitForTimeout(1000);
  const sideLabels = await sides.allInnerTexts();
  if (await sides.count()) { await sides.first().click(); await page.waitForTimeout(2000); }
  const conf = page.locator('[data-testid="where-confirm"]');
  if (await conf.count()) { await conf.first().click(); await page.waitForTimeout(6000); }
  const lanes = page.locator("#what-lanes");
  for (let i = 0; i < 30 && (await lanes.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const before = { lanes: await lanes.inputValue(), width: await page.locator("#what-lane-width").inputValue() };
  await page.screenshot({ path: `${OUT}-before.png`, fullPage: true });
  const n0 = audits.length;
  await lanes.selectOption("3");
  await page.waitForTimeout(1500);
  await page.locator("#what-lane-width").selectOption("11");
  for (let i = 0; i < 60 && !(audits.length > n0 && audits[audits.length - 1].req.lanes === 3 && audits[audits.length - 1].req.laneWidth === 11 && audits[audits.length - 1].status); i += 1) await page.waitForTimeout(1000);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}-after.png`, fullPage: true });
  const result = { sideLabels, before, audits: audits.slice(-4) };
  fs.writeFileSync(`${OUT}-result.json`, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
