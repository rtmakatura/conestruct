// #541 local walk: coordinates in the search box and the read-only line,
// at each size.  Adapted from #537's walk537.mjs (size check, 44 px, axe)
// and #538's walk538.mjs (the camera, read from the map itself).
//   node walk541.mjs <worktree> <crops dir> <extra dir> <site url> <env file>
// The env file gives GATE_BYPASS_TOKEN when the shell has none (read raw,
// never printed).
//
// Part A, one window: no pin -> out of range -> swapped ("Did you mean") ->
// the choice taken (pin).  The map, the rail and the bar are measured in
// each state; axe runs on the dialog in each; every control in the search
// row and its list is measured.
// Part B, a fresh page per format: type it, press Enter, wait for the fly
// to stop and the road list to load; record the camera, the road rows and
// the POSTs to /api/geocode (must be 0) and /api/road-bearing.  The road
// service is live: when it doesn't answer, the walk presses the window's
// own Try again and records how often.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [WT, CROPS, EXTRA, SITE, ENVFILE] = process.argv.slice(2);
if (!process.env.GATE_BYPASS_TOKEN && ENVFILE) {
  const m = fs.readFileSync(ENVFILE, "utf8").match(/^\s*GATE_BYPASS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
  if (m) process.env.GATE_BYPASS_TOKEN = m[1];
}
const require = createRequire(path.join(WT, "scripts", "gate.cjs"));
const { newGatedContext, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const requireMain = createRequire("C:/Users/rtmak/Documents/traffic-control-tool/package.json");
const { chromium } = requireMain("playwright");
const AXE = fs.readFileSync(path.join(WT, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
const FORMATS = [
  ["comma-space", "39.7401, -104.9811"],
  ["space", "39.7401 -104.9811"],
  ["comma", "39.7401,-104.9811"],
  ["degrees", "39.7401\u00b0 N, 104.9811\u00b0 W"],
];
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const out = [];
let step = "";

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// Boxes in the dialog's own frame: viewport rect plus the body scroller's
// scrollTop (below md the body scrolls).
async function measure(p) {
  return p.evaluate(() => {
    const dlg = document.querySelector("[data-testid=coords-bar]").closest("[role=dialog]");
    const scroller = dlg.querySelector(".mw-map-col").parentElement;
    const d = dlg.getBoundingClientRect();
    const r2 = (n) => Math.round(n * 100) / 100;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r2(r.left - d.left), y: r2(r.top - d.top + scroller.scrollTop), w: r2(r.width), h: r2(r.height) };
    };
    const bar = dlg.querySelector("[data-testid=coords-bar]");
    const list = dlg.querySelector("[data-testid=search-list]");
    const search = dlg.querySelector(".mw-search");
    const controls = [...search.querySelectorAll("button, input"), ...bar.querySelectorAll("button, input, a")].map((c) => {
      const r = c.getBoundingClientRect();
      return { what: c.tagName === "INPUT" ? "search box" : `button "${c.textContent.trim()}"`, w: r2(r.width), h: r2(r.height) };
    });
    const cs = getComputedStyle(bar);
    const ls = getComputedStyle(list);
    return {
      map: box(dlg.querySelector(".picker-map, .mw-map-off")),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      search: box(search),
      dialog: { w: r2(d.width), h: r2(d.height) },
      scrollHeight: scroller.scrollHeight,
      barText: bar.textContent,
      barFont: `${cs.fontFamily.split(",")[0]} ${cs.fontSize}`,
      barControls: bar.querySelectorAll("button, input, a, form, [tabindex]").length,
      coordsSelect: bar.querySelector(".mw-cbar-coords") ? getComputedStyle(bar.querySelector(".mw-cbar-coords")).userSelect : null,
      list: ls.display === "none" ? null : { ...box(list), position: ls.position, text: list.textContent, font: `${ls.fontFamily.split(",")[0]}` },
      controls,
      scrollTop: scroller.scrollTop,
    };
  });
}

// The camera as the map reports it (the window's mapRef, found through
// React's fiber tree from the map's container node).
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
          };
        }
      }
    }
    return null;
  });
}
async function settled(p) {
  for (let i = 0; i < 60; i += 1) {
    await p.waitForTimeout(250);
    const c = await readCamera(p);
    if (c && !c.moving) return c;
  }
  return readCamera(p);
}

