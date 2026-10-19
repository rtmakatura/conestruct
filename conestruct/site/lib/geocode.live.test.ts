// #347 live run: the real geocodeAddress against Mapbox for every case in
// Ryan's 2026-10-18 ruling.  Skipped unless LIVE_GEOCODE=1 and MAPBOX_TOKEN
// are set; the table it prints is recorded in
// validation-artifacts/committed/issue-347-geocoder/outcome.md.
import { describe, expect, it } from "vitest";
import { geocodeAddress } from "./geocode";

const CORNER = { lat: 39.739964, lng: -104.966006 }; // E Colfax Ave & N Williams St

function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

const CASES: { input: string; jurisdictionKey?: string; note: string }[] = [
  { input: "Colfax & Williams, Denver", note: "issue input 1 (was Nebraska)" },
  { input: "Colfax and Williams", note: "issue input 2" },
  { input: "E Colfax Ave and N Williams St", note: "issue input 3" },
  { input: "E Colfax Ave & N Race St, Denver", note: "issue input 4" },
  { input: "Colfax & Williams", note: "no city, no jurisdiction" },
  { input: "Colfax & Williams", jurisdictionKey: "denver", note: "no city, Denver selected" },
  { input: "Colfax & Main", note: "no city, no jurisdiction" },
  { input: "Colfax & Main", jurisdictionKey: "denver", note: "no city, Denver selected" },
  { input: "Colfax & Main", jurisdictionKey: "cdot", note: "no city, CDOT selected (no TIGER area)" },
  { input: "Colfax & Main, Aurora", note: "city in two states" },
  { input: "Colfax & Main, Aurora, IL", note: "city in two states, Illinois named" },
  { input: "Colfax & Kipling, Lakewood", note: "Mapbox alone ranks Lakewood NJ first" },
  { input: "1437 Bannock St, Denver, CO", note: "plain street address (unchanged path)" },
];

describe.skipIf(!process.env.LIVE_GEOCODE)("#347 live geocoder run", () => {
  it("records what each ruling case returns", async () => {
    const rows: string[] = [];
    for (const c of CASES) {
      const r = await geocodeAddress(c.input, undefined, {
        jurisdictionKey: c.jurisdictionKey,
      });
      const where = r.ok
        ? `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)} | ${r.placeType} | ${miles(CORNER, r).toFixed(2)} mi`
        : `HTTP ${r.status} ${r.reason} | | `;
      rows.push(`| \`${c.input}\` | ${c.jurisdictionKey ?? "none"} | ${where} | ${c.note} |`);
    }
    console.log(rows.join("\n"));
    expect(rows).toHaveLength(CASES.length);
  }, 60_000);
});
