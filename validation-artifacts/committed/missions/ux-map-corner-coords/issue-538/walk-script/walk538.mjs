// #538 local walk: apply 39.7401, -104.9811 from the coordinates bar on the
// state view and read the camera from the map itself, then press Enter with
// the pin's own numbers (fold-in (a)) and count the road lookups.
// Adapted from #537's walk537.mjs.
//   node walk538.mjs <worktree> <crops dir> <extra dir> <site url>
// Env: GATE_BYPASS_TOKEN (local value, never printed).
//
// The map is read through React: from the map's container node, walk up the
// fiber tree to the component whose hook list holds a ref to an object with
// getZoom / getCenter (the window's mapRef), and ask that object.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [WT, CROPS, EXTRA, SITE] = process.argv.slice(2);
const require = createRequire(path.join(WT, "scripts", "gate.cjs"));
const { newGatedContext, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const requireMain = createRequire("C:/Users/rtmak/Documents/traffic-control-tool/package.json");
const { chromium } = requireMain("playwright");
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const out = [];
let step = "";

// The camera as the map reports it, or null while the map is not there.
function readCamera(p) {
  return p.evaluate(() => {
    const el = document.querySelector("[role=dialog] .picker-map");
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    let f = key ? el[key] : null;
    for (; f; f = f.return) {
      for (let h = f.memoizedState; h && typeof h === "object" && "next" in h; h = h.next) {
        const m = h.memoizedState?.current;
        if (m && typeof m.getZoom === "function" && typeof m.getCenter === "function") {
          const c = m.getCenter();
          return {
            zoom: Math.round(m.getZoom() * 100) / 100,
            center: [Math.round(c.lng * 10000) / 10000, Math.round(c.lat * 10000) / 10000],
            moving: m.isMoving(),
            loaded: m.loaded(),
          };
        }
      }
    }
    return null;
  });
}

async function settled(p) {
  // flyTo takes about a second or two; wait for the camera to stop.
  for (let i = 0; i < 60; i += 1) {
    await p.waitForTimeout(250);
    const c = await readCamera(p);
    if (c && !c.moving) return c;
  }
  return readCamera(p);
}

async function shoot(p, w, name) {
  // The map and the bar under it, full width of the map column.
  const map = await p.locator("[role=dialog] .picker-map").boundingBox();
  const bar = await p.locator("[role=dialog] [data-testid=coords-bar]").boundingBox();
  const vw = p.viewportSize().width;
  const vh = p.viewportSize().height;
  const x = Math.max(0, map.x);
  const y = Math.max(0, map.y);
  await p.screenshot({
    path: path.join(CROPS, `${w}-${name}.png`),
    clip: { x, y, width: Math.min(map.width, vw - x), height: Math.min(bar.y + bar.height - y, vh - y) },
  });
  await p.screenshot({ path: path.join(EXTRA, `${w}-${name}-window.png`) });
}

for (const [w, h] of SIZES) {
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    let lookups = 0;
    p.on("request", (r) => {
      if (r.url().includes("/api/road-bearing") && r.method() === "POST") lookups += 1;
    });
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.getByRole("button", { name: "Pick on map" }).first().click();
    await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });

    step = "1";
    // 1. The state view, as the window opens.
    await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
    const opening = await settled(p);

    step = "2";
    // 2. Apply 39.7401, -104.9811 from the bar with Enter.
    const bar = p.locator("[role=dialog] [data-testid=coords-bar]");
    await bar.getByRole("button", { name: "Enter coordinates" }).click();
    await bar.getByLabel("Latitude").fill("39.7401");
    await bar.getByLabel("Longitude").fill("-104.9811");
    await bar.getByLabel("Longitude").press("Enter");
    const applied = await settled(p);
    await p.waitForSelector("[data-testid=road-pick-panel], [data-testid=road-lookup-status]", { timeout: 120000 });
    await p.waitForTimeout(2500); // tiles at the new zoom
    const lookupsAfterApply = lookups;
    await shoot(p, w, "applied");

    step = "3";
    // 3. Fold-in (a): reopen and press Enter with the pin's own numbers.
    await bar.getByRole("button", { name: "39.7401, -104.9811" }).click();
    await bar.getByLabel("Latitude").press("Enter");
    await p.waitForTimeout(1500);
    const sameNumbers = { lookupsBefore: lookupsAfterApply, lookupsAfter: lookups, barOpen: (await bar.getByLabel("Latitude").count()) > 0, camera: await settled(p) };

    const rec = { size: `${w}x${h}`, opening, applied, sameNumbers };
    out.push(rec);
    console.log(`${w}x${h}: opening zoom ${opening?.zoom} center ${JSON.stringify(opening?.center)} | applied zoom ${applied?.zoom} center ${JSON.stringify(applied?.center)} | lookups ${lookupsAfterApply} -> same-numbers Enter ${lookups}, bar open ${sameNumbers.barOpen}, zoom ${sameNumbers.camera?.zoom}`);
  } catch (e) {
    console.log(`${w}x${h} ERROR at step ${step} ${oneLine(e).slice(0, 300)}`);
  } finally {
    await b.close();
  }
}
fs.writeFileSync(path.join(CROPS, "walk.json"), `${JSON.stringify(out, null, 1)}\n`, "utf8");
