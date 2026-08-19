// Client-side corridor → GeoJSON projection.  Returns plain GeoJSON so a
// live mapbox-gl map can re-render as the operator drags the pin or types
// a new work-zone length without round-tripping a token-bearing URL.
//
// The convention mirrors ``src/rules/corridor.py``:
// stations grow from the anchor (downstream end) along ``bearingDeg``
// toward the upstream end:
//
//   anchor(0) → downstream taper → work zone → buffer → transition →
//   advance warning → total length.
//
// #211: the station frame's ``coverageFt`` (how far real road geometry
// reaches before the tangent continuation takes over) is surfaced here —
// each GeoJSON feature carries an ``extended`` flag and zones are split
// at the coverage boundary, so the drawing can render beyond-geometry
// footage visibly different from road-backed footage instead of a
// tangent ray silently posing as the road (Rule 10).

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

// Order matches the upstream-walking convention used by the backend.
// Anchor → downstream → work → buffer → transition → advance.
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

export interface CorridorFeatureProps {
  zone: CorridorZone;
  // True for footage beyond the road geometry's reach — drawn on the
  // end-tangent continuation, not on relayed OSM vertices (#211).
  extended: boolean;
  // Exactly one feature per zone carries the zone label (the longer
  // sub-feature when the zone splits at the coverage boundary), so the
  // line-center symbol layer never doubles a zone's label.
  labeled: boolean;
}

export interface CorridorPolyline {
  segments: CorridorPolylineSegment[];
  // GeoJSON FeatureCollection ready to hand to a mapbox-gl source.
  // Zones split at ``coverageFt`` into road-backed and extended
  // features (#211); a single layer per zone filters by ``zone`` and
  // styles by ``extended``.
  featureCollection: GeoJSON.FeatureCollection<GeoJSON.LineString, CorridorFeatureProps>;
  totalLengthFt: number;
  // Station (ft from the anchor) still covered by real road geometry;
  // null when the frame has no centerline (manual straight projection).
  coverageFt: number | null;
  // West, south, east, north — suitable for ``map.fitBounds``.
  bbox: [number, number, number, number];
}

export function buildCorridorPolyline(spec: CorridorSpec): CorridorPolyline {
  const segments: CorridorPolylineSegment[] = [];
  type Feature = GeoJSON.Feature<GeoJSON.LineString, CorridorFeatureProps>;
  const features: Feature[] = [];
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
  const coverageFt = frame.coverageFt;

  const toCoords = (pts: Array<[number, number]>): Array<[number, number]> => {
    const coords: Array<[number, number]> = [];
    for (const [lat, lng] of pts) {
      coords.push([lng, lat]);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    return coords;
  };

  for (const zone of ZONE_ORDER) {
    const length = zoneLengthFt(spec, zone);
    if (length <= 0) {
      cursor += length;
      continue;
    }
    const start = cursor;
    const end = cursor + length;

    // Sub-spans at the coverage boundary (#211).  No centerline, or a
    // boundary outside this zone, leaves the zone whole — the manual /
    // fully-covered paths emit exactly the pre-#211 single feature.
    const spans: Array<{ a: number; b: number; extended: boolean }> = [];
    if (coverageFt === null || coverageFt >= end) {
      spans.push({ a: start, b: end, extended: false });
    } else if (coverageFt <= start) {
      spans.push({ a: start, b: end, extended: true });
    } else {
      spans.push({ a: start, b: coverageFt, extended: false });
      spans.push({ a: coverageFt, b: end, extended: true });
    }
    const longest = spans.reduce((m, s) => Math.max(m, s.b - s.a), 0);
    const zoneCoords: Array<[number, number]> = [];
    let labelUsed = false;
    for (const s of spans) {
      const coords = toCoords(
        zonePointsAlongFrame(frame, s.a, s.b, SAMPLES_PER_SEGMENT),
      );
      const labeled = !labelUsed && s.b - s.a === longest;
      if (labeled) labelUsed = true;
      features.push({
        type: "Feature",
        properties: { zone, extended: s.extended, labeled },
        geometry: { type: "LineString", coordinates: coords },
      });
      for (const c of coords) {
        const last = zoneCoords[zoneCoords.length - 1];
        if (!last || last[0] !== c[0] || last[1] !== c[1]) zoneCoords.push(c);
      }
    }

    segments.push({
      zone,
      color: ZONE_COLOR[zone],
      coords: zoneCoords,
      startStationFt: start,
      endStationFt: end,
      lengthFt: length,
    });
    cursor = end;
  }

  return {
    segments,
    featureCollection: { type: "FeatureCollection", features },
    totalLengthFt: cursor,
    coverageFt,
    bbox: [minLng, minLat, maxLng, maxLat],
  };
}
