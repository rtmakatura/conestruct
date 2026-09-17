// #279 — the isUrban rate, before and after, on one named sample.
//
//   node rate-279.js <outDir>
//
// WHY IT IS BUILT THIS WAY.  The ruling asks for "the rate ... measured
// before and after on the same named sample of reference pins".  Running
// the old code and the new code against Overpass separately would compare
// two different fetches an hour apart, and Overpass load is a property of
// the hour — the comparison would measure the weather, not the fix.
//
// So: ONE fetch per pin, and BOTH predicates evaluated over that single
// payload.  The before/after difference is then a property of the
// predicate alone, which is the only thing that changed.  The fetch still
// varies run to run; the DELTA does not.
//
// The two predicates are transcribed from the route, before and after:
//   OLD  closest place node of ANY class decides
//   NEW  ANY node of an urban class decides
// They are copied rather than imported because the point is to run the
// retired one, which no longer exists in the source.
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n");
};

const PLACE_RADIUS_M = 3000;
const URBAN = new Set(["city", "town", "suburb", "neighbourhood"]);
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

// THE NAMED SAMPLE.  Four pins, named and sourced, so "the same sample"
// means something on a re-run.  Three urban pins already carrying
// evidence in this repo, plus one rural control — because a fix that
// makes everything urban is not a fix, and the ruling asks that a
// genuinely rural fixture stays rural.
const PINS = [
  {
    name: "e-bayaud",
    lat: 39.71466,
    lng: -104.94071,
    expect: "urban",
    source: "#279's own report; the #213 pin; way 39508704, an OSM primary in central Denver",
  },
  {
    name: "denver-demo",
    lat: 39.7269,
    lng: -104.9873,
    expect: "urban",
    source: "#256 / s2-arc31's Denver demo pin",
  },
  {
    name: "lakewood",
    lat: 39.7113,
    lng: -105.0815,
    expect: "urban",
    source: "#224's Lakewood control pin; tests/fixtures/site_scan/",
  },
  {
    name: "rural-control-us40-east",
    lat: 39.3722,
    lng: -102.6019,
    expect: "rural",
    source: "US-40 east of Kit Carson, eastern Colorado plains — the control",
  },
];

function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371008.8, r = (d) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// The predicate as it was: closest place node of ANY class decides.
function isUrbanOLD(elements, lat, lng) {
  let best = null, bestD = Infinity;
  for (const el of elements) {
    if (el.type !== "node" || !el.tags?.place) continue;
    if (typeof el.lat !== "number" || typeof el.lon !== "number") continue;
    const d = haversineM(lat, lng, el.lat, el.lon);
    if (d < bestD) { bestD = d; best = el; }
  }
  return best !== null && URBAN.has(best.tags?.place ?? "");
}

// The predicate as it is: ANY urban-class node in range decides.
function isUrbanNEW(elements) {
  return elements.some(
    (el) => el.type === "node" && URBAN.has(el.tags?.place ?? ""),
  );
}

async function fetchPlaces(pin) {
  const q =
    `[out:json][timeout:10];` +
    `node(around:${PLACE_RADIUS_M},${pin.lat},${pin.lng})` +
    `["place"~"^(city|town|suburb|neighbourhood|village|hamlet)$"];` +
    `out tags center;`;
  for (const url of MIRRORS) {
    // Per-mirror cap, the #256 lesson applied here: without it the first
    // draft hung on mirror 2, which s2-arc31 measured stalling 25-27 s.
    // A probe that can hang is a probe that reports nothing.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          // Overpass answers 406 Not Acceptable without an identifying
          // User-Agent — documented at site_detection.py's USER_AGENT and
          // duplicated in route.ts.  The first draft of this probe omitted
          // it and every mirror "failed" in four seconds; the loop's
          // `if (!r.ok) continue` swallowed the status, which is why the
          // failure is now logged with its code below.
          "user-agent":
            "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)",
        },
        body: `data=${encodeURIComponent(q)}`,
        signal: ctl.signal,
      });
      if (!r.ok) {
        log(`    mirror ${url} -> HTTP ${r.status}`);
        continue;
      }
      const j = await r.json();
      if (j && Array.isArray(j.elements)) return { elements: j.elements, mirror: url };
    } catch (e) {
      log(`    mirror ${url} -> ${e.name === "AbortError" ? "timeout 8s" : e.name}`);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

(async () => {
  log("#279 isUrban rate — one fetch per pin, both predicates over it");
  log("started " + new Date().toISOString());
  log("");
  const rows = [];
  for (const pin of PINS) {
    const got = await fetchPlaces(pin);
    if (got === null) {
      log(`[${pin.name}] FETCH FAILED — every mirror. Row omitted, not guessed.`);
      rows.push({ ...pin, fetched: false });
      continue;
    }
    const before = isUrbanOLD(got.elements, pin.lat, pin.lng);
    const after = isUrbanNEW(got.elements);
    const classes = {};
    for (const el of got.elements) {
      const c = el.tags?.place;
      if (c) classes[c] = (classes[c] || 0) + 1;
    }
    // The closest place, which is what the OLD predicate read.
    let closest = null, cd = Infinity;
    for (const el of got.elements) {
      if (!el.tags?.place || typeof el.lat !== "number") continue;
      const d = haversineM(pin.lat, pin.lng, el.lat, el.lon);
      if (d < cd) { cd = d; closest = el; }
    }
    rows.push({
      ...pin, fetched: true, before, after,
      place_classes: classes,
      closest_place: closest ? `${closest.tags.place} "${closest.tags.name ?? "?"}" @ ${cd.toFixed(0)} m` : null,
      elements: got.elements.length,
    });
    log(`[${pin.name}] expect=${pin.expect}  before=${before}  after=${after}` +
        (before !== after ? "   <-- CHANGED" : ""));
    log(`    closest place: ${closest ? `${closest.tags.place} "${closest.tags.name ?? "?"}" @ ${cd.toFixed(0)} m` : "none"}`);
    log(`    classes in range: ${JSON.stringify(classes)}`);
    log("");
    await new Promise((r) => setTimeout(r, 3000));
  }

  const done = rows.filter((r) => r.fetched);
  const urban = done.filter((r) => r.expect === "urban");
  const rural = done.filter((r) => r.expect === "rural");
  log("=====================================================================");
  log("RATE, on the named sample");
  log("=====================================================================");
  log(`urban pins classified urban — BEFORE: ${urban.filter((r) => r.before).length}/${urban.length}` +
      `   AFTER: ${urban.filter((r) => r.after).length}/${urban.length}`);
  log(`rural pins classified rural — BEFORE: ${rural.filter((r) => !r.before).length}/${rural.length}` +
      `   AFTER: ${rural.filter((r) => !r.after).length}/${rural.length}`);
  const changed = done.filter((r) => r.before !== r.after).map((r) => r.name);
  log(`pins whose verdict changed: ${changed.length ? changed.join(", ") : "none"}`);
  if (done.length < rows.length) {
    log(`NOT FETCHED (omitted, not guessed): ${rows.filter((r) => !r.fetched).map((r) => r.name).join(", ")}`);
  }
  log("=====================================================================");
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  log("DONE " + new Date().toISOString());
})();
