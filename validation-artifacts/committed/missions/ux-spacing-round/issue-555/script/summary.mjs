// #555: one line per state, view and width from measures-<width>.json, plus
// the checks walk.md quotes.  Read-only.   node summary.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TICKS = ["6 am", "noon", "6 pm", "midnight", "6 am"];
let readings = 0;
let measured44 = 0;
const bad = [];
for (const w of [1440, 1198, 390]) {
  const L = JSON.parse(fs.readFileSync(path.join(EV, `measures-${w}.json`), "utf8"));
  console.log(`\n== ${w}x${L.viewport[1]}  errors: ${L.errors.length}  WHAT band height, window closed, before/after: ${L.bandHeightClosed}/${L.bandHeightAfterClose}`);
  for (const [name, views] of Object.entries(L.states)) {
    for (const view of ["day", "week"]) {
      const o = views[view];
      if (!o) continue;
      readings += 1;
      if (o.under44) measured44 += 1;
      const c = o.chart;
      const ticks = c.ticks.map((t) => t.text);
      const along = view === "day" ? "x" : "y";
      const span = view === "day" ? "w" : "h";
      const share = (b) => `${(((b[along] - c.scale[along]) / c.scale[span]) * 100).toFixed(1)}+${((b[span] / c.scale[span]) * 100).toFixed(1)}`;
      const bars = view === "day" ? c.ruler.yours : (c.week.find((d) => d.yours.length)?.yours ?? []);
      const bands = view === "day" ? c.ruler.bands : (c.week.find((d) => d.bands.length)?.bands ?? []);
      const overlap = c.ticks.some((t, i) => i > 0 && t[along] < c.ticks[i - 1][along] + c.ticks[i - 1][span]);
      const checks = {
        ticks: JSON.stringify(ticks) === JSON.stringify(TICKS),
        ticksInside: c.ticks.every((t) => t.within) && c.caps.every((t) => t.within),
        ticksClear: !overlap,
        midnightStronger: c.ticks[3]?.weight === "600" && c.ticks.filter((t) => t.weight === "400").length === 4,
        midnightLines: c.midnight.length === (view === "day" ? 1 : 7),
        noArrows: c.clipMarks === 0,
        dialog: c.dialog.w === (w === 390 ? 358 : 560) && c.dialog.h === 600,
        scale: view === "day" ? c.scale.h === 28 : c.week.every((d) => d.col.h === 240),
        noSideScroll: c.body.scrollWidth === c.body.clientWidth,
        inter: c.families.length === 1 && /Inter/.test(c.families[0]),
        axe0: o.axe.length === 0,
        // Rule 10: a view the 44 px measure never ran on is not a pass.
        ...(o.under44 ? { under44: o.under44.length === 0 } : {}),
      };
      const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
      if (failed.length) bad.push(`${w} ${name} ${view}: ${failed.join(", ")}`);
      console.log(
        `${name} ${view}: yours [${bars.map((b) => `${share(b)}${/is-out/.test(b.cls) ? " out" : /is-unchecked/.test(b.cls) ? " unchecked" : ""}`).join("; ")}]  bands [${bands.map(share).join("; ")}]` +
          `  caps [${c.caps.map((t) => t.text).join(", ")}]  body ${c.body.scrollHeight}/${c.body.clientHeight}  ${view === "week" ? `column ${c.week[0].col.w}x${c.week[0].col.h}` : `track ${c.scale.w}x${c.scale.h}`}` +
          `  axe ${o.axe.length}  under 44: ${o.under44 ? o.under44.length : "not measured"}  ${failed.length ? `FAILED ${failed.join(", ")}` : "all checks ok"}`,
      );
    }
  }
}
console.log(`\n${readings} readings (${measured44} with the 44 px measure); failed checks: ${bad.length ? bad.join(" | ") : "none"}`);
