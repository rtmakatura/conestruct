// #557: the walk's readings, before against after, one block per size.
//   node summary.mjs > ../measures-summary.txt
// Reads ../measures-before-<size>.json (the base, c7fc482e) and
// ../measures-<size>.json (the final code), and ../hours-row-<mode>.json.
// A reading that is missing prints "not measured".  Exits 1 on any FAILED line.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EV = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(EV, f), "utf8")); } catch { return null; } };
const nm = (v) => (v === null || v === undefined ? "not measured" : v);
const r2 = (n) => Math.round(n * 100) / 100;
let failed = 0;
const fail = (s) => { failed += 1; console.log(`   FAILED ${s}`); };
// #505's exception (Mapbox's logo and attribution links) and the page's own
// header and footer links, which are outside the tool's bands.
const exempt = (x) => x.cls.startsWith("mapboxgl-ctrl-logo") || /^(© |Improve this map)/.test(x.label) || ["conestruct.", "Terms", "Privacy"].includes(x.label);
const hoursB = load("hours-row-before.json");
const hoursA = load("hours-row-after.json");

for (const size of ["1440", "1198", "390"]) {
  const B = load(`measures-before-${size}.json`);
  const A = load(`measures-${size}.json`);
  console.log(`== ${size} (${A ? A.viewport.join("x") : "not measured"}) ==`);
  if (!A || !B) { fail("a measures file is missing"); continue; }
  if (A.errors.length || B.errors.length) fail(`walk errors: before ${JSON.stringify(B.errors)} after ${JSON.stringify(A.errors)}`);

  // d. The collapsed rows.
  for (const id of ["factWhere", "factWhat"]) {
    const b = B[id], a = A[id];
    if (!a || !b) { console.log(` d ${id}: not measured`); fail(`${id} not measured`); continue; }
    console.log(` d ${id}: row ${b.row.h} -> ${a.row.h} px tall; link "${b.link.text}" ${b.link.w} x ${b.link.h} -> "${a.link.text}" ${a.link.w} x ${a.link.h}`);
    console.log(`   type ${b.link.family} ${b.link.size}/${b.link.weight} ${b.link.transform} tracking ${b.link.tracking} -> ${a.link.family} ${a.link.size}/${a.link.weight} ${a.link.transform} tracking ${a.link.tracking}; colour ${a.link.color} (--act ${a.act}); ${a.link.decoration}`);
    console.log(`   label top ${b.label.t} -> ${a.label.t}; value top ${b.value?.t} -> ${a.value?.t}; value left ${b.value?.l} -> ${a.value?.l}; link top in row ${b.link.t} -> ${a.link.t}`);
    if (a.row.h !== b.row.h) fail(`${id} row height ${b.row.h} -> ${a.row.h}`);
    if (a.link.text !== "Change" || a.link.name !== "Change") fail(`${id} text ${a.link.text}`);
    if (a.link.w < 44 || a.link.h < 44) fail(`${id} link ${a.link.w} x ${a.link.h}`);
    if (!/Inter/.test(a.link.family) || a.link.size !== "13.5px" || a.link.weight !== "600" || a.link.transform !== "none" || a.link.color !== "rgb(52, 169, 232)") fail(`${id} type`);
  }

  // e. The small aerial.
  for (const st of Object.keys(A.aerial ?? {})) {
    const a = A.aerial[st], b = B.aerial?.[st];
    if (!a) { console.log(` e ${st}: not measured`); continue; }
    const z = a.boxes.filter((x) => /Zoom|Reset/.test(x.name));
    const zb = (b?.boxes ?? []).filter((x) => /Zoom|Reset/.test(x.name));
    const others = (bx) => bx.filter((x) => !/Zoom|Reset/.test(x.name)).map((x) => `${x.name}[${x.l},${x.t},${x.r},${x.b}]`).join(" ");
    console.log(` e ${st}: frame ${a.frame.w} x ${a.frame.h} (before ${b ? `${b.frame.w} x ${b.frame.h}` : "not measured"}); bar ${a.hasBar}; zoom ${z.length ? z.map((x) => `${x.name} ${x.w}x${x.h} at [${x.l},${x.t}]`).join(", ") : "not shown"}`);
    console.log(`   before: ${zb.length ? zb.map((x) => `${x.name} ${x.w}x${x.h} at [${x.l},${x.t}]`).join(", ") : "not shown"}`);
    // While the picture is being fetched again the frame shows its "held"
    // line and no zoom or key; a run caught in that moment can't be compared
    // box for box with one that wasn't.
    const loading = [["before", b], ["after", a]].filter(([, x]) => x?.boxes.some((y) => y.name === "band-aerial-held")).map(([n]) => n);
    const rest = !b ? "not measured" : loading.length ? `not compared (the picture was still loading in the ${loading.join(" and ")} run)` : others(a.boxes) === others(b.boxes) ? "where it was" : "MOVED";
    console.log(`   overlaps ${a.overlaps.length ? a.overlaps.join("; ") : "0"}; past the frame's edge: ${a.outsideFrame.length ? a.outsideFrame.join(", ") : "none"} (before: ${b ? (b.outsideFrame.length ? b.outsideFrame.join(", ") : "none") : "not measured"}); everything else ${rest}`);
    if (a.overlaps.length) fail(`${st} overlaps ${a.overlaps}`);
    if (z.some((x) => x.w < 44 || x.h < 44)) fail(`${st} zoom under 44`);
    if (b && (a.frame.h !== b.frame.h || a.frame.w !== b.frame.w)) fail(`${st} frame size`);
    if (rest === "MOVED") fail(`${st} another control moved`);
    if (b && a.outsideFrame.join() !== b.outsideFrame.join()) fail(`${st} outside the frame`);
  }
  console.log(`   WHERE section ${nm(B.whereHeightPinned)} -> ${nm(A.whereHeightPinned)} px tall (pinned); with Reset showing ${nm(B.whereHeightZoomed)} -> ${nm(A.whereHeightZoomed)}`);
  if (A.whereHeightPinned !== B.whereHeightPinned || A.whereHeightZoomed !== B.whereHeightZoomed) fail("WHERE height");

  // g. The Default links, and every box in the What section.
  for (const [i, a] of A.what.defaults.entries()) {
    const b = B.what.defaults[i];
    console.log(` g ${a.testid}: box ${b.box[2]} x ${b.box[3]} -> ${a.box[2]} x ${a.box[3]}; box left ${r2(a.box[0] - b.box[0])} px; word moved ${r2(a.wordBox[0] - b.wordBox[0])}, ${r2(a.wordBox[1] - b.wordBox[1])} px; padding ${a.padding}, margin ${a.margin}; ${a.family} ${a.size}`);
    if (a.box[2] < 44 || a.box[3] < 44) fail(`${a.testid} under 44`);
    if (a.wordBox[0] !== b.wordBox[0] || a.wordBox[1] !== b.wordBox[1]) fail(`${a.testid} word moved`);
  }
  if (A.what.defaults.length !== 3) fail(`${A.what.defaults.length} Default links`);
  {
    const kb = Object.keys(B.what.boxes), ka = Object.keys(A.what.boxes);
    const rowKey = ka.find((k) => k.includes("w-hours-row"));
    const rowTop = rowKey ? B.what.boxes[rowKey]?.[1] : null;
    let same = 0, lower8 = 0, other = [];
    for (const k of ka) {
      const a = A.what.boxes[k], b = B.what.boxes[k];
      if (!b) { other.push(`${k} new`); continue; }
      const d = [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]].map(r2);
      if (d.every((x) => x === 0)) same += 1;
      else if (rowTop !== null && b[1] > rowTop && d[0] === 0 && d[1] === 8 && d[2] === 0 && d[3] === 0) lower8 += 1;
      else if (k === rowKey && d[0] === 0 && d[1] === 0 && d[2] === 0 && d[3] === 8) console.log(`   the hours row: ${b[3]} -> ${a[3]} px tall, top unchanged`);
      else other.push(`${k} ${d}`);
    }
    console.log(`   What section boxes (cells, labels, source words, controls, rows): ${ka.length} read (${kb.length} before); ${same} did not move (0 px on every side); ${lower8} under the hours row are 8 px lower, same size; other: ${other.length ? other.join(" | ") : "none"}`);
    console.log(`   What section ${B.what.band[3]} -> ${A.what.band[3]} px tall`);
    if (ka.length !== kb.length || other.length) fail("a What section box moved or changed");
    if (r2(A.what.band[3] - B.what.band[3]) !== 8) fail("What section height is not +8");
  }

  // f. The hours row.
  for (const st of ["outside", "withRecord", "afterUndo"]) {
    const a = A.hours?.[st], b = B.hours?.[st];
    if (!a || !b) { console.log(` f ${st}: not measured`); fail(`${st} not measured`); continue; }
    console.log(` f ${st}: hours row ${b.row.h} -> ${a.row.h} px; Work dates cell ${b.workDatesCell.h} -> ${a.workDatesCell.h} px at y ${b.workDatesCell.y} -> ${a.workDatesCell.y}; row top ${b.row.y} -> ${a.row.y}; link ${a.link.w} x ${a.link.h}; ring ${a.focused ? a.outline : "not focused"}; ring's top edge to the text above the row: ${nm(b.ringTopToInk)} -> ${nm(a.ringTopToInk)}`);
    if (r2(a.row.h - b.row.h) !== 8) fail(`${st} row is not +8`);
    if (a.workDatesCell.h !== b.workDatesCell.h || a.workDatesCell.y !== b.workDatesCell.y || a.row.y !== b.row.y) fail(`${st} Work dates row moved`);
  }
  if (A.hours && new Set(["outside", "withRecord", "afterUndo"].map((s) => A.hours[s]?.row.h)).size !== 1) fail("the hours row changes height between its states");
  for (const [mode, H] of [["before", hoursB], ["after", hoursA]]) {
    const x = H?.sizes?.[size];
    if (!x || x.error) { console.log(`   hours row, ${mode}: not measured`); fail(`hours row ${mode}`); continue; }
    console.log(`   hours row, ${mode}: ${x.row.h} px, align-items ${x.row.align}; link ${x.wrapped ? "wraps under the sentence" : "beside the sentence"}; sentence ink ${x.sentence.ink.t} to ${x.sentence.ink.b}, link box top ${x.link.t} (margin-top ${x.link.marginTop}), link ink top ${x.link.ink.t}; ring's top edge (link top - 4) is ${r2(x.link.t - 4 - x.sentence.ink.b)} px ${x.wrapped ? "from the sentence's ink (negative: it crosses)" : "(not under the sentence)"}; ink tops differ ${x.inkOffset}; record line at ${x.slot.t}, ${x.slot.h} px; What section ${x.bandHeight}`);
  }
  {
    const a = hoursA?.sizes?.[size], b = hoursB?.sizes?.[size];
    if (a && b && !a.error && !b.error) {
      if (r2(a.link.t - b.link.t) !== 8) fail(`link is not 8 px lower (${r2(a.link.t - b.link.t)})`);
      if (a.wrapped && a.link.t - 4 - a.sentence.ink.b < 0) fail("the ring still crosses the sentence");
      if (!a.wrapped && Math.abs(a.inkOffset - b.inkOffset) > 1) fail(`sentence and link came apart by ${r2(a.inkOffset - b.inkOffset)}`);
    }
  }

  // The week columns' bottom.
  const n = A.night, nd = A.nightDay;
  console.log(` week view, 8 pm to 5 am: arrow characters ${nm(n?.arrows)} (weekday view ${nm(nd?.arrows)}); .whd-clip elements ${nm(n?.clipElements)}; your-hours bars ${nm(n?.yourBars)}; columns ${n?.columns?.length ? n.columns.join(",") : "not measured"} px; window ${n?.window?.join(" x ") ?? "not measured"} (before ${B.night?.window?.join(" x ") ?? "not measured"}, columns ${B.night?.columns?.join(",") ?? "not measured"})`);
  if (!n || n.arrows !== 0 || nd?.arrows !== 0 || n.clipElements !== 0) fail("an arrow rendered");
  if (!n || n.columns.join() !== "240" || n.window.join() !== B.night?.window?.join()) fail("the window or its columns changed size");

  // axe and the 44 px measure.
  const axeKeys = Object.keys(A).filter((k) => k.startsWith("axe"));
  console.log(` axe: ${axeKeys.map((k) => `${k.slice(3)} ${A[k].length}`).join(", ")} violation(s)`);
  if (axeKeys.some((k) => A[k].length)) fail("axe");
  for (const k of Object.keys(A).filter((k) => k.startsWith("under44"))) {
    const mine = A[k].filter((x) => !exempt(x));
    const was = (B[k] ?? []).filter((x) => !exempt(x));
    const fmt = (l) => (l.length ? l.map((x) => `${x.label} ${x.w}x${x.h}`).join("; ") : "0");
    console.log(` under 44 px, ${k.slice(7)}: ${fmt(mine)} (before: ${fmt(was)}); exempt and unchanged: ${A[k].filter(exempt).length} (Mapbox's marks, #505; the page's header and footer links)`);
    if (mine.length) fail(`under 44: ${fmt(mine)}`);
  }
}
console.log(failed ? `\n${failed} FAILED` : "\nall checks ok");
process.exit(failed ? 1 : 0);
