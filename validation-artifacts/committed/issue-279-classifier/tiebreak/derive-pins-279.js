// #279 tiebreaker, step 1 — DERIVE the rural control pins from the roads
// themselves, so "is this pin on the highway I named?" is not a guess.
//
//   node derive-pins-279.js <outDir>
//
// THE METHOD, and why it replaces the last set.  The first candidate run
// used coordinates I picked by eye.  Two of them resolved to a
// `highway=residential` way — a farm access road — which is how candidate
// C came to call US-385 and US-287 "urban".  Picking a coordinate and then
// checking it is the wrong order.
//
// Here the road comes first: query OSM for a way carrying the named
// `ref` inside a bbox, take a vertex from its own geometry, and use THAT
// as the pin.  The pin is then on the road by construction, and the
// verification is the way's own id/ref/name reported beside it — a reader
// can paste the id into osm.org and see the same road.
//
// Pins are also required to sit at least MIN_PLACE_DIST_M from the nearest
// place node, so a "rural" control is not one that merely happens to be
// between two towns' nodes.  Where that cannot be satisfied, the pin is
// reported as REJECTED rather than quietly kept.
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "derive-log.txt"), s + "\n"); };

const UA = "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
// A rural control must be this far from ANY place node, so the control is
// controlling for what it claims to.  CHOSEN: 3,000 m is the radius under
// test, so a pin inside it would prejudge the very question.  4,000 gives
// a margin beyond the widest candidate but one still inside 5 km.
const MIN_PLACE_DIST_M = 4000;

// Ten rural candidates: plains, mountain, and small-town-adjacent, each
// named by the OSM `ref` of the road it must sit on.
const TARGETS = [
  { name: "plains-us385-cheyenne",  ref: "US 385",  bbox: [38.70, -102.45, 38.95, -102.25], ctx: "plains" },
  { name: "plains-us287-kim",       ref: "US 287",  bbox: [37.10, -103.45, 37.40, -103.20], ctx: "plains" },
  { name: "plains-us40-kitcarson",  ref: "US 40",   bbox: [38.70, -102.95, 38.85, -102.65], ctx: "plains" },
  { name: "plains-sr71-limon",      ref: "CO 71",   bbox: [39.10, -103.80, 39.45, -103.60], ctx: "plains" },
  { name: "plains-us36-joes",       ref: "US 36",   bbox: [39.60, -102.75, 39.75, -102.45], ctx: "plains" },
  { name: "plains-us50-lamar",      ref: "US 50",   bbox: [38.05, -102.90, 38.15, -102.55], ctx: "plains" },
  { name: "mtn-us550-ouray",        ref: "US 550",  bbox: [37.85, -107.80, 38.05, -107.65], ctx: "mountain" },
  { name: "mtn-co14-poudre",        ref: "CO 14",   bbox: [40.65, -105.90, 40.75, -105.60], ctx: "mountain" },
  { name: "mtn-us160-wolfcreek",    ref: "US 160",  bbox: [37.45, -106.90, 37.55, -106.70], ctx: "mountain" },
  { name: "mtn-co133-mcclure",      ref: "CO 133",  bbox: [39.10, -107.35, 39.30, -107.20], ctx: "mountain" },
  // Second pass (2026-09-17): the first run accepted 8 of 12.  Four were
  // REJECTED for sitting within 4,000 m of a place node — us550 at 197 m
  // (Ouray), co14 at 1,601 m, us85 at 562 m (Fort Lupton) — and one bbox
  // held no way with the named ref.  More targets, to clear ten clean
  // controls without lowering the gate to get there.
  { name: "plains-us287-springfield", ref: "US 287",  bbox: [37.30, -102.65, 37.55, -102.50], ctx: "plains" },
  { name: "plains-us160-walsh",     ref: "US 160",  bbox: [37.35, -102.50, 37.45, -102.20], ctx: "plains" },
  { name: "plains-co59-seibert",    ref: "CO 59",   bbox: [39.30, -102.65, 39.55, -102.55], ctx: "plains" },
  { name: "plains-us34-otis",       ref: "US 34",   bbox: [40.10, -103.10, 40.20, -102.80], ctx: "plains" },
  { name: "mtn-us50-monarch",       ref: "US 50",   bbox: [38.48, -106.40, 38.58, -106.20], ctx: "mountain" },
  { name: "mtn-co149-creede",       ref: "CO 149",  bbox: [37.75, -107.15, 37.95, -106.95], ctx: "mountain" },
  { name: "mtn-us285-antonito",     ref: "US 285",  bbox: [37.10, -106.20, 37.30, -106.00], ctx: "mountain" },
  { name: "mtn-co139-douglaspass",  ref: "CO 139",  bbox: [39.55, -108.85, 39.75, -108.75], ctx: "mountain" },
  { name: "smalltown-us85-fortlupton", ref: "US 85", bbox: [40.02, -104.85, 40.12, -104.78], ctx: "small-town adjacent" },
  { name: "smalltown-us24-limon",   ref: "US 24",   bbox: [39.24, -103.75, 39.30, -103.60], ctx: "small-town adjacent" },
];

