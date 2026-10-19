// Client-safe classifier for Mapbox geocode precision (lib/geocode.ts
// is server-only — it reads MAPBOX_TOKEN).  A geocode result may only
// trigger road detection when it lands at street precision: detecting
// at a town centroid (searching "Lafayette, CO") snaps to whatever road
// happens to pass the centroid and produces a confidently wrong
// classification — street class feeds jurisdiction rules downstream.
//
// Mapbox v5 place_type values, coarse → fine: country, region,
// postcode, district, place, locality, neighborhood, address, poi.
// Only the street-level classes are precise; anything else — including
// an unknown/missing type — is coarse, so an unrecognised future type
// degrades to "recenter and ask for a pin", never to a silent wrong
// detection.

const PRECISE_PLACE_TYPES: ReadonlySet<string> = new Set([
  "address",
  "poi",
  // v6 vocabulary, accepted defensively for a future API upgrade.
  "intersection",
  "street",
]);

export function isPreciseGeocode(placeType: string | null): boolean {
  return placeType !== null && PRECISE_PLACE_TYPES.has(placeType);
}

/** The search bar's line for a failed /api/geocode answer.  422 is a
 *  street pair typed with no city and no jurisdiction whose corner is
 *  not inside our places (#347, lib/geocode.ts). */
export function geocodeErrorMessage(status: number): string {
  if (status === 503) return "Geocoding not configured";
  if (status === 404) return "No match for that address";
  if (status === 422) return "Add a city to search cross streets.";
  return `Geocoding failed (${status})`;
}
