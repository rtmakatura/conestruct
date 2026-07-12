// Drives the Define Work Zone modal's multi-candidate road-pick flow in
// a real browser: /api/road-bearing is mocked to two candidates (the
// divided-highway case), then the script asserts the Which-road card
// renders at the rail top, Save is disabled while unpicked (#139), a
// pick collapses the card and loads road properties, and Change
// re-expands.  Screenshots saved for visual QA.  Run from the repo root
// with the dev server up (cd conestruct/site && npm run dev), then:
//   node scripts/verify-whichroad-card.mjs [screenshot-out-dir]
import { chromium } from "playwright";

const TWO_CANDIDATES = {
  candidates: [
    {
      way_id: "111001",
      highway_class: "trunk",
      name: "E Baseline Rd",
      ref: "CO 7",
      bearing: 90,
      snap_distance_m: 8.2,
      snapped_lat: 40.0176,
      snapped_lng: -105.13,
      tags: {
        oneway: "yes", maxspeed: "45 mph", lanes: "2",
        lanes_forward: null, lanes_backward: null,
        turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null,
      },
      signal_distance_m: null,
    },
    {
      way_id: "111002",
      highway_class: "trunk",
      name: "E Baseline Rd",
      ref: "CO 7",
      bearing: 270,
      snap_distance_m: 14.6,
      snapped_lat: 40.0178,
      snapped_lng: -105.13,
      tags: {
        oneway: "yes", maxspeed: "45 mph", lanes: "2",
        lanes_forward: null, lanes_backward: null,
        turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null,
      },
      signal_distance_m: null,
    },
  ],
  primary_index: null,
  isUrban: true,
  placeName: "Lafayette",
};

const outDir = process.argv[2] ?? ".";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("**/api/road-bearing", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TWO_CANDIDATES) }));
await page.goto("http://localhost:3000/sandbox", { waitUntil: "networkidle", timeout: 90000 });
await page.getByText("Pick Location on Map").click();
await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
await page.getByText("+ Or enter coordinates manually").click();
await page.getByLabel("Latitude").fill("40.0176");
await page.getByLabel("Longitude").fill("-105.1300");
await page.waitForSelector("text=Which road?", { timeout: 15000 });

const expanded = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  const rail = [...dialog.querySelectorAll("div")].find((d) =>
    d.className.includes("md:overflow-y-auto"),
  );
  const first = rail.firstElementChild;
  const rows = [...dialog.querySelectorAll("button")].filter((b) =>
    /m from pin · way/.test(b.textContent ?? ""),
  );
  const save = [...dialog.querySelectorAll("button")].find(
    (b) => b.textContent === "Save & Close",
  );
  return {
    cardIsFirstRailBlock:
      first?.textContent?.startsWith("⚠ Which road?") ?? false,
    railBlockOrder: [...rail.children[0].children, ...rail.children]
      .slice(0, 3)
      .map((c) => c.textContent?.slice(0, 16)),
    headerText: first?.textContent?.slice(0, 40),
    rowCount: rows.length,
    rowSample: rows[0]?.textContent,
    awaitingPickMsg: dialog.textContent.includes(
      "pick a road above to load road properties",
    ),
    saveDisabledNow: save?.disabled ?? null, // pre-inc-4: expect false
  };
});
await page.screenshot({ path: `${outDir}/whichroad-expanded.png` });

await page.getByRole("button", { name: /eastbound/i }).first().click();
await page.waitForSelector("text=Change", { timeout: 10000 });
const collapsed = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  return {
    summaryShown: /Detected from OSM: 90/.test(dialog.textContent),
    pickerRowsGone: ![...dialog.querySelectorAll("button")].some((b) =>
      /m from pin · way/.test(b.textContent ?? ""),
    ),
    roadPropsLoaded: dialog.textContent.includes("Speed limit"),
    bearingField: dialog.querySelector(
      'input[aria-label="Direction of travel in degrees"]',
    )?.value,
  };
});
await page.screenshot({ path: `${outDir}/whichroad-collapsed.png` });

await page.getByRole("button", { name: "Change" }).click();
const reexpanded = await page.evaluate(() =>
  [...document.querySelectorAll("button")].filter((b) =>
    /m from pin · way/.test(b.textContent ?? ""),
  ).length,
);

console.log("expanded:", JSON.stringify(expanded));
console.log("collapsed:", JSON.stringify(collapsed));
console.log("re-expanded row count:", reexpanded);
await browser.close();
