// #286 before/after: the calculation rows' text (result, cite, formula lines,
// footer) for a shoulder plan (N Broadway SB) and a flagger plan (W Alameda
// Ave, Lakewood), plus screenshots of the opened rows at 1440 and 360.
// CALC_SITE, CALC_OUT; CALC_KINDS (default "shoulder,flagger").
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const { openAll } = require("./results-flow.cjs");

const SITE = process.env.CALC_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.CALC_OUT;
const KINDS = (process.env.CALC_KINDS || "shoulder,flagger").split(",");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);

const PLANS = {
  shoulder: { lat: "39.73370", lng: "-104.98753", chip: "kind-chip-shoulder", speed: "30" },
  flagger: { lat: "39.71130", lng: "-105.08150", chip: "kind-chip-flagger_lane_closure", speed: "45" },
};

async function toResults(browser, plan, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w <= 480 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(plan.lat);
  await page.getByPlaceholder(/^Longitude/).fill(plan.lng);
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  const pick = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await pick.count()) > 0) {
    await pick.scrollIntoViewIfNeeded();
    await pick.click();
  }
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, plan.chip)).click();
  await page.waitForTimeout(2500);
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 20 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  if (await side.count()) await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  // Flagger: the relay-fact confirmations the decline asks for (same on
  // both sides of the before/after).
  for (const label of [/Road has one through lane in each direction/, /Road carries two-way traffic/]) {
    const box = page.getByRole("checkbox", { name: label });
    if ((await box.count()) && !(await box.isChecked().catch(() => true))) {
      await box.check().catch(async () => page.getByText(label).first().click().catch(() => {}));
      await page.waitForTimeout(2500);
    }
  }
  const gen = page.getByRole("button", { name: /Generate plan/ }).first();
  for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) {
    const sp = page.locator("#what-speed");
    if (i % 5 === 0 && (await sp.count()) && (await sp.inputValue().catch(() => "x")) === "") {
      await sp.selectOption(plan.speed).catch(() => {});
    }
    await page.waitForTimeout(1000);
  }
  await gen.click({ timeout: 5000 });
  await page.waitForTimeout(30000);
  await openAll(page);
  await page.waitForTimeout(1500);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const kind of KINDS) {
    for (const [w, h] of [[1440, 1000], [360, 800]]) {
      let ctx, page;
      try {
        ({ ctx, page } = await toResults(browser, PLANS[kind], w, h));
      } catch (e) {
        const msg = String(e).split(/\r?\n/)[0];
        console.log(kind, w, "FAILED:", msg);
        out[`${kind}-${w}`] = { error: msg };
        for (const c of browser.contexts()) {
          const pg = c.pages()[0];
          if (pg) await pg.screenshot({ path: path.join(OUT, `fail-${kind}-${w}.png`), fullPage: true }).catch(() => {});
          await c.close().catch(() => {});
        }
        continue;
      }
      // The audit rows are plain buttons (no aria-expanded), so openAll
      // leaves them shut: open each one.
      // One row opens at a time: open each calculation row, read it, move on.
      const items = page.locator(".audit-item:visible");
      const n = await items.count();
      const rows = [];
      for (let i = 0; i < n; i += 1) {
        const it = items.nth(i);
        const title = ((await it.locator(".audit-head .title").innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
        if (!/Taper length|Buffer space|Channelizing device|Advance warning|sight distance/i.test(title)) continue;
        if (!(await it.evaluate((el) => el.classList.contains("open")))) {
          await it.locator(".audit-head").scrollIntoViewIfNeeded().catch(() => {});
          await it.locator(".audit-head").click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(600);
        }
        const row = await it.evaluate((el) => {
          const t = (sel) => (el.querySelector(sel)?.innerText || "").replace(/\s+/g, " ").trim();
          return {
            title: t(".audit-head .title"),
            result: t(".audit-head .result"),
            cite: t(".audit-head .cite"),
            formulas: [...el.querySelectorAll(".formula")].map((f) => f.innerText.replace(/\s+/g, " ").trim()),
            footer: t(".citation"),
          };
        });
        rows.push(row);
        const tag = /Advance/.test(title) ? "advance" : /sight distance/.test(title) ? "ssd" : /Taper/.test(title) ? "taper" : null;
        if (tag) {
          await page.mouse.move(1, 1).catch(() => {});
          await it.screenshot({ path: path.join(OUT, `row-${tag}-${kind}-${w}.png`) }).catch(() => {});
        }
      }
      const speed = await page.locator("#what-speed").inputValue().catch(() => null);
      out[`${kind}-${w}`] = { speed, rows };
      console.log(kind, w, "speed", speed, "rows", rows.length, rows.map((r) => `${r.title}: ${r.result}`).join(" | "));
      const first = page.locator(".audit-item").first();
      if (await first.count()) {
        const list = first.locator("xpath=..");
        await list.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await list.screenshot({ path: path.join(OUT, `calc-${kind}-${w}.png`) });
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, "calc-rows.json"), JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
