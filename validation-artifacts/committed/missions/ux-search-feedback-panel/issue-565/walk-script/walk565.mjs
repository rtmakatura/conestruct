// #565 local walk: the search's messages in the right panel's box, at each
// size.  Adapted from #543's walk543.mjs (the same measure, axe and 44 px
// code).
//   node walk565.mjs <worktree> <crops dir> <extra dir> <site url> <env file>
// The env file gives GATE_BYPASS_TOKEN when the shell has none (read raw,
// never printed).
//
// /api/geocode and /api/road-bearing are answered in the browser (stubs
// below), so no geocoder and no road service is called.  The map's tiles
// are live Mapbox.
//
// One window per size.  No pin -> each message in turn (town, weak match,
// out of range, "Did you mean", no match, outside Colorado) -> a search
// held open (the box is gone while it runs) -> the town again, then a tap
// on the map (a pin; the box goes, the roads list) -> a weak match with
// the pin (the box over the road list).  The map, the search row, the bar,
// the footer, the head and the right panel are measured in every state;
// axe runs on the dialog in every state; every control is measured.
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
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const out = [];
let step = "";

const HOLLY = { lat: 38.053441, lng: -102.122704, placeType: "address", weak: true, placeName: "39 North Main Street, Holly, Colorado 81047" };
const TOWN = { lat: 39.9936, lng: -105.0897, placeType: "place" };
const road = (way_id, name, bearing, dist) => ({
  way_id, highway_class: "primary", name, ref: null, bearing, snap_distance_m: dist,
  snapped_lat: 39.9936, snapped_lng: -105.0897,
  tags: { oneway: "no", maxspeed: "30 mph", lanes: "4", lanes_forward: null, lanes_backward: null, lanes_both_ways: null, turn_lanes: null, turn_lanes_forward: null, turn_lanes_backward: null },
  signal_distance_m: null,
  travel: { travel: "both_ways", carriageway: "undivided" },
});
const ROADS = { scan_status: "ok", candidates: [road("201", "S Public Rd", 0, 6), road("202", "E Baseline Rd", 90, 14)], primary_index: null, isUrban: true, placeName: "Lafayette" };

