// R139 proposal: the results page's device table at 360x800 (and 1440 for
// reference) on production, as it is and with three mock layouts injected
// as page CSS (nothing built):
//   A  stack: each device is one block; name and quantity on the first
//      line, MUTCD code and function under it, labelled.
//   B  wrap: the same 4-column table, fixed layout, cells wrap.
//   C  scroll: the table scrolls inside its own box; a right-edge fade and a
//      "scroll sideways" line say there is more.
// Per variant: the table's width, the page's scroll width vs the screen,
// and a screenshot of the device section.  Writes devtable.json + PNGs.
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

const CSS = {
  A: `
.device-table thead { display: none; }
.device-table, .device-table tbody { display: block; width: 100%; }
.device-table tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 16px; row-gap: 2px;
  padding: 10px 12px; border-bottom: 1px solid var(--paper-line-soft); }
.device-table tr:last-child { border-bottom: 0; }
.device-table td { display: block; padding: 0 !important; border: 0 !important; }
.device-table td:nth-child(1) { grid-column: 1; grid-row: 1; font-weight: 500; }
.device-table td.num { grid-column: 2; grid-row: 1 / span 3; text-align: right; }
.device-table td:nth-child(2), .device-table td:nth-child(3) { grid-column: 1; font-size: 12px; color: var(--ink-faint); }
.device-table td:nth-child(2)::before { content: "MUTCD "; }
.device-table td:nth-child(2)::before, .device-table td.num::before { font-family: var(--font-mono); font-size: 9.5px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); font-weight: 500; }
.device-table td.num::before { content: "Qty"; display: block; }
`,
  B: `
.device-table { table-layout: fixed; }
.device-table th, .device-table td { padding: 8px 6px !important; overflow-wrap: anywhere; }
.device-table th:nth-child(4) { width: 44px; }
.device-table th:nth-child(2) { width: 64px; }
`,
  C: `
.mock-scroll { overflow-x: auto; -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); }
.mock-scroll.at-end { -webkit-mask-image: none; mask-image: none; }
.mock-scroll .device-table { width: max-content; min-width: 100%; }
.mock-hint { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ink-on-dark-faint); margin: 0 0 6px; }
`,
};

async function measure(page) {
  return page.evaluate(() => {
    const t = document.querySelector(".device-table");
    if (!t) return null;
    const r = t.getBoundingClientRect();
    const box = t.closest(".mock-scroll");
    return {
      tableW: Math.round(r.width * 10) / 10,
      tableRight: Math.round(r.right * 10) / 10,
      rows: t.querySelectorAll("tbody tr").length,
      pageScrollW: document.documentElement.scrollWidth,
      screenW: screen.width,
      innerW: innerWidth,
      boxScroll: box ? [box.scrollWidth, box.clientWidth] : null,
    };
  });
}

async function shootSection(page, file) {
  const sec = page.locator(".device-table").first();
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const b = await sec.boundingBox();
  const vp = page.viewportSize();
  const y = Math.max(0, b.y - 90);
  await page.screenshot({ path: file, clip: { x: 0, y, width: vp.width, height: Math.min(vp.height - y, b.height + 130) } });
}

async function toResults(browser, w, h) {
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
  const gen = page.getByRole("button", { name: /Generate plan/ }).first();
  for (let i = 0; i < 60 && !(await gen.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await gen.click();
  await page.waitForTimeout(30000);
  // The device schedule is a disclosure, possibly inside others: open
  // every closed one, a few rounds, as measure360more.cjs did.
  for (let round = 0; round < 4; round += 1) {
    const closed = page.locator('[aria-expanded="false"]:visible');
    const n = await closed.count();
    if (!n) break;
    for (let i = 0; i < n; i += 1) {
      try {
        const el = closed.nth(0);
        await el.scrollIntoViewIfNeeded({ timeout: 2000 });
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(400);
      } catch {
        break;
      }
    }
  }
  const table = page.locator(".device-table");
  for (let i = 0; i < 30 && (await table.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [w, h] of [[360, 800], [1440, 1000]]) {
    const { ctx, page } = await toResults(browser, w, h);
    out[`now-${w}`] = await measure(page);
    await shootSection(page, path.join(OUT, `now-${w}.png`));
    if (w === 360) {
      for (const v of ["A", "B", "C"]) {
        await page.evaluate(([v, css]) => {
          document.getElementById("mock-css")?.remove();
          const s = document.createElement("style");
          s.id = "mock-css";
          s.textContent = css;
          document.head.appendChild(s);
          const t = document.querySelector(".device-table");
          const wrap = t.closest(".mock-scroll");
          if (v === "C" && !wrap) {
            const d = document.createElement("div");
            d.className = "mock-scroll";
            t.parentNode.insertBefore(d, t);
            d.appendChild(t);
            const hint = document.createElement("p");
            hint.className = "mock-hint";
            hint.textContent = "4 columns · scroll sideways →";
            d.parentNode.insertBefore(hint, d);
            d.addEventListener("scroll", () => d.classList.toggle("at-end", d.scrollLeft + d.clientWidth >= d.scrollWidth - 2));
          }
        }, [v, CSS[v]]);
        await page.waitForTimeout(600);
        out[`${v}-360`] = await measure(page);
        await shootSection(page, path.join(OUT, `${v}-360.png`));
        if (v === "C") {
          await page.evaluate(() => { const d = document.querySelector(".mock-scroll"); d.scrollLeft = d.scrollWidth; });
          await page.waitForTimeout(500);
          await shootSection(page, path.join(OUT, `C-360-scrolled.png`));
        }
      }
    }
    console.log(w, JSON.stringify(out, null, 0));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "devtable.json"), JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
