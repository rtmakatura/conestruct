// Client-side corridor → GeoJSON projection.  The static-image route at
// ``/api/corridor-map`` does the same math server-side for an immutable
// preview; this version returns plain GeoJSON so a live mapbox-gl map
// can re-render as the operator drags the pin or types a new work-zone
// length without round-tripping a token-bearing URL.
//
// The convention mirrors ``lib/corridor-map.ts`` and ``src/rules/corridor.py``:
// stations grow from the anchor (downstream end) along ``bearingDeg``
// toward the upstream end:
//
//   anchor(0) → downstream taper → work zone → buffer → transition →
//   advance warning → total length.

import { buildStationFrame, zonePointsAlongFrame } from "./centerline";
import { zoneLengthFt, type CorridorSpec } from "./corridor-map";
import {
  CORRIDOR_ZONES,
  ZONE_CHANNEL,
  ZONE_COLOR,
  ZONE_LABEL,
  type CorridorZone,
} from "./corridor-zones";

// Zone identity (type, colours, labels, non-colour channel, order) is
// single-sourced in ``./corridor-zones``; re-exported here so existing
// importers of this module are unaffected (#131).
export type { CorridorZone } from "./corridor-zones";
export { CORRIDOR_ZONES, ZONE_CHANNEL, ZONE_COLOR, ZONE_LABEL };

// Order matches the upstream-walking convention used by the static-image
// route.  Anchor → downstream → work → buffer → transition → advance.
const ZONE_ORDER = CORRIDOR_ZONES;

const SAMPLES_PER_SEGMENT = 4;

export interface CorridorPolylineSegment {
  zone: CorridorZone;
  color: string;
  // GeoJSON convention: [lng, lat] tuples.
  coords: Array<[number, number]>;
  startStationFt: number;
  endStationFt: number;
  lengthFt: number;
}

export interface CorridorPolyline {
  segments: CorridorPolylineSegment[];
  // GeoJSON FeatureCollection ready to hand to a mapbox-gl source.
  // Each feature carries a ``zone`` property so a single layer can
  // colour by ``match`` expression instead of per-zone layers.
  featureCollection: GeoJSON.FeatureCollection<GeoJSON.LineString, { zone: CorridorZone }>;
  totalLengthFt: number;
  // West, south, east, north — suitable for ``map.fitBounds``.
  bbox: [number, number, number, number];
}

export function buildCorridorPolyline(spec: CorridorSpec): CorridorPolyline {
  const segments: CorridorPolylineSegment[] = [];
  let cursor = 0;

  let minLat = spec.anchorLat;
  let maxLat = spec.anchorLat;
  let minLng = spec.anchorLng;
  let maxLng = spec.anchorLng;

  // One frame for the whole corridor (#140): with spec.centerline the
  // stations walk the road's arc; without it, the identical straight
  // dead-reckon as before.
  const frame = buildStationFrame(
    spec.anchorLat,
    spec.anchorLng,
    spec.bearingDeg,
    spec.centerline,
  );

  for (const zone of ZONE_ORDER) {
    const length = zoneLengthFt(spec, zone);
    if (length <= 0) {
      cursor += length;
      continue;
    }
    const start = cursor;
    const end = cursor + length;
    const coords: Array<[number, number]> = [];
    for (const [lat, lng] of zonePointsAlongFrame(frame, start, end, SAMPLES_PER_SEGMENT)) {
      coords.push([lng, lat]);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    segments.push({
      zone,
      color: ZONE_COLOR[zone],
      coords,
      startStationFt: start,
      endStationFt: end,
      lengthFt: length,
    });
    cursor = end;
  }

  const featureCollection: GeoJSON.FeatureCollection<
    GeoJSON.LineString,
    { zone: CorridorZone }
  > = {
    type: "FeatureCollection",
    features: segments.map((seg) => ({
      type: "Feature",
      properties: { zone: seg.zone },
      geometry: { type: "LineString", coordinates: seg.coords },
    })),
  };

  return {
    segments,
    featureCollection,
    totalLengthFt: cursor,
    bbox: [minLng, minLat, maxLng, maxLat],
  };
}