// The six messages: [state, typed text, the geocoder stub's answer (null:
// the text never reaches it), the box's lines].
const MESSAGES = [
  ["town", "Lafayette, CO", { status: 200, json: TOWN }, ["That search found a town or area, not a street.", "Tap the map on the road where the work starts. The roads near your tap show up here."]],
  ["weak-match", "39 N, 44.4", { status: 200, json: HOLLY }, ["Closest match: 39 North Main Street, Holly, Colorado 81047.", "Check the pin before you go on."]],
  ["out-of-range", "139.7401, -104.9811", null, ["Latitude must be between -90 and 90"]],
  ["did-you-mean", "-104.9811, 39.7401", null, ["Did you mean 39.7401, -104.9811?"]],
  ["no-match", "Lafayete, CO", { status: 404, text: "check spelling" }, ["No match in Colorado for that city.", "Check the spelling."]],
  ["outside-colorado", "Cheyenne, WY", { status: 422, text: "outside colorado" }, ["Plans cover Colorado roads only."]],
];

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// Boxes in the dialog's own frame: viewport rect plus the body scroller's
// scrollTop for what is inside the scroller (below md the body scrolls).
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
      const inScroller = scroller.contains(el);
      return { x: r2(r.left - d.left), y: r2(r.top - d.top + (inScroller ? scroller.scrollTop : 0)), w: r2(r.width), h: r2(r.height) };
    };
    const map = dlg.querySelector(".picker-map, .mw-map-off");
    const fb = dlg.querySelector("[data-testid=search-feedback]");
    const fs_ = getComputedStyle(fb);
    const shown = fs_.display !== "none";
    const fbRect = fb.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    const foot = dlg.querySelector(".mw-foot");
    const footRect = foot.getBoundingClientRect();
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    // Anything that is not the map's own, drawn over the map: every element
    // of the dialog with position absolute or fixed that overlaps it.
    const overMap = [...dlg.querySelectorAll("*")].filter((e) => {
      if (map.contains(e)) return false;
      const s = getComputedStyle(e);
      if (s.position !== "absolute" && s.position !== "fixed") return false;
      if (s.display === "none" || s.visibility === "hidden") return false;
      return overlap(e.getBoundingClientRect(), mapRect) > 0;
    }).map((e) => e.className || e.tagName);
    const controls = [...dlg.querySelectorAll("button, input, a[href], [role=radio]")].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !map.contains(c);
    }).map((c) => {
      const r = c.getBoundingClientRect();
      return { what: c.tagName === "INPUT" ? "search box" : `"${(c.getAttribute("aria-label") || c.textContent).trim().slice(0, 40)}"`, w: r2(r.width), h: r2(r.height) };
    });
    const mapControls = [...map.querySelectorAll("button")].map((c) => {
      const r = c.getBoundingClientRect();
      return { what: `map "${c.getAttribute("aria-label") || c.title}"`, w: r2(r.width), h: r2(r.height) };
    });
    const style = (e) => {
      const s = getComputedStyle(e);
      return { text: e.textContent, tag: e.tagName.toLowerCase(), font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, color: s.color, h: r2(e.getBoundingClientRect().height), w: r2(e.getBoundingClientRect().width) };
    };
    const section = dlg.querySelector("[data-testid=road-section]");
    return {
      map: box(map),
      search: box(dlg.querySelector(".mw-search")),
      bar: box(dlg.querySelector("[data-testid=coords-bar]")),
      foot: box(foot),
      head: box(dlg.querySelector(".mw-head")),
      rail: box(dlg.querySelector(".mw-rail")),
      column: box(col),
      dialog: { x: 0, y: 0, w: r2(d.width), h: r2(d.height) },
      scrollHeight: scroller.scrollHeight,
      scrollTop: scroller.scrollTop,
      barText: dlg.querySelector("[data-testid=coords-bar]").textContent,
      flow: [...col.children].map((e) => e.className.split(" ")[0]),
      statusInColumn: col.querySelectorAll("[role=status]").length,
      overMap,
      feedback: shown
        ? {
            ...box(fb),
            role: fb.getAttribute("role"),
            inRail: !!fb.closest(".mw-rail"),
            ground: fs_.backgroundColor,
            overlapsMapPx2: r2(overlap(fbRect, mapRect)),
            // Where the box is on the screen as the window opens (no scroll).
            viewport: { top: r2(fbRect.top), bottom: r2(fbRect.bottom), footTop: r2(footRect.top), visiblePx: r2(Math.max(0, Math.min(fbRect.bottom, footRect.top) - fbRect.top)) },
            lines: [...fb.children].map(style),
          }
        : null,
      titleFont: getComputedStyle(dlg.querySelector(".mw-title")).fontFamily,
      section: [...section.children].filter((e) => getComputedStyle(e).display !== "none").map((e) => `${e.tagName.toLowerCase()}.${e.className.split(" ")[0]}: ${e.textContent.slice(0, 40)}`),
      sectionShown: getComputedStyle(section).display !== "none",
      controls,
      mapControls,
    };
  });
}

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
          return { zoom: Math.round(m.getZoom() * 100) / 100, moving: m.isMoving() };
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

