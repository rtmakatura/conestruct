// s2-arc28 — the anchor recount, computed from the archive.
//   node recount-anchor.js [outDir]        (default outProd-22f2f81)
//
// Ryan's ruling of 2026-09-10: "Anchor the jump leg's smooth run at the
// landing scrollIntoView, not at the first movement after the click.  An
// anchoring compensation that moves the zone zero pixels is not the
// landing starting; on a cold scan it closed the run before the landing
// existed and the landing's own animation was then counted as
// unattributed post-settle moves." ... "recompute the recount from the
// archive the same way — do not assert it".
//
// So: the archived prod run is NOT re-run and NOT edited (log.txt is the
// record).  This script replays the WHOLE L3 leg — the smooth run, arc
// 26's pre-side rule, the ruled cap of two re-issues and the four
// post-partition conditions — over every committed run of the archive,
// twice: once with arc 26's first-movement anchor, which must reproduce
// the archive's own verdicts and is checked against them, and once with
// the amended landing anchor.  The difference is the recount.
//
// THE CLOCKS, as in recount-finding5.js.  The sampler's `t` is relative
// to its own start; the census's `at` is relative to the click, and the
// sampler starts some tens of ms after the click.  The anchor, the
// partition and the attribution are all meaningless across two clocks,
// so the shift is recovered per run where the archive allows it (a
// logged post-settle move prints `mt = t + shift`, so shift = mt - t).
// Where no move was logged the shift cannot be recovered, and the run is
// replayed across the whole plausible band 0..120 ms; a run whose
// verdict is not constant over that band prints AMBIGUOUS rather than a
// number that depends on a guess.
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, process.argv[2] || "outProd-22f2f81");
const LOG = fs.readFileSync(path.join(DIR, "log.txt"), "utf-8");
const TARGET = { "1440x1000": 136, "380x800": 154 };
const BAND = [0, 20, 40, 60, 80, 100, 120];
const ATTRIB_SLACK_MS = 20;

// s2a28-lr.js `jumps()`, copied so the recount runs the same arithmetic
// the harness runs live.  anchorT === null is arc 26's behaviour.
function jumps(samples, anchorT) {
  const anchored = anchorT !== null && anchorT !== undefined;
  let i0 = 0;
  if (anchored) {
    const k = samples.findIndex((x) => x.t >= anchorT);
    i0 = k < 0 ? Math.max(0, samples.length - 1) : k;
  }
  let dir = 0, smoothUntil = i0;
  for (let i = i0 + 1; i < samples.length; i++) {
    const d = samples[i].scrollY - samples[i - 1].scrollY;
    if (d === 0) { if (dir !== 0) { smoothUntil = i; break; } continue; }
    if (dir === 0) { dir = Math.sign(d); smoothUntil = i; continue; }
    if (Math.sign(d) !== dir) { smoothUntil = i - 1; break; }
    smoothUntil = i;
  }
  const scroll = [], visible = [];
  for (let i = smoothUntil + 1; i < samples.length; i++) {
    const d = samples[i].scrollY - samples[i - 1].scrollY;
    const from = samples[i - 1].results?.vtop ?? 0;
    const to = samples[i].results?.vtop ?? 0;
    const v = to - from;
    if (Math.abs(d) > 40) scroll.push({ t: samples[i].t, d, v: Math.round(v), from, to });
    if (Math.abs(v) > 40) visible.push({ t: samples[i].t, d, v: Math.round(v), from, to });
  }
  return { smoothUntil, smoothEnd: samples[smoothUntil]?.t ?? 0, scroll, visible };
}

// The L3 leg, verbatim in behaviour from s2a28-lr.js.
function l3(samples, z, tag, shift, anchor) {
  const zone = z.zone || [];
  const target = TARGET[tag];
  const landingAt = zone.length ? zone[0].at - shift : null;
  const js = jumps(samples, anchor === "landing" ? landingAt : null);
  const partitionAt = z.settledAt === null ? null : landingAt === null ? z.settledAt : Math.max(z.settledAt, landingAt);
  const post = partitionAt === null ? [] : js.visible.filter((j) => j.t > partitionAt);
  const preVisible = partitionAt === null ? js.visible : js.visible.filter((j) => j.t <= partitionAt);
  const preScroll = partitionAt === null ? js.scroll : js.scroll.filter((j) => j.t <= partitionAt);
  const reissues = zone.length - 1;
  const verdicts = post.map((j, i) => {
    const mt = j.t + shift;
    let idx = 0;
    zone.forEach((zz, zi) => { if (zi > 0 && zz.at <= mt + ATTRIB_SLACK_MS) idx = zi; });
    return { ok: Math.abs(j.to - target) < Math.abs(j.from - target) && idx >= 1 && idx <= 2 && Math.abs(j.to - target) <= 1 && i === post.length - 1 };
  });
  const ok = preScroll.length <= 1 && preVisible.length === 0 && zone.length >= 1 && reissues <= 2 && verdicts.every((v) => v.ok);
  return { ok, smoothEnd: js.smoothEnd, landingAt, partitionAt, pre: preScroll.length, preVis: preVisible.length, post: post.length };
}

function shiftFor(label, samples, settledAt) {
  const row = LOG.split("\n").find((l) => l.includes(label + " L3 "));
  if (!row) return null;
  const printed = [...row.matchAll(/@(\d+)ms by re-issue/g)].map((m) => Number(m[1]));
  if (printed.length === 0) return null;
  const mine = jumps(samples, null).visible.filter((v) => v.t > settledAt).map((v) => v.t);
  if (mine.length !== printed.length) return null;
  const shifts = printed.map((p, i) => p - mine[i]).filter((d) => d >= 0 && d <= 300);
  if (shifts.length !== printed.length) return null;
  const uniq = [...new Set(shifts)];
  return uniq.length === 1 ? uniq[0] : Math.round(shifts.reduce((a, b) => a + b, 0) / shifts.length);
}

