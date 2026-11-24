// #556 walk: one line per reading from measures-<label>.json, and the
// checks.  A value that wasn't read prints "not measured", never 0.
//   node summary.mjs > ../measures-summary.txt
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nm = (v) => (v === undefined || v === null ? "not measured" : v);
const INK = "rgb(234, 240, 247)";
const DIM = "rgb(255, 138, 46)";
// WCAG contrast of two rgb() strings.
const lum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map((n) => { const c = n / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };

let readings = 0;
let outline = null;
const failed = [];
for (const label of ["1440", "1198", "390", "390x667", "390x600"]) {
  const f = path.join(EV, `measures-${label}.json`);
  if (!fs.existsSync(f)) { console.log(`${label}: not measured`); continue; }
  const L = JSON.parse(fs.readFileSync(f, "utf8"));
  console.log(`== ${label} (${L.viewport.join("x")}) errors: ${L.errors.length ? L.errors.join(" | ") : "none"}; WHAT section height before the window opened ${nm(L.bandHeightClosed)}, after it closed ${nm(L.bandHeightAfterClose)}`);
  if (L.classUnsetAnswer) console.log(`   the backend's answer with no street class: ${JSON.stringify(L.classUnsetAnswer)}`);
  for (const [state, views] of Object.entries(L.states)) {
    for (const [view, r] of Object.entries(views)) {
      readings += 1;
      const id = `${label} ${state} ${view}`;
      const fail = (why) => failed.push(`${id}: ${why}`);
      const n = r.note;
      const note = !n ? "no note in this view"
        : `note ${n.atRest.lines} line(s), last line ${n.atRest.lastLine.top} to ${n.atRest.lastLine.bottom} in a ${r.body.clientHeight} px box: ${n.atRest.lastLineInside ? "inside" : "CUT"} at rest`
          + (n.atEnd ? `; scrolled to the end (scrollTop ${n.atEnd.scrollTop}) ${n.atEnd.lastLine.top} to ${n.atEnd.lastLine.bottom}: ${n.atEnd.lastLineInside ? "inside" : "CUT"}` : "; the body doesn't scroll");
      const inks = r.yours.map((y) => `${y.cls.replace("whd-yours", "").trim() || "plain"}=${y.bg}/${y.border.replace(/ rgb.*/, "")}`).join(", ");
      console.log(`${id}: window ${r.dialog.w}x${r.dialog.h}; body ${r.body.clientHeight} px, content ${r.body.scrollHeight} px; ${note}`);
      console.log(`   key: ${r.legend.join(" | ")} (${r.legendLines} line(s)); striped days ${r.stripedDays}; notice: ${r.notice ? `"${r.notice.text}" first in body ${r.notice.firstInBody}` : "none"}`);
      console.log(`   your hours: ${r.yoursCount} bar(s): ${inks || "none"}; bands ${r.bands}; track ${nm(r.track)}; columns ${r.cols.length ? r.cols.join(",") : "not measured"}; week rows ${nm(r.weekRows)}`);
      console.log(`   font ${r.families.join(",")}; sizes ${r.sizes.join(",")}; axe ${r.axe ? `${r.axe.length} violation(s)` : "not measured"}; under 44 px ${r.under44 ? r.under44.length : "not measured"}`);
      if (r.keyNoClosures) console.log(`   swatch ${r.keyNoClosures.swatch.w}x${r.keyNoClosures.swatch.h}, ${r.keyNoClosures.swatch.border}, ${r.keyNoClosures.swatch.backgroundImage}`);
      // Checks.
      if (r.axe?.length) fail(`axe ${JSON.stringify(r.axe)}`);
      if (r.under44?.length) fail(`under 44 px ${JSON.stringify(r.under44)}`);
      if (r.families.length !== 1 || !/Inter/.test(r.families[0])) fail(`font ${r.families}`);
      if (r.sizes.some((s) => !["12.5px", "13.5px", "19px"].includes(s))) fail(`size ${r.sizes}`);
      if (r.body.scrollWidth !== r.body.clientWidth) fail("sideways scroll");
      if (r.track !== null && r.track !== 28) fail(`track ${r.track}`);
      if (r.cols.some((c) => c !== 240)) fail(`columns ${r.cols}`);
      if (n && !(n.atRest.lastLineInside || n.atEnd?.lastLineInside)) fail("the note's last line is cut");
      // At rest it must be whole wherever the body doesn't scroll.
      if (n && !r.body.scrolls && !n.atRest.lastLineInside) fail("the note's last line is cut at rest");
      if (n && label === "390" && r.body.scrolls) fail("the body scrolls at 390x844");
      if (Boolean(r.keyNoClosures) !== r.stripedDays > 0) fail("key entry and stripes disagree");
      if (state === "535-class-unset") {
        const hollow = r.yours.find((y) => /dashed/.test(y.border));
        if (hollow) outline = { id, line: hollow.border.replace(/^.*?(rgb.*)$/, "$1"), ground: r.ground };
        if (!r.notice?.firstInBody) fail("no notice on top");
        if (r.yours.some((y) => y.bg === INK || y.bg === DIM || !/dashed/.test(y.border))) fail("a bar carries the inside or outside ink");
      } else if (r.notice) fail("notice with a street class set");
    }
  }
}
console.log(`\n${readings} readings; failed checks: ${failed.length ? `\n${failed.join("\n")}` : "none"}`);

// Round 2: the worst-case wordings (shots-556-worst.mjs), street class set
// and really unset.  Every line of the note must be whole at rest and on top.
let worst = 0;
const worstFailed = [];
console.log("\n== worst-case wordings (measures-worst-<class>-<size>.json)");
for (const label of ["390", "390x667", "390x600", "1440"]) {
  for (const klass of ["set", "unset"]) {
    const f = path.join(EV, `measures-worst-${klass}-${label}.json`);
    if (!fs.existsSync(f)) { console.log(`${label} class ${klass}: not measured`); continue; }
    const L = JSON.parse(fs.readFileSync(f, "utf8"));
    console.log(`-- ${label} (${L.viewport.join("x")}), street class ${klass}; errors: ${L.errors.length ? L.errors.join(" | ") : "none"}${klass === "unset" ? `; street_class in the page's hours request: ${nm(L.hoursRequestStreetClass)}; the backend answered ${L.backendAnswer ? JSON.stringify(L.backendAnswer) : "not measured"}` : ""}`);
    if (L.errors.length) worstFailed.push(`${label} ${klass}: errors`);
    for (const [state, views] of Object.entries(L.states)) {
      for (const [view, r] of Object.entries(views)) {
        worst += 1;
        const id = `${label} ${state} ${view}`;
        const n = r.note;
        const at = (a) => `lines ${a.firstLineTop} to ${a.lastLineBottom}, ${a.whole ? "whole" : "CUT"}, ${a.onTop ? "on top" : "COVERED"}, over the chart's box by ${a.coversChartBy} px`;
        console.log(`${id}: window ${r.dialog.w}x${r.dialog.h}; subtitle ${r.sub.lines} line(s); notice ${r.notice ? "yes" : "no"}; key ${r.legendLines} line(s); source line ${r.source ? "yes" : "no"}; body ${r.body.clientHeight} px, content ${r.body.scrollHeight} px`);
        if (n) console.log(`   note ${n.atRest.lines} line(s) "${n.text}": at rest ${at(n.atRest)}${n.atEnd ? `; scrolled to the end (scrollTop ${n.atEnd.scrollTop}) ${at(n.atEnd)}` : "; the body doesn't scroll"}`);
        console.log(`   font ${r.families.join(",")}; sizes ${r.sizes.join(",")}; axe ${r.axe ? `${r.axe.length} violation(s)` : "not measured"}; under 44 px ${r.under44 ? r.under44.length : "not measured"}`);
        const fail = (why) => worstFailed.push(`${id}: ${why}`);
        if (r.axe?.length) fail("axe");
        if (r.under44?.length) fail("under 44 px");
        if (r.families.length !== 1 || !/Inter/.test(r.families[0])) fail("font");
        if (r.sizes.some((s) => !["12.5px", "13.5px", "19px"].includes(s))) fail(`size ${r.sizes}`);
        if (r.body.scrollWidth !== r.body.clientWidth) fail("sideways scroll");
        if (n && !(n.atRest.whole && n.atRest.onTop)) fail("the note is cut or covered at rest");
        if (n?.atEnd && !(n.atEnd.whole && n.atEnd.onTop && n.atEnd.coversChartBy === 0)) fail("the note is cut, covered or over the chart at the end");
        if ((klass === "unset") !== Boolean(r.notice)) fail("notice and street class disagree");
        if (klass === "unset" && !/^Street class not set/.test(r.sub.text)) fail("subtitle isn't the no-class one");
        if (klass === "unset" && r.yours.some((y) => !/dashed/.test(y.border))) fail("a bar isn't hollow");
      }
    }
  }
}
console.log(`\n${worst} worst-case readings; failed checks: ${worstFailed.length ? `\n${worstFailed.join("\n")}` : "none"}`);
console.log(outline ? `dashed outline ${outline.line} on the window's ground ${outline.ground} (computed colours, ${outline.id}): contrast ${contrast(outline.line, outline.ground)} to 1` : "dashed outline contrast: not measured");
