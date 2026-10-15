// #323 R153 look: the turn-bay field on a left near_intersection plan,
// N Broadway SB (one-way), at a given width.   node cap323f.cjs <outPrefix> <base> <width>
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , OUT, BASE, W] = process.argv;
const width = Number(W);

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 800 : 1000 }, deviceScaleFactor: width < 600 ? 2 : 1 });
  await applyGate(ctx, BASE);
  const page = await ctx.newPage();
  const audits = [];
  page.on("response", async (r) => {
    if (!r.url().includes("/api/render/")) return;
    let tail = "";
    if (r.status() >= 400) { try { tail = " " + (await r.text()).slice(0, 300); } catch (e) {} }
    audits.push(r.url().split("/api/render/")[1] + ":" + r.status() + tail);
  });
  page.on("request", (q) => {
    if (q.url().includes("/api/render/audit")) {
      try { const b = JSON.parse(q.postData() || "{}"); const s = b.scenario || b; require("fs").writeFileSync(`${OUT}-auditreq.json`, JSON.stringify({ topKeys: Object.keys(b), metaKeys: Object.keys(s.meta || {}), rd: s.meta && s.meta.roadDirection, work: s.meta && s.meta.work, roadDirection: s.meta && s.meta.roadDirection, hasCenterline: !!(s.meta && s.meta.centerline), carriageway: s.carriageway, pinModel: s.meta && s.meta.pinModel, kind: s.kind }, null, 1)); } catch (e) {}
    }
  });
  await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.73370");
  await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
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
  await page.waitForTimeout(2500);
  const mark = page.getByRole("button", { name: /^mark on map$/i }).first();
  if (await mark.count()) {
    await mark.click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}-mark.png` });
    if (process.env.STOP_AT_MARK) { await browser.close(); return; }
    // the pin (orange marker) is the work start, ~50 ft S of E 11th Ave;
    // click a little north of it on the canvas.
    const canvas = page.locator(".mapboxgl-canvas").first();
    const cb = await canvas.boundingBox();
    const pin = page.locator(".mapboxgl-marker").first();
    const pb = (await pin.count()) ? await pin.boundingBox() : { x: cb.x + cb.width / 2 - 10, y: cb.y + cb.height / 2 - 10, width: 20, height: 20 };
    await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2 - Number(process.env.DY || 20));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}-marked.png` });
    const save2 = page.getByRole("button", { name: /Save & Close/ });
    for (let i = 0; i < 60 && !(await save2.isEnabled()); i += 1) await page.waitForTimeout(1000);
    await save2.click();
    await page.waitForTimeout(6000);
  }
  const sides = page.locator('[data-testid="side-option"]');
  for (let i = 0; i < 30 && (await sides.count()) < 2; i += 1) await page.waitForTimeout(1000);
  const labels = await sides.allInnerTexts();
  const left = sides.filter({ hasText: /East side/ }).first();
  if (!(await left.count())) {
    await page.screenshot({ path: `${OUT}-noside.png`, fullPage: true });
    console.log(JSON.stringify({ width, labels, side: false }));
    await browser.close();
    return;
  }
  await left.click();
  await page.waitForTimeout(2000);
  const conf = page.locator('[data-testid="where-confirm"]');
  if (await conf.count()) { await conf.first().click(); await page.waitForTimeout(6000); }
  const field = page.locator("#ni-turn-bay");
  for (let i = 0; i < 30 && (await field.count()) === 0; i += 1) await page.waitForTimeout(1000);
  if (!(await field.count())) {
    await page.screenshot({ path: `${OUT}-nofield.png`, fullPage: true });
    console.log(JSON.stringify({ width, labels, field: false }));
    await browser.close();
    return;
  }
  const spd = page.locator("#ni-cross-speed");
  if (await spd.count()) {
    const cur = await spd.inputValue();
    if (!cur) await spd.selectOption("30");
    await page.waitForTimeout(1500);
  }
  const refLoc = page.locator("#ni-turn-bay-ref");
  for (let i = 0; i < 90 && !/ ft at this speed/.test(await refLoc.innerText()); i += 1) await page.waitForTimeout(1000);
  const box = field.locator("xpath=ancestor::div[1]");
  await box.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const b = await box.boundingBox();
  const pad = 24;
  await page.screenshot({
    path: `${OUT}.png`,
    clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - 140), width: Math.min(width, b.width + 2 * pad), height: b.height + 140 + pad },
  });
  await page.screenshot({ path: `${OUT}-viewport.png` });
  const value = await field.inputValue();
  const help = await page.locator("#ni-turn-bay-help").innerText();
  const ref = await page.locator("#ni-turn-bay-ref").innerText();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${OUT}-full.png`, fullPage: true });
  console.log(JSON.stringify({ width, value, overflow, audits: audits.slice(-12) }));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
