// s2-arc28 — the finding-5 recount, computed from the archive.
//   node recount-finding5.js [outDir]        (default outProd-22f2f81)
//
// Ryan's ruling of 2026-09-10: "partition at whichever comes later, the
// settle or the landing scroll."  The archived run is NOT re-run and
// NOT edited (log.txt is the record); this script recomputes the L3
// partition over the committed samples/scrolls of every run and prints,
// per run, what the amended partition changes — so the README's recount
// is a measurement against the archive rather than an assertion.
//
// THE CLOCKS.  The sampler's `t` is relative to its own start; the
// scroll census's `at` is relative to the click, and the sampler starts
// some tens of ms after the click.  `max(settledAt, landingAt)` is only
// meaningful in ONE clock, so the shift is recovered per run where the
// archive allows it: a logged post-settle move prints `mt = t + shift`,
// so shift = mt - t.  Runs with no logged move cannot have their shift
// recovered from the archive; for those the script reports the decision
// for the whole plausible band (0..120 ms) and says so if the answer is
// ambiguous within it.
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, process.argv[2] || "outProd-22f2f81");
const LOG = fs.readFileSync(path.join(DIR, "log.txt"), "utf-8");
const TARGET = { "1440x1000": 136, "380x800": 154 };

// arc 26's jumps(), verbatim in behaviour — the monotone run from the
// FIRST movement is the smooth landing; everything after it is a jump.
function jumps(samples) {
  let dir = 0, smoothUntil = 0;
  for (let i = 1; i < samples.length; i++) {
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

// shift = mt - t, recovered from the log's printed post-settle moves.
function shiftFor(label, js, settledAt) {
  const row = LOG.split("\n").find((l) => l.includes(`${label} L3 `));
  if (!row) return null;
  const printed = [...row.matchAll(/@(\d+)ms by re-issue/g)].map((m) => Number(m[1]));
  if (printed.length === 0) return null;
  // Match IN ORDER, not by nearest: the printed list is exactly this
  // run's post-settle moves in sequence, and consecutive samples are
  // ~60 ms apart, so a nearest-value match silently pairs a move with
  // the sample before its own whenever the shift exceeds the sampling
  // interval — which is how this script first read L1's 82 ms shift as
  // 36 ms.  The post-settle moves are the visible moves after the
  // settle, in order.
  const mine = js.visible.filter((v) => v.t > settledAt).map((v) => v.t);
  if (mine.length !== printed.length) return null;
  const shifts = printed.map((p, i) => p - mine[i]).filter((d) => d >= 0 && d <= 300);
  if (shifts.length !== printed.length) return null;
  const uniq = [...new Set(shifts)];
  return uniq.length === 1 ? uniq[0] : Math.round(shifts.reduce((a, b) => a + b, 0) / shifts.length);
}

const rows = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith("-scrolls.json"))) {
  const label = f.replace("-scrolls.json", "");
  const tag = label.startsWith("1440") ? "1440x1000" : "380x800";
  const z = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8"));
  const sp = path.join(DIR, `${label}-samples.json`);
  if (!fs.existsSync(sp) || z.settledAt === null) continue;
  const samples = JSON.parse(fs.readFileSync(sp, "utf-8"));
  const js = jumps(samples);
  const zone = z.zone || [];
  if (zone.length === 0) continue;
  const landingCensus = zone[0].at;
  const shift = shiftFor(label, js, z.settledAt);
  // settle in the CENSUS clock, for the comparison the ruling asks for
  const decide = (sh) => (z.settledAt + sh >= landingCensus ? "settle" : "landing");
  const band = [0, 120].map(decide);
  const later = shift === null ? (band[0] === band[1] ? band[0] : "AMBIGUOUS") : decide(shift);
  const oldPost = js.visible.filter((j) => j.t > z.settledAt);
  // amended: partition at whichever is later, expressed in sample time
  const partSample = later === "landing" ? landingCensus - (shift === null ? 60 : shift) : z.settledAt;
  const newPost = js.visible.filter((j) => j.t > partSample);
  const changed = oldPost.length !== newPost.length;
  rows.push({ label, tag, settledAt: z.settledAt, shift, settleCensus: shift === null ? null : z.settledAt + shift,
    landingCensus, later, oldPost: oldPost.length, newPost: newPost.length, changed,
    preVisible: js.visible.filter((j) => j.t <= partSample).length,
    preScroll: js.scroll.filter((j) => j.t <= partSample).length, smoothEnd: js.smoothEnd });
}

rows.sort((a, b) => a.label.localeCompare(b.label));
console.log("label                  settle(samp)  shift  settle(census)  landing(census)  later    post: old->new  pre(vis/scr)");
for (const r of rows) {
  console.log(
    r.label.padEnd(22),
    String(r.settledAt).padStart(11),
    String(r.shift ?? "-").padStart(6),
    String(r.settleCensus ?? "-").padStart(15),
    String(r.landingCensus).padStart(16),
    " " + r.later.padEnd(8),
    `${r.oldPost} -> ${r.newPost}`.padStart(13),
    `   ${r.preVisible}/${r.preScroll}`,
    r.changed ? "  CHANGED" : "");
}
const changed = rows.filter((r) => r.changed);
console.log(`\n${rows.length} runs recounted; ${changed.length} changed by the amended partition` +
  (changed.length ? ": " + changed.map((r) => r.label).join(", ") : " — the leg totals are unchanged."));
const amb = rows.filter((r) => r.later === "AMBIGUOUS");
if (amb.length) console.log(`AMBIGUOUS within the 0..120 ms shift band: ${amb.map((r) => r.label).join(", ")}`);
