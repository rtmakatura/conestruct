// Captures the restaged generator page in both hero states (checkpoint
// deliverable): pre-generation (Zone 1 dominant) and post-generation
// (Zone 2 dominant).  Run from the repo root with the dev server up.
//   node <this file> <outDir>
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const outDir = process.argv[2] ?? "gen2-preview";
const base = process.env.GEN2_BASE ?? "http://localhost:3000";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(`${base}/sandbox`, {
  waitUntil: "networkidle",
  timeout: 120000,
});

// Unstick the nav for full-page capture: Playwright's scroll-and-stitch
// repaints position:sticky elements at a scroll offset, which prints a
// phantom mid-page nav band that does NOT exist in the live DOM
// (verified: scripts/verify-single-nav.mjs counts exactly one <nav>).
await page.addStyleTag({
  content: "nav { position: static !important; }",
});

// Give the audit/breakdown round-trips time to settle (cold backend can
// take ~6s) so the status strip shows a real verdict, not VERIFYING.
await page
  .waitForSelector(".status-bar.pass, .status-bar.caution, .status-bar.fail", {
    timeout: 30000,
  })
  .catch(() => console.log("note: strip never settled — capturing anyway"));

await page.screenshot({ path: `${outDir}/1-pre-generation.png`, fullPage: true });
console.log("captured pre-generation");

// Select a jurisdiction so the post-gen state shows the jbar populated
// (Greeley: fired arrow-board delta in production data).
await page.selectOption("#jl-jurisdiction", "parker");
await page.getByRole("button", { name: "Arterial" }).click();
await page.waitForTimeout(4000);

const genBtn = page.getByRole("button", { name: /Generate plan/ });
const disabled = await genBtn.isDisabled();
console.log("generate disabled?", disabled);
await genBtn.click();

// Post state: hero mounts once the breakdown answers.
await page.waitForSelector(".hero", { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/2-post-generation.png`, fullPage: true });
console.log("captured post-generation");

// Bonus: the strip presentation on its own (viewport shot, not full page).
await page.screenshot({ path: `${outDir}/3-post-viewport.png`, fullPage: false });

await browser.close();
console.log("done");
