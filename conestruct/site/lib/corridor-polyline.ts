// The corridor polyline's TYPES and the zone identity re-exports.
//
// #301: the client-side projection that lived here (`buildCorridorPolyline`,
// walking a station frame from lib/centerline.ts with lengths from
// lib/corridor-map.ts) is deleted — a frontend mirror of corridor math the
// backend owns (Rule 3; #290 checkpoint row 26).  The picker's overlay is the
// backend's geometry (lib/corridor-geometry.ts `geometryToPolyline`), in the
// shape these types describe; the band's aerial is the backend's picture.

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
  // #290 hand-check: the first road-backed station, when the backend's
  // geometry starts past the anchor (the work-start anchor beyond the
  // way's downstream end).  Absent / 0: the road reaches the anchor.
  coverageStartFt?: number | null;
  // West, south, east, north — suitable for ``map.fitBounds``.
  bbox: [number, number, number, number];
}
