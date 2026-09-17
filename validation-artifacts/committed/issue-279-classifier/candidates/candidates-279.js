// #279 checkpoint (c) — the three candidates, measured per-pin on one sample.
//
//   node candidates-279.js <outDir>
//
// ONE FETCH PER PIN serves every candidate: the road ways within 50 m
// (with tags) and every place node within 8 km.  Each candidate is then a
// pure function of that payload, so the differences between them are
// properties of the PREDICATES and not of the hour.  A 3 km candidate and
// an 8 km candidate read the same node list, filtered by distance.
//
// WHY THE SAMPLE IS THIS SAMPLE.  memory.md's "Reference pins" section is
// the named set the ruling asks for, plus rural controls — because a
// candidate that classifies everything urban passes every urban pin and
// is still wrong.  A candidate that flips a rural control FAILS, however
// well it does on the urban side.
//
// WHAT THIS CANNOT DO.  It cannot tell us what a road IS, only what OSM
// says about it.  Every verdict below is a verdict about tags.
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };

const UA = "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const URBAN = new Set(["city", "town", "suburb", "neighbourhood"]);
const URBAN_PLUS_LOCALITY = new Set([...URBAN, "locality"]);
const ROAD_RE =
  /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$/;

// memory.md "Reference pins", plus rural controls.  `expect` is what the
// classification SHOULD say; it is the yardstick, not an input.
const PINS = [
  { name: "e-bayaud",     lat: 39.71466,   lng: -104.94071,   expect: "urban", src: "memory.md reference pins; #279's own pin" },
  { name: "e-colfax",     lat: 39.73997,   lng: -104.96632,   expect: "urban", src: "memory.md reference pins" },
  { name: "lakewood",     lat: 39.7113,    lng: -105.0815,    expect: "urban", src: "memory.md reference pins (control)" },
  { name: "northglenn",   lat: 39.886,     lng: -104.9811,    expect: "urban", src: "memory.md reference pins" },
  { name: "thornton",     lat: 39.8680,    lng: -104.9847,    expect: "urban", src: "memory.md reference pins" },
  { name: "greeley",      lat: 40.404292,  lng: -104.715863,  expect: "urban", src: "memory.md reference pins" },
  { name: "denver-demo",  lat: 39.7269,    lng: -104.9873,    expect: "urban", src: "#256 / s2-arc31 demo pin" },
  // Rural controls.  A candidate that flips any of these fails.
  { name: "rural-us40-kitcarson",  lat: 38.7644,  lng: -102.7980, expect: "rural", src: "US-40 W of Kit Carson, eastern plains" },
  { name: "rural-us385-cheyenne",  lat: 38.8200,  lng: -102.3510, expect: "rural", src: "US-385 N of Cheyenne Wells" },
  { name: "rural-sr71-limon",      lat: 39.2100,  lng: -103.6900, expect: "rural", src: "SR-71 N of Limon" },
  { name: "rural-us287-kim",       lat: 37.2450,  lng: -103.3500, expect: "rural", src: "US-287 near Kim, SE Colorado" },
  { name: "lookout-mountain",      lat: 39.7326,  lng: -105.2405, expect: "rural", src: "memory.md: Lookout Mountain Rd way 1432422179 — mountain road" },
];

function hav(aLat, aLng, bLat, bLng) {
  const R = 6371008.8, r = (d) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function fetchAll(pin) {
  const q =
    `[out:json][timeout:25];` +
    `(way(around:50,${pin.lat},${pin.lng})["highway"~"${ROAD_RE.source.replace(/^\^|\$$/g, "")}"];)->.roads;` +
    `.roads out geom tags;` +
    `(node(around:8000,${pin.lat},${pin.lng})["place"];)->.places;` +
    `.places out tags center;`;
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
      if (!r.ok) { log(`    ${url} -> HTTP ${r.status}`); continue; }
      const j = await r.json();
      if (j && Array.isArray(j.elements)) return j.elements;
    } catch (e) {
      log(`    ${url} -> ${e.name === "AbortError" ? "timeout 25s" : e.name}`);
    } finally { clearTimeout(timer); }
  }
  return null;
}

// ---- the candidates -------------------------------------------------

// Current shipped behaviour (after the masking fix): any urban-class
// place within 3 km.
function placeVerdict(places, pin, radius, classes) {
  return places.some(
    (p) => classes.has(p.tags?.place ?? "") && hav(pin.lat, pin.lng, p.lat, p.lon) <= radius,
  );
}

// The road nearest the pin — the one the operator would pick.
function nearestRoad(roads, pin) {
  let best = null, bestD = Infinity;
  for (const w of roads) {
    for (const g of w.geometry || []) {
      const d = hav(pin.lat, pin.lng, g.lat, g.lon);
      if (d < bestD) { bestD = d; best = w; }
    }
  }
  return best ? { way: best, d: bestD } : null;
}

