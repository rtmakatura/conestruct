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

export type CorridorZone =
  | "advance_warning"
  | "transition"
  | "buffer"
  | "work_zone"
  | "downstream";

// Hex with leading ``#`` (mapbox-gl expressions accept either form, but
// the rest of our component palette uses ``#``-prefixed strings).
export const ZONE_COLOR: Record<CorridorZone, string> = {
  advance_warning: "#FFD166", // amber
  transition: "#F3722C", // orange
  buffer: "#FF7A00", // deeper orange (deceleration)
  work_zone: "#1EC8A5", // teal
  downstream: "#8A8A8A", // muted gray
};

export const ZONE_LABEL: Record<CorridorZone, string> = {
  advance_warning: "Advance warning",
  transition: "Taper",
  buffer: "Buffer",
  work_zone: "Work zone",
  downstream: "Downstream",
};

// Order matches the upstream-walking convention used by the static-image
// route.  Anchor → downstream → work → buffer → transition → advance.
const ZONE_ORDER: readonly CorridorZone[] = [
  "downstream",
  "work_zone",
  "buffer",
  "transition",
  "advance_warning",
];

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
