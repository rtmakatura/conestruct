// #290 — the laid-out corridor, as the BACKEND lays it (POST
// /api/render/corridor-geometry → /render/corridor-geometry).
//
// Ruling 7: "each approach's geometry returned by the backend, never sent
// on the request."  The picker's overlay used to walk the pin along a
// typed bearing itself (lib/centerline.ts + lib/corridor-polyline.ts, a
// documented frontend mirror of corridor math, Rule 3) — the mirror whose
// direction #298 found inverted.  This module only fetches the backend's
// answer and reshapes it into the overlay's existing GeoJSON form
// (``CorridorPolyline``), so the map's layers, legend and fit are
// unchanged.  No station, length or direction is computed here.

import { useEffect, useRef, useState } from "react";
import type { Scenario, WorkPlacement } from "@/lib/scenarios/types";
import {
  CORRIDOR_ZONES,
  ZONE_COLOR,
  ZONE_LABEL,
  type CorridorZone,
} from "./corridor-zones";
import type {
  CorridorFeatureProps,
  CorridorPolyline,
  CorridorPolylineSegment,
} from "./corridor-polyline";

type LatLng = [number, number];

export interface GeometryPart {
  points: LatLng[];
  extended: boolean;
}

export interface GeometryZone {
  zone: Exclude<CorridorZone, "work_zone">;
  length_ft: number;
  points: LatLng[];
  parts: GeometryPart[];
}

export interface GeometryApproach {
  id: "primary" | "opposing";
  travel_bearing_deg: number;
  zones: GeometryZone[];
}

export interface SideOption {
  /** Written verbatim to ``meta.work`` — never composed here. */
  work: WorkPlacement;
  /** "East side · northbound traffic" — the backend's words (ruling 8). */
  label: string;
  /** False: not buildable yet.  Never rendered — the #290 hand-check
   *  ruling (superseding the open-points ruling 2); the backend sends
   *  none, and the band filters any an older backend sends. */
  built: boolean;
  note?: string;
}

export type GeometryStatus =
  | "laid_out"
  | "no_pin"
  | "side_not_confirmed"
  | "no_bearing"
  | "corridor_unbuildable";

export interface CorridorGeometry {
  status: GeometryStatus;
  pin_model: "corridor_end" | "work_start";
  pin: LatLng | null;
  travel_bearing_deg: number | null;
  work: { length_ft: number; points: LatLng[]; parts: GeometryPart[] } | null;
  approaches: GeometryApproach[];
  coverage_ft: number | null;
  /** First road-backed station (#290 hand-check): above 0 when the work
   *  runs past the downstream end of the relayed way.  Absent from an
   *  older backend — read as 0. */
  coverage_start_ft?: number | null;
  message: string | null;
  side_options: SideOption[];
}

/** The side choice currently on the scenario, if it is one of the options. */
export function selectedSideOption(
  options: readonly SideOption[],
  work: WorkPlacement | undefined,
): SideOption | null {
  if (!work?.side) return null;
  return (
    options.find(
      (o) =>
        o.work.side === work.side &&
        (o.work.travel ?? null) === (work.travel ?? null) &&
        (o.work.heading ?? null) === (work.heading ?? null),
    ) ?? null
  );
}

// Direction words for a flagger's two approaches (rule 111: no channel's
// meaning may ride on position alone).  DISPLAY ONLY — a label on the
// backend's own ``travel_bearing_deg``, quantized like the backend's side
// words (nearest cardinal).
const BOUND = ["northbound", "eastbound", "southbound", "westbound"] as const;
function boundWord(deg: number): string {
  return BOUND[Math.floor((((deg % 360) + 360) % 360 + 45) / 90) % 4];
}

/** The backend's refusal, in its own words, for the picker to state
 *  (Rule 10: a corridor that cannot be laid out says why, never draws
 *  blank).  The exception's type name is the wire's, not the operator's. */
export function refusalReason(g: CorridorGeometry | null): string | null {
  if (!g || (g.status !== "corridor_unbuildable" && g.status !== "no_bearing")) return null;
  if (g.status === "no_bearing") return "no direction of travel for this pin";
  return (g.message ?? "the layout service gave no reason").replace(/^\w+Error:\s*/, "");
}

/**
 * The backend's geometry as the overlay's GeoJSON.  ``showApproaches``
 * false draws the work segment alone (rule 112: before the kind is
 * confirmed, nothing upstream is drawn).  Before the side is confirmed the
 * response has no work segment at all, and this returns null: the picker
 * then draws the pin and its one sentence (the pre-side ruling).
 */
