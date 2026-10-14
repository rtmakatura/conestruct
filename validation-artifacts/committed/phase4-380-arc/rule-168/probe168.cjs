// Rule 168 (R137 Q1): the download row at 320, 360 and 1440 on results
// (shoulder, N Broadway SB).  Measures the zip control, its count line, the
// four cards (height, layout, buttons), and where the row ends against the
// screen height.  Screenshots: dl-<w>.png (the row), first-<w>.png (the
// first screen after results).  P168_SITE, P168_OUT.
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { gateHeaders } = require(`${REPO}/scripts/gate.cjs`);
const { toResults } = require("./results-flow.cjs");

const SITE = process.env.P168_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.P168_OUT;
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
      out[w] = { error: String(e).split(/\r?\n/)[0] };
      console.log("w" + w, "FAILED", out[w].error);
      for (const c of browser.contexts()) await c.close().catch(() => {});
      continue;
    }
    await page.mouse.move(1, 1).catch(() => {});
    const m = await page.evaluate(() => {
      const r1 = (x) => Math.round(x * 10) / 10;
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r1(r.top + scrollY), h: r1(r.height), w: r1(r.width) };
      };
      const dls = document.querySelector(".dls");
      const cards = [...document.querySelectorAll(".dl-card")];
      const zip = document.querySelector(".dl-all");
      const hero = document.querySelector(".hero");
      return {
        zip: box(zip),
        zipText: zip ? zip.innerText.replace(/\s+/g, " ").trim() : null,
        zipPrimary: !!zip && zip.classList.contains("is-primary"),
        row: box(dls),
        cols: dls ? getComputedStyle(dls).gridTemplateColumns : null,
        cards: cards.map((c) => ({
          title: c.querySelector(".top")?.innerText.replace(/\s+/g, " ").trim(),
          buttons: [...c.querySelectorAll(".dl-btn")].map((b) => b.innerText.replace(/\s+/g, " ").trim()),
          ...box(c),
        })),
        hero: box(hero),
        pageH: document.documentElement.scrollHeight,
      };
    });
    out[w] = m;
    console.log("w" + w, "zip", JSON.stringify(m.zip), m.zipText, "primary", m.zipPrimary, "| row", JSON.stringify(m.row), "cols", m.cols, "| cards", m.cards.map((c) => `${c.title} h${c.h} [${c.buttons.join(", ")}]`).join(" ; "));
    const row = page.locator(".dls").first();
    if (await row.count()) {
      const zipEl = page.locator(".dl-all").first();
      await (await zipEl.count() ? zipEl : row).scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const parent = row.locator("xpath=..");
      await parent.screenshot({ path: path.join(OUT, `dl-${w}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
