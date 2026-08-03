// Station frame over an optional road centerline (#140).
//
// Every corridor drawing surface converts stations (feet from the
// anchor, growing along ``bearingDeg`` toward the upstream end) into
// lat/lng.  Without road geometry that conversion is a great-circle
// dead-reckon from the anchor — a straight chord that leaves the
// pavement on any curve.  This module builds the frame once from the
// confirmed road candidate's relayed OSM way geometry and walks the
// polyline by arc length instead, with tangent continuation past the
// geometry's ends (never a silent truncation — coverage is exposed so
// surfaces can disclose it).
//
// MIRROR NOTE (Rule 3): this positions frontend *previews* only.  The
// backend has its own authoritative copy of the same frame for the PDF
// (``WorkCorridor._centerline_frame`` in src/rules/corridor.py); both
// derive from the same relayed raw fact (``meta.centerline``).  No
// MUTCD length is computed here — zone lengths stay backend-owned.

import { destinationPoint, haversineM, initialBearingDeg, M_PER_FT } from "./geodesy";

export interface StationFrame {
  /** Lat/lng at a corridor station.  Dead-reckon when no geometry. */
  pointAtStationFt(stationFt: number): [number, number];
  /**
   * Corridor station (ft from the anchor) still covered by real
   * geometry, or null when the frame has no centerline at all.
   * Stations beyond this fall on the end-tangent continuation.
   */
  coverageFt: number | null;
  /**
   * Station of each centerline vertex (same index space as
   * ``centerline``), or null without geometry.  Lets drawing surfaces
   * place a vertex at every real road point inside a zone instead of
   * sampling a curve coarsely.
   */
  vertexStationsFt: number[] | null;
  centerline: Array<[number, number]> | null;
}

// Local-equirectangular point→segment projection, t clamped to [0, 1].
// Same math as /api/road-bearing's projectOnSegment and the backend's
// _project_onto_segment_m.
function projectArcM(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): { distM: number; t: number } {
  const kx = Math.cos((pLat * Math.PI) / 180) * 111_320;
  const ky = 110_540;
  const ax = (aLng - pLng) * kx;
  const ay = (aLat - pLat) * ky;
  const bx = (bLng - pLng) * kx;
  const by = (bLat - pLat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return { distM: Math.hypot(px, py), t };
}

export function buildStationFrame(
  anchorLat: number,
  anchorLng: number,
  bearingDeg: number,
  centerline?: Array<[number, number]> | null,
): StationFrame {
  if (!centerline || centerline.length < 2) {
    return {
      pointAtStationFt: (stationFt) =>
        destinationPoint(anchorLat, anchorLng, bearingDeg, stationFt * M_PER_FT),
      coverageFt: null,
      vertexStationsFt: null,
      centerline: null,
    };
  }

  const pts = centerline;
  const cumM: number[] = [0];
  for (let i = 0; i < pts.length - 1; i++) {
    cumM.push(cumM[i] + haversineM(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }

  // Project the anchor onto the polyline to find its arc position, and
  // read the direction sign off the local tangent vs the corridor
  // bearing (vertex ORDER carries no meaning — OSM ways run either way).
  let bestD = Infinity;
  let anchorArcM = 0;
  let anchorSeg = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const { distM, t } = projectArcM(
      anchorLat,
      anchorLng,
      pts[i][0],
      pts[i][1],
      pts[i + 1][0],
      pts[i + 1][1],
    );
    if (distM < bestD) {
      bestD = distM;
      anchorArcM = cumM[i] + t * (cumM[i + 1] - cumM[i]);
      anchorSeg = i;
    }
  }
  const tangent = initialBearingDeg(
    pts[anchorSeg][0],
    pts[anchorSeg][1],
    pts[anchorSeg + 1][0],
    pts[anchorSeg + 1][1],
  );
  const diff = ((tangent - bearingDeg + 540) % 360) - 180;
  const sign = Math.abs(diff) <= 90 ? 1 : -1;

  const totalArcM = cumM[cumM.length - 1];
  const coverageFt = (sign > 0 ? totalArcM - anchorArcM : anchorArcM) / M_PER_FT;
  const vertexStationsFt = cumM.map((c) => (sign * (c - anchorArcM)) / M_PER_FT);

  const pointAtStationFt = (stationFt: number): [number, number] => {
    const sM = anchorArcM + sign * stationFt * M_PER_FT;
    if (sM <= 0) {
      const outTangent = initialBearingDeg(pts[1][0], pts[1][1], pts[0][0], pts[0][1]);
      return destinationPoint(pts[0][0], pts[0][1], outTangent, -sM);
    }
    if (sM >= totalArcM) {
      const n = pts.length;
      const outTangent = initialBearingDeg(
        pts[n - 2][0],
        pts[n - 2][1],
        pts[n - 1][0],
        pts[n - 1][1],
      );
      return destinationPoint(pts[n - 1][0], pts[n - 1][1], outTangent, sM - totalArcM);
    }
    for (let i = 0; i < cumM.length - 1; i++) {
      if (cumM[i] <= sM && sM <= cumM[i + 1]) {
        const segM = cumM[i + 1] - cumM[i];
        const t = segM === 0 ? 0 : (sM - cumM[i]) / segM;
        return [
          pts[i][0] + t * (pts[i + 1][0] - pts[i][0]),
          pts[i][1] + t * (pts[i + 1][1] - pts[i][1]),
        ];
      }
    }
    return pts[pts.length - 1];
  };

  return { pointAtStationFt, coverageFt, vertexStationsFt, centerline: pts };
}

/**
 * Lat/lng vertices for one zone: both boundary stations exactly, plus
 * (with geometry) every centerline vertex strictly inside the zone.
 * Without geometry: ``samples + 1`` evenly spaced dead-reckoned points —
 * numerically identical to the pre-#140 per-zone sampling, so existing
 * straight-frame output is unchanged.
 */
export function zonePointsAlongFrame(
  frame: StationFrame,
  startStationFt: number,
  endStationFt: number,
  samples = 4,
): Array<[number, number]> {
  if (frame.vertexStationsFt === null) {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= samples; i++) {
      const station = startStationFt + ((endStationFt - startStationFt) * i) / samples;
      pts.push(frame.pointAtStationFt(station));
    }
    return pts;
  }
  const interior: Array<{ station: number; pt: [number, number] }> = [];
  const centerline = frame.centerline;
  if (centerline) {
    for (let i = 0; i < frame.vertexStationsFt.length; i++) {
      const station = frame.vertexStationsFt[i];
      if (station > startStationFt && station < endStationFt) {
        interior.push({ station, pt: centerline[i] });
      }
    }
    interior.sort((a, b) => a.station - b.station);
  }
  return [
    frame.pointAtStationFt(startStationFt),
    ...interior.map((v) => v.pt),
    frame.pointAtStationFt(endStationFt),
  ];
}