function hav(aLat, aLng, bLat, bLng) {
  const R = 6371008.8, r = (d) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function overpass(q) {
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
      if (j && Array.isArray(j.elements)) return j.elements;
    } catch (e) {
      log(`      ${url} -> ${e.name === "AbortError" ? "timeout 25s" : e.name}`);
    } finally { clearTimeout(timer); }
  }
  return null;
}

(async () => {
  log("#279 tiebreaker step 1 — deriving rural control pins FROM the roads");
  log("started " + new Date().toISOString());
  log(`a control must sit >= ${MIN_PLACE_DIST_M} m from any place node`);
  log("");
  const out = [];
  for (const t of TARGETS) {
    const [s, w, n, e] = t.bbox;
    const ways = await overpass(
      `[out:json][timeout:25];way(${s},${w},${n},${e})["ref"="${t.ref}"]["highway"];out geom tags;`,
    );
    if (!ways || ways.length === 0) { log(`[${t.name}] no way with ref="${t.ref}" in bbox — REJECTED`); out.push({ ...t, ok: false, why: "no such ref in bbox" }); continue; }
    // Take the mid vertex of the longest way carrying the ref.
    const best = ways
      .filter((wy) => (wy.geometry || []).length >= 2)
      .sort((a, b) => (b.geometry.length - a.geometry.length))[0];
    if (!best) { log(`[${t.name}] ref found but no geometry — REJECTED`); out.push({ ...t, ok: false, why: "no geometry" }); continue; }
    const v = best.geometry[Math.floor(best.geometry.length / 2)];
    // How far is the nearest place node?
    const places = await overpass(
      `[out:json][timeout:25];node(around:8000,${v.lat},${v.lon})["place"];out tags center;`,
    );
    if (places === null) { log(`[${t.name}] place query failed — REJECTED (not guessed)`); out.push({ ...t, ok: false, why: "place query failed" }); continue; }
    let nearest = null, nd = Infinity;
    for (const p of places) {
      if (typeof p.lat !== "number") continue;
      const d = hav(v.lat, v.lon, p.lat, p.lon);
      if (d < nd) { nd = d; nearest = p; }
    }
    const ok = nd >= MIN_PLACE_DIST_M;
    log(`[${t.name}] ${ok ? "OK" : "REJECTED"}  ${v.lat.toFixed(5)}, ${v.lon.toFixed(5)}`);
    log(`    on way ${best.id}  ref=${best.tags?.ref}  name=${best.tags?.name ?? "(none)"}  highway=${best.tags?.highway}`);
    log(`    nearest place: ${nearest ? `${nearest.tags.place} "${nearest.tags.name ?? "?"}" @ ${nd.toFixed(0)} m` : "none within 8 km"}`);
    if (!ok) log(`    -> inside ${MIN_PLACE_DIST_M} m of a place node; not a clean rural control`);
    log("");
    out.push({
      name: t.name, ctx: t.ctx, expect: "rural", ok,
      lat: Number(v.lat.toFixed(5)), lng: Number(v.lon.toFixed(5)),
      way_id: best.id, ref: best.tags?.ref, road_name: best.tags?.name ?? null,
      highway: best.tags?.highway,
      nearest_place: nearest ? { place: nearest.tags.place, name: nearest.tags.name ?? null, dist_m: Math.round(nd) } : null,
      why: ok ? null : `nearest place ${Math.round(nd)} m < ${MIN_PLACE_DIST_M} m`,
    });
    await new Promise((r) => setTimeout(r, 3000));
  }
  const accepted = out.filter((r) => r.ok);
  log("=====================================================================");
  log(`ACCEPTED ${accepted.length} of ${TARGETS.length} rural controls`);
  log(`by context: ${JSON.stringify(accepted.reduce((a, r) => ((a[r.ctx] = (a[r.ctx] || 0) + 1), a), {}))}`);
  log("=====================================================================");
  fs.writeFileSync(path.join(OUT, "derived-pins.json"), JSON.stringify(out, null, 1));
  log("DONE " + new Date().toISOString());
})();
