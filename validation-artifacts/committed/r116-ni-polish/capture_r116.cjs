// R116 checkpoint captures (items 1 and 2), on a local build of main
// 4c1a324 (AUDIT_SITE), at 1440 and 390.  The plan: a near-intersection
// lane closure on N Broadway SB (pin 39.73370, -104.98753, Denver guessed
// from the pin), the cross street marked at E 12th Ave (~39.7351, upstream
// of the work start; E 11th Ave sits ~120 ft downstream of the pin, inside
// any work zone long enough for the 180 ft taper at 30 mph), 500 ft of work.
//
// BEFORE is the page as built.  AFTER is a MOCK: the proposed markup is
// written into the live page with the page's own classes (no code change),
// so it renders with the real CSS.  Writes into AUDIT_OUT:
//   ny-<w>-before.png / ny-<w>-after.png         item 1, the NEEDS YOU row
//   extent-<w>-before.png                         item 2, as built
//   extent-<w>-A.png                              item 2 option A (rows removed)
//   extent-<w>-B.png / extent-<w>-B-open.png      item 2 option B (WHAT row)
//   dom-*.html                                    the markup captured
// Usage: GATE_BYPASS_TOKEN=... AUDIT_SITE=http://localhost:3108/sandbox
//        AUDIT_OUT=<dir> node capture_r116.cjs
const path = require("path");
const fs = require("fs");
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(`${REPO}/node_modules/playwright`);
const { hook } = require(`${REPO}/scripts/live-check.cjs`);
const { applyGate, gateHeaders } = require(`${REPO}/scripts/gate.cjs`);

const SITE = process.env.AUDIT_SITE || "http://localhost:3108/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required");
fs.mkdirSync(OUT, { recursive: true });
gateHeaders(SITE);
const PIN = { lat: 39.7337, lng: -104.98753 };
const CROSS_LAT = 39.7351; // E 12th Ave at N Broadway (approximate)

async function toPlan(page) {
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(String(PIN.lat.toFixed(5)));
  await page.getByPlaceholder(/^Longitude/).fill(String(PIN.lng));
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page
    .locator("button")
    .filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ })
    .first();
  for (let i = 0; i < 90; i += 1) {
    if ((await candidate.count()) > 0 || (await save.isEnabled())) break;
    await page.waitForTimeout(1000);
  }
  if ((await candidate.count()) > 0) {
    await candidate.click();
    await page.waitForTimeout(2500);
  }
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(4000);
  const len = page.locator("#band-worklen");
  await len.fill("500");
  await len.blur();
  await page.waitForTimeout(1500);
  await (await hook(page, "kind-chip-near_intersection")).click();
  await page.waitForTimeout(3000);
  // Mark the cross street: the picker reopens at zoom 16 (PIN_ZOOM) on the
  // pin; 512-px tiles, Web Mercator.
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(6000);
  await page.getByRole("button", { name: /Mark the intersection on the map/ }).click();
  await page.waitForTimeout(3000);
  const box = await page.locator(".mapboxgl-canvas").first().boundingBox();
  const dy = ((PIN.lat - CROSS_LAT) * ((512 * 2 ** 16) / 360)) / Math.cos((39.734 * Math.PI) / 180);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + dy);
  await page.waitForTimeout(5000);
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.waitForTimeout(6000);
  const side = page.locator('[data-testid="side-option"]').first();
  for (let i = 0; i < 40 && (await side.count()) === 0; i += 1) await page.waitForTimeout(1000);
  await side.click();
  await page.waitForTimeout(2500);
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(9000);
  await (await hook(page, "generate-plan")).click();
  for (let i = 0; i < 150; i += 1) {
    await page.waitForTimeout(1000);
    if (
      (await page.locator(".working-band").count()) === 0 &&
      (await page.locator('[data-testid="fact-setup"]').count()) > 0
    )
      break;
  }
  await page.waitForTimeout(4000);
  await page.mouse.move(1, 1);
}

async function shot(page, sel, file) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  await el.screenshot({ path: path.join(OUT, file) });
}

