// #279 tiebreaker, step 2 — A-5 km versus B (+place=locality), per pin.
//
//   node tiebreak-279.js <derivedPinsJson> <outDir>
//
// THE SAMPLE.  Seven urban reference pins from memory.md, plus every rural
// control DERIVED from its road by derive-pins-279.js — pins that sit on
// the named highway by construction (way id reported) and at least
// 4,000 m from any place node, so a "rural" control controls for what it
// claims to.
//
// SCORED: plains and mountain only.  UNSCORED: the pins the derivation
// REJECTED for sitting close to a place node.  Those are the ambiguous
// middle — a highway 562 m from Fort Lupton is not obviously urban or
// rural — and asserting an expectation for them would measure the
// author's assumption rather than the predicate.  Their verdicts are
// still reported, because where the two candidates DISAGREE is the
// information.
//
// ONE FETCH PER PIN serves both candidates: every place node within 8 km,
// filtered by distance and class per candidate.  The difference between
// the two columns is therefore a property of the predicates, not the hour.
const fs = require("fs");
const path = require("path");

const DERIVED = process.argv[2];
const OUT = process.argv[3] || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "tiebreak-log.txt"), s + "\n"); };

const UA = "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const URBAN = new Set(["city", "town", "suburb", "neighbourhood"]);
const URBAN_PLUS_LOCALITY = new Set([...URBAN, "locality"]);

const URBAN_PINS = [
  { name: "e-bayaud",    lat: 39.71466,  lng: -104.94071,  expect: "urban", ctx: "urban", src: "memory.md; #279's pin" },
  { name: "e-colfax",    lat: 39.73997,  lng: -104.96632,  expect: "urban", ctx: "urban", src: "memory.md" },
  { name: "lakewood",    lat: 39.7113,   lng: -105.0815,   expect: "urban", ctx: "urban", src: "memory.md (control)" },
  { name: "northglenn",  lat: 39.886,    lng: -104.9811,   expect: "urban", ctx: "urban", src: "memory.md" },
  { name: "thornton",    lat: 39.8680,   lng: -104.9847,   expect: "urban", ctx: "urban", src: "memory.md" },
  { name: "greeley",     lat: 40.404292, lng: -104.715863, expect: "urban", ctx: "urban", src: "memory.md" },
  { name: "denver-demo", lat: 39.7269,   lng: -104.9873,   expect: "urban", ctx: "urban", src: "#256 demo pin" },
];

function hav(aLat, aLng, bLat, bLng) {
  const R = 6371008.8, r = (d) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function places(pin) {
  const q = `[out:json][timeout:25];node(around:8000,${pin.lat},${pin.lng})["place"];out tags center;`;
  for (const url of MIRRORS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
        body: `data=${encodeURIComponent(q)}`,
        signal: ctl.signal,
      });
      if (!r.ok) { log(`      ${url} -> HTTP ${r.status}`); continue; }
      const j = await r.json();
      if (j && Array.isArray(j.elements)) return j.elements.filter((e) => e.tags?.place && typeof e.lat === "number");
    } catch (e) {
      log(`      ${url} -> ${e.name === "AbortError" ? "timeout 25s" : e.name}`);
    } finally { clearTimeout(timer); }
  }
  return null;
}

const verdict = (ps, pin, radius, classes) =>
  ps.some((p) => classes.has(p.tags.place) && hav(pin.lat, pin.lng, p.lat, p.lon) <= radius);

