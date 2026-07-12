// Measures the Define Work Zone modal's map-column/rail layout in a real
// browser at five viewport widths.  Run from the repo root with the dev
// server up (cd conestruct/site && npm run dev), then:
//   node scripts/measure-picker-rail.mjs
//
// This repo's Tailwind md breakpoint is 980px (the column-split gate;
// tailwind.config.ts OVERRIDES the stock breakpoints — lg is 1280, not
// 1024, which is exactly the defect this script caught when the split
// was first gated on lg:).  Expected: 1440/1100/980 split (456px rail
// with its own scrollbar), 979/900 stacked.
import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge", headless: true });
for (const width of [1440, 1100, 980, 979, 900]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto("http://localhost:3000/sandbox", {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.getByText("Pick Location on Map").click();
  await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
  const m = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const kids = [...dialog.children];
    // header, search-error rows only exist conditionally; find the body
    // as the element carrying the two-column flex classes.
    const body = kids.find((k) => k.className.includes("md:flex-row"));
    const [mapCol, rail] = [...body.children];
    const b = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const railRect = b(rail);
    const mapColRect = b(mapCol);
    const railInner = rail.firstElementChild;
    const mapPane = [...mapCol.children].find((c) =>
      c.className.includes("bg-black/30"),
    );
    return {
      dialog: b(dialog),
      mapCol: mapColRect,
      rail: railRect,
      sideBySide: railRect.x >= mapColRect.x + mapColRect.w - 2,
      railScrolls: railInner.scrollHeight > railInner.clientHeight,
      railOwnScrollbar:
        getComputedStyle(railInner).overflowY === "auto",
      mapPane: mapPane ? b(mapPane) : null,
      bodyScrollY: getComputedStyle(body).overflowY,
      pageOverflowsX:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });
  console.log(`viewport ${width}:`, JSON.stringify(m));
  await page.close();
}
await browser.close();
