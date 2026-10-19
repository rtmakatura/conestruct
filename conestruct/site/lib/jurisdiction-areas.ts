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
}

const AREAS: SearchArea[] = Object.entries(data.areas).map(([key, a]) => ({
  key,
  name: a.name,
  bbox: a.bbox as BBox,
}));

/** The area for a jurisdiction key, or null when the key has no TIGER
 *  place (cdot, e470 and the county records carry none). */
export function areaForKey(key: string | null | undefined): SearchArea | null {
  if (!key) return null;
  return AREAS.find((a) => a.key === key) ?? null;
}

/** The area whose place name is exactly `name` (case-insensitive). */
export function areaForName(name: string): SearchArea | null {
  const n = name.trim().toLowerCase();
  return AREAS.find((a) => a.name.toLowerCase() === n) ?? null;
}

export function bboxCenter(b: BBox): [number, number] {
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}
