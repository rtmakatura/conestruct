// #525 local walk: the map window's road list at Colfax and Pennsylvania
// (39.7401, -104.9811), at each size.  Helpers are group 8's
// (validation-artifacts/committed/missions/ux-group8-map-window/walk-script/):
// the site on :3000 with Overpass replayed by overpass-preload.cjs, the stub
// backend on :8000 for the travel words.
//   node walk525.mjs <worktree> <committed crops dir> <tag: before|after>
// Env: GATE_BYPASS_TOKEN (local value; run.ps1 sets it, never printed).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [WT, CROPS, TAG] = process.argv.slice(2);
const require = createRequire(path.join(WT, "scripts", "gate.cjs"));
const { newGatedContext, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(WT, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "http://localhost:3000";
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
const PIN = [39.7401, -104.9811];
fs.mkdirSync(CROPS, { recursive: true });
const out = [];

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}
// Every visible control in the window; Mapbox's own marks are excepted (#505).
async function small(p) {
  return p.evaluate(() => {
    const d = document.querySelector("[role=dialog]");
    const els = [...d.querySelectorAll("button, a[href], input, select, textarea, [role=radio], [role=button], summary")];
    const vis = els.filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; });
    const name = (e) => (e.getAttribute("aria-label") || e.innerText || e.className || e.tagName).toString().replace(/\s+/g, " ").trim().slice(0, 40);
    const under = [], excepted = [];
    for (const e of vis) {
      const r = e.getBoundingClientRect();
      if (r.width >= 44 && r.height >= 44) continue;
      const rec = `${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`;
      if (e.closest(".mapboxgl-ctrl-attrib, .mapboxgl-ctrl-logo, .mapboxgl-ctrl")) excepted.push(rec);
      else under.push(rec);
    }
    return { checked: vis.length, under, excepted };
  });
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
    await p.waitForSelector("[role=dialog]", { timeout: 30000 });
    await p.waitForTimeout(1500);
    const t = p.locator("[role=dialog] button", { hasText: "Or enter coordinates manually" });
    if (await t.count()) await t.click();
    await p.getByLabel("Latitude").fill(String(PIN[0]));
    await p.getByLabel("Longitude").fill(String(PIN[1]));
    await p.waitForSelector("[data-testid=road-pick-panel]", { timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.locator("[data-testid=road-pick-panel]").scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    const file = path.join(CROPS, `${TAG}-${w}-colfax-pennsylvania.png`);
    await p.screenshot({ path: file });
    const rows = await p.evaluate(() => [...document.querySelectorAll("[data-testid=road-pick-panel] [role=radio]")].map((r) => r.innerText.replace(/\n+/g, " / ")));
    const ax = await axeDialog(p);
    const s = await small(p);
    const rec = { size: `${w}x${h}`, inter, rows, axe: ax, small: s, crop: path.basename(file) };
    out.push(rec);
    console.log(`${TAG} ${w}x${h}: Inter ${inter} | rows ${JSON.stringify(rows)} | axe ${ax.length} ${ax.join("; ")} | 44px checked ${s.checked}, under ${s.under.length} ${s.under.join("; ")} | excepted ${s.excepted.join("; ") || "-"}`);
  } catch (e) {
    console.log(`${TAG} ${w}x${h} ERROR ${oneLine(e).slice(0, 300)}`);
  } finally {
    await b.close();
  }
}
// ASCII-only JSON (non-ASCII as \u escapes), so no reader's code page can mis-decode it.
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, `${TAG}-walk.json`), `${ascii}\n`, "utf8");
