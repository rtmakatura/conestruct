// #537 local walk: the coordinates bar's four states at each size, with
// the size check (the map and the rail in every state), the 44 px measure
// and axe.  Adapted from #536's walk536.mjs.
//   node walk537.mjs <worktree> <crops dir> <extra dir> <site url>
// Env: GATE_BYPASS_TOKEN (local value, never printed).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [WT, CROPS, EXTRA, SITE] = process.argv.slice(2);
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

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// Boxes in the dialog's own frame: viewport rect plus the body scroller's
// scrollTop (below md the body scrolls; a focused box may scroll it).
async function measure(p) {
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
      return { what: c.tagName === "INPUT" ? `input ${c.labels?.[0]?.textContent?.trim()}` : `button "${c.getAttribute("aria-label") ?? c.textContent.trim()}"`, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, overflows: c.tagName === "INPUT" ? c.scrollWidth > c.clientWidth : null };
    });
    const says = [...bar.querySelectorAll(".mw-cbar-say")].map((s) => ({ text: s.textContent, clipped: s.scrollHeight > s.clientHeight + 1, h: Math.round(s.getBoundingClientRect().height) }));
    const cs = getComputedStyle(bar);
    return {
      map: box(dlg.querySelector(".picker-map, .mw-map-off")),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      barText: bar.textContent,
      barFont: `${cs.fontFamily.split(",")[0]} ${cs.fontSize}`,
      controls,
      says,
      scrollTop: scroller.scrollTop,
    };
  });
}

async function shoot(p, w, state) {
  const bar = p.locator("[role=dialog] [data-testid=coords-bar]");
  const r = await bar.boundingBox();
  const vw = p.viewportSize().width;
  // The bar with 60 px of map above it and 16 below, full width of its column.
  await p.screenshot({ path: path.join(CROPS, `${w}-${state}.png`), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y - 60), width: Math.min(r.width, vw - r.x), height: r.height + 76 } });
  await p.screenshot({ path: path.join(EXTRA, `${w}-${state}-window.png`) });
}

for (const [w, h] of SIZES) {
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
    const inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
    await p.getByRole("button", { name: "Pick on map" }).first().click();
    await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
    await p.waitForTimeout(2500);
    const bar = p.locator("[role=dialog] [data-testid=coords-bar]");
    const states = {};

    step = "1";
    // 1. No pin.
    states.noPin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shoot(p, w, "no-pin");

    step = "2";
    // 2. Editing (from no pin).
    await bar.getByRole("button", { name: "Enter coordinates" }).click();
    await p.waitForTimeout(300);
    states.editing = { ...(await measure(p)), axe: await axeDialog(p), focus: await p.evaluate(() => document.activeElement?.labels?.[0]?.textContent?.trim() ?? null) };
    await shoot(p, w, "editing");

    step = "3";
    // 3. Error: not numbers in Latitude, Enter.
    await bar.getByLabel("Latitude").fill("abc");
    await bar.getByLabel("Longitude").fill("-104.9811");
    await bar.getByLabel("Longitude").press("Enter");
    await p.waitForTimeout(300);
    states.error = { ...(await measure(p)), axe: await axeDialog(p) };
    await shoot(p, w, "error");

    step = "4";
    // 4. Pin: reopen (the typed text is kept), paste the pair into
    // Latitude, Enter.
    await bar.getByRole("button", { name: "Enter coordinates" }).click();
    const kept = await bar.getByLabel("Latitude").inputValue();
    await bar.getByLabel("Latitude").fill("");
    await bar.getByLabel("Latitude").evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", "39.7401, -104.9811");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await p.waitForTimeout(200);
    const pasted = [await bar.getByLabel("Latitude").inputValue(), await bar.getByLabel("Longitude").inputValue()];
    await bar.getByLabel("Latitude").press("Enter");
    await p.waitForSelector("[data-testid=road-pick-panel], [data-testid=road-lookup-status]", { timeout: 120000 });
    await p.waitForTimeout(2500);
    states.pin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shoot(p, w, "pin");

    step = "5";
    // 5. Editing over a pin, then Esc (the window must stay open).
    await bar.getByRole("button", { name: "39.7401, -104.9811" }).click();
    await bar.getByLabel("Latitude").fill("40.1");
    states.editingPin = { ...(await measure(p)), axe: await axeDialog(p) };
    await shoot(p, w, "editing-pin");
    await bar.getByLabel("Latitude").press("Escape");
    await p.waitForTimeout(300);
    const afterEsc = { dialogOpen: await p.locator("[role=dialog]").count(), barText: (await measure(p)).barText };

    const keys = Object.keys(states);
    const moved = (k) => keys.map((s) => JSON.stringify(states[s][k])).filter((v, i, a) => a.indexOf(v) === i).length - 1;
    const rec = { size: `${w}x${h}`, inter, kept, pasted, afterEsc, mapMoves: moved("map"), railMoves: moved("rail"), barMoves: moved("bar"), states };
    out.push(rec);
    const minCtl = Math.min(...keys.flatMap((s) => states[s].controls.flatMap((c) => [c.w, c.h])));
    console.log(`${w}x${h}: Inter ${inter} | map ${JSON.stringify(states.noPin.map)} distinct-after-first ${rec.mapMoves} | rail ${JSON.stringify(states.noPin.rail)} distinct ${rec.railMoves} | bar h ${keys.map((s) => states[s].bar.h).join("/")} | min control ${minCtl} | axe ${keys.map((s) => `${s}:${states[s].axe.length}`).join(" ")} | kept "${kept}" pasted ${pasted.join(",")} | esc open ${afterEsc.dialogOpen}`);
  } catch (e) {
    console.log(`${w}x${h} ERROR at step ${step} ${oneLine(e).slice(0, 300)}`);
  } finally {
    await b.close();
  }
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "walk.json"), `${ascii}\n`, "utf8");
