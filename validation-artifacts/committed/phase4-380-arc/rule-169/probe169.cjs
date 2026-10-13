// Rule 169 / branch 5B: results (shoulder, N Broadway SB) with every
// disclosure open, at 320, 360 and 1440.  Measures the hero's geometry cell,
// the Zone geometry group in Reference, and the advance row's sign table
// (its width against its box, and whether any MUTCD code wraps), plus the
// page scroll width.  Screenshots: results-<w>.png (full page),
// advance-<w>.png (the opened advance row), zonegeo-<w>.png (the group).
// P169_SITE, P169_OUT.
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const { toResults, openAll } = require("./results-flow.cjs");

const SITE = process.env.P169_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.P169_OUT;
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [w, h] of [[320, 800], [360, 800], [1440, 1000]]) {
    let ctx, page;
    try {
      ({ ctx, page } = await toResults(browser, SITE, w, h));
    } catch (e) {
      const msg = String(e).split(/\r?\n/)[0];
      console.log(w, "FAILED:", msg);
      out[w] = { error: msg };
      for (const c of browser.contexts()) await c.close().catch(() => {});
      continue;
    }
    await openAll(page);
    // Open the advance calculation row (one audit row opens at a time).
    const adv = page.locator(".audit-item:visible").filter({ hasText: "Advance warning sign set" }).first();
    if ((await adv.count()) && !(await adv.evaluate((el) => el.classList.contains("open")))) {
      await adv.locator(".audit-head").scrollIntoViewIfNeeded().catch(() => {});
      await adv.locator(".audit-head").click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
    await page.mouse.move(1, 1).catch(() => {});
    const m = await page.evaluate(() => {
      const r1 = (x) => Math.round(x * 10) / 10;
      const vis = (el) => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none";
      const meta = document.querySelector(".hero-meta");
      const advItem = [...document.querySelectorAll(".audit-item")].find((i) => /Advance warning sign set/.test(i.innerText));
      const table = advItem?.querySelector(".audit-body table");
      const body = advItem?.querySelector(".audit-body");
      let codes = [];
      if (table) {
        const heads = [...table.querySelectorAll("thead th")].map((t) => t.innerText.trim());
        const ci = heads.findIndex((t) => /^Code$/i.test(t));
        codes = [...table.querySelectorAll("tbody tr")].map((tr) => {
          const cell = tr.querySelector(".st-code") || tr.children[ci >= 0 ? ci : 1];
          const range = document.createRange();
          range.selectNodeContents(cell);
          const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
          return { code: cell.innerText.trim(), lines, right: r1(cell.getBoundingClientRect().right) };
        });
      }
      const zg = [...document.querySelectorAll(".zone-geo")].find(vis);
      return {
        pageScrollW: document.documentElement.scrollWidth,
        screenW: screen.width,
        heroMetaRendered: vis(meta),
        heroMetaRows: meta ? [...meta.querySelectorAll(".row")].map((r) => r.innerText.replace(/\s+/g, " ").trim()) : [],
        zoneGeoRendered: !!zg,
        zoneGeoRows: zg ? [...zg.querySelectorAll(".zg-row")].map((r) => r.innerText.replace(/\s+/g, " ").trim()) : [],
        advance: table
          ? {
              tableW: r1(table.getBoundingClientRect().width),
              tableScrollW: table.scrollWidth,
              bodyW: r1(body.getBoundingClientRect().width),
              bodyRight: r1(body.getBoundingClientRect().right),
              tableRight: r1(table.getBoundingClientRect().right),
              codes,
            }
          : null,
      };
    });
    out[w] = m;
    const wrapped = (m.advance?.codes ?? []).filter((c) => c.lines > 1).map((c) => c.code);
    console.log(
      w,
      "page", m.pageScrollW, "/", m.screenW,
      "| hero-meta", m.heroMetaRendered,
      "| zone-geo", m.zoneGeoRendered, m.zoneGeoRows.join(" ; "),
      "| advance table", m.advance ? `${m.advance.tableW} (right ${m.advance.tableRight}) in ${m.advance.bodyW} (right ${m.advance.bodyRight})` : "none",
      "| codes wrapped", wrapped.join(",") || "none",
    );
    await page.screenshot({ path: path.join(OUT, `results-${w}.png`), fullPage: true });
    if (await adv.count()) await adv.screenshot({ path: path.join(OUT, `advance-${w}.png`) }).catch(() => {});
    const zg = page.locator(".zone-geo:visible").first();
    if (await zg.count()) {
      await zg.scrollIntoViewIfNeeded().catch(() => {});
      await zg.screenshot({ path: path.join(OUT, `zonegeo-${w}.png`) }).catch(() => {});
    }
    const hero = page.locator(".hero").first();
    if (await hero.count()) {
      await hero.scrollIntoViewIfNeeded().catch(() => {});
      await hero.screenshot({ path: path.join(OUT, `hero-${w}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
