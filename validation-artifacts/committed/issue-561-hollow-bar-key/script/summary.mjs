// One line per reading of walk-561's measures, and the checks.
//   node summary.mjs > ../measures-summary.txt
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let fails = 0, checks = 0;
const ok = (cond, what) => { checks++; if (!cond) { fails++; console.log(`  FAIL: ${what}`); } };
for (const f of fs.readdirSync(EV).filter((n) => /^measures-(set|unset)-.*\.json$/.test(n)).sort()) {
  const L = JSON.parse(fs.readFileSync(path.join(EV, f), "utf-8"));
  console.log(`\n${f}  viewport ${L.viewport.join("x")}  class ${L.streetClass}  errors ${L.errors.length}${L.backendAnswer ? `  backend ${JSON.stringify(L.backendAnswer)}` : ""}`);
  ok(L.errors.length === 0, "walk errors");
  const f556 = path.join(EV, "..", "missions", "ux-spacing-round", "issue-556", f.replace("measures-", "measures-worst-"));
  const was = fs.existsSync(f556) ? JSON.parse(fs.readFileSync(f556, "utf-8")) : null;
  for (const [name, views] of Object.entries(L.states)) for (const [view, S] of Object.entries(views)) {
    const r = S.atRest;
    const one = (tag, x) => console.log(`  ${name} ${view} ${tag}: body ${x.body.clientHeight}/${x.body.scrollHeight} top ${x.body.scrollTop} below ${x.body.below} more ${x.more} fade ${x.fade ? `${x.fade.on} ${x.fade.height} ${x.fade.position} ends ${x.fade.endsAboveEdgeBy} from the edge` : "none"}${x.note ? ` note ${x.note.lines}l ${x.note.boxTop}-${x.note.boxBottom} whole ${x.note.whole} onTop ${x.note.onTop} covers ${x.note.coversChartBy}` : ""}`);
    one("rest", r);
    console.log(`    sub ${r.sub.lines}l; key (${r.legendLines} lines, foot ${r.footHeight}): ${r.legend.join(" | ")}; hollow ${r.hollowBars} solid ${r.solidBars}; swatch ${r.swatch ? `${r.swatch.w}x${r.swatch.h} ${r.swatch.border}` : "none"}; bar ${r.bar.join(",") || "none"}; axe ${r.axe.length}; under44 ${JSON.stringify(r.under44)}; ${r.families.join(",")}; ${r.sizes.join(",")}`);
    const entry = r.legend.includes("Not checked");
    ok(entry === r.hollowBars > 0, `${name} ${view}: key entry ${entry} but ${r.hollowBars} hollow bars`);
    ok(!entry || (r.swatch && r.swatch.border === r.bar[0]), `${name} ${view}: swatch rule differs from the bar's`);
    ok(r.more === r.body.below > 1, `${name} ${view} rest: more ${r.more} with ${r.body.below} below`);
    ok(Boolean(r.fade) === r.more, `${name} ${view} rest: fade ${Boolean(r.fade)} with more ${r.more}`);
    if (r.fade) ok(r.fade.height === "16px" && Math.abs(r.fade.endsAboveEdgeBy) < 0.51 && r.fade.pointerEvents === "none" && /linear-gradient/.test(r.fade.image), `${name} ${view}: fade ${JSON.stringify(r.fade)}`);
    ok(r.axe.length === 0, `${name} ${view}: axe`);
    ok(r.body.scrollWidth <= r.body.clientWidth, `${name} ${view}: sideways scroll`);
    ok(r.families.length === 1 && r.families[0].includes("Inter"), `${name} ${view}: font ${r.families}`);
    // The same state in #556's round-2 walk (its "night": the same dates
    // and hours): the body is as tall as it was, so the entry cost no room.
    if (was && name.endsWith("-night")) {
      const b556 = was.states[`556-worst-class-${L.streetClass}-night`]?.[view]?.body;
      console.log(`    #556 body ${b556?.clientHeight}/${b556?.scrollHeight}`);
      ok(b556 && b556.clientHeight === r.body.clientHeight && b556.scrollHeight === r.body.scrollHeight, `${name} ${view}: body ${r.body.clientHeight}/${r.body.scrollHeight}, was ${b556?.clientHeight}/${b556?.scrollHeight} in #556`);
    }
    if (r.note) ok(r.note.whole && r.note.onTop, `${name} ${view} rest: note cut or covered`);
    if (S.atEnd) {
      one("end ", S.atEnd);
      ok(!S.atEnd.more && !S.atEnd.fade, `${name} ${view} end: still flagged`);
      ok(S.atEnd.body.scrollHeight === r.body.scrollHeight, `${name} ${view}: scrollHeight moved ${r.body.scrollHeight} -> ${S.atEnd.body.scrollHeight}`);
      if (S.atEnd.note) ok(S.atEnd.note.whole && S.atEnd.note.onTop && S.atEnd.note.coversChartBy === 0, `${name} ${view} end: note`);
      ok(JSON.stringify(S.backAtRest.body) === JSON.stringify(r.body) && S.backAtRest.more === r.more, `${name} ${view}: not the same back at rest`);
    }
  }
}
console.log(`\n${checks} checks, ${fails} failed`);
