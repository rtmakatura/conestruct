// #541 production check (mission ux-coords-in-search, #542), main 42161dc.
// The real site and backend, no stubs, read-only: nothing is saved; the
// search box and the pin change only the page's own state, and every window
// is closed with Escape.  Built from the local walk
// ../../issue-541/walk-script/walk541.mjs (measure, camera, the states) and
// the previous mission's production check
// ../../../ux-map-corner-coords/prod-check/script/walk-539-prod.mjs (the
// live site, the gate, console and failed requests).
//   node walk-541-prod.mjs <main checkout> <crops dir> <extra dir> <results json> <head sha> <feat sha>
// <head sha> is the shipped main; <feat sha> is #541's own commit (the only
// site change under <head sha>; the commit after it is docs only, so a build
// of either serves the same site).
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs, to the site's
// own host; never printed, never written.
//
// Before any browser: backend healthz sha == <head sha>; the site's
// /api/version sha is <head sha> or <feat sha> (polled up to 10 min).
// Per size, one browser:
//   A  one window: no pin -> out of range -> swapped ("Did you mean") ->
//      the choice taken (pin) -> Escape.
//   B  a fresh page per ruled format: type, Enter, the fly, the road list.
//   C  a fresh page: an ordinary address search (one /api/geocode request).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS, EXTRA, RESULTS, HEAD_SHA, FEAT_SHA] = process.argv.slice(2);
const envText = fs.readFileSync(path.join(MAIN, "conestruct/site/.env.local"), "utf8");
const m = envText.match(/^GATE_BYPASS_TOKEN=(.*)$/m);
if (!m) throw new Error("GATE_BYPASS_TOKEN not in .env.local");
process.env.GATE_BYPASS_TOKEN = m[1].trim().replace(/^["']|["']$/g, "");
const require = createRequire(path.join(MAIN, "package.json"));
const { newGatedContext, guardOutput, oneLine, gateHeaders } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
const FORMATS = [
  ["comma-space", "39.7401, -104.9811"],
  ["space", "39.7401 -104.9811"],
  ["comma", "39.7401,-104.9811"],
  ["degrees", "39.7401° N, 104.9811° W"],
];
const ADDRESS = "E Colfax Ave & Pennsylvania St, Denver";
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ranAt: new Date().toISOString(), site: SITE, headSha: HEAD_SHA, featSha: FEAT_SHA, sizes: [] };
const save = () => {
  const ascii = JSON.stringify(result, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  fs.writeFileSync(RESULTS, `${ascii}\n`, "utf8");
};

// ---- The sha gate -------------------------------------------------------
{
  const hz = await (await fetch(HEALTHZ)).json();
  result.healthz = { status: hz.status, sha: hz.sha, equalsHead: hz.sha === HEAD_SHA };
  console.log(`healthz sha ${String(hz.sha).slice(0, 7)} equals head: ${result.healthz.equalsHead}`);
  if (!result.healthz.equalsHead) { save(); throw new Error("healthz sha is not the shipped main"); }
  const polls = [];
  let ok = false;
  for (let i = 0; i < 40 && !ok; i += 1) {
    let sha = null;
    let status = 0;
    try {
      const r = await fetch(`${SITE}/api/version`, { headers: gateHeaders(SITE), redirect: "manual", cache: "no-store" });
      status = r.status;
      if (r.ok) sha = (await r.json()).sha ?? null;
    } catch (e) {
      status = -1;
    }
    polls.push({ status, sha });
    ok = sha === HEAD_SHA || sha === FEAT_SHA;
    if (!ok) await sleep(15000);
  }
  const last = polls[polls.length - 1];
  result.served = { route: "/api/version", polls: polls.length, status: last.status, sha: last.sha, isHead: last.sha === HEAD_SHA, isFeat: last.sha === FEAT_SHA };
  console.log(`served /api/version sha ${String(last.sha).slice(0, 7)} after ${polls.length} poll(s): head ${result.served.isHead} feat ${result.served.isFeat}`);
  if (!ok) { save(); throw new Error("the served frontend is not the shipped build"); }
}

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// walk541's measure (boxes in the dialog's own frame, plus the body
// scroller's scrollTop), widened to every control in the window.
function measure(p) {
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
    const input = search.querySelector("input");
    const all = [...dlg.querySelectorAll("button, input, a, select, textarea, [role=radio], [role=button], [tabindex]:not([tabindex='-1'])")];
    const controls = [];
    const mapboxException = [];
    for (const c of all) {
      const r = c.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (c === dlg) continue;
      if (c.tagName === "CANVAS") continue; // the map itself
      const label = (c.getAttribute("aria-label") ?? c.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 70);
      const rec = { tag: c.tagName.toLowerCase(), role: c.getAttribute("role"), type: c.getAttribute("type"), cls: String(c.className?.baseVal ?? c.className).slice(0, 60), what: label, w: r2(r.width), h: r2(r.height) };
      // #505: Mapbox's logo and attribution links are a ruled exception.
      if (c.closest(".mapboxgl-ctrl-attrib, .mapboxgl-ctrl-logo") || c.classList.contains("mapboxgl-ctrl-logo")) mapboxException.push(rec);
      else controls.push(rec);
    }
    const ls = getComputedStyle(list);
    return {
      map: box(dlg.querySelector(".picker-map, .mw-map-off")),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      search: box(search),
      dialog: { w: r2(d.width), h: r2(d.height) },
      barText: bar.textContent,
      barControls: bar.querySelectorAll("button, input, a, form, select, textarea, [tabindex], [role=button]").length,
      list: ls.display === "none" ? null : { ...box(list), position: ls.position, text: list.textContent, lines: list.children.length },
      placeholder: input.getAttribute("placeholder"),
      searchLabel: input.getAttribute("aria-label"),
      controls,
      mapboxException,
    };
  });
}