// The search row, its list and `below` px of what is under them.
async function shootSearch(p, w, name, below) {
  const s = await p.locator("[role=dialog] .mw-search").boundingBox();
  const vw = p.viewportSize().width;
  await p.screenshot({ path: path.join(CROPS, `${w}-${name}.png`), clip: { x: Math.max(0, s.x), y: Math.max(0, s.y), width: Math.min(s.width, vw - s.x), height: s.height + below } });
  await p.screenshot({ path: path.join(EXTRA, `${w}-${name}-window.png`) });
}
// The bar with 60 px of map above it and 16 below.
async function shootBar(p, w, name) {
  const r = await p.locator("[role=dialog] [data-testid=coords-bar]").boundingBox();
  const vw = p.viewportSize().width;
  await p.screenshot({ path: path.join(CROPS, `${w}-${name}.png`), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y - 60), width: Math.min(r.width, vw - r.x), height: r.height + 76 } });
  await p.screenshot({ path: path.join(EXTRA, `${w}-${name}-window.png`) });
}

async function openWindow(p) {
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  await p.getByRole("button", { name: "Pick on map" }).first().click();
  await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
  await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
  await settled(p);
  await p.waitForTimeout(1500);
}

for (const [w, h] of SIZES) {
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const posts = { geocode: 0, roads: 0 };
    p.on("request", (r) => {
      if (r.method() !== "POST") return;
      if (r.url().includes("/api/geocode")) posts.geocode += 1;
      if (r.url().includes("/api/road-bearing")) posts.roads += 1;
    });
    const box = p.locator("[role=dialog]").getByLabel("Address, intersection or coordinates search");
    const list = p.locator("[role=dialog] [data-testid=search-list]");

    // ---- Part A: the states, one window ---------------------------------
    step = "A0";
    await openWindow(p);
    const inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
    const placeholder = await box.getAttribute("placeholder");
    const states = {};
    step = "A1";
    states.noPin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootBar(p, w, "no-pin");

    step = "A2";
    await box.fill("139.7401, -104.9811");
    await box.press("Enter");
    await list.getByText("Latitude must be between -90 and 90").waitFor({ timeout: 5000 });
    states.outOfRange = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootSearch(p, w, "out-of-range", 110);

    step = "A3";
    await box.fill("-104.9811, 39.7401");
    await box.press("Enter");
    const choice = list.getByRole("button", { name: "Did you mean 39.7401, -104.9811?" });
    await choice.waitFor({ timeout: 5000 });
    states.didYouMean = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootSearch(p, w, "did-you-mean", 110);
    const beforeChoice = { ...posts };

    step = "A4";
    await choice.click();
    const swapCamera = await settled(p);
    await p.waitForSelector("[data-testid=road-pick-panel], [data-testid=road-lookup-status]", { timeout: 120000 });
    await p.waitForTimeout(2500);
    states.pin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootBar(p, w, "pin");
    const afterChoice = { ...posts, boxValue: await box.inputValue(), camera: swapCamera };

    const keys = Object.keys(states);
    const moves = (k) => keys.map((s) => JSON.stringify(states[s][k])).filter((v, i, a) => a.indexOf(v) === i).length - 1;

    // ---- Part B: each accepted format, a fresh page each ----------------
    const formats = [];
    for (const [name, text] of FORMATS) {
      step = `B ${name}`;
      await openWindow(p);
      const before = { ...posts };
      const opening = await readCamera(p);
      await box.fill(text);
      await box.press("Enter");
      const camera = await settled(p);
      // The road list, or the live road service's "didn't answer" panel:
      // press its Try again (at most 4 times) and count them.
      const panel = p.locator("[role=dialog] [data-testid=road-pick-panel]");
      const again = p.locator("[role=dialog] [data-testid=road-lookup-status]").getByRole("button", { name: "Try again" });
      const roadPostsFirst = posts.roads - before.roads;
      let retries = 0;
      for (;;) {
        await panel.or(again).first().waitFor({ timeout: 120000 });
        if ((await panel.count()) > 0 || retries >= 4) break;
        retries += 1;
        await p.waitForTimeout(4000);
        await again.click();
        await p.waitForTimeout(500);
      }
      await p.waitForTimeout(2500); // tiles at the new zoom
      const rows = await panel.locator("[role=radio]").count();
      const barText = await p.locator("[role=dialog] [data-testid=coords-bar]").textContent();
      formats.push({ name, text, boxValue: await box.inputValue(), opening, camera, rows, barText, geocodePosts: posts.geocode - before.geocode, roadPostsOnEnter: roadPostsFirst, lookupRetries: retries });
      // The window as it stands: the box still holds what was typed, the
      // map is at the pin, the road list is in the rail.  The first format
      // is committed whole; the others (the same window) as a strip from
      // the search row down past the first road rows, the whole in EXTRA.
      const whole = name === FORMATS[0][0];
      await p.screenshot({ path: path.join(whole ? CROPS : EXTRA, `${w}-format-${name}${whole ? "" : "-window"}.png`) });
      if (!whole) {
        const d = await p.locator("[role=dialog]").boundingBox();
        const s = await p.locator("[role=dialog] .mw-search").boundingBox();
        const vw = p.viewportSize().width;
        const vh = p.viewportSize().height;
        // One column: the search row and the map down past the pin.  Two
        // columns: the search row, the top of the map and the road rows.
        const height = Math.min(w < 980 ? 330 : 300, vh - s.y);
        await p.screenshot({ path: path.join(CROPS, `${w}-format-${name}.png`), clip: { x: Math.max(0, d.x), y: s.y, width: Math.min(d.width, vw - Math.max(0, d.x)), height } });
      }
      if (w < 980) {
        // One column: the road list is under the map; scroll it into view.
        await p.locator("[role=dialog] .mw-rail").scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        await p.screenshot({ path: path.join(whole ? CROPS : EXTRA, `${w}-format-${name}-roads.png`) });
      }
    }

    const rec = { size: `${w}x${h}`, inter, placeholder, mapMoves: moves("map"), railMoves: moves("rail"), barMoves: moves("bar"), searchMoves: moves("search"), dialogMoves: moves("dialog"), scrollHeightMoves: moves("scrollHeight"), beforeChoice, afterChoice, states, formats };
    out.push(rec);
    const ctl = keys.flatMap((s) => states[s].controls);
    const minH = Math.min(...ctl.map((c) => c.h));
    const minW = Math.min(...ctl.map((c) => c.w));
    console.log(`${w}x${h}: Inter ${inter} | placeholder "${placeholder}" | moves map ${rec.mapMoves} rail ${rec.railMoves} bar ${rec.barMoves} search ${rec.searchMoves} dialog ${rec.dialogMoves} scrollHeight ${rec.scrollHeightMoves} | bar h ${keys.map((s) => states[s].bar.h).join("/")} controls-in-bar ${keys.map((s) => states[s].barControls).join("/")} | min control ${minW}x${minH} | list ${keys.map((s) => (states[s].list ? `${states[s].list.position} h${states[s].list.h}` : "-")).join(" ")} | axe ${keys.map((s) => `${s}:${states[s].axe.length ? states[s].axe.join(",") : 0}`).join(" ")} | swap: geocode ${afterChoice.geocode} roads ${beforeChoice.roads}->${afterChoice.roads} zoom ${swapCamera?.zoom}`);
    for (const f of formats) console.log(`  ${f.name}: zoom ${f.opening?.zoom} -> ${f.camera?.zoom} center ${JSON.stringify(f.camera?.center)} | road rows ${f.rows} | geocode POSTs ${f.geocodePosts} | road POSTs on Enter ${f.roadPostsOnEnter} (retries ${f.lookupRetries}) | bar "${f.barText}"`);
  } catch (e) {
    console.log(`${w}x${h} ERROR at step ${step} ${oneLine(e).slice(0, 300)}`);
  } finally {
    await b.close();
  }
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "walk.json"), `${ascii}\n`, "utf8");
