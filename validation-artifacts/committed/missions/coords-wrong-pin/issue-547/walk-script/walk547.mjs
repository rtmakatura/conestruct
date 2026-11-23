// #547 local walk: the search's floating list before and after the dead
// bearing-note slot is deleted.  Adapted from #543's walk543.mjs (the same
// measure and axe code, the same gate helper).
//   node walk547.mjs <worktree> <out dir> <site url> <env file>
//   node walk547.mjs --compare <before walk.json> <after walk.json>
// The env file gives GATE_BYPASS_TOKEN when the shell has none (read raw,
// never printed).
//
// One window per size, three states: no pin (the list has no line) ->
// search "Lafayette, CO" (the geocoder answers with a town, so the
// coarse-match notice shows) -> search "139.7401, -104.9811" (latitude out
// of range, so the refusal line shows).  In each state the list's HTML and
// box, and the map, search row, right panel, bar, column and dialog boxes
// are recorded, and axe runs on the dialog.  --compare reads two runs and
// prints the largest px difference and whether the list's HTML is the same.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const STATES = ["noPin", "coarse", "outOfRange"];
const BOXES = ["map", "search", "rail", "bar", "column", "dialog", "list"];

if (process.argv[2] === "--compare") {
  const [a, b] = process.argv.slice(3).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  for (const before of a) {
    const after = b.find((r) => r.size === before.size);
    let px = 0;
    const htmlSame = [];
    for (const s of STATES) {
      for (const k of BOXES) {
        const x = before.states[s][k];
        const y = after.states[s][k];
        if (!x !== !y) { px = Infinity; continue; }
        if (!x) continue;
        for (const f of ["x", "y", "w", "h"]) px = Math.max(px, Math.abs((x[f] ?? 0) - (y[f] ?? 0)));
      }
      px = Math.max(px, Math.abs(before.states[s].scrollHeight - after.states[s].scrollHeight));
      htmlSame.push(before.states[s].listHtml === after.states[s].listHtml && before.states[s].listDisplay === after.states[s].listDisplay);
    }
    const whole = JSON.stringify(before.states) === JSON.stringify(after.states);
    console.log(`${before.size}: largest px difference ${px} | list HTML the same in ${htmlSame.filter(Boolean).length} of ${STATES.length} states | every recorded value the same ${whole} | axe before ${STATES.map((s) => before.states[s].axe.length).join(",")} after ${STATES.map((s) => after.states[s].axe.length).join(",")}`);
  }
  process.exit(0);
}

const [WT, OUT, SITE, ENVFILE] = process.argv.slice(2);
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
fs.mkdirSync(OUT, { recursive: true });
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
    const ls = getComputedStyle(list);
    return {
      map: box(dlg.querySelector(".picker-map, .mw-map-off")),
      search: box(dlg.querySelector(".mw-search")),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      column: box(col),
      dialog: { w: r2(d.width), h: r2(d.height) },
      list: ls.display === "none" ? null : box(list),
      listDisplay: ls.display,
      listHtml: list.outerHTML,
      listChildren: list.children.length,
      scrollHeight: scroller.scrollHeight,
      barText: bar.textContent,
      flow: [...col.children].map((e) => e.className.split(" ")[0]),
    };
  });
}

// The window's map, found through React's fiber tree from its container.
function mapMoving(p) {
  return p.evaluate(() => {
    const el = document.querySelector("[role=dialog] .picker-map");
    if (!el) return false;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    let f = key ? el[key] : null;
    for (; f; f = f.return) {
      for (let h = f.memoizedState; h && typeof h === "object" && "next" in h; h = h.next) {
        const m = h.memoizedState?.current;
        if (m && typeof m.getZoom === "function" && typeof m.isMoving === "function") return m.isMoving();
      }
    }
    return false;
  });
}
async function settled(p) {
  for (let i = 0; i < 60; i += 1) {
    await p.waitForTimeout(250);
    if (!(await mapMoving(p))) return;
  }
}

// The search row, its list and 150 px of what is under them.
async function shootSearch(p, w, name) {
  const s = await p.locator("[role=dialog] .mw-search").boundingBox();
  const vw = p.viewportSize().width;
  await p.screenshot({ path: path.join(OUT, `${w}-${name}.png`), clip: { x: Math.max(0, s.x), y: Math.max(0, s.y), width: Math.min(s.width, vw - s.x), height: s.height + 150 } });
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
    // Which code was served: does any script the page loaded still name the
    // deleted state?  (A dev build keeps variable names; `coarseNotice`, the
    // state beside it, is the control that the window's script was read.)
    const scripts = [];
    p.on("response", (r) => {
      if (!/\/_next\/.*\.js/.test(r.url())) return;
      scripts.push(r.text().then((t) => [t.includes("bearingWarning"), t.includes("coarseNotice")], () => [false, false]));
    });
    const dlg = p.locator("[role=dialog]");
    const box = dlg.getByLabel("Address, intersection or coordinates search");

    step = "0 open";
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    await p.getByRole("button", { name: "Pick on map" }).first().click();
    await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
    await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
    await settled(p);
    await p.waitForTimeout(1500);
    const inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
    const states = {};

    step = "1 no pin";
    states.noPin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootSearch(p, w, "no-line");

    step = "2 coarse search";
    await box.fill("Lafayette, CO");
    await box.press("Enter");
    await dlg.getByText(COARSE).waitFor({ timeout: 30000 });
    await settled(p);
    await p.waitForTimeout(2000); // tiles at the town's zoom
    states.coarse = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootSearch(p, w, "coarse-notice");

    step = "3 out of range";
    await box.fill("139.7401, -104.9811");
    await box.press("Enter");
    await dlg.locator("[data-testid=search-list] .mw-note-fail").waitFor({ timeout: 15000 });
    await p.waitForTimeout(500);
    states.outOfRange = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootSearch(p, w, "out-of-range");

    const read = await Promise.all(scripts);
    const named = read.filter((r) => r[0]).length;
    const control = read.filter((r) => r[1]).length;
    out.push({ size: `${w}x${h}`, inter, posts, scriptsLoaded: scripts.length, scriptsNamingBearingWarning: named, scriptsNamingCoarseNotice: control, states });
    console.log(`${w}x${h}: Inter ${inter} | ${STATES.map((s) => `${s}: list ${states[s].list ? `${states[s].list.w}x${states[s].list.h}` : states[s].listDisplay} children ${states[s].listChildren} map ${states[s].map.y},${states[s].map.h} bar ${states[s].bar.y} axe ${states[s].axe.length ? states[s].axe.join(",") : 0}`).join(" | ")} | geocode POSTs ${posts.geocode} roads POSTs ${posts.roads} | scripts ${scripts.length}, naming bearingWarning ${named}, naming coarseNotice ${control}`);
  } catch (e) {
    console.log(`${w}x${h} ERROR at step ${step} ${oneLine(e).slice(0, 300)}`);
  } finally {
    await b.close();
  }
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(OUT, "walk.json"), `${ascii}\n`, "utf8");
