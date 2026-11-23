// #543 local walk: the coarse-match notice in the search's floating list,
// at each size.  Adapted from #541's walk541.mjs (the same measure, axe and
// 44 px code; the same crops helper).
//   node walk543.mjs <worktree> <crops dir> <extra dir> <site url> <env file>
// The env file gives GATE_BYPASS_TOKEN when the shell has none (read raw,
// never printed).
//
// One window per size: no pin -> search "Lafayette, CO" (the geocoder
// answers with a town, so the notice shows) -> tap the map under the notice
// (a pin; the notice goes).  The map, the search row, the bar and the
// right panel are measured in each state; axe runs on the dialog in each;
// every control in the search row and its list is measured.
//
// The bearing note is not walked: nothing in the window gives it words
// (rulings.md call 1), so there is no state to open.
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
const COARSE = "That search found a town or area. Tap the map on the road where the work starts.";
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
async function measure(p, noticeText) {
  return p.evaluate((COARSE) => {
    const dlg = document.querySelector("[data-testid=coords-bar]").closest("[role=dialog]");
    const col = dlg.querySelector(".mw-map-col");
    const scroller = col.parentElement;
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
    const map = dlg.querySelector(".picker-map, .mw-map-off");
    const controls = [...search.querySelectorAll("button, input"), ...bar.querySelectorAll("button, input, a")].map((c) => {
      const r = c.getBoundingClientRect();
      return { what: c.tagName === "INPUT" ? "search box" : `button "${c.textContent.trim()}"`, w: r2(r.width), h: r2(r.height) };
    });
    const ls = getComputedStyle(list);
    const note = [...dlg.querySelectorAll("p")].find((e) => e.textContent === COARSE) ?? null;
    const ns = note ? getComputedStyle(note) : null;
    const listBox = ls.display === "none" ? null : box(list);
    return {
      map: box(map),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      search: box(search),
      column: box(col),
      dialog: { w: r2(d.width), h: r2(d.height) },
      scrollHeight: scroller.scrollHeight,
      barText: bar.textContent,
      flow: [...col.children].map((e) => e.className.split(" ")[0]),
      list: listBox ? { ...listBox, position: ls.position, text: list.textContent, overMapPx: r2(listBox.y + listBox.h - box(map).y) } : null,
      notice: note
        ? {
            ...box(note),
            inList: list.contains(note),
            font: `${ns.fontFamily.split(",")[0].replace(/["']/g, "")} ${ns.fontSize}`,
            color: ns.color,
            lines: Math.round((note.clientHeight - parseFloat(ns.paddingTop) - parseFloat(ns.paddingBottom)) / parseFloat(ns.lineHeight)),
          }
        : null,
      controls,
      scrollTop: scroller.scrollTop,
    };
  }, noticeText);
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
    const dlg = p.locator("[role=dialog]");
    const box = dlg.getByLabel("Address, intersection or coordinates search");

    step = "0 open";
    await openWindow(p);
    const inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
    const states = {};
    step = "1 no pin";
    states.noPin = { ...(await measure(p, COARSE)), axe: await axeDialog(p) };
    await shootSearch(p, w, "no-notice", 150);

    step = "2 coarse search";
    await box.fill("Lafayette, CO");
    await box.press("Enter");
    await dlg.getByText(COARSE).waitFor({ timeout: 30000 });
    const coarseCamera = await settled(p);
    await p.waitForTimeout(2000); // tiles at the town's zoom
    states.coarse = { ...(await measure(p, COARSE)), axe: await axeDialog(p) };
    await shootSearch(p, w, "coarse-notice", 150);
    await p.screenshot({ path: path.join(CROPS, `${w}-coarse-notice-window.png`) });
    const afterSearch = { ...posts };

    // Tap the map, as the notice asks: 60 px under the list's lower edge,
    // at the middle of the map (map-space the list does not cover).
    step = "3 tap the map";
    const m = await dlg.locator(".picker-map").boundingBox();
    await p.mouse.click(m.x + m.width / 2, m.y + Math.max(120, (states.coarse.list?.overMapPx ?? 0) + 60));
    await dlg.locator("[data-testid=coords-bar]").getByText("Pin at").waitFor({ timeout: 15000 });
    await settled(p);
    await dlg.locator("[data-testid=road-pick-panel], [data-testid=road-lookup-status]").first().waitFor({ timeout: 120000 });
    await p.waitForTimeout(2500);
    const noticeGone = (await dlg.getByText(COARSE).count()) === 0;
    states.pin = { ...(await measure(p, COARSE)), axe: await axeDialog(p) };
    await p.screenshot({ path: path.join(EXTRA, `${w}-pin-after-tap-window.png`) });

    const keys = Object.keys(states);
    const distinct = (ks, k) => ks.map((s) => JSON.stringify(states[s][k])).filter((v, i, a) => a.indexOf(v) === i).length - 1;
    // Largest change in any of x, y, w, h between the notice not shown and
    // shown, per box.
    const px = (k) => Math.max(...["x", "y", "w", "h"].map((f) => Math.abs((states.coarse[k][f] ?? 0) - (states.noPin[k][f] ?? 0))));
    const rec = {
      size: `${w}x${h}`,
      inter,
      noticeMovesPx: { map: px("map"), search: px("search"), rail: px("rail"), bar: px("bar"), column: px("column"), dialog: px("dialog"), scrollHeight: Math.abs(states.coarse.scrollHeight - states.noPin.scrollHeight) },
      allStatesDistinct: { map: distinct(keys, "map"), search: distinct(keys, "search"), rail: distinct(keys, "rail"), bar: distinct(keys, "bar"), dialog: distinct(keys, "dialog") },
      coarseCamera,
      afterSearch,
      afterTap: { ...posts, noticeGone, barText: states.pin.barText },
      states,
    };
    out.push(rec);
    const ctl = keys.flatMap((s) => states[s].controls);
    const minH = Math.min(...ctl.map((c) => c.h));
    const minW = Math.min(...ctl.map((c) => c.w));
    const n = states.coarse.notice;
    console.log(`${w}x${h}: Inter ${inter} | notice shown vs not, px moved: map ${rec.noticeMovesPx.map} search ${rec.noticeMovesPx.search} rail ${rec.noticeMovesPx.rail} bar ${rec.noticeMovesPx.bar} column ${rec.noticeMovesPx.column} dialog ${rec.noticeMovesPx.dialog} scrollHeight ${rec.noticeMovesPx.scrollHeight} | notice inList ${n?.inList} ${n?.w}x${n?.h} lines ${n?.lines} font ${n?.font} | list ${states.coarse.list ? `${states.coarse.list.position} ${states.coarse.list.w}x${states.coarse.list.h} over map ${states.coarse.list.overMapPx}` : "-"} | flow ${states.coarse.flow.join(",")} | min control ${minW}x${minH} | axe ${keys.map((s) => `${s}:${states[s].axe.length ? states[s].axe.join(",") : 0}`).join(" ")} | geocode POSTs ${afterSearch.geocode} zoom ${coarseCamera?.zoom} | tap: pin "${states.pin.barText}" notice gone ${noticeGone} roads POSTs ${posts.roads}`);
  } catch (e) {
    console.log(`${w}x${h} ERROR at step ${step} ${oneLine(e).slice(0, 300)}`);
  } finally {
    await b.close();
  }
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "walk.json"), `${ascii}\n`, "utf8");
