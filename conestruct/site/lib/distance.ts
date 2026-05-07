const EARTH_R_MI = 3958.7613;

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Winding factor approximates driving distance from straight-line; 1.2 is
// typical for metro/suburban grids and is within ~10% of a routed Mapbox
// Directions response in the Denver area. Quote field rounds to 5-mi steps
// so the inflate-then-snap pattern keeps the auto value stable across small
// address tweaks.
const ROAD_WINDING_FACTOR = 1.2;
const QUOTE_MILE_STEP = 5;

export function approxRoadMiles(origin: LatLng, dest: LatLng): number {
  const straight = haversineMiles(origin, dest);
  const rounded =
    Math.round((straight * ROAD_WINDING_FACTOR) / QUOTE_MILE_STEP) *
    QUOTE_MILE_STEP;
  return Math.max(0, rounded);
}
