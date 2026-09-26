// One-off evidence check: is the nav band duplicated in the live DOM,
// or is the mid-page band in full-page captures a sticky-repaint
// artifact?  Counts <nav> elements and screenshots a mid-scroll
// viewport (not fullPage) where a genuine duplicate would be visible.
import { chromium } from "playwright";
// coming-soon-gate C-Q7: edited in place (scripts/ is not an archive) —
// the gate's bypass header, on requests to the site only; throws on prod
// without GATE_BYPASS_TOKEN.  The default moves from the apex to www:
// the apex answers with a 307 to www, and the header does not survive a
// redirect hop (scripts/gate.cjs).
import { applyGate } from "./gate.cjs";

const base = process.env.GEN2_BASE ?? "https://www.conestruct.com";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await applyGate(page, base);
await page.goto(`${base}/sandbox`, { waitUntil: "networkidle", timeout: 120000 });

const counts = await page.evaluate(() => ({
  navs: document.querySelectorAll("nav").length,
  frames: document.querySelectorAll(".workbench-frame").length,
  wordmarks: [...document.querySelectorAll("nav")].map((n) =>
    (n.textContent ?? "").slice(0, 40),
  ),
}));
console.log(JSON.stringify(counts));

// Scroll to the middle of the page and take a VIEWPORT screenshot — a
// real duplicate band would appear here detached from the top.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
await page.waitForTimeout(400);
await page.screenshot({ path: "gen2-preview-prod/4-midscroll-viewport.png" });
console.log("mid-scroll viewport captured");
await browser.close();
