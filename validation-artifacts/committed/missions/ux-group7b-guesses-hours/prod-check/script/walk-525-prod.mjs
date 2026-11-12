// #525 production check (mission ux-group7b-guesses-hours #527, main 99d828d).
// Copied from ../../issue-525/walk-script/walk525.mjs (left as it was) with:
//   - SITE pointed at production; the gate token goes in a header only
//     (scripts/gate.cjs newGatedContext), never in a body or a file here;
//   - the churn-replay pins (Colfax/Williams, Lincoln, Speer) read at 1440,
//     so their rows can be compared with plan.md's replay table.
//   node walk-525-prod.mjs <main checkout> <committed crops dir> <extra dir>
// Env: GATE_BYPASS_TOKEN.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS, EXTRA] = process.argv.slice(2);
const require = createRequire(path.join(MAIN, "package.json"));
if (!process.env.GATE_BYPASS_TOKEN) throw new Error("GATE_BYPASS_TOKEN not set");
const { newGatedContext, guardOutput, oneLine } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const RUNS = [
  ["colfax-pennsylvania", [39.7401, -104.9811], [[1440, 900], [1198, 930], [390, 844]]],
  ["colfax-williams", [39.73997, -104.96632], [[1440, 900]]],
  ["lincoln", [39.7345, -104.9862], [[1440, 900]]],
  ["speer", [39.7197, -104.97677], [[1440, 900]]],
];
for (const d of [CROPS, EXTRA]) fs.mkdirSync(d, { recursive: true });
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

for (const [where, PIN, sizes] of RUNS) {
  for (const [w, h] of sizes) {
    const b = await chromium.launch();
    try {
      const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      const errors = [];
      p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
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
      await p.waitForTimeout(3500);
      await p.locator("[data-testid=road-pick-panel]").scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);
      const name = `prod-${w}-${where}.png`;
      const dir = where === "colfax-pennsylvania" ? CROPS : EXTRA;
      await p.screenshot({ path: path.join(dir, name) });
      const rows = await p.evaluate(() => [...document.querySelectorAll("[data-testid=road-pick-panel] [role=radio]")].map((r) => r.innerText.replace(/\n+/g, " / ")));
      const ax = await axeDialog(p);
      const s = await small(p);
      out.push({ where, size: `${w}x${h}`, inter, rows, axe: ax, small: s, console_errors: errors.length, crop: name });
      console.log(`${where} ${w}x${h}: Inter ${inter} | rows ${JSON.stringify(rows)} | axe ${ax.length} ${ax.join("; ")} | 44px checked ${s.checked}, under ${s.under.length} ${s.under.join("; ")} | console errors ${errors.length}`);
    } catch (e) {
      console.log(`${where} ${w}x${h} ERROR ${oneLine(e).slice(0, 300)}`);
    } finally {
      await b.close();
    }
  }
}
// ASCII-only JSON (non-ASCII as \u escapes), so no reader's code page can mis-decode it.
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "prod-walk.json"), `${ascii}\n`, "utf8");