export function geometryToPolyline(
  g: CorridorGeometry,
  opts: { showApproaches: boolean },
): CorridorPolyline | null {
  if (g.status !== "laid_out" || !g.work) return null;
  type Feature = GeoJSON.Feature<GeoJSON.LineString, CorridorFeatureProps & { label?: string }>;
  const features: Feature[] = [];
  const segments: CorridorPolylineSegment[] = [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  const toCoords = (pts: LatLng[]): Array<[number, number]> =>
    pts.map(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      return [lng, lat] as [number, number];
    });
  const push = (zone: CorridorZone, parts: GeometryPart[], label?: string) => {
    const longest = parts.reduce((m, p) => Math.max(m, p.points.length), 0);
    let labelUsed = false;
    for (const part of parts) {
      const labeled = !labelUsed && part.points.length === longest;
      if (labeled) labelUsed = true;
      features.push({
        type: "Feature",
        properties: { zone, extended: part.extended, labeled, ...(label ? { label } : {}) },
        geometry: { type: "LineString", coordinates: toCoords(part.points) },
      });
    }
  };

  push("work_zone", g.work.parts);
  const approaches = opts.showApproaches ? g.approaches : [];
  const named = approaches.length > 1;
  for (const approach of approaches) {
    const suffix = named ? ` · ${boundWord(approach.travel_bearing_deg)} approach` : "";
    for (const z of approach.zones) {
      push(z.zone, z.parts, named ? `${ZONE_LABEL[z.zone]}${suffix}` : undefined);
    }
  }

  // Legend / extent rows: the work and the PRIMARY approach, in corridor
  // order — the lengths the backend returned, never recomputed.
  const primary = approaches.find((a) => a.id === "primary");
  let cursor = 0;
  for (const zone of CORRIDOR_ZONES) {
    const lengthFt =
      zone === "work_zone"
        ? g.work.length_ft
        : (primary?.zones.find((z) => z.zone === zone)?.length_ft ?? 0);
    if (lengthFt <= 0) continue;
    if (zone !== "work_zone" && !primary) continue;
    segments.push({
      zone,
      color: ZONE_COLOR[zone],
      coords: [],
      startStationFt: cursor,
      endStationFt: cursor + lengthFt,
      lengthFt,
    });
    cursor += lengthFt;
  }

  return {
    segments,
    featureCollection: {
      type: "FeatureCollection",
      features: features as GeoJSON.Feature<GeoJSON.LineString, CorridorFeatureProps>[],
    },
    totalLengthFt: cursor,
    coverageFt: g.coverage_ft,
    coverageStartFt: g.coverage_ft === null ? null : (g.coverage_start_ft ?? 0),
    bbox: [minLng, minLat, maxLng, maxLat],
  };
}

export type GeometryFetch =
  | { state: "idle"; geometry: null }
  | { state: "loading"; geometry: CorridorGeometry | null }
  | { state: "ready"; geometry: CorridorGeometry }
  | { state: "error"; geometry: null };

/**
 * Fetch the backend's geometry for ``scenario`` (null: nothing to ask),
 * debounced 300 ms and superseded by any newer scenario — the same cadence
 * as the picker's retired corridor-spec fetch.  A read: no check fires, no
 * verdict is formed; the answer is kept only while it is the current
 * scenario's (a newer request clears nothing, an error clears the answer —
 * a stale corridor is never drawn as this one, Rule 10).
 */
export function useCorridorGeometry(scenario: Scenario | null): GeometryFetch {
  const [result, setResult] = useState<GeometryFetch>({ state: "idle", geometry: null });
  const key = scenario ? JSON.stringify(scenario) : null;
  const tokenRef = useRef(0);
  useEffect(() => {
    const token = ++tokenRef.current;
    if (key === null) {
      setResult({ state: "idle", geometry: null });
      return;
    }
    setResult((prev) => ({ state: "loading", geometry: prev.geometry }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/render/corridor-geometry", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: JSON.parse(key) }),
          signal: controller.signal,
        });
        if (tokenRef.current !== token) return;
        if (!r.ok) {
          setResult({ state: "error", geometry: null });
          return;
        }
        const g = (await r.json()) as CorridorGeometry;
        if (tokenRef.current !== token) return;
        setResult({ state: "ready", geometry: g });
      } catch {
        if (tokenRef.current === token) setResult({ state: "error", geometry: null });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);
  return result;
}
