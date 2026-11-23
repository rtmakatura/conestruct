// #554 step 1: what Mapbox answers for the texts the map window's search
// sends it.  Makes the same two requests lib/geocode.ts geocodePlain makes
// (v5 places, limit=1: first inside the Colorado box, then anywhere) and
// keeps the fields that say how good the match is.  Read-only.
//
//   node probe.mjs <path to .env.local holding MAPBOX_TOKEN> <out.json>
//
// The token is read from the file and never written out.
import { readFileSync, writeFileSync } from "node:fs";

const [envPath, outPath] = process.argv.slice(2);
const token = /^MAPBOX_TOKEN=(.*)$/m.exec(readFileSync(envPath, "utf8"))?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!token) throw new Error("no MAPBOX_TOKEN in the env file");

// lib/jurisdiction-areas.json authority_areas.cdot.bbox
const COLORADO_BBOX = [-109.060204, 36.992449, -102.041522, 41.003444];

const TEXTS = [
  // The two texts the ruling names.
  "39 N, 44.4",
  "105° W, 39.7401",
  // Other half coordinates and number text from #548's rulings.md.
  "39° 44.4",
  "39, -105",
  "39 44.4",
  "39 N, 104 W",
  "39.7401°",
  "39.7401° N",
  "104°, 39",
  "E 470 N",
  "1437 N 14",
  "500 N 200 W 84103",
  // Real searches an operator types.
  "1437 Bannock St, Denver, CO",
  "1437 Bannock St, Denver",
  "1437 Bannock St",
  "200 E Colfax Ave, Denver",
  "E Colfax Ave, Denver",
  "E Colfax Ave",
  "W Colfax Ave, Lakewood",
  "E Bayaud Ave, Denver",
  "Lookout Mountain Rd",
  "Lookout Mountain Rd, Golden",
  "Gamble Gulch Rd",
  "E-470",
  "I-25",
  "US 36",
  "Union Station, Denver",
  "Lafayette, CO",
  "Denver",
  "80203",
  // A typed city with a misspelling or a missing word (the answers that
  // pass geocodePlain below relevance 1), units, places of interest.
  "1437 Banock St, Denver",
  "1437 Bannock, Denver, CO 80202",
  "200 Colfax, Denver",
  "200 E Colfax Avenue Denver Colorado",
  "E Colfax Ave, Aurora",
  "123 Main St, Lakewood",
  "1437 Bannock St Apt 4, Denver",
  "1437 Bannock St #210, Denver",
  "Coors Field",
  "Denver International Airport",
  "King Soopers, Lakewood",
  "Hwy 36",
  "Highway 285",
  "CO-93",
  "E 6th Ave, Denver",
  "6th and Lincoln",
  "39 Denver 44.4",
  "44.4",
  "39 N",
  "105 W",
];

const keep = (f) =>
  f
    ? {
        id: f.id,
        place_type: f.place_type,
        relevance: f.relevance,
        accuracy: f.properties?.accuracy ?? null,
        address: f.address ?? null,
        text: f.text,
        place_name: f.place_name,
        matching_text: f.matching_text ?? null,
        matching_place_name: f.matching_place_name ?? null,
        center: f.center,
      }
    : null;

async function ask(query, params) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}${params}`;
  const r = await fetch(url);
  if (!r.ok) return { http: r.status };
  const j = await r.json();
  return { http: 200, feature: keep(j.features?.[0]) };
}

const rows = [];
for (const text of TEXTS) {
  // geocodePlain spells a trailing "CO" out before it asks.
  const segs = text.split(",").map((s) => s.trim());
  const last = segs[segs.length - 1];
  if (segs.length > 1 && /^(co|colorado)(\s+\d{5}(-\d{4})?)?$/i.test(last)) {
    segs[segs.length - 1] = last.replace(/^(co|colorado)/i, "Colorado");
  }
  const query = segs.join(", ");
  rows.push({
    text,
    query,
    boxed: await ask(query, `&limit=1&bbox=${COLORADO_BBOX.join(",")}`),
    anywhere: await ask(query, "&limit=1"),
  });
}
writeFileSync(outPath, JSON.stringify({ asked: new Date().toISOString(), rows }, null, 2) + "\n");
for (const r of rows) {
  const b = r.boxed.feature;
  console.log(
    [r.text, b ? `${b.place_type?.[0]}/${b.accuracy ?? "-"}` : `none(${r.boxed.http})`, b?.relevance ?? "", b?.place_name ?? ""].join(" | "),
  );
}
