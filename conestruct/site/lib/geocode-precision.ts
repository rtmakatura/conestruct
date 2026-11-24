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

/** #554 (Ryan, 2026-11-23): the notice for a weak match (#565: in the
 *  right panel's box).  `place` is the server's name for its answer
 *  (lib/geocode.ts).  No pin, no camera move, no road lookup goes with it. */
export function weakMatchNotice(place: string): string {
  return `Closest match: ${place}. Check the pin before you go on.`;
}

/** The search bar's line for a failed /api/geocode answer.  422 is a
 *  street pair typed with no city and no jurisdiction whose corner is
 *  not inside our places (#347, lib/geocode.ts).  #376: `reason` is the
 *  response body; a typed city outside Colorado and a partial match
 *  inside it each have their own line. */
export function geocodeErrorMessage(status: number, reason = ""): string {
  if (status === 422 && reason === "outside colorado") return "Plans cover Colorado roads only.";
  if (status === 404 && reason === "check spelling") {
    return "No match in Colorado for that city. Check the spelling.";
  }
  if (status === 404 && reason === "check address") {
    return "No match in Colorado for that address. Check the spelling.";
  }
  if (status === 503) return "Address search isn't set up here.";
  if (status === 404) return "No match for that address";
  if (status === 422) return "Add a city to search cross streets.";
  return `Address search failed (${status}). Try again.`;
}

/** The search bar's line for a failed /api/geocode response, read from
 *  its status and its reason body (#376). */
export async function geocodeFailureMessage(r: Response): Promise<string> {
  let reason = "";
  try {
    reason = (await r.text()).trim();
  } catch {
    // An unreadable body reads as the status alone.
  }
  return geocodeErrorMessage(r.status, reason);
}

/** #565 (ruling 4): the line for a search request that got no answer at
 *  all (the network failed), in place of the raw error text. */
export const SEARCH_NO_ANSWER = "The address search didn't answer. Try again.";

/** #565 (Ryan, 2026-11-24, ruling 2): a search message as the box's two
 *  lines, what happened and what to do next.  A message's last sentence
 *  is its next step; a one-sentence message has none (Rule 10: no step is
 *  made up).  A full stop inside a place name ("St. Vrain Rd") or a
 *  number ("39.7401") never splits: the split is at the last sentence. */
export type SearchMessage = { happened: string; next: string | null };
export function searchMessageLines(text: string): SearchMessage {
  const m = /^(.*[.?!])\s+([^.?!]+[.?!])$/.exec(text);
  return m ? { happened: m[1], next: m[2] } : { happened: text, next: null };
}
