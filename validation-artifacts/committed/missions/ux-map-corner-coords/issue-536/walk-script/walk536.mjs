// #536 local walk: the map window's road list at three pins, at each size.
// Adapted from #525's walk525.mjs (ux-group7b-guesses-hours/issue-525/walk-script/).
//   node walk536.mjs <worktree> <crops dir> <site url>
// Env: GATE_BYPASS_TOKEN (local value, never printed).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [WT, CROPS, SITE] = process.argv.slice(2);
const require = createRequire(path.join(WT, "scripts", "gate.cjs"));
const { newGatedContext, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const requireMain = createRequire("C:/Users/rtmak/Documents/traffic-control-tool/package.json");
const { chromium } = requireMain("playwright");
const AXE = fs.readFileSync(path.join(WT, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
const PINS = [
  ["colfax-pennsylvania", 39.7401, -104.9811],
  ["colfax-humboldt", 39.7401, -104.9696],
  ["no-cross-street", 39.7401, -104.9757],
];
fs.mkdirSync(CROPS, { recursive: true });
const out = [];

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

for (const [w, h] of SIZES) {
  for (const [tag, lat, lng] of PINS) {
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
      await p.getByLabel("Latitude").fill(String(lat));
      await p.getByLabel("Longitude").fill(String(lng));
      await p.waitForSelector("[data-testid=road-pick-panel]", { timeout: 90000 });
      await p.waitForTimeout(2500);
      const panel = p.locator("[data-testid=road-pick-panel]");
      await panel.scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(CROPS, `${w}-${tag}.png`) });
      await panel.screenshot({ path: path.join(CROPS, `${w}-${tag}-list.png`) });
      const rows = await p.evaluate(() => [...document.querySelectorAll("[data-testid=road-pick-panel] [role=radio]")].map((r) => {
        const n = r.querySelector(".road-pick-name");
        const at = r.querySelector(".road-pick-at");
        const sub = r.querySelector(".road-pick-sub");
        const cs = (e) => (e ? getComputedStyle(e) : null);
        return {
          title: n?.textContent ?? null,
          at: at?.textContent ?? null,
          sub: sub?.textContent ?? null,
          nameWeight: cs(n)?.fontWeight, nameColor: cs(n)?.color, nameSize: cs(n)?.fontSize, nameFamily: cs(n)?.fontFamily.split(",")[0],
          atWeight: cs(at)?.fontWeight ?? null, atColor: cs(at)?.color ?? null, atSize: cs(at)?.fontSize ?? null,
          subColor: cs(sub)?.color,
          titleLines: n ? Math.round(n.getBoundingClientRect().height / parseFloat(cs(n).lineHeight)) : null,
          rowH: Math.round(r.getBoundingClientRect().height),
        };
      }));
      const names = await p.evaluate(() => [...document.querySelectorAll("[data-testid=road-pick-panel] [role=radio]")].map((r) => r.textContent));
      const ax = await axeDialog(p);
      const accNames = [];
      for (const r of await p.locator("[data-testid=road-pick-panel] [role=radio]").all()) {
        const snap = await r.evaluate((e) => e.getAttribute("aria-label"));
        accNames.push(snap);
      }
      const tree = await p.locator("[data-testid=road-pick-panel]").ariaSnapshot();
      const rec = { size: `${w}x${h}`, pin: tag, lat, lng, inter, rows, textNames: names, ariaLabels: accNames, ariaSnapshot: tree, axe: ax };
      out.push(rec);
      console.log(`${w}x${h} ${tag}: Inter ${inter} | axe ${ax.length} ${ax.join("; ")} | ${rows.map((r) => `[${r.title} / ${r.sub}] lines ${r.titleLines}`).join(" ; ")}`);
    } catch (e) {
      console.log(`${w}x${h} ${tag} ERROR ${oneLine(e).slice(0, 300)}`);
    } finally {
      await b.close();
    }
  }
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "walk.json"), `${ascii}\n`, "utf8");
