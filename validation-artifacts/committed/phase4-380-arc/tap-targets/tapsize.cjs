// Phase 4 branch 2 (R138): every control's size on the picker, WHERE,
// WHAT (shoulder, flagger, near-intersection with its cross-street group)
// and WHAT's footer, at 1440x1000 and 360x800.  AUDIT_SITE = production
// (before) or a local stack of the branch (after).  Writes
// tapsize-<w>.json: per surface, every visible enabled control (button,
// link, select, input, role=button/radio/tab, summary) with its label and
// its box (w x h).
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

async function census(page, rootSel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    const label = (el) => {
      const id = el.getAttribute("data-testid");
      const t = (el.getAttribute("aria-label") || el.innerText || el.value || el.getAttribute("placeholder") || "")
        .replace(/\s+/g, " ").trim().slice(0, 40);
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute("type");
      return `${tag}${type && tag === "input" ? `[${type}]` : ""}${id ? ` #${id}` : ""} "${t}"`;
    };
    return [...root.querySelectorAll("button, a[href], select, input:not([type=hidden]), [role=button], [role=radio], [role=tab], summary")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.disabled;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { label: label(el), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
      });
  }, rootSel);
}

async function start(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w <= 480 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  return { ctx, page };
}

async function pickRoad(page, out, w) {
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
  if (out) {
    out.picker = await census(page, '[role="dialog"]');
    await page.screenshot({ path: path.join(OUT, `picker-${w}.png`), fullPage: false });
  }
}

async function saveRoad(page) {
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
}

async function sideAndConfirm(page, out, w) {
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 60 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  if (out) {
    out.where = await census(page, '[data-testid="band-where"]');
    const band = page.locator('[data-testid="band-where"]');
    await band.scrollIntoViewIfNeeded();
    await band.screenshot({ path: path.join(OUT, `where-${w}.png`) });
  }
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
}

async function shootWhat(page, name, w, out) {
  await page.mouse.move(1, 1).catch(() => {});
  out[name] = await census(page, '[data-testid="band-what"]');
  const band = page.locator('[data-testid="band-what"]');
  await band.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await band.screenshot({ path: path.join(OUT, `${name}-${w}.png`) });
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[1440, 1000], [360, 800]]) {
    const out = { width: w };
    {
      const { ctx, page } = await start(browser, w, h);
      await pickRoad(page, out, w);
      await saveRoad(page);
      await (await hook(page, "kind-chip-shoulder")).click();
      await sideAndConfirm(page, out, w);
      await shootWhat(page, "what-shoulder", w, out);
      await ctx.close();
    }
    {
      const { ctx, page } = await start(browser, w, h);
      await pickRoad(page, null, w);
      await saveRoad(page);
      await (await hook(page, "kind-chip-flagger_lane_closure")).click();
      await sideAndConfirm(page, null, w);
      await shootWhat(page, "what-flagger", w, out);
      await ctx.close();
    }
    {
      const { ctx, page } = await start(browser, w, h);
      await pickRoad(page, null, w);
      await saveRoad(page);
      await (await hook(page, "kind-chip-near_intersection")).click();
      const mark = page.locator('[data-testid="side-control-mark"]');
      for (let i = 0; i < 60 && (await mark.count()) === 0; i += 1) await page.waitForTimeout(1000);
      await mark.click();
      await page.waitForTimeout(7000);
      const box = await page.locator(".mapboxgl-canvas").first().boundingBox();
      await page.mouse.click(box.x + box.width / 2 + 35, box.y + box.height / 2 - 20);
      await page.waitForTimeout(2000);
      const looking = page.getByText(/Looking up the cross street/);
      for (let i = 0; i < 90 && (await looking.count()) > 0; i += 1) await page.waitForTimeout(1000);
      await saveRoad(page);
      await sideAndConfirm(page, null, w);
      await shootWhat(page, "what-near-intersection", w, out);
      await ctx.close();
    }
    fs.writeFileSync(path.join(OUT, `tapsize-${w}.json`), JSON.stringify(out, null, 2));
    console.log(w, Object.fromEntries(Object.entries(out).filter(([k]) => k !== "width").map(([k, v]) => [k, v ? `${v.length} controls, ${v.filter((c) => Math.min(c.w, c.h) < 44).length} under 44` : "missing"])));
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
