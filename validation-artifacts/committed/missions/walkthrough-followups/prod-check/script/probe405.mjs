// #405 probe (read-only): per-mirror timing of /api/road-bearing's own first
// Overpass query, and the live route end to end, for the issue's five searches.
// Usage: node probe405.mjs <envfile> <outjson> [label] [route base URL, default the live site]
import fs from "node:fs";

const [envPath, outPath, label = "run", base = "https://www.conestruct.com"] = process.argv.slice(2);
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const MAPBOX = env.MAPBOX_TOKEN || env.NEXT_PUBLIC_MAPBOX_TOKEN;
const GATE = env.GATE_BYPASS_TOKEN;
const UA = "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const SEARCHES = [
  "1600 E Colfax Ave, Denver",
  "Colfax & Williams, Denver",
  "Wadsworth Blvd & W 10th Ave, Lakewood, CO",
  "1600 E Colfax Ave, Denver",
  "1600 E Colfax Ave, Denver",
];

function query(lat, lng) {
  return (
    `[out:json][timeout:10];` +
    `(way(around:50,${lat},${lng})` +
    `["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];` +
    `node(around:5000,${lat},${lng})["place"~"^(city|town|suburb|neighbourhood|village|hamlet)$"];` +
    `node(around:50,${lat},${lng})["highway"="traffic_signals"];` +
    `);out geom tags;`
  );
}

async function timed(fn, capMs) {
  const t0 = performance.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), capMs);
  try {
    const r = await fn(ac.signal);
    const text = await r.text();
    let remark = null, elements = null, scan = null;
    try { const j = JSON.parse(text); remark = j.remark ?? null; elements = Array.isArray(j.elements) ? j.elements.length : null; scan = j.scan_status ? `${j.scan_status}:${(j.candidates||[]).length}` : null; } catch {}
    return { ms: Math.round(performance.now() - t0), status: r.status, bytes: text.length, remark, elements, scan, body: elements === null && !scan ? text.slice(0, 200) : undefined };
  } catch (e) {
    return { ms: Math.round(performance.now() - t0), error: e.name === "AbortError" ? `no answer in ${capMs} ms` : `${e.name}: ${e.message}` };
  } finally { clearTimeout(timer); }
}

// "Colfax & Williams" is an intersection the forward geocoder misplaces (it
// answered Nebraska on the first run); it takes the Colfax-at-Williams pin
// #411's probe used (colfaxPin), as the prod check did.
const geo = { "Colfax & Williams, Denver": { lat: 39.74003, lng: -104.96555 } };
async function geocode(q) {
  if (geo[q]) return geo[q];
  const u = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(MAPBOX)}&country=us&limit=1&proximity=-104.99,39.74`;
  const j = await (await fetch(u)).json();
  const [lng, lat] = j.features[0].center;
  return (geo[q] = { lat, lng });
}

const rows = [];
for (const s of SEARCHES) {
  const { lat, lng } = await geocode(s);
  const q = query(lat, lng);
  const mirrors = await Promise.all(MIRRORS.map((m) => timed((signal) => fetch(m, {
    method: "POST", signal,
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
    body: `data=${encodeURIComponent(q)}`,
  }), 25000).then((r) => ({ mirror: new URL(m).host, ...r }))));
  const live = await timed((signal) => fetch(`${base}/api/road-bearing`, {
    method: "POST", signal,
    headers: { "content-type": "application/json", "x-conestruct-gate": GATE },
    body: JSON.stringify({ lat, lng }),
  }), 60000);
  const row = { search: s, lat, lng, at: new Date().toISOString(), mirrors, live: { ms: live.ms, status: live.status, scan: live.scan, error: live.error, bytes: live.bytes } };
  rows.push(row);
  console.log(`${s.padEnd(44)} ` + mirrors.map((m) => `${m.mirror.split(".")[0]}=${m.status ?? "-"}/${m.ms}`).join(" ") + `  live=${live.status ?? live.error}:${live.scan}/${live.ms}`);
}
fs.writeFileSync(outPath, JSON.stringify({ label, rows }, null, 2));