// walk538's camera read: the window's mapRef, found through the React fiber.
function readCamera(p) {
  return p.evaluate(() => {
    const el = document.querySelector("[role=dialog] .picker-map");
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    for (let f = key ? el[key] : null; f; f = f.return) {
      for (let h = f.memoizedState; h && typeof h === "object" && "next" in h; h = h.next) {
        const mm = h.memoizedState?.current;
        if (mm && typeof mm.getZoom === "function" && typeof mm.getCenter === "function") {
          const c = mm.getCenter();
          return { zoom: Math.round(mm.getZoom() * 100) / 100, lat: Math.round(c.lat * 100000) / 100000, lng: Math.round(c.lng * 100000) / 100000, moving: mm.isMoving() };
        }
      }
    }
    return null;
  });
}
async function settled(p) {
  for (let i = 0; i < 80; i += 1) {
    await p.waitForTimeout(250);
    const c = await readCamera(p);
    if (c && !c.moving) return c;
  }
  return readCamera(p);
}
function readRows(p) {
  return p.evaluate(() => [...document.querySelectorAll("[role=dialog] [data-testid=road-pick-panel] [role=radio]")].map((r) => ({
    title: r.querySelector(".road-pick-name")?.textContent ?? null,
    sub: r.querySelector(".road-pick-sub")?.textContent ?? null,
  })));
}
// The largest move, in px, of any edge of the named boxes between two states.
function moved(a, b, keys) {
  const o = {};
  for (const k of keys) {
    o[k] = a[k] && b[k] ? Math.max(...["x", "y", "w", "h"].map((e) => Math.round(Math.abs(a[k][e] - b[k][e]) * 100) / 100)) : null;
  }
  return o;
}
const under44 = (st) => st.controls.filter((c) => c.w < 44 || c.h < 44);

