// Prints the production walk's readings (results.json) as text.
//   node summary.mjs <results.json> > measures-summary.txt
import fs from "node:fs";

const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = [];
const say = (s) => out.push(s);
say(`run ${r.ranAt} to ${r.finishedAt}; site ${r.site}; head ${r.headSha}`);
say(`healthz sha ${r.healthz.sha} (equals head: ${r.healthz.equalsHead}); served /api/version sha ${r.served.sha} (equals head: ${r.served.isHead}, ${r.served.polls} poll(s))`);
say(`overall: ${r.pass ? "PASS" : "FAIL"}`);
const bars = (ys) => ys.map((y) => `${y.startPct}%+${y.lengthPct}% (${y.lengthPx} px)${/is-out/.test(y.cls) ? " out" : ""}${/is-unchecked/.test(y.cls) ? " hollow" : ""}${y.crossesMidnight ? " across midnight" : ""}`).join("; ");
const uniq = (xs) => [...new Set(xs)];
const view = (size, part, name, v) => {
  say(` ${part} ${name} ${v.view === "day" ? "weekday ruler" : "week view"}: window ${v.dialog.w}x${v.dialog.h}; body ${v.body.clientHeight} px, content ${v.body.scrollHeight} px, width ${v.body.clientWidth}/${v.body.scrollWidth}`);
  say(`   ticks [${v.ticks.join(", ")}] at ${v.tickAt.join(", ")} px; midnight lines ${v.midnightLines}; clip elements ${v.clipElements}; arrow characters ${v.arrows}`);
  if (v.ruler) say(`   ruler ${v.ruler.track.w}x${v.ruler.track.h}; allowed bands ${v.ruler.bands}; your hours: ${v.ruler.yours.length} piece(s): ${bars(v.ruler.yours)}; midnight at ${v.ruler.yours[0]?.midnightPx ?? "?"} px`);
  if (v.week.length) {
    say(`   days ${v.week.length}; columns ${uniq(v.week.map((d) => d.colH)).join("/")} px; striped days ${v.stripedDays}`);
    for (const d of v.week) say(`     ${d.name}: ${d.yours.length} piece(s)${d.yours.length ? `: ${bars(d.yours)}` : ""}${d.striped ? "; striped" : ""}`);
    const styles = uniq(v.week.flatMap((d) => d.yours.map((y) => `${y.cls.replace("whd-yours", "").trim() || "plain"}=${y.bg}/${y.border}`)));
    say(`   bar styles: ${styles.join(", ") || "none"}`);
  } else if (v.ruler) {
    say(`   bar styles: ${uniq(v.ruler.yours.map((y) => `${y.cls.replace("whd-yours", "").trim() || "plain"}=${y.bg}/${y.border}`)).join(", ")}`);
  }
  say(`   key: ${v.legend.join(" | ")}${v.keyNoClosures ? `; "No closures allowed" entry ${v.keyNoClosures.w}x${v.keyNoClosures.h}, swatch ${v.keyNoClosures.swatch.w}x${v.keyNoClosures.swatch.h}, ${v.keyNoClosures.swatch.border}, ${v.keyNoClosures.swatch.backgroundImage}` : ""}`);
  if (v.notice) say(`   notice "${v.notice.text}": first in body ${v.notice.firstInBody}; ${v.notice.top} to ${v.notice.bottom} px; first bar top ${v.notice.firstBarTop} px; above the bars ${v.notice.aboveBars}`);
  if (v.note) say(`   week note "${v.note.text}" ${v.note.size}: ${v.note.lines} line(s); last line ${v.note.lastLine.top} to ${v.note.lastLine.bottom} px in a ${v.note.bodyHeight} px body (box ${v.note.box.top} to ${v.note.box.bottom}); every line inside ${v.note.everyLineInsideBody}; body inside window ${v.note.bodyInsideWindow}; window inside screen ${v.note.windowInsideScreen}; no sideways overflow ${v.note.noSidewaysOverflow}; body scrolls ${v.note.bodyScrolls}`);
  say(`   sub "${v.sub}"; verdict ${v.verdict ? `"${v.verdict}"` : "none in this view"}; axe ${v.axe.length ? v.axe.join(",") : 0}; under 44 px ${v.under44.length ? v.under44.join("; ") : 0}`);
};
for (const s of r.sizes) {
  say("");
  say(`== ${s.size}  errors: ${s.errors.length ? s.errors.join(" | ") : "none"}; landed on ${s.landedOn}; jurisdiction set by hand: ${s.jurisdictionByHand}`);
  const failed = Object.entries(s.verdict).filter(([, v]) => !v).map(([k]) => k);
  say(` checks: ${Object.keys(s.verdict).length} named, failed: ${failed.length ? failed.join("; ") : "none"}`);
  say(" -- part A: unmodified production data --");
  for (const name of ["day-9-15", "day-7-17", "night-20-5"]) if (s.A[name]) for (const v of [s.A[name].day, s.A[name].week]) view(s.size, "A", name, v);
  const link = (f) => (f ? `"${f.link.innerText}" (text-transform ${f.link.transform}) ${f.link.w} x ${f.link.h} px; ${f.link.family} ${f.link.size}/${f.link.weight}, tracking ${f.link.tracking}, colour ${f.link.color}; row ${f.row.w} x ${f.row.h}` : "NOT READ");
  say(` A  Where row link: ${link(s.A.factWhere)}`);
  say(` A2 What row link:  ${link(s.A.factWhat)}`);
  const z = (a) => (a ? `frame ${a.frame.w} x ${a.frame.h}; ${a.zoom.filter((x) => x.shown).map((x) => `${x.name} "${x.text}" ${x.w} x ${x.h} at [${x.left},${x.top}]`).join(", ") || "zoom not shown"}` : "not read");
  const ae = s.A.aerial ?? {};
  say(` A  aerial, pinned (Where open): ${z(ae.pinned)}`);
  say(` ${ae.zoomShownPinned ? "A " : "A2"} aerial, zoomed in once: ${z(ae.zoomedIn)}`);
  say(` A2 aerial, Where reopened: ${z(ae.reopened)}`);
  for (const d of s.A.defaults ?? []) say(` A  Default link ${d.testid}: ${d.w} x ${d.h} px (the word ${d.wordW} px)`);
  const hr = s.A.hoursRing?.outside;
  if (hr) say(` A  hours link "${hr.link.text}" ${hr.link.w} x ${hr.link.h}, margin-top ${hr.link.marginTop}; focused by keyboard ${hr.focused}; ring ${hr.outline}; ring's top edge to the text in the grid above: ${hr.ringTopToGridTextAbove} px; to the row's own sentence above the link: ${hr.ringTopToRowSentenceAbove}${typeof hr.ringTopToRowSentenceAbove === "number" ? " px" : ""}; hours row ${hr.row.h} px`);
  say(` A  under 44 px: Where section ${JSON.stringify(s.A.aerial?.under44Where)}; What section ${JSON.stringify(s.A.under44What)}; whole page with Where reopened (A2) ${JSON.stringify(s.A.under44Reopened)}`);
  say(` A  axe: Where section ${s.A.aerial?.axeWhere?.length ? s.A.aerial.axeWhere.join(",") : 0}; What section ${s.A.axeWhat?.length ? s.A.axeWhat.join(",") : 0}`);
  say(" -- part B: browser-side edits --");
  say(` edits made: answers with the weekend rewritten to no closures ${s.B.edits?.closuresAnswersRewritten}; requests sent without street_class ${s.B.edits?.classRequestsStripped}`);
  say(` the real backend's answer with no street class: ${JSON.stringify(s.B.classUnsetAnswer)}`);
  for (const name of ["no-closures", "class-unset"]) if (s.B[name]) for (const v of [s.B[name].day, s.B[name].week]) view(s.size, "B", name, v);
  say(" -- the run --");
  say(` console errors ${s.consoleErrors}${s.console.length ? `: ${s.console.map((c) => `[${c.step}] ${c.text}`).join(" | ")}` : ""}; HTTP 429 ${s.http429}; failed requests ${JSON.stringify(s.failedCounts)}`);
  say(` non-GET requests to the site, by part: ${JSON.stringify(s.nonGetCounts)}`);
  say(` served scripts read ${s.scripts?.read}/${s.scripts?.loaded}; sha found in them: ${s.chunkShas.map((x) => x.slice(0, 7)).join(", ") || "none"}; token checks ${s.tokenChecks}, hits ${s.tokenHits}`);
}
process.stdout.write(`${out.join("\n").replace(/[\u0080-￿]/g, (ch) => (ch === " " ? " " : ch))}\n`);
