// #279 — the place nodes around E Bayaud, at every radius considered.
//
//   node bayaud-places-279.js <outDir>
//
// WHY THIS EXISTS.  The arc's central factual claim is that #279's pin is
// not near any node the predicate accepts: the nearest `neighbourhood` is
// just outside 3,000 m and Denver's `city` node is far beyond it.  Those
// two distances are quoted in the fix commit, in route.ts's comment and
// in rulings.md — and until this script they came from a throwaway probe
// whose output was never committed.  A number cited in shipped code with
// no committed evidence behind it is a number nobody can check.  This
// re-runs the measurement and records it.
//
// It lists EVERY place node around the pin with its class and distance,
// so the reader can confirm the two quoted figures and also see what else
// is in range — in particular the `locality` nodes Denver uses for real
// neighbourhoods, which is the second half of #279's cause.
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "bayaud-log.txt"), s + "\n"); };

const UA = "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
// #279's reported pin: E Bayaud Ave / S Colorado Blvd.
const LAT = 39.71466, LNG = -104.94071;
// The four classes the predicate accepts (route.ts URBAN_PLACE_CLASSES).
const URBAN = new Set(["city", "town", "suburb", "neighbourhood"]);

function hav(aLat, aLng, bLat, bLng) {
  const R = 6371008.8, r = (d) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function q(radius) {
  const query = `[out:json][timeout:25];node(around:${radius},${LAT},${LNG})["place"];out tags center;`;
  for (const url of MIRRORS) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctl.signal,
      });
      if (!r.ok) { log(`    ${url} -> HTTP ${r.status}`); continue; }
      return (await r.json()).elements || [];
    } catch (e) {
      log(`    ${url} -> ${e.name === "AbortError" ? "timeout 20s" : e.name}`);
    } finally { clearTimeout(t); }
  }
  return null;
}

(async () => {
  log("#279 — place nodes around E Bayaud (39.71466, -104.94071)");
  log("started " + new Date().toISOString());
  log("predicate accepts: " + [...URBAN].join(", "));
  log("");
  const out = {};
  for (const radius of [3000, 5000, 8000]) {
    const els = await q(radius);
    if (!els) { log(`radius ${radius} m: FETCH FAILED — not guessed`); out[radius] = null; continue; }
    const rows = els
      .filter((e) => e.tags?.place && typeof e.lat === "number")
      .map((e) => ({ place: e.tags.place, name: e.tags.name || "(unnamed)", dist_m: Math.round(hav(LAT, LNG, e.lat, e.lon)) }))
      .sort((a, b) => a.dist_m - b.dist_m);
    out[radius] = rows;
    log(`=== radius ${radius} m — ${rows.length} place nodes ===`);
    for (const r of rows.slice(0, 15)) {
      log(`  ${String(r.dist_m).padStart(5)} m  place=${r.place.padEnd(14)} ${r.name}` +
        (URBAN.has(r.place) ? "   <- predicate ACCEPTS" : ""));
    }
    if (rows.length > 15) log(`  … ${rows.length - 15} more`);
    const firstUrban = rows.find((r) => URBAN.has(r.place));
    log(`  nearest node the predicate accepts: ` +
      (firstUrban ? `${firstUrban.name} @ ${firstUrban.dist_m} m (place=${firstUrban.place})` : "NONE in range"));
    const city = rows.find((r) => r.place === "city");
    log(`  nearest place=city: ` + (city ? `${city.name} @ ${city.dist_m} m` : "none in range"));
    log(`  isUrban at this radius: ${firstUrban ? "TRUE" : "false"}`);
    log("");
    await new Promise((r) => setTimeout(r, 4000));
  }
  fs.writeFileSync(path.join(OUT, "bayaud-places.json"), JSON.stringify(out, null, 1));
  log("DONE " + new Date().toISOString());
})();
