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

import { destinationPoint, M_PER_FT } from "./geodesy";
import type { CorridorSpec } from "./corridor-map";
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

function zoneLengthFt(spec: CorridorSpec, zone: CorridorZone): number {
  switch (zone) {
    case "downstream":
      return spec.downstreamTaperFt;
    case "work_zone":
      return spec.workZoneFt;
    case "buffer":
      return spec.bufferFt;
    case "transition":
      return spec.taperFt;
    case "advance_warning":
      return spec.advanceWarningFt;
  }
}

export function buildCorridorPolyline(spec: CorridorSpec): CorridorPolyline {
  const segments: CorridorPolylineSegment[] = [];
  let cursor = 0;

  let minLat = spec.anchorLat;
  let maxLat = spec.anchorLat;
  let minLng = spec.anchorLng;
  let maxLng = spec.anchorLng;

  for (const zone of ZONE_ORDER) {
    const length = zoneLengthFt(spec, zone);
    if (length <= 0) {
      cursor += length;
      continue;
    }
    const start = cursor;
    const end = cursor + length;
    const coords: Array<[number, number]> = [];
    for (let i = 0; i <= SAMPLES_PER_SEGMENT; i++) {
      const station = start + ((end - start) * i) / SAMPLES_PER_SEGMENT;
      const distM = station * M_PER_FT;
      const [lat, lng] = destinationPoint(
        spec.anchorLat,
        spec.anchorLng,
        spec.bearingDeg,
        distM,
      );
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