// Candidate C: the road's own tags decide; place nodes tie-break only
// where the road is silent.  Each signal is an OSM-wiki-defined tag.
function roadTagVerdict(roads, places, pin) {
  const near = nearestRoad(roads, pin);
  if (!near) return { urban: null, why: "no road within 50 m", fell_back: false };
  const t = near.way.tags || {};
  const reasons = [];
  // sidewalk=* — OSM wiki: presence of a footway alongside the road.
  const sw = t.sidewalk ?? t["sidewalk:both"] ?? t["sidewalk:left"] ?? t["sidewalk:right"];
  if (sw && !["no", "none", "separate"].includes(sw)) reasons.push(`sidewalk=${sw}`);
  // lit=yes — OSM wiki: street lighting present.
  if (t.lit === "yes") reasons.push("lit=yes");
  // maxspeed — parsed to mph; <= 40 mph is a posted urban speed.
  if (t.maxspeed) {
    const m = /^(\d+)\s*(mph)?$/.exec(t.maxspeed.trim());
    if (m) {
      const mph = m[2] ? Number(m[1]) : Number(m[1]) * 0.621371;
      if (mph <= 40) reasons.push(`maxspeed=${t.maxspeed} (${mph.toFixed(0)} mph)`);
    }
  }
  // highway=residential — OSM wiki: roads within residential areas.
  if (t.highway === "residential") reasons.push("highway=residential");
  if (reasons.length) return { urban: true, why: reasons.join(" + "), fell_back: false, road: near.way.id, dist: Math.round(near.d) };
  // Silent: fall back to the place tie-break, and SAY that it did.
  const tie = placeVerdict(places, pin, 3000, URBAN);
  return {
    urban: tie, fell_back: true, road: near.way.id, dist: Math.round(near.d),
    why: `road tags silent (highway=${t.highway ?? "?"}) -> place tie-break within 3 km = ${tie}`,
  };
}

(async () => {
  log("#279 checkpoint (c) — three candidates, one fetch per pin");
  log("started " + new Date().toISOString());
  log("");
  const rows = [];
  for (const pin of PINS) {
    const els = await fetchAll(pin);
    if (els === null) { log(`[${pin.name}] FETCH FAILED — omitted, not guessed`); rows.push({ ...pin, fetched: false }); continue; }
    const roads = els.filter((e) => e.type === "way");
    const places = els.filter((e) => e.type === "node" && e.tags?.place && typeof e.lat === "number");
    const cur = placeVerdict(places, pin, 3000, URBAN);
    const a5 = placeVerdict(places, pin, 5000, URBAN);
    const a8 = placeVerdict(places, pin, 8000, URBAN);
    const b = placeVerdict(places, pin, 3000, URBAN_PLUS_LOCALITY);
    const c = roadTagVerdict(roads, places, pin);
    const row = { ...pin, fetched: true, current: cur, A_5km: a5, A_8km: a8, B_locality: b, C_roadtags: c.urban, C_why: c.why, C_fell_back: c.fell_back, roads: roads.length, places: places.length };
    rows.push(row);
    const mark = (v) => (v === null ? "  ?  " : v ? "URBAN" : "rural");
    const ok = (v) => (v === null ? "?" : (v ? "urban" : "rural") === pin.expect ? "ok" : "MISS");
    log(`[${pin.name}] expect=${pin.expect}  roads=${roads.length} places=${places.length}`);
    log(`    current(3km)  ${mark(cur)} ${ok(cur)}`);
    log(`    A widen 5km   ${mark(a5)} ${ok(a5)}     A widen 8km ${mark(a8)} ${ok(a8)}`);
    log(`    B +locality   ${mark(b)} ${ok(b)}`);
    log(`    C road tags   ${mark(c.urban)} ${ok(c.urban)}   ${c.why}`);
    log("");
    await new Promise((r) => setTimeout(r, 3000));
  }

  const done = rows.filter((r) => r.fetched);
  const score = (key) => {
    const u = done.filter((r) => r.expect === "urban");
    const rr = done.filter((r) => r.expect === "rural");
    return {
      urban_ok: u.filter((r) => r[key] === true).length + "/" + u.length,
      rural_ok: rr.filter((r) => r[key] === false).length + "/" + rr.length,
      rural_flipped: rr.filter((r) => r[key] === true).map((r) => r.name),
      urban_missed: u.filter((r) => r[key] !== true).map((r) => r.name),
    };
  };
  log("=====================================================================");
  log("PER-CANDIDATE SCORE on the whole sample");
  log("=====================================================================");
  for (const [label, key] of [
    ["current (3 km, urban classes)", "current"],
    ["A — widen radius to 5 km", "A_5km"],
    ["A — widen radius to 8 km", "A_8km"],
    ["B — admit place=locality (3 km)", "B_locality"],
    ["C — road tags, place tie-break", "C_roadtags"],
  ]) {
    const s = score(key);
    log(`${label}`);
    log(`   urban pins urban: ${s.urban_ok}   rural pins rural: ${s.rural_ok}`);
    if (s.urban_missed.length) log(`   urban MISSED: ${s.urban_missed.join(", ")}`);
    if (s.rural_flipped.length) log(`   rural FLIPPED (disqualifying): ${s.rural_flipped.join(", ")}`);
    log("");
  }
  const fellBack = done.filter((r) => r.C_fell_back).map((r) => r.name);
  log(`C fell back to the place tie-break on: ${fellBack.length ? fellBack.join(", ") : "none"}`);
  log(`(those are the pins where C's answer would be marked inferred)`);
  if (done.length < rows.length) log(`NOT FETCHED: ${rows.filter((r) => !r.fetched).map((r) => r.name).join(", ")}`);
  log("=====================================================================");
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  log("DONE " + new Date().toISOString());
})();
