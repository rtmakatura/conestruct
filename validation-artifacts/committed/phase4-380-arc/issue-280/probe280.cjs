// #280 (Phase 4, measured first): where "Freeway / interstate" renders at
// 320, 360 and 1440, and what it costs.  Shoulder on N Broadway SB with the
// WHAT road type set to freeway; measured at WHAT and again after Generate.
// For every element whose own text holds the label: its line count, whether
// it is clipped (scrollWidth > clientWidth), its box width, and the label's
// width in the element's own font next to candidate short forms.
// P280_SITE, P280_OUT.
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.P280_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.P280_OUT;
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const LABEL = "Freeway / interstate";
const CANDIDATES = ["Freeway / interstate", "Freeway", "Freeway/interstate", "Interstate"];

async function toWhat(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w <= 480 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.73370");
  await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
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
  await (await hook(page, "kind-chip-shoulder")).click();
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  return { ctx, page };
}

async function measure(page) {
  return page.evaluate(({ LABEL, CANDIDATES }) => {
    const canvas = document.createElement("canvas");
    const g = canvas.getContext("2d");
    const textW = (el, s) => {
      const cs = getComputedStyle(el);
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const ls = parseFloat(cs.letterSpacing) || 0;
      return Math.round((g.measureText(s).width + ls * s.length) * 10) / 10;
    };
    const hits = [];
    const all = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().width > 0);
    for (const el of all) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
      const isSelect = el.tagName === "SELECT";
      const shown = isSelect ? el.options[el.selectedIndex]?.text ?? "" : own;
      if (!shown.includes(LABEL)) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = isSelect ? 1 : new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      hits.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") || "").split(/\s+/).slice(0, 3).join("."),
        id: el.id || null,
        text: shown.replace(/\s+/g, " ").trim().slice(0, 120),
        boxW: Math.round(r.width * 10) / 10,
        contentW: Math.round((el.clientWidth - padX) * 10) / 10,
        lines,
        clipped: el.scrollWidth > el.clientWidth + 1,
        lineHeight: Math.round(lh * 10) / 10,
        widths: Object.fromEntries(CANDIDATES.map((c) => [c, textW(el, c)])),
        fullTextW: textW(el, shown.replace(/\s+/g, " ").trim()),
      });
    }
    return { pageW: document.documentElement.scrollWidth, hits };
  }, { LABEL, CANDIDATES });
}

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [w, h] of [[320, 800], [360, 800], [1440, 1000]]) {
    let ctx, page;
    try {
      ({ ctx, page } = await toWhat(browser, w, h));
      await page.locator("#what-road-type").selectOption("freeway");
      await page.waitForTimeout(3000);
      await page.mouse.move(1, 1).catch(() => {});
      out[`${w}-what`] = await measure(page);
      await page.locator("#what-road-type").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUT, `what-${w}.png`), fullPage: true });
      const gen = page.getByRole("button", { name: /Generate plan/ }).first();
      for (let i = 0; i < 120 && !(await gen.isEnabled()); i += 1) {
        const sp = page.locator("#what-speed");
        if (i % 5 === 0 && (await sp.count()) && (await sp.inputValue().catch(() => "x")) === "") {
          await sp.selectOption("55").catch(() => {});
        }
        await page.waitForTimeout(1000);
      }
      await gen.click({ timeout: 5000 });
      await page.waitForTimeout(30000);
      await page.mouse.move(1, 1).catch(() => {});
      out[`${w}-results`] = await measure(page);
      await page.screenshot({ path: path.join(OUT, `results-${w}.png`), fullPage: true });
      // What the label costs: the setup box's height with the label, then
      // with the value's text swapped in place for each short candidate
      // (a measurement only; the page is discarded after).
      const v = page.locator(".a-setup-v", { hasText: LABEL }).first();
      if (await v.count()) {
        const cell = v.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' a-setupcell ')][1]");
        const boxEl = cell.locator("xpath=..");
        await boxEl.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
        await boxEl.screenshot({ path: path.join(OUT, `setup-${w}.png`) }).catch(() => {});
        const cost = {};
        // One handle: the swap changes the text the locator matched on.
        const handle = await v.elementHandle();
        for (const c of CANDIDATES) {
          cost[c] = await handle.evaluate((el, text) => {
            const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
            if (node) node.textContent = text;
            const cellEl = el.closest(".a-setupcell");
            const range = document.createRange();
            range.selectNodeContents(el);
            return {
              lines: new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size,
              cellH: Math.round(cellEl.getBoundingClientRect().height * 10) / 10,
              boxH: Math.round(cellEl.parentElement.getBoundingClientRect().height * 10) / 10,
              valueW: Math.round(el.getBoundingClientRect().width * 10) / 10,
            };
          }, c);
        }
        out[`${w}-cost`] = cost;
        console.log("w" + w, "cost", JSON.stringify(cost));
      }
    } catch (e) {
      out[`${w}-error`] = String(e).split(/\r?\n/)[0];
    }
    for (const k of [`${w}-what`, `${w}-results`]) {
      const m = out[k];
      if (!m) continue;
      console.log("w" + k, "page", m.pageW, "hits", m.hits.length);
      for (const x of m.hits) console.log("   ", x.tag, x.cls || x.id, "| lines", x.lines, "clipped", x.clipped, "| box", x.boxW, "content", x.contentW, "| label", x.widths[CANDIDATES[0]], "Freeway", x.widths.Freeway, "| full", x.fullTextW, "|", x.text);
    }
    if (out[`${w}-error`]) console.log("w" + w, "ERROR", out[`${w}-error`]);
    if (ctx) await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
