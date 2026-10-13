// Verifies the jurisdiction cell on the WHAT band is geometrically
// stable: its height must be IDENTICAL across every selection (none + all
// launch-8), while the evaluation is in flight, and through a street-class
// switch — and no skeleton may appear.  Run at the two supported sizes,
// 1440×1000 and the phone test size 360×800 (R138, DESIGN-SPACING.md
// "Supported sizes").
//
// Phase 4 (R138): this script used to drive the jurisdiction summary bar
// (Surface B, #152: `.jbar`, `#jl-jurisdiction`, `.classpick`), which
// §8.31 removed — no component renders those selectors, so the old
// script could not run.  Its successor is WHAT's jurisdiction cell
// (`#what-jurisdiction`, the Street class control, and the cell's reserved
// provenance line, #276); the checks are the same three.  The file keeps
// its name so the docs that cite it still point here.
//
// Run from the repo root with the site and its backend up (cd
// conestruct/site && npm run dev):
//   node scripts/verify-jbar-stability.mjs            (default :3000)
//   GEN2_BASE=http://localhost:3001 node scripts/verify-jbar-stability.mjs
// It reaches WHAT the way a person does: the picker (coordinates typed,
// N Broadway SB), Shoulder work, the first side, Confirm.  Exits 1 on any
// height change or skeleton.
import { createRequire } from "node:module";
import { chromium } from "playwright";

// The site's coming-soon gate (scripts/gate.cjs): the header rides every
// site request when GATE_BYPASS_TOKEN is set (a local dev server loads
// .env.local, which can turn the gate on), and is required on production.
const require = createRequire(import.meta.url);
const { applyGate, gateHeaders } = require("./gate.cjs");

const base = process.env.GEN2_BASE ?? "http://localhost:3000";
const PIN = { lat: "39.73370", lng: "-104.98753" };
const KEYS = [
  "",
  "cdot",
  "denver",
  "lakewood",
  "englewood",
  "littleton",
  "centennial",
  "parker",
  "e470",
];
const SIZES = [
  { width: 1440, height: 1000 },
  { width: 360, height: 800 },
];

const browser = await chromium.launch({ channel: "msedge", headless: true });
let failed = false;

async function toWhat(page) {
  await page.goto(`${base}/sandbox`, { waitUntil: "networkidle", timeout: 120000 });
  // A click before hydration does nothing: wait for the page to settle.
  await page.waitForTimeout(5000);
  await page.locator('[data-testid="where-open-picker"]').first().click({ timeout: 60000 });
  await page.getByRole("button", { name: /enter coordinates manually/i }).click({ timeout: 60000 });
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
  const card = page.getByText(/Road detected · 1 match|Which road\?|No road|No roads detected/).first();
  await card.waitFor({ timeout: 90000 });
  const pick = page
    .locator("button")
    .filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ })
    .first();
  if ((await page.getByText(/Which road\?/).count()) > 0 && (await pick.count()) > 0) {
    await pick.scrollIntoViewIfNeeded();
    await pick.click();
  }
  const save = page.getByRole("button", { name: /Save & Close/ });
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) await page.waitForTimeout(1000);
  await save.click();
  await page.locator('[data-testid="kind-chip-shoulder"]').first().click({ timeout: 60000 });
  await page.locator('[data-testid="side-option"]').first().click({ timeout: 60000 });
  await page.locator('[data-testid="where-confirm"]').first().click({ timeout: 60000 });
  await page.locator("#what-jurisdiction").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
}

for (const size of SIZES) {
  const context = await browser.newContext({ viewport: size });
  await applyGate(context, base);
  const gate = gateHeaders(base);
  const page = await context.newPage();

  // Stall breakdown responses on demand so the in-flight state is
  // measurable; released per-selection below.
  let stall = false;
  const pending = [];
  await page.route("**/api/render/device-breakdown", async (route) => {
    // This route answers before the context's gate route, so it carries
    // the gate header itself.
    const go = () => route.continue({ headers: { ...route.request().headers(), ...gate } });
    if (stall) {
      pending.push(go);
    } else {
      await go();
    }
  });

  await toWhat(page);

  const measure = () =>
    page.evaluate(() => {
      const h = (sel) => {
        const el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().height) : -1;
      };
      // The cell's provenance line sits in its closed details popover
      // (R98) unless it needs the operator now, so the cell's own height
      // is the measure.
      return {
        cell: h('[data-testid="cell-jurisdiction"]'),
        skeleton: Boolean(
          document.querySelector(
            '[data-testid="cell-jurisdiction"] [class*="skel"], [data-testid="cell-jurisdiction"] .animate-pulse',
          ),
        ),
      };
    });

  const heights = {};
  for (const key of KEYS) {
    stall = false;
    await page.selectOption("#what-jurisdiction", key);
    // Let the evaluation land and the cell's line settle.
    await page.waitForTimeout(1500);
    heights[key || "none"] = await measure();
  }

  // In flight: stall the evaluation, flip to a new jurisdiction.
  stall = true;
  await page.selectOption("#what-jurisdiction", "");
  await page.waitForTimeout(300);
  await page.selectOption("#what-jurisdiction", "denver");
  await page.waitForTimeout(500);
  heights["denver(in flight)"] = await measure();
  stall = false;
  for (const go of pending.splice(0)) await go().catch(() => {});
  await page.waitForTimeout(1500);

  // Class-switch stability (#152 D): with a jurisdiction evaluated,
  // switching the street class refires the evaluation — the cell must
  // hold its height and show no skeleton while that is in flight.
  for (const cls of ["Local", "Collector", "Arterial"]) {
    stall = true;
    await page
      .locator('[data-testid="cell-street-class"]')
      .getByRole("button", { name: cls, exact: true })
      .click();
    await page.waitForTimeout(300);
    heights[`class:${cls}(in flight)`] = await measure();
    stall = false;
    for (const go of pending.splice(0)) await go().catch(() => {});
    await page.waitForTimeout(1200);
    heights[`class:${cls}(settled)`] = await measure();
  }

  const cellHeights = new Set(Object.values(heights).map((v) => v.cell));
  const skeletons = Object.entries(heights).filter(([, v]) => v.skeleton);
  const missing = Object.values(heights).some((v) => v.cell < 0);
  const ok = cellHeights.size === 1 && skeletons.length === 0 && !missing;
  if (!ok) failed = true;
  console.log(
    `viewport ${size.width}x${size.height}: ${ok ? "STABLE" : "UNSTABLE"} — cell heights ${[...cellHeights].join(", ")}`,
  );
  for (const [k, v] of Object.entries(heights)) {
    console.log(`  ${k.padEnd(26)} cell=${v.cell}${v.skeleton ? " SKELETON" : ""}`);
  }
  await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