// Every check the archived run printed, leg by leg.
const LEGS = ["L1", "L2", "L3", "L4", "N5", "N6", "N10", "F0", "window"];
const checks = [];
for (const line of LOG.split("\n")) {
  const m = line.match(/^\[([^\]]+)\] (PASS|FAIL) (\S+) (L1|L2|L3|L4|N5|N6|N10|window)\b/);
  if (m) { checks.push({ tag: m[1], ok: m[2] === "PASS", label: m[3], leg: m[4] }); continue; }
  // the per-viewport wire capture prints as "<tag>] PASS F0 capture"
  const c = line.match(/^\[([^\]]+)\] (PASS|FAIL) F0 capture\b/);
  if (c) checks.push({ tag: c[1], ok: c[2] === "PASS", label: c[1] + "-F0", leg: "F0" });
}

const rows = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith("-scrolls.json"))) {
  const label = f.replace("-scrolls.json", "");
  const tag = label.startsWith("1440") ? "1440x1000" : "380x800";
  const z = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8"));
  const sp = path.join(DIR, label + "-samples.json");
  if (!fs.existsSync(sp) || z.settledAt === null || !(z.zone || []).length) continue;
  const samples = JSON.parse(fs.readFileSync(sp, "utf-8"));
  const shift = shiftFor(label, samples, z.settledAt);
  const tries = shift === null ? BAND : [shift];
  const olds = tries.map((sh) => l3(samples, z, tag, sh, "click"));
  const news = tries.map((sh) => l3(samples, z, tag, sh, "landing"));
  const oneOld = [...new Set(olds.map((r) => r.ok))];
  const oneNew = [...new Set(news.map((r) => r.ok))];
  const arch = checks.find((c) => c.label === label && c.leg === "L3");
  rows.push({
    label, tag, shift, settledAt: z.settledAt, landingCensus: z.zone[0].at,
    old: olds[0], neu: news[0],
    oldOk: oneOld.length === 1 ? oneOld[0] : null,
    newOk: oneNew.length === 1 ? oneNew[0] : null,
    archived: arch ? arch.ok : null,
  });
}
rows.sort((a, b) => a.label.localeCompare(b.label));

const V = (v) => (v === null ? "AMBIG" : v ? "PASS" : "FAIL");
console.log("The L3 leg replayed over the archive: arc 26's click anchor (must reproduce the log) vs the landing anchor ruled 2026-09-10.\n");
console.log("label                  shift  settle  landing   smoothEnd click→landing   pre/vis/post click→landing    log  click  landing");
for (const r of rows) {
  console.log(
    r.label.padEnd(22),
    String(r.shift === null ? "band" : r.shift).padStart(5),
    String(r.settledAt).padStart(7),
    String(r.landingCensus).padStart(8),
    (r.old.smoothEnd + " → " + r.neu.smoothEnd).padStart(24),
    ("  " + r.old.pre + "/" + r.old.preVis + "/" + r.old.post + " → " + r.neu.pre + "/" + r.neu.preVis + "/" + r.neu.post).padEnd(30),
    V(r.archived).padStart(4),
    V(r.oldOk).padStart(6),
    V(r.newOk).padStart(8),
    r.archived !== r.oldOk ? "  REPLAY DISAGREES WITH THE LOG" : r.oldOk !== r.newOk ? "  CHANGED" : "");
}

const bad = rows.filter((r) => r.archived !== r.oldOk);
const changed = rows.filter((r) => r.oldOk !== r.newOk);
console.log("\nSelf-check: the click-anchored replay reproduces the archived L3 verdict on " + (rows.length - bad.length) + " of " + rows.length + " runs" +
  (bad.length ? " — DISAGREES on " + bad.map((r) => r.label).join(", ") : "."));
console.log("Recount: " + changed.length + " of " + rows.length + " runs change under the landing anchor" +
  (changed.length ? ": " + changed.map((r) => r.label + " " + V(r.oldOk) + "→" + V(r.newOk)).join(", ") : " — the leg totals are unchanged."));
const amb = rows.filter((r) => r.oldOk === null || r.newOk === null);
if (amb.length) console.log("AMBIGUOUS within the 0..120 ms shift band: " + amb.map((r) => r.label).join(", "));

// Per-leg totals, as logged and with L3 substituted by the recount.
console.log("\nPer-leg totals across the archived prod run (outProd-22f2f81):");
console.log("leg      as logged      recounted (landing anchor)");
let ok = 0, okNew = 0, total = 0;
const newFails = [];
for (const leg of LEGS) {
  const mine = checks.filter((c) => c.leg === leg);
  if (!mine.length) continue;
  let a = 0, b = 0;
  for (const c of mine) {
    if (c.ok) a++;
    let nw = c.ok;
    if (leg === "L3") { const r = rows.find((x) => x.label === c.label); if (r) nw = r.newOk === true; }
    if (nw) b++; else newFails.push("[" + c.tag + "] " + c.label + " " + leg);
  }
  ok += a; okNew += b; total += mine.length;
  console.log(leg.padEnd(8) + (a + "/" + mine.length).padEnd(15) + b + "/" + mine.length + (b !== a ? "   <- changed" : ""));
}
console.log("TOTAL".padEnd(8) + (ok + "/" + total).padEnd(15) + okNew + "/" + total);
console.log("\nRESULT line as archived : " + (LOG.split("\n").find((l) => l.startsWith("RESULT")) || "").trim());
console.log("RESULT line recounted   : RESULT " + (okNew === total ? "ALL PASS " : "FAIL ") + okNew + "/" + total +
  (okNew === total ? "" : " — " + newFails.join(", ")));
