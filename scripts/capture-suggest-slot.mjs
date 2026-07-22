// Captures the Endeavor-B suggest slot in its live states (B1 evidence):
//   1. pin inside Denver → suggestion + Confirm/Dismiss + honesty line
//   2. Confirm clicked → passive agreement line, key applied
//   3. pin in the Glendale enclave → no suggestion, amber warnings
// Run from the repo root with the dev stack up (local render API +
// Next dev with MODAL_RENDER_URL pointed at it):
//   node scripts/capture-suggest-slot.mjs [outDir]
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const outDir = process.argv[2] ?? "gen2-preview";
const base = process.env.GEN2_BASE ?? "http://localhost:3000";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(`${base}/sandbox`, { waitUntil: "networkidle", timeout: 120000 });

// Setting one coordinate flips the sidebar from empty-state to summary
// (hasPin), which remounts the panel and closes manual entry — so the
// panel is re-opened before every fill.
async function fillManual(label, value) {
  const input = page.locator(`div:has(> label:text-is("${label}")) input`);
  if (!(await input.isVisible().catch(() => false))) {
    await page
      .getByRole("button", { name: /Enter manually|Edit manually/ })
      .click();
  }
  await input.fill(String(value));
}

async function setPin(lat, lng) {
  await fillManual("Latitude", lat);
  await fillManual("Longitude", lng);
}

const jbar = page.locator(".jbar");

// 1 · Denver pin → live suggestion.
await setPin(39.7392, -104.9903);
await page.waitForSelector("text=Pin suggests:", { timeout: 15000 });
await jbar.screenshot({ path: `${outDir}/suggest-1-denver-pin.png` });
await page.screenshot({ path: `${outDir}/suggest-1-denver-viewport.png` });
console.log("captured: Denver suggestion");

// 2 · Confirm → passive agreement + key applied.
await page.getByRole("button", { name: /^Confirm / }).click();
await page.waitForSelector("text=Pin agrees with your selection", {
  timeout: 15000,
});
await jbar.screenshot({ path: `${outDir}/suggest-2-confirmed.png` });
const applied = await page.locator("#jl-jurisdiction").inputValue();
console.log("captured: confirmed — picker value:", applied);

// 3 · Glendale enclave pin → warnings, no suggestion.
await page.locator("#jl-jurisdiction").selectOption("");
await setPin(39.7047, -104.935);
await page.waitForSelector("text=Pin is in Glendale", { timeout: 15000 });
await jbar.screenshot({ path: `${outDir}/suggest-3-glendale-trap.png` });
console.log("captured: Glendale trap warnings");

await browser.close();
console.log("done");
