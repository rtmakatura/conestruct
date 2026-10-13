// Phase 4 / R137 Q3: what breaks at 360 px that doesn't at 380 px.
// Production's /sandbox (AUDIT_SITE), N Broadway SB (39.73370, -104.98753),
// shoulder work, at WIDTHS (default 360 and 380, 800 tall), four stages:
//   empty    the page before a pin
//   where    WHERE with the road picked (the picker saved), the kind chosen
//   what     WHAT open after Confirm
//   results  after Generate
// Per stage and width: horizontal scroll, the outermost elements past the
// viewport's right edge (not inside a clipping scroller), clipped text
// (overflow hidden and wider than its box), and visible interactive
// targets under 44 px in either dimension.  Writes <stage>-<w>.png (full
// page) and measure-<w>.json.
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

async function measure(page) {
  return page.evaluate(() => {
    const W = innerWidth;
    const describe = (el) => {
      const id = el.getAttribute("data-testid");
      const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      const text = (el.innerText || el.getAttribute("aria-label") || el.value || "").replace(/\s+/g, " ").trim().slice(0, 50);
      return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ""}${cls ? "." + cls : ""} "${text}"`;
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === "hidden" || ox === "auto" || ox === "scroll" || ox === "clip") return true;
      }
      return false;
    };
    const all = [...document.querySelectorAll("body *")].filter(visible);
    const over = all.filter((el) => el.getBoundingClientRect().right > W + 0.5 && !clipped(el));
    // Outermost only: drop an element whose parent is also past the edge.
    const overflow = over
      .filter((el) => !over.includes(el.parentElement))
      .map((el) => `${describe(el)} right=${el.getBoundingClientRect().right.toFixed(1)}`);
    const clippedText = all
      .filter((el) => {
        const s = getComputedStyle(el);
        return (s.overflowX === "hidden" || s.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && (el.innerText || "").trim();
      })
      .map((el) => `${describe(el)} scroll=${el.scrollWidth} box=${el.clientWidth}`);
    const targets = all
      .filter((el) => el.matches("button, a[href], select, input:not([type=hidden]), [role=button], [role=radio], [role=tab], summary"))
      .filter((el) => !el.disabled)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ el, r }) => `${describe(el)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
    return {
      scroll: [document.documentElement.scrollWidth, W],
      overflow,
      clippedText,
      smallTargets: targets,
    };
  });
}

async function run(browser, w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const out = { width: w };
  const stage = async (name) => {
    await page.mouse.move(1, 1).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${name}-${w}.png`), fullPage: true });
    out[name] = await measure(page);
    console.log(w, name, JSON.stringify({ scroll: out[name].scroll, overflow: out[name].overflow.length, clipped: out[name].clippedText.length, small: out[name].smallTargets.length }));
  };
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await stage("empty");
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill("39.73370");
  await page.getByPlaceholder(/^Longitude/).fill("-104.98753");
  const save = page.getByRole("button", { name: /Save & Close/ });
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  for (let i = 0; i < 90 && (await card.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await stage("picker");
  const pick = page.locator("button").filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ }).first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await pick.count()) > 0) {
    await pick.scrollIntoViewIfNeeded();
    await pick.click();
  }
  await page.waitForTimeout(2000);
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  await (await hook(page, "kind-chip-shoulder")).click();
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await stage("where");
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  await stage("what");
  const gen = page.getByRole("button", { name: /Generate plan/ }).first();
  for (let i = 0; i < 60 && !(await gen.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await gen.click();
  await page.waitForTimeout(30000);
  await stage("results");
  out.errors = errors;
  fs.writeFileSync(path.join(OUT, `measure-${w}.json`), JSON.stringify(out, null, 2));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const w of (process.env.WIDTHS || "360,380").split(",").map(Number)) await run(browser, w);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
