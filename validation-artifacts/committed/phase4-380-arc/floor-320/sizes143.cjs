// R143 before/after sizes on the results page (every disclosure open), at
// 320x800 and 360x800: the audit calculation rows (height, right edge, the
// cite's position against the title) and the pricing quote's controls
// (the number inputs, Preview, Download).  Also the page's scroll width.
// Screenshots: results-<w>.png (full page) and audit-<w>.png (the
// Checked & passed calculation rows).
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
  for (const [w, h] of [[320, 800], [360, 800]]) {
    const { ctx, page } = await toResults(browser, SITE, w, h);
    await page.mouse.move(1, 1).catch(() => {});
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const r1 = (x) => Math.round(x * 10) / 10;
      const box = (el) => { const r = el.getBoundingClientRect(); return { w: r1(r.width), h: r1(r.height), right: r1(r.right) }; };
      const heads = [...document.querySelectorAll(".audit-head")].filter((e) => e.getBoundingClientRect().width > 0).map((hd) => {
        const t = hd.querySelector(".title"), c = hd.querySelector(".cite");
        const tr = t.getBoundingClientRect(), cr = c.getBoundingClientRect();
        return { title: t.innerText.replace(/\s+/g, " ").slice(0, 28), ...box(hd), citeBelowTitle: cr.top >= tr.bottom - 1, citeRight: r1(cr.right) };
      });
      const qInputs = [...document.querySelectorAll('input[type="number"]')].filter((e) => e.getBoundingClientRect().width > 0 && e.className.includes("canvas")).map((e) => ({ value: e.value, ...box(e) }));
      const qButtons = [...document.querySelectorAll("a, button")].filter((e) => /Preview breakdown|Download Quote|Sign up to download Quote|Save to download the edited plan/.test(e.innerText) && e.getBoundingClientRect().width > 0).map((e) => ({ label: e.innerText.replace(/\s+/g, " ").trim(), ...box(e) }));
      return { pageScrollW: document.documentElement.scrollWidth, screenW: screen.width, auditRows: heads, quoteInputs: qInputs, quoteButtons: qButtons };
    });
    out[w] = m;
    console.log(w, "scroll", m.pageScrollW, "audit rows", m.auditRows.length, "max right", Math.max(...m.auditRows.map((a) => a.right)), "inputs", m.quoteInputs.map((i) => i.h).join("/"), "buttons", m.quoteButtons.map((b) => `${b.label} ${b.w}x${b.h}`).join(" | "));
    await page.screenshot({ path: path.join(OUT, `results-${w}.png`), fullPage: true });
    const first = page.locator(".audit-item").first();
    if (await first.count()) {
      const list = page.locator(".audit-item").first().locator("xpath=..");
      await list.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await list.screenshot({ path: path.join(OUT, `audit-${w}.png`) });
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "sizes.json"), JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