// Item 1's AFTER: the row as the checkpoint proposes it.  Title from the
// device's display name ("required": the layout already places the board);
// one detail line; the short citation (source.doc) on the right.
const NY_AFTER = {
  title: "Arrow board required",
  prov: "Denver requires one on any lane closure · the plan already places it",
  cite: "DOTI PT-116.1",
};

// Item 2's rows, as the audit gives them (captured from the page).
async function extentRows(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="corridor-extent"] [data-testid^="zone-"]')].map(
      (e) => e.textContent,
    ),
  );
}

function optionB(rows, open, withRows) {
  const pop = [
    '<span class="tr-prov">your answer · the extent the plan is built for</span>',
    ...(withRows
      ? [
          '<span class="tr-prov" style="color: var(--ink)">Corridor at this length</span>',
          ...rows.map((r) => `<span class="tr-prov">${r}</span>`),
          '<span class="tr-prov">the cross-street approaches lay out separately</span>',
        ]
      : []),
  ].join("");
  return (
    '<div class="a-cols mt-4" data-mock="r116"><div class="a-col">' +
    '<div class="a-cell"><div class="a-cell-head">' +
    '<label class="tr-field" for="band-worklen">Work zone length (ft)</label>' +
    `<span class="a-marks"><button type="button" class="a-mark tr-prov is-ok" aria-expanded="${open}"><span>✓ yours</span></button></span>` +
    '</div><div class="a-cell-ctl"><input id="band-worklen" class="a-fld" type="number" value="500"></div>' +
    `<div class="a-info a-pop" role="group"${open ? "" : " hidden"}>${pop}</div>` +
    "</div></div></div>"
  );
}

async function run(browser, w, h) {
  // The plan is built at 1440 (the picker's map click is computed for the
  // desktop modal), then the viewport is set to the capture width: the
  // same page, laid out at that width.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  await toPlan(page);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(1500);

  // --- item 1 ---------------------------------------------------------------
  const ny = '[data-testid="needs-you"], .ny-list, section:has(.ny-item)';
  fs.writeFileSync(
    path.join(OUT, "dom-ny-item.html"),
    await page.evaluate(() => document.querySelector(".ny-item")?.outerHTML ?? "(none)"),
  );
  await shot(page, ".ny-item", `ny-${w}-before.png`);
  await page.evaluate((a) => {
    const li = document.querySelector(".ny-item");
    li.querySelector(".ny-body").textContent = a.title;
    li.querySelector(".ny-prov").textContent = a.prov;
    li.querySelector(".ny-cite").textContent = a.cite;
  }, NY_AFTER);
  await shot(page, ".ny-item", `ny-${w}-after.png`);
  void ny;

  // --- item 2 ---------------------------------------------------------------
  await (await hook(page, "setup-link-extent")).click();
  await page.waitForTimeout(4000);
  const cellSel = '.a-cell:has([data-testid="corridor-extent"])';
  fs.writeFileSync(
    path.join(OUT, "dom-extent-cell.html"),
    await page.evaluate((s) => document.querySelector(s)?.outerHTML ?? "(none)", cellSel),
  );
  const rows = await extentRows(page);
  fs.writeFileSync(path.join(OUT, `extent-${w}-rows.json`), JSON.stringify(rows, null, 2));
  await shot(page, cellSel, `extent-${w}-before.png`);
  for (const [tag, html] of [
    ["A", optionB(rows, false, false)],
    ["B", optionB(rows, false, true)],
    ["B-open", optionB(rows, true, true)],
  ]) {
    await page.evaluate(
      ({ s, html: x }) => {
        const prev = document.querySelector('[data-mock="r116"]') ?? document.querySelector(s);
        prev.outerHTML = x;
      },
      { s: cellSel, html },
    );
    await page.waitForTimeout(300);
    const target = '[data-mock="r116"]';
    const el = page.locator(target).first();
    await el.scrollIntoViewIfNeeded();
    await page.mouse.move(1, 1);
    const b = await el.boundingBox();
    // The popover overlays below the row: take the row plus room for it.
    await page.screenshot({
      path: path.join(OUT, `extent-${w}-${tag}.png`),
      clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: Math.min(b.width + 16, w), height: b.height + (tag === "B-open" ? 190 : 16) },
    });
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 1440, 1000);
  await run(browser, 390, 844);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