// WCAG contrast of two "rgb(r, g, b)" colours.
function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.match(/[\d.]+/g).slice(0, 3).map((v) => {
      const s = Number(v) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
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
    // The stubs.  `answer` is what the geocoder says next; `hold` keeps a
    // search open until it is released.
    let answer = { status: 404, text: "" };
    let hold = null;
    const posts = { geocode: 0, roads: 0 };
    await p.route("**/api/geocode", async (route) => {
      posts.geocode += 1;
      if (hold) await hold;
      const a = answer;
      if (a.json) await route.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.json) });
      else await route.fulfill({ status: a.status, contentType: "text/plain", body: a.text });
    });
    await p.route("**/api/road-bearing", async (route) => {
      posts.roads += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ROADS) });
    });
    const dlg = p.locator("[role=dialog]");
    const input = dlg.getByLabel("Address, intersection or coordinates search");
    const fb = dlg.locator("[data-testid=search-feedback]");
    const shoot = async (name) => {
      // The whole window as it is on screen (extra), then the right panel
      // alone (committed).  The panel's shot may scroll the body at 390, so
      // the scroll is put back.
      await p.screenshot({ path: path.join(EXTRA, `${w}-${name}-window.png`) });
      await dlg.locator(".mw-rail").screenshot({ path: path.join(CROPS, `${w}-${name}.png`) });
      await p.evaluate(() => { document.querySelector("[role=dialog] .mw-map-col").parentElement.scrollTop = 0; });
    };
    const search = async (text) => {
      await input.fill(text);
      await input.press("Enter");
    };

    step = "0 open";
    await openWindow(p);
    const inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
    const states = {};
    step = "no-pin";
    states["no-pin"] = { ...(await measure(p)), axe: await axeDialog(p) };
    await shoot("no-pin");

    const textOk = {};
    for (const [name, text, stub, lines] of MESSAGES) {
      step = name;
      if (stub) answer = stub;
      const before = posts.geocode;
      await search(text);
      await fb.getByText(lines[0]).waitFor({ timeout: 30000 });
      await settled(p);
      await p.waitForTimeout(name === "town" ? 2500 : 400); // the town's tiles
      states[name] = { ...(await measure(p)), axe: await axeDialog(p), geocodePosts: posts.geocode - before };
      textOk[name] = JSON.stringify(states[name].feedback.lines.map((l) => l.text)) === JSON.stringify(lines);
      await shoot(name);
      if (name === "town") await p.screenshot({ path: path.join(CROPS, `${w}-town-window.png`) });
    }

    // A new search starts: the box is gone while it runs.
    step = "searching";
    let release;
    hold = new Promise((r) => { release = r; });
    answer = { status: 200, json: TOWN };
    await search("Lafayette, CO");
    await dlg.getByRole("button", { name: "Searching…" }).waitFor({ timeout: 15000 });
    states.searching = { ...(await measure(p)), axe: await axeDialog(p) };
    await p.screenshot({ path: path.join(EXTRA, `${w}-searching-window.png`) });
    release();
    hold = null;
    await fb.getByText(MESSAGES[0][3][0]).waitFor({ timeout: 30000 });
    await settled(p);

    // A pin is placed: tap the middle of the map.  The box goes; the roads
    // (the stub's two) list.
    step = "pin";
    const m = await dlg.locator(".picker-map").boundingBox();
    await p.mouse.click(m.x + m.width / 2, m.y + m.height / 2);
    await dlg.locator("[data-testid=coords-bar]").getByText("Pin at").waitFor({ timeout: 15000 });
    await dlg.locator("[data-testid=road-pick-panel]").waitFor({ timeout: 30000 });
    await settled(p);
    await p.waitForTimeout(800);
    states.pin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shoot("pin-box-gone");

    // A weak match with the pin: the box sits over the road list.
    step = "pin-weak-match";
    answer = { status: 200, json: HOLLY };
    await search("39 N, 44.4");
    await fb.getByText(MESSAGES[1][3][0]).waitFor({ timeout: 30000 });
    await p.waitForTimeout(400);
    states["pin-weak-match"] = { ...(await measure(p)), axe: await axeDialog(p) };
    await shoot("pin-weak-match");

    // "Did you mean" is a real button: take it (with the pin already there).
    step = "take the choice";
    await search("-104.9811, 39.7401");
    const choice = fb.getByRole("button", { name: "Did you mean 39.7401, -104.9811?" });
    await choice.waitFor({ timeout: 15000 });
    const choiceBox = await choice.boundingBox();
    await choice.click();
    await dlg.locator("[data-testid=coords-bar]").getByText("Pin at 39.7401, -104.9811").waitFor({ timeout: 15000 });
    await settled(p);
    const afterChoice = await measure(p);

    const keys = Object.keys(states);
    const FIXED = ["map", "search", "bar", "foot", "head", "column", "dialog"];
    // The largest change in any of x, y, w, h across every state, per box.
    const moved = (k, ks = keys) => Math.max(...["x", "y", "w", "h"].map((f) => {
      const vs = ks.map((s) => states[s][k][f]);
      return Math.round((Math.max(...vs) - Math.min(...vs)) * 100) / 100;
    }));
    const noPinKeys = keys.filter((k) => !k.startsWith("pin"));
    const msgKeys = MESSAGES.map((x) => x[0]).concat(["pin-weak-match"]);
    const ctl = keys.flatMap((s) => states[s].controls.map((c) => ({ ...c, state: s })));
    const under44 = ctl.filter((c) => c.w < 44 || c.h < 44).map((c) => `${c.state}: ${c.what} ${c.w}x${c.h}`).filter((v, i, a) => a.indexOf(v) === i);
    const mapCtl = states["no-pin"].mapControls;
    const ground = states.town.feedback.ground;
    const rec = {
      size: `${w}x${h}`,
      inter,
      movedPx: Object.fromEntries(FIXED.map((k) => [k, moved(k)])),
      railMovedPx: { allStates: moved("rail"), noPinStates: moved("rail", noPinKeys) },
      scrollHeight: Object.fromEntries(keys.map((s) => [s, states[s].scrollHeight])),
      overMap: Object.fromEntries(keys.map((s) => [s, states[s].overMap])),
      statusInColumn: Math.max(...keys.map((s) => states[s].statusInColumn)),
      feedbackOverlapsMapPx2: Math.max(...msgKeys.map((s) => states[s].feedback.overlapsMapPx2)),
      textOk,
      // Every line of every box is in the window heading's font family.
      fontAsHeading: msgKeys.every((k) => states[k].feedback.lines.every((l) => l.font === states[k].titleFont)),
      font: states.town.titleFont,
      boxGone: { searching: states.searching.feedback === null, pin: states.pin.feedback === null, afterChoice: afterChoice.feedback === null },
      contrast: {
        ground,
        firstLine: contrast(states.town.feedback.lines[0].color, ground),
        secondLine: contrast(states.town.feedback.lines[1].color, ground),
        choice: contrast(states["did-you-mean"].feedback.lines[0].color, ground),
      },
      choiceButton: { w: Math.round(choiceBox.width * 100) / 100, h: Math.round(choiceBox.height * 100) / 100 },
      under44,
      minControl: { w: Math.min(...ctl.map((c) => c.w)), h: Math.min(...ctl.map((c) => c.h)) },
      mapControls: mapCtl,
      axe: Object.fromEntries(keys.map((s) => [s, states[s].axe])),
      posts,
      states,
    };
    out.push(rec);
    console.log(`${w}x${h}: Inter ${inter} font as heading ${rec.fontAsHeading} (${rec.font}) | moved px across ${keys.length} states: ${FIXED.map((k) => `${k} ${rec.movedPx[k]}`).join(" ")} | rail ${rec.railMovedPx.allStates} (no-pin states ${rec.railMovedPx.noPinStates}) | over the map: ${JSON.stringify([...new Set(keys.flatMap((s) => states[s].overMap))])} status in column ${rec.statusInColumn} box/map overlap ${rec.feedbackOverlapsMapPx2} | text ok ${Object.values(textOk).every(Boolean)} | box gone: searching ${rec.boxGone.searching} pin ${rec.boxGone.pin} choice taken ${rec.boxGone.afterChoice} | contrast ${rec.contrast.firstLine} ${rec.contrast.secondLine} choice ${rec.contrast.choice} | choice ${rec.choiceButton.w}x${rec.choiceButton.h} | under 44: ${under44.length ? under44.join("; ") : "none"} | map controls ${mapCtl.map((c) => `${c.w}x${c.h}`).join(",")} | axe ${keys.map((s) => `${s}:${states[s].axe.length ? states[s].axe.join(",") : 0}`).join(" ")} | posts geocode ${posts.geocode} roads ${posts.roads}`);
  } catch (e) {
    console.log(`${w}x${h} ERROR at step ${step} ${oneLine(e).slice(0, 400)}`);
  } finally {
    await b.close();
  }
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "walk.json"), `${ascii}\n`, "utf8");
