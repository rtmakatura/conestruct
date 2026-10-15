// #318 (R149): is the corridor aerial's legend legible at the phone width?
//
//   node measure318.cjs <outDir> <base> [widths]
//
// Pins N Broadway SB, takes the shoulder kind and a side, so the WHERE
// band's aerial draws the laid-out corridor and its legend.  For every
// legend text node: its computed font size (against the smallest ruled
// type role, 10 px, lib/design/type-roles.ts), whether it is clipped
// (scrollWidth > clientWidth, or outside the viewport), and axe's
// color-contrast verdict on the legend.  Screenshots of the aerial block.
const fs = require("fs");
const path = require("path");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const [, , OUT, BASE, W] = process.argv;
const WIDTHS = (W || "360,320,1440").split(",").map(Number);
const PIN = { lat: "39.73370", lng: "-104.98753" };
fs.mkdirSync(OUT, { recursive: true });
const rows = [];

(async () => {
  gateHeaders(BASE);
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: width >= 1440 ? 1000 : 800 },
      deviceScaleFactor: 2,
      ...(width <= 480 ? { isMobile: true, hasTouch: true } : {}),
    });
    await applyGate(ctx, BASE);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/sandbox`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await (await hook(page, "where-open-picker")).click();
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /enter coordinates manually/i }).click();
    await page.waitForTimeout(1200);
    await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
    await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
    const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
    for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
    const cand = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
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
    // The five-row legend draws once the kind is confirmed too: confirm
    // WHERE, then reopen it to see the laid-out aerial.
    await (await hook(page, "where-confirm")).click();
    await page.waitForTimeout(6000);
    const reopen = page.locator('[data-testid="fact-link-where"]').first();
    if (await reopen.count()) await reopen.click();
    await page.waitForTimeout(3000);
    const legend = page.locator('[data-testid="band-aerial-legend"]').first();
    for (let i = 0; i < 30 && (await legend.count()) === 0; i += 1) await page.waitForTimeout(1000);
    await page.waitForTimeout(4000);
    const m = await page.evaluate(() => {
      const lg = document.querySelector('[data-testid="band-aerial-legend"]');
      if (!lg) return null;
      const vw = window.innerWidth;
      const items = [];
      for (const el of lg.querySelectorAll("*")) {
        const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
        if (!own) continue;
        const cs = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        items.push({
          text: own.slice(0, 60),
          fontPx: parseFloat(cs.fontSize),
          clipped: el.scrollWidth > el.clientWidth + 1 || b.left < 0 || b.right > vw + 0.5,
        });
      }
      const img = lg.parentElement ? lg.parentElement.querySelector("img") : null;
      const ib = img ? img.getBoundingClientRect() : null;
      return { items, imageCssWidth: ib ? Math.round(ib.width) : null, legendWidth: Math.round(lg.getBoundingClientRect().width) };
    });
    await page.addScriptTag({ path: `${REPO}/conestruct/site/node_modules/axe-core/axe.min.js` });
    const ax = await page.evaluate(async () => {
      const r = await window.axe.run({ include: ['[data-testid="band-aerial-legend"]'] }, { runOnly: { type: "rule", values: ["color-contrast"] } });
      return { violations: r.violations.reduce((s, v) => s + v.nodes.length, 0), passes: r.passes.reduce((s, v) => s + v.nodes.length, 0) };
    });
    const block = legend.locator("xpath=..");
    if (await block.count()) {
      await block.scrollIntoViewIfNeeded();
      await block.screenshot({ path: path.join(OUT, `aerial-${width}.png`) });
    }
    const minFont = m ? Math.min(...m.items.map((i) => i.fontPx)) : null;
    const row = { width, ...m, minFontPx: minFont, clippedCount: m ? m.items.filter((i) => i.clipped).length : null, axe: ax };
    rows.push(row);
    console.log(`${width}: legend ${m ? m.items.length : 0} text nodes; smallest ${minFont}px; clipped ${row.clippedCount}; axe contrast ${ax.violations} violations / ${ax.passes} passes; image ${m && m.imageCssWidth}px wide; legend ${m && m.legendWidth}px`);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  await browser.close();
})();
