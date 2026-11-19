// Mission ux-map-corner-coords (#539) production check, main 89d5f9e.
// The real site and backend, no stubs, read-only (nothing is saved; the bar
// and the pin change only the page's own state).  Built from the items'
// local walks: ../../issue-536/walk-script/walk536.mjs (road rows),
// ../../issue-537/walk-script/walk537.mjs (bar states, boxes, 44 px, axe),
// ../../issue-538/walk-script/walk538.mjs (camera read through React).
//
// Per size, run A: open the map window; no pin; editing; error ("abc");
// then type 39.7401, -104.9811 and press Enter (#538: the camera after the
// fly); the pin state (#537) and the road list (#536, Colfax and
// Pennsylvania); editing over the pin; Esc.  Run B: a fresh page, the
// no-cross-street pin 39.7401, -104.9757, the road list.
//   node walk-539-prod.mjs <main checkout> <crops dir> <extra dir>
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs; never printed.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS, EXTRA] = process.argv.slice(2);
const envText = fs.readFileSync(path.join(MAIN, "conestruct/site/.env.local"), "utf8");
const m = envText.match(/^GATE_BYPASS_TOKEN=(.*)$/m);
if (!m) throw new Error("GATE_BYPASS_TOKEN not in .env.local");
process.env.GATE_BYPASS_TOKEN = m[1].trim().replace(/^["']|["']$/g, "");
const require = createRequire(path.join(MAIN, "package.json"));
const { newGatedContext, guardOutput, oneLine } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
const PIN = [39.7401, -104.9811];
const NOCROSS = [39.7401, -104.9757];
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const out = [];

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// walk537's measure: boxes in the dialog's frame (plus the body scroller's scrollTop).
function measure(p) {
  return p.evaluate(() => {
    const dlg = document.querySelector("[data-testid=coords-bar]").closest("[role=dialog]");
    const scroller = dlg.querySelector(".mw-map-col").parentElement;
    const d = dlg.getBoundingClientRect();
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round((r.left - d.left) * 100) / 100, y: Math.round((r.top - d.top + scroller.scrollTop) * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
    };
    const bar = dlg.querySelector("[data-testid=coords-bar]");
    const controls = [...bar.querySelectorAll("button, input")].map((c) => {
      const r = c.getBoundingClientRect();
      return { what: c.tagName === "INPUT" ? `input ${c.labels?.[0]?.textContent?.trim()}` : `button "${c.getAttribute("aria-label") ?? c.textContent.trim()}"`, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
    });
    return { map: box(dlg.querySelector(".picker-map, .mw-map-off")), rail: box(dlg.querySelector(".mw-rail")), bar: box(bar), barText: bar.textContent, controls };
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
          return { zoom: Math.round(mm.getZoom() * 100) / 100, center: [Math.round(c.lat * 100000) / 100000, Math.round(c.lng * 100000) / 100000], moving: mm.isMoving() };
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

// walk536's row read, plus the resolved --ink-mute of the row.
function readRows(p) {
  return p.evaluate(() => [...document.querySelectorAll("[data-testid=road-pick-panel] [role=radio]")].map((r) => {
    const n = r.querySelector(".road-pick-name");
    const at = r.querySelector(".road-pick-at");
    const sub = r.querySelector(".road-pick-sub");
    const cs = (e) => (e ? getComputedStyle(e) : null);
    const probe = document.createElement("span");
    probe.style.color = "var(--ink-mute)";
    r.appendChild(probe);
    const inkMute = getComputedStyle(probe).color;
    probe.remove();
    return {
      title: n?.textContent ?? null, at: at?.textContent ?? null, sub: sub?.textContent ?? null,
      nameWeight: cs(n)?.fontWeight, nameColor: cs(n)?.color,
      atWeight: cs(at)?.fontWeight ?? null, atColor: cs(at)?.color ?? null,
      subColor: cs(sub)?.color ?? null, inkMute,
      ariaName: r.getAttribute("aria-label") ?? r.textContent,
    };
  }));
}

async function openWindow(b, w, h, sink) {
  const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("console", (msg) => { if (msg.type() === "error") sink.console.push({ text: msg.text().slice(0, 160), url: (msg.location()?.url ?? "").slice(0, 120) }); });
  p.on("requestfailed", (r) => { sink.failed.push(`${new URL(r.url()).host} ${r.failure()?.errorText ?? ""}`); });
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  await p.getByRole("button", { name: "Pick on map" }).first().click();
  await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
  await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  return p;
}

async function shootBar(p, w, state) {
  const r = await p.locator("[role=dialog] [data-testid=coords-bar]").boundingBox();
  const vw = p.viewportSize().width;
  await p.screenshot({ path: path.join(CROPS, `prod-${w}-bar-${state}.png`), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y - 60), width: Math.min(r.width, vw - r.x), height: r.height + 76 } });
  await p.screenshot({ path: path.join(EXTRA, `prod-${w}-${state}-window.png`) });
}

for (const [w, h] of SIZES) {
  const rec = { size: `${w}x${h}`, console: [], failed: [], step: "" };
  let b = await chromium.launch();
  try {
    const p = await openWindow(b, w, h, rec);
    const bar = p.locator("[role=dialog] [data-testid=coords-bar]");
    const states = {};
    rec.step = "no-pin";
    states.noPin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootBar(p, w, "no-pin");
    rec.step = "editing";
    await bar.getByRole("button", { name: "Enter coordinates" }).click();
    await p.waitForTimeout(300);
    states.editing = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootBar(p, w, "editing");
    rec.step = "error";
    await bar.getByLabel("Latitude").fill("abc");
    await bar.getByLabel("Longitude").fill(String(PIN[1]));
    await bar.getByLabel("Longitude").press("Enter");
    await p.waitForTimeout(300);
    states.error = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootBar(p, w, "error");
    rec.step = "apply";
    await bar.getByRole("button", { name: "Enter coordinates" }).click();
    await bar.getByLabel("Latitude").fill(String(PIN[0]));
    await bar.getByLabel("Longitude").fill(String(PIN[1]));
    await bar.getByLabel("Longitude").press("Enter");
    rec.camera = await settled(p);
    await p.waitForSelector("[data-testid=road-pick-panel]", { timeout: 120000 });
    await p.waitForTimeout(2500);
    rec.cameraAfterList = await readCamera(p);
    const map = await p.locator("[role=dialog] .picker-map").boundingBox();
    await p.screenshot({ path: path.join(CROPS, `prod-${w}-applied-map.png`), clip: { x: Math.max(0, map.x), y: Math.max(0, map.y), width: Math.min(map.width, w - Math.max(0, map.x)), height: Math.min(map.height, h - Math.max(0, map.y)) } });
    rec.step = "pin";
    states.pin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootBar(p, w, "pin");
    rec.rowsCorner = await readRows(p);
    const panel = p.locator("[data-testid=road-pick-panel]");
    await panel.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await panel.screenshot({ path: path.join(CROPS, `prod-${w}-list-colfax-pennsylvania.png`) });
    rec.step = "editing-pin";
    await bar.getByRole("button", { name: `${PIN[0]}, ${PIN[1]}` }).click();
    await bar.getByLabel("Latitude").fill("40.1");
    states.editingPin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shootBar(p, w, "editing-pin");
    await bar.getByLabel("Latitude").press("Escape");
    await p.waitForTimeout(300);
    rec.afterEsc = { dialogOpen: await p.locator("[role=dialog]").count(), barText: (await measure(p)).barText };
    const keys = Object.keys(states);
    const distinct = (k) => keys.map((s) => JSON.stringify(states[s][k])).filter((v, i, a) => a.indexOf(v) === i).length - 1;
    rec.states = states;
    rec.mapMoves = distinct("map");
    rec.railMoves = distinct("rail");
    rec.barHeights = keys.map((s) => states[s].bar.h);
    rec.minControl = Math.min(...keys.flatMap((s) => states[s].controls.flatMap((c) => [c.w, c.h])));
    rec.axe = Object.fromEntries(keys.map((s) => [s, states[s].axe]));
  } catch (e) {
    rec.error = `run A at ${rec.step}: ${oneLine(e).slice(0, 300)}`;
  } finally {
    await b.close();
  }
  b = await chromium.launch();
  try {
    rec.step = "no-cross";
    const p = await openWindow(b, w, h, rec);
    const bar = p.locator("[role=dialog] [data-testid=coords-bar]");
    await bar.getByRole("button", { name: "Enter coordinates" }).click();
    await bar.getByLabel("Latitude").fill(String(NOCROSS[0]));
    await bar.getByLabel("Longitude").fill(String(NOCROSS[1]));
    await bar.getByLabel("Longitude").press("Enter");
    await p.waitForSelector("[data-testid=road-pick-panel]", { timeout: 120000 });
    await p.waitForTimeout(2500);
    rec.rowsNoCross = await readRows(p);
    rec.axeNoCross = await axeDialog(p);
    const panel = p.locator("[data-testid=road-pick-panel]");
    await panel.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await panel.screenshot({ path: path.join(CROPS, `prod-${w}-list-no-cross-street.png`) });
  } catch (e) {
    rec.errorB = `run B: ${oneLine(e).slice(0, 300)}`;
  } finally {
    await b.close();
  }
  out.push(rec);
  const c = rec.camera;
  console.log(`${rec.size}: ${rec.error ?? ""}${rec.errorB ?? ""} zoom ${c?.zoom} center ${JSON.stringify(c?.center)} | map moves ${rec.mapMoves} rail moves ${rec.railMoves} | bar h ${rec.barHeights?.join("/")} | min ctl ${rec.minControl} | axe ${JSON.stringify(rec.axe)} nocross ${JSON.stringify(rec.axeNoCross)} | corner rows ${rec.rowsCorner?.map((r) => `[${r.title} / ${r.sub}]`).join(" ")} | nocross ${rec.rowsNoCross?.map((r) => `[${r.title} / ${r.sub}]`).join(" ")} | console ${rec.console.length} failed ${rec.failed.length}`);
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "prod-walk.json"), `${ascii}\n`, "utf8");
