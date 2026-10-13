// R141: the results page with every disclosure open, at 1440x1000 and
// 360x800.  Per width: the page's scroll width vs the screen, the device
// table's box, the chips' left edge inside the reference disclosure, and
// anything past the screen's right edge; a full-page screenshot and the
// device table alone (devtable-<w>.png, for the desk pixel comparison).
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const { toResults } = require("./results-flow.cjs");

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [w, h] of [[1440, 1000], [360, 800]]) {
    const { ctx, page, opened } = await toResults(browser, SITE, w, h);
    await page.mouse.move(1, 1).catch(() => {});
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const W = Math.min(innerWidth, screen.width);
      const t = document.querySelector(".device-table");
      const tr = t ? t.getBoundingClientRect() : null;
      const rows = t ? [...t.querySelectorAll("tbody tr")].map((r) => Math.round(r.getBoundingClientRect().height)) : [];
      // Lines the code's own text occupies (the label span excluded): >1 = it broke.
      const codes = t ? [...t.querySelectorAll("tbody td:nth-child(2)")].map((c) => {
        const txt = [...c.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).pop();
        if (!txt) return 0;
        const r = document.createRange();
        r.selectNodeContents(txt);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      }) : [];
      const bodyRowRights = t ? [...t.querySelectorAll("tbody tr")].map((r) => Math.round(r.getBoundingClientRect().right)) : [];
      const theadRight = t && t.tHead ? Math.round(t.tHead.querySelector("tr").getBoundingClientRect().right) : null;
      const theadClip = t && t.tHead ? getComputedStyle(t.tHead).overflow + "/" + Math.round(t.tHead.getBoundingClientRect().width) : null;
      const past = [...document.querySelectorAll("body *")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > W + 0.5 && !el.closest("[style*='overflow'], .mapboxgl-map");
      }).filter((el) => !el.parentElement || el.parentElement.getBoundingClientRect().right <= W + 0.5)
        .slice(0, 8).map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(/\s+/).slice(0, 2).join(".")} right=${Math.round(el.getBoundingClientRect().right)}`);
      const chips = [...document.querySelectorAll(".disc-panel .refchip")].map((c) => Math.round(c.getBoundingClientRect().left));
      return {
        pageScrollW: document.documentElement.scrollWidth,
        screenW: screen.width,
        table: tr ? { left: Math.round(tr.left * 10) / 10, width: Math.round(tr.width * 10) / 10, right: Math.round(tr.right * 10) / 10 } : null,
        rowHeights: rows,
        codeLines: codes,
        bodyRowRights: [...new Set(bodyRowRights)],
        theadRowRight: theadRight,
        theadOverflowWidth: theadClip,
        chipLefts: [...new Set(chips)],
        pastRightEdge: past,
      };
    });
    m.disclosuresOpened = opened;
    out[w] = m;
    console.log(w, JSON.stringify(m));
    await page.screenshot({ path: path.join(OUT, `results-${w}.png`), fullPage: true });
    const t = page.locator(".device-table").first();
    if (await t.count()) {
      await t.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await t.screenshot({ path: path.join(OUT, `devtable-${w}.png`) });
      const sec = page.locator(".refchip", { has: page.locator(".device-table") }).last();
      await sec.screenshot({ path: path.join(OUT, `devsection-${w}.png`) });
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