(async () => {
  const derived = JSON.parse(fs.readFileSync(DERIVED, "utf-8"));
  const scored = [
    ...URBAN_PINS,
    ...derived.filter((d) => d.ok).map((d) => ({ ...d, expect: "rural" })),
  ];
  // The derivation's rejects, kept as the unscored ambiguous bucket.
  const unscored = derived.filter((d) => !d.ok && d.lat != null).map((d) => ({ ...d, expect: null }));

  log("#279 tiebreaker — A-5 km vs B(+locality), per pin");
  log("started " + new Date().toISOString());
  log(`scored: ${scored.length} pins (${scored.filter((p) => p.expect === "urban").length} urban, ${scored.filter((p) => p.expect === "rural").length} rural)`);
  log(`unscored (ambiguous, near a place node): ${unscored.length}`);
  log("");

  const rows = [];
  for (const pin of [...scored, ...unscored]) {
    const ps = await places(pin);
    if (ps === null) { log(`[${pin.name}] FETCH FAILED — omitted, not guessed`); rows.push({ ...pin, fetched: false }); continue; }
    const cur = verdict(ps, pin, 3000, URBAN);
    const a5 = verdict(ps, pin, 5000, URBAN);
    const b = verdict(ps, pin, 3000, URBAN_PLUS_LOCALITY);
    rows.push({ name: pin.name, ctx: pin.ctx, expect: pin.expect, fetched: true, current: cur, A_5km: a5, B_locality: b, way_id: pin.way_id ?? null, places: ps.length });
    const m = (v) => (v ? "URBAN" : "rural");
    const ok = (v) => (pin.expect === null ? "  " : (v ? "urban" : "rural") === pin.expect ? "ok" : "MISS");
    log(`[${pin.name}] ${pin.expect ?? "(unscored)"}  ctx=${pin.ctx}  places=${ps.length}` + (pin.way_id ? `  way=${pin.way_id}` : ""));
    log(`    current(3km) ${m(cur)} ${ok(cur)}    A-5km ${m(a5)} ${ok(a5)}    B(+loc) ${m(b)} ${ok(b)}`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  const done = rows.filter((r) => r.fetched && r.expect);
  const tally = (key) => {
    const u = done.filter((r) => r.expect === "urban");
    const rr = done.filter((r) => r.expect === "rural");
    return {
      urban: `${u.filter((r) => r[key]).length}/${u.length}`,
      rural: `${rr.filter((r) => !r[key]).length}/${rr.length}`,
      flips: rr.filter((r) => r[key]).map((r) => r.name),
      missed: u.filter((r) => !r[key]).map((r) => r.name),
    };
  };
  log("");
  log("=====================================================================");
  log("SCORED RESULT — plains and mountain controls only");
  log("=====================================================================");
  for (const [label, key] of [["current (3 km)", "current"], ["A — 5 km", "A_5km"], ["B — +locality", "B_locality"]]) {
    const t = tally(key);
    log(`${label}:  urban ${t.urban}   rural ${t.rural}`);
    if (t.missed.length) log(`    urban MISSED: ${t.missed.join(", ")}`);
    if (t.flips.length) log(`    rural FLIPPED: ${t.flips.join(", ")}`);
  }
  const a = tally("A_5km"), b = tally("B_locality");
  log("");
  log(`RURAL FLIPS — A-5km: ${a.flips.length}   B: ${b.flips.length}`);
  log(a.flips.length < b.flips.length ? "  -> A-5 km wins on rural flips"
    : b.flips.length < a.flips.length ? "  -> B wins on rural flips"
    : "  -> TIE on rural flips; the ruling breaks it toward A-5 km");
  log("");
  log("UNSCORED (ambiguous, near a place node) — reported, not scored:");
  for (const r of rows.filter((x) => x.fetched && !x.expect)) {
    const dis = r.A_5km !== r.B_locality ? "   <-- candidates DISAGREE" : "";
    log(`  ${r.name}: current=${r.current ? "urban" : "rural"} A-5km=${r.A_5km ? "urban" : "rural"} B=${r.B_locality ? "urban" : "rural"}${dis}`);
  }
  log("=====================================================================");
  fs.writeFileSync(path.join(OUT, "tiebreak-rows.json"), JSON.stringify(rows, null, 1));
  log("DONE " + new Date().toISOString());
})();
