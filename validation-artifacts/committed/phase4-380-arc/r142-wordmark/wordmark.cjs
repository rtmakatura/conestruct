// R142: the Mapbox wordmark in the picker, satellite style (the default),
// at 1440x1000 and 360x800.  Per width: what Mapbox's logo control asked
// for (its inline style; "display: none;" = the style data said no logo),
// what the page shows (computed display), the wordmark's box, and the
// style in use.  Screenshots: wordmark-<w>.png (the picker) and
// wordmark-map-<w>.png (the map's lower-left corner, zoomed).
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [w, h] of [[1440, 1000], [360, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w <= 480 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
    await applyGate(ctx, SITE);
    const page = await ctx.newPage();
    const styles = [];
    page.on("request", (r) => {
      const m = r.url().match(/api\.mapbox\.com\/styles\/v1\/([^?]+)/);
      if (m) styles.push(m[1]);
    });
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await (await hook(page, "where-open-picker")).click();
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /enter coordinates manually/i }).click();
    await page.waitForTimeout(1200);
    await page.getByPlaceholder(/^Latitude/).fill("39.73370");
    await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
    await page.waitForTimeout(12000);
    const r = await page.evaluate(() => {
      const a = document.querySelector('[role="dialog"] .mapboxgl-ctrl-logo');
      if (!a) return { present: false };
      const c = a.parentElement;
      const b = a.getBoundingClientRect();
      const m = document.querySelector('[role="dialog"] .mapboxgl-canvas').getBoundingClientRect();
      const toggle = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /^(streets|satellite)$/i.test(x.innerText.trim()));
      return {
        present: true,
        mapboxInline: c.getAttribute("style"),
        computedDisplay: getComputedStyle(c).display,
        box: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
        insideMap: b.left >= m.left && b.right <= m.right && b.top >= m.top && b.bottom <= m.bottom,
        styleToggleOffers: toggle ? toggle.innerText.trim() : null,
      };
    });
    r.stylesRequested = [...new Set(styles)];
    out[w] = r;
    console.log(w, JSON.stringify(r));
    await page.screenshot({ path: path.join(OUT, `wordmark-${w}.png`) });
    const mb = await page.locator('[role="dialog"] .mapboxgl-canvas').first().boundingBox();
    const cw = Math.min(mb.width, w <= 480 ? 360 : 420), ch = Math.min(mb.height, 140);
    await page.screenshot({ path: path.join(OUT, `wordmark-map-${w}.png`), clip: { x: mb.x, y: mb.y + mb.height - ch, width: cw, height: ch } });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "wordmark.json"), JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