async function clip(p, file, box) {
  const vp = p.viewportSize();
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  await p.screenshot({ path: file, clip: { x, y, width: Math.min(box.width, vp.width - x), height: Math.min(box.height, vp.height - y) } });
}
async function shootBar(p, w, name) {
  const r = await p.locator("[role=dialog] [data-testid=coords-bar]").boundingBox();
  await clip(p, path.join(CROPS, `prod-${w}-bar-${name}.png`), { x: r.x, y: r.y - 24, width: Math.min(r.width, 520), height: r.height + 32 });
  await p.screenshot({ path: path.join(EXTRA, `prod-${w}-${name}-window.png`) });
}
async function shootSearch(p, w, name) {
  const s = await p.locator("[role=dialog] .mw-search").boundingBox();
  await clip(p, path.join(CROPS, `prod-${w}-search-${name}.png`), { x: s.x, y: s.y, width: Math.min(s.width, 620), height: s.height + 70 });
  await p.screenshot({ path: path.join(EXTRA, `prod-${w}-${name}-window.png`) });
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
async function closeWindow(p) {
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
  return p.locator("[role=dialog]").count();
}
// The road list, or the live road service's "didn't answer" panel: press
// its own Try again (at most 4 times) and count them (walk541).
async function roadList(p) {
  const panel = p.locator("[role=dialog] [data-testid=road-pick-panel]");
  const again = p.locator("[role=dialog] [data-testid=road-lookup-status]").getByRole("button", { name: "Try again" });
  let retries = 0;
  for (;;) {
    await panel.or(again).first().waitFor({ timeout: 120000 });
    if ((await panel.count()) > 0 || retries >= 4) break;
    retries += 1;
    await p.waitForTimeout(4000);
    await again.click();
    await p.waitForTimeout(500);
  }
  return retries;
}

for (const [w, h] of SIZES) {
  const rec = { size: `${w}x${h}`, step: "", console: [], failed: [], chunkShas: [] };
  result.sizes.push(rec);
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const reqs = { geocode: 0, roads: 0, saves: 0 };
    p.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.includes("/api/geocode")) reqs.geocode += 1;
      if (u.pathname.includes("/api/road-bearing")) reqs.roads += 1;
    });
    p.on("console", (msg) => { if (msg.type() === "error") rec.console.push({ step: rec.step, text: msg.text().slice(0, 160), url: (msg.location()?.url ?? "").split("?")[0].slice(0, 120) }); });
    p.on("requestfailed", (r) => { rec.failed.push(`${new URL(r.url()).host} ${r.failure()?.errorText ?? ""}`); });
    // The served bundle itself: commit shas carried by the site's own chunks.
    p.on("response", async (r) => {
      try {
        const u = new URL(r.url());
        if (u.host !== new URL(SITE).host || !u.pathname.startsWith("/_next/static/") || !u.pathname.endsWith(".js")) return;
        const t = await r.text();
        for (const s of [HEAD_SHA, FEAT_SHA]) if (t.includes(s) && !rec.chunkShas.includes(s)) rec.chunkShas.push(s);
      } catch { /* a chunk cut off by a navigation */ }
    });
    const box = p.locator("[role=dialog] .mw-search-input");
    const list = p.locator("[role=dialog] [data-testid=search-list]");
    const barLoc = p.locator("[role=dialog] [data-testid=coords-bar]");

    // ---- A: the states, one window -------------------------------------
    rec.step = "A open";
    await openWindow(p);
    const A = {};
    rec.A = A;
    rec.step = "A no-pin";
    A.noPin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootBar(p, w, "no-pin");

    rec.step = "A out-of-range";
    const before2 = { ...reqs };
    await box.fill("139.7401, -104.9811");
    await box.press("Enter");
    await list.locator("p").first().waitFor({ timeout: 5000 });
    await p.waitForTimeout(1500);
    A.outOfRange = { ...(await measure(p)), axe: await axeDialog(p), camera: await readCamera(p) };
    A.outOfRange.geocodeRequests = reqs.geocode - before2.geocode;
    A.outOfRange.roadRequests = reqs.roads - before2.roads;
    A.outOfRange.movedVsNoPin = moved(A.noPin, A.outOfRange, ["map", "bar", "rail", "search", "dialog"]);
    await shootSearch(p, w, "out-of-range");

    rec.step = "A did-you-mean";
    const before3 = { ...reqs };
    await box.fill("-104.9811, 39.7401");
    await box.press("Enter");
    const choice = list.getByRole("button", { name: "Did you mean 39.7401, -104.9811?" });
    await choice.waitFor({ timeout: 5000 });
    await p.waitForTimeout(1500);
    A.didYouMean = { ...(await measure(p)), axe: await axeDialog(p) };
    A.didYouMean.geocodeRequests = reqs.geocode - before3.geocode;
    A.didYouMean.roadRequests = reqs.roads - before3.roads;
    A.didYouMean.movedVsNoPin = moved(A.noPin, A.didYouMean, ["map", "bar", "rail", "search", "dialog"]);
    A.didYouMean.movedVsOutOfRange = moved(A.outOfRange, A.didYouMean, ["map", "bar", "rail", "search", "dialog"]);
    await shootSearch(p, w, "did-you-mean");

    rec.step = "A choice";
    await choice.click();
    await barLoc.getByText("Pin at").waitFor({ timeout: 10000 });
    const camA = await settled(p);
    const retriesA = await roadList(p);
    await p.waitForTimeout(2500);
    A.pin = { ...(await measure(p)), axe: await axeDialog(p), camera: camA, cameraAfterList: await readCamera(p), rows: await readRows(p), lookupRetries: retriesA, boxValue: await box.inputValue() };
    A.pin.geocodeRequests = reqs.geocode - before3.geocode;
    A.pin.roadRequests = reqs.roads - before3.roads;
    A.pin.movedVsNoPin = moved(A.noPin, A.pin, ["map", "bar", "search", "dialog"]);
    A.pin.railMovedVsNoPin = { x: Math.abs(A.pin.rail.x - A.noPin.rail.x), y: Math.abs(A.pin.rail.y - A.noPin.rail.y), w: Math.abs(A.pin.rail.w - A.noPin.rail.w), h: Math.round(Math.abs(A.pin.rail.h - A.noPin.rail.h) * 100) / 100 };
    await shootBar(p, w, "pin");
    rec.step = "A close";
    A.dialogsAfterEscape = await closeWindow(p);

    // ---- B: each ruled format, a fresh page each ------------------------
    rec.formats = [];
    for (const [name, text] of FORMATS) {
      rec.step = `B ${name}`;
      await openWindow(p);
      const before = { ...reqs };
      const opening = await readCamera(p);
      await box.fill(text);
      await box.press("Enter");
      let pinPlaced = true;
      try { await barLoc.getByText("Pin at").waitFor({ timeout: 10000 }); } catch { pinPlaced = false; }
      const camera = await settled(p);
      const roadOnEnter = reqs.roads - before.roads;
      const retries = pinPlaced ? await roadList(p) : 0;
      await p.waitForTimeout(2500);
      const st = await measure(p);
      const f = {
        name, text, boxValue: await box.inputValue(), pinPlaced, opening, camera, cameraAfterList: await readCamera(p),
        rows: await readRows(p), barText: st.barText, barH: st.bar.h, barControls: st.barControls,
        listText: st.list ? st.list.text : null,
        markers: await p.locator("[role=dialog] .picker-map .mapboxgl-marker").count(),
        geocodeRequests: reqs.geocode - before.geocode, roadRequestsOnEnter: roadOnEnter, lookupRetries: retries,
        under44: under44(st), controls: st.controls, mapboxException: st.mapboxException,
      };
      if (name === FORMATS[0][0]) {
        f.axe = await axeDialog(p);
        const panel = p.locator("[role=dialog] [data-testid=road-pick-panel]");
        if ((await panel.count()) > 0) {
          await panel.scrollIntoViewIfNeeded();
          await p.waitForTimeout(400);
          await panel.screenshot({ path: path.join(CROPS, `prod-${w}-roads-${name}.png`) });
        }
      }
      await p.screenshot({ path: path.join(EXTRA, `prod-${w}-format-${name}-window.png`) });
      f.dialogsAfterEscape = await closeWindow(p);
      rec.formats.push(f);
      save();
    }

    // ---- C: an ordinary address search ---------------------------------
    rec.step = "C address";
    await openWindow(p);
    const beforeC = { ...reqs };
    const geo = p.waitForResponse((r) => new URL(r.url()).pathname.includes("/api/geocode"), { timeout: 60000 }).catch(() => null);
    await box.fill(ADDRESS);
    await box.press("Enter");
    const gr = await geo;
    let pinC = true;
    try { await barLoc.getByText("Pin at").waitFor({ timeout: 20000 }); } catch { pinC = false; }
    const camC = await settled(p);
    const retriesC = pinC ? await roadList(p) : 0;
    await p.waitForTimeout(5000);
    const stC = await measure(p);
    rec.address = {
      text: ADDRESS, geocodeRequests: reqs.geocode - beforeC.geocode, geocodeStatus: gr ? gr.status() : null, geocodeMethod: gr ? gr.request().method() : null,
      pinPlaced: pinC, camera: camC, barText: stC.barText, barH: stC.bar.h, listText: stC.list ? stC.list.text : null,
      rows: await readRows(p), lookupRetries: retriesC, axe: await axeDialog(p), under44: under44(stC),
    };
    await shootSearch(p, w, "address");
    rec.address.dialogsAfterEscape = await closeWindow(p);

    // ---- The size's summary ---------------------------------------------
    const states = [A.noPin, A.outOfRange, A.didYouMean, A.pin];
    rec.placeholder = A.noPin.placeholder;
    rec.searchLabel = A.noPin.searchLabel;
    rec.barHeights = [...states.map((s) => s.bar.h), ...rec.formats.map((f) => f.barH), rec.address.barH];
    rec.barControls = [...states.map((s) => s.barControls), ...rec.formats.map((f) => f.barControls)];
    rec.axe = { noPin: A.noPin.axe, outOfRange: A.outOfRange.axe, didYouMean: A.didYouMean.axe, pin: A.pin.axe, formatWithRoads: rec.formats[0].axe, address: rec.address.axe };
    rec.axeViolations = Object.values(rec.axe).reduce((n, v) => n + (v ? v.length : 0), 0);
    const allControls = [...states.flatMap((s) => s.controls), ...rec.formats.flatMap((f) => f.controls)];
    rec.controlsMeasured = allControls.length;
    rec.minControlW = Math.min(...allControls.map((c) => c.w));
    rec.minControlH = Math.min(...allControls.map((c) => c.h));
    rec.under44 = [...states.flatMap(under44), ...rec.formats.flatMap((f) => f.under44), ...rec.address.under44];
    rec.mapboxExceptionCount = A.pin.mapboxException.length;
    rec.requests = { ...reqs };
    rec.step = "done";
  } catch (e) {
    rec.error = `at ${rec.step}: ${oneLine(e).slice(0, 300)}`;
  } finally {
    await b.close();
  }
  rec.consoleErrors = rec.console.length;
  rec.consoleTelemetry = rec.console.filter((c) => /events\.mapbox\.com/.test(`${c.text} ${c.url}`)).length;
  const fails = {};
  for (const f of rec.failed) fails[f] = (fails[f] ?? 0) + 1;
  rec.failedByKind = fails;
  rec.failedTotal = rec.failed.length;
  delete rec.failed;
  save();
  console.log(`${rec.size}: ${rec.error ?? "ok"} | placeholder "${rec.placeholder}" | bar h ${rec.barHeights?.join("/")} | bar controls ${rec.barControls?.join("/")} | oor moved ${JSON.stringify(rec.A?.outOfRange?.movedVsNoPin)} geocode ${rec.A?.outOfRange?.geocodeRequests} list "${rec.A?.outOfRange?.list?.text}" lines ${rec.A?.outOfRange?.list?.lines} | dym moved ${JSON.stringify(rec.A?.didYouMean?.movedVsNoPin)} | choice zoom ${rec.A?.pin?.camera?.zoom} bar "${rec.A?.pin?.barText}" geocode ${rec.A?.pin?.geocodeRequests} | axe ${rec.axeViolations} | min ctl ${rec.minControlW}x${rec.minControlH} under44 ${rec.under44?.length} mapbox-exc ${rec.mapboxExceptionCount} | console ${rec.consoleErrors} (telemetry ${rec.consoleTelemetry}) failed ${rec.failedTotal} | chunk shas ${rec.chunkShas.map((s) => s.slice(0, 7)).join(",")}`);
  for (const f of rec.formats ?? []) console.log(`  ${f.name}: pin ${f.pinPlaced} zoom ${f.opening?.zoom} -> ${f.camera?.zoom} center ${f.camera?.lat}, ${f.camera?.lng} | rows ${f.rows.map((r) => `[${r.title}]`).join(" ")} | geocode ${f.geocodeRequests} | roads on Enter ${f.roadRequestsOnEnter} retries ${f.lookupRetries} | bar "${f.barText}" | closed ${f.dialogsAfterEscape === 0}`);
  if (rec.address) console.log(`  address: geocode ${rec.address.geocodeRequests} (${rec.address.geocodeMethod} ${rec.address.geocodeStatus}) pin ${rec.address.pinPlaced} zoom ${rec.address.camera?.zoom} center ${rec.address.camera?.lat}, ${rec.address.camera?.lng} | bar "${rec.address.barText}" | list "${rec.address.listText}" | rows ${rec.address.rows.map((r) => `[${r.title}]`).join(" ")}`);
  await sleep(20000); // the live map route's 40 requests a minute
}
save();
