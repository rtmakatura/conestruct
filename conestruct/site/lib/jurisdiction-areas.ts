// #347: the geocoder's search areas, one box per TIGER place in
// data/boundaries/.  The JSON is built by scripts/build_jurisdiction_areas.py
// (tests/test_jurisdiction_areas.py fails when it drifts), so every
// coordinate is a Census polygon's extent, never a hand-picked number.

import data from "./jurisdiction-areas.json";

/** [minLng, minLat, maxLng, maxLat], Mapbox's bbox order. */
export type BBox = [number, number, number, number];

export interface SearchArea {
  key: string;
  name: string;
  bbox: BBox;
  /** #352: a whole state (cdot's Colorado), too wide to recenter on. */
  statewide?: true;
}

/** The extent of every place below together (no city, no jurisdiction). */
export const COMBINED_BBOX = data.combined as BBox;

/** #376: Colorado's TIGER extent (cdot's authority area).  Every
 *  cross-street answer must lie inside it. */
export const COLORADO_BBOX = data.authority_areas.cdot.bbox as BBox;

const AREAS: SearchArea[] = Object.entries(data.areas).map(([key, a]) => ({
  key,
  name: a.name,
  bbox: a.bbox as BBox,
}));

// #352: the jurisdictions with no TIGER place, each scoped by its own
// record's authority: Colorado for cdot, El Paso County, the Loveland
// place.  e470's toll corridor has no sourced polygon and is absent.
const AUTHORITY_AREAS: SearchArea[] = Object.entries(data.authority_areas).map(
  ([key, a]) => ({
    key,
    name: a.name,
    bbox: a.bbox as BBox,
    ...(a.scope === "state" ? { statewide: true as const } : {}),
  }),
);

/** The area for a jurisdiction key: its TIGER place, else its authority's
 *  TIGER state, county or place extent, else null (e470). */
export function areaForKey(key: string | null | undefined): SearchArea | null {
  if (!key) return null;
  return (
    AREAS.find((a) => a.key === key) ?? AUTHORITY_AREAS.find((a) => a.key === key) ?? null
  );
}

/** The area whose place name is exactly `name` (case-insensitive). */
export function areaForName(name: string): SearchArea | null {
  const n = name.trim().toLowerCase();
  return AREAS.find((a) => a.name.toLowerCase() === n) ?? null;
}

export function bboxCenter(b: BBox): [number, number] {
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}
