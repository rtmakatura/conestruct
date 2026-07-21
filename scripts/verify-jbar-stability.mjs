// Verifies the jurisdiction bar is geometrically stable: its height must
// be IDENTICAL across every selection (none + all launch-8) and during
// the jurisdiction data fetch (skeleton state).  Run from the repo root
// with the dev server up (cd conestruct/site && npm run dev):
//   node scripts/verify-jbar-stability.mjs            (default :3000)
//   GEN2_BASE=http://localhost:3001 node scripts/verify-jbar-stability.mjs
// Exits 1 on any height mismatch.  Also prints the measured chain-slot
// content heights — if a new jurisdiction's chain exceeds the reserved
// .jbar-slot-chain min-height (globals.css), raise the reservation.
import { chromium } from "playwright";

const base = process.env.GEN2_BASE ?? "http://localhost:3000";
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

const browser = await chromium.launch({ channel: "msedge", headless: true });
let failed = false;

for (const width of [1440, 1100]) {
  const page = await browser.newPage({ viewport: { width, height: 950 } });

  // Stall breakdown responses on demand so the skeleton state is
  // measurable; released per-selection below.
  let stall = false;
  const pending = [];
  await page.route("**/api/render/device-breakdown", async (route) => {
    if (stall) {
      pending.push(route);
    } else {
      await route.continue();
    }
  });

  await page.goto(`${base}/sandbox`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });

  const measure = () =>
    page.evaluate(() => {
      const h = (sel) => {
        const el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().height) : -1;
      };
      const chain = document.querySelector(".jbar-slot-chain");
      return {
        bar: h(".jbar"),
        authSlot: h(".jbar-slot-auth"),
        hintSlot: h(".jbar-slot-hint"),
        chainSlot: h(".jbar-slot-chain"),
        chainContent: Math.round(
          (chain.firstElementChild?.getBoundingClientRect().height ?? 0) +
            (chain.lastElementChild !== chain.firstElementChild
              ? (chain.lastElementChild?.getBoundingClientRect().height ?? 0)
              : 0),
        ),
      };
    });

  const heights = {};
  for (const key of KEYS) {
    stall = false;
    await page.selectOption("#jl-jurisdiction", key);
    // Let the fetch land and the chain render.
    await page.waitForTimeout(1200);
    heights[key || "none"] = await measure();
  }

  // Skeleton state: stall the fetch, flip to a new jurisdiction.
  stall = true;
  await page.selectOption("#jl-jurisdiction", "");
  await page.waitForTimeout(300);
  await page.selectOption("#jl-jurisdiction", "denver");
  await page.waitForTimeout(500);
  heights["loading(skeleton)"] = await measure();
  for (const r of pending.splice(0)) await r.continue().catch(() => {});

  const barHeights = new Set(Object.values(heights).map((h) => h.bar));
  const ok = barHeights.size === 1;
  if (!ok) failed = true;
  console.log(
    `viewport ${width}: ${ok ? "STABLE" : "UNSTABLE"} — bar heights ${[...barHeights].join(", ")}`,
  );
  for (const [k, h] of Object.entries(heights)) {
    console.log(
      `  ${k.padEnd(20)} bar=${h.bar} auth=${h.authSlot} hint=${h.hintSlot} chainSlot=${h.chainSlot} chainContent=${h.chainContent}`,
    );
  }
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
