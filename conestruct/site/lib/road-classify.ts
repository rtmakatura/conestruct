// Server-side road classification using Mapbox Tilequery on streets-v8.
// Reads MAPBOX_TOKEN from env so the token never reaches the browser.
//
// Two queries: a tight one against the `road` layer to find the closest
// segment, and a wider one against `place_label` to detect whether we're
// inside or adjacent to a populated place (urban vs rural). Returns a
// RoadClassification with a confidence flag so the UI can warn the operator
// when the detection is borderline.

import type { RoadType } from "./scenarios";

export type Confidence = "high" | "medium" | "low";

export interface RoadClassification {
  roadType: RoadType;
  divided: boolean;
  laneWidthFt: number;
  confidence: Confidence;
  source: "mapbox-tilequery";
  raw: {
    class: string;
    oneway: boolean;
    structure: string | null; // "bridge" | "tunnel" | null
    roadName: string | null;
    roadRef: string | null; // route number (e.g. "US 85")
    place: string | null; // OSM place class — city/town/etc.
    placeName: string | null;
  };
}

export type ClassifyResult =
  | { ok: true; result: RoadClassification }
  | { ok: false; status: number; reason: string };

interface MapboxFeature {
  properties?: Record<string, unknown>;
  tilequery?: { distance?: number; layer?: string };
}

interface TilequeryResponse {
  features?: MapboxFeature[];
}

const STREETS_TILESET = "mapbox.mapbox-streets-v8";

// Treat these OSM `place=*` classes as "urban" for road-type assignment.
const URBAN_PLACE_CLASSES = new Set([
  "city",
  "town",
  "suburb",
  "neighbourhood",
]);

async function tilequery(
  layers: string,
  lat: number,
  lng: number,
  radius: number,
  signal: AbortSignal | undefined,
  token: string,
): Promise<TilequeryResponse | null> {
  const url =
    `https://api.mapbox.com/v4/${STREETS_TILESET}/tilequery/` +
    `${lng},${lat}.json?radius=${radius}&limit=10&dedupe=true` +
    `&layers=${encodeURIComponent(layers)}&access_token=${encodeURIComponent(token)}`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return (await r.json()) as TilequeryResponse;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return null;
  }
}

function pickClosestRoad(resp: TilequeryResponse | null): MapboxFeature | null {
  if (!resp?.features?.length) return null;
  // The tilequery response is already ordered by distance ascending, but a
  // few low-relevance footways/paths can sit closer than the actual road —
  // skip them in favor of a real driveable class.
  const driveable = new Set([
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "street",
    "street_limited",
    "service",
  ]);
  for (const f of resp.features) {
    const cls = String(f.properties?.class ?? "");
    if (driveable.has(cls)) return f;
  }
  return resp.features[0] ?? null;
}

function pickClosestPlace(resp: TilequeryResponse | null): MapboxFeature | null {
  if (!resp?.features?.length) return null;
  const knownPlaces = new Set([
    "city",
    "town",
    "village",
    "hamlet",
    "suburb",
    "neighbourhood",
  ]);
  for (const f of resp.features) {
    const cls = String(f.properties?.class ?? "");
    if (knownPlaces.has(cls)) return f;
  }
  return null;
}

function pickClosestRoadLabel(
  resp: TilequeryResponse | null,
  withinM: number,
): MapboxFeature | null {
  if (!resp?.features?.length) return null;
  let best: MapboxFeature | null = null;
  let bestDist = Infinity;
  for (const f of resp.features) {
    if (f.tilequery?.layer !== "road_label") continue;
    const d = f.tilequery?.distance ?? Infinity;
    if (d < bestDist && d <= withinM) {
      best = f;
      bestDist = d;
    }
  }
  return best;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function classify(
  road: MapboxFeature,
  place: MapboxFeature | null,
  roadLabel: MapboxFeature | null,
): RoadClassification {
  const cls = String(road.properties?.class ?? "");
  const oneway = road.properties?.oneway === 1 || road.properties?.oneway === true;
  const structure = strOrNull(road.properties?.structure);
  const placeClass = place ? String(place.properties?.class ?? "") : null;
  const placeName = place ? strOrNull(place.properties?.name) : null;
  const roadName = roadLabel ? strOrNull(roadLabel.properties?.name) : null;
  const roadRef = roadLabel ? strOrNull(roadLabel.properties?.ref) : null;
  const isUrban = placeClass !== null && URBAN_PLACE_CLASSES.has(placeClass);

  let roadType: RoadType;
  let divided: boolean;
  let confidence: Confidence;

  if (cls === "motorway" || cls === "motorway_link") {
    roadType = "freeway";
    divided = true;
    confidence = "high";
  } else if (cls === "trunk" || cls === "trunk_link") {
    // Trunks (US/state primary routes) are typically multi-lane divided.
    roadType = isUrban ? "urban_arterial" : "rural_divided";
    divided = true;
    confidence = "medium";
  } else if (cls === "primary" || cls === "primary_link") {
    if (oneway) {
      // One-way primary in either direction implies a couplet → divided.
      roadType = isUrban ? "urban_arterial" : "rural_divided";
      divided = true;
      confidence = "medium";
    } else {
      roadType = isUrban ? "urban_arterial" : "rural_undivided";
      divided = false;
      confidence = "medium";
    }
  } else if (cls === "secondary" || cls === "secondary_link") {
    roadType = isUrban ? "urban_arterial" : "rural_undivided";
    divided = false;
    confidence = "medium";
  } else if (
    cls === "tertiary" ||
    cls === "tertiary_link" ||
    cls === "street" ||
    cls === "street_limited"
  ) {
    roadType = isUrban ? "urban_arterial" : "rural_undivided";
    divided = false;
    confidence = "low";
  } else {
    // service, residential, path, etc. — uncommon TC sites; fall back low.
    roadType = isUrban ? "urban_arterial" : "rural_undivided";
    divided = false;
    confidence = "low";
  }

  return {
    roadType,
    divided,
    laneWidthFt: 12,
    confidence,
    source: "mapbox-tilequery",
    raw: {
      class: cls,
      oneway,
      structure,
      roadName,
      roadRef,
      place: placeClass,
      placeName,
    },
  };
}

export async function classifyRoadAtPoint(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ClassifyResult> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return { ok: false, status: 503, reason: "MAPBOX_TOKEN not configured" };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, status: 400, reason: "invalid coords" };
  }

  // Run tilequeries in parallel — road + road_label share a tight radius
  // (we only want the label that belongs to the matched road); place_label
  // uses a wider radius so we can detect adjacent populated areas.
  const [roadResp, placeResp] = await Promise.all([
    tilequery("road,road_label", lat, lng, 30, signal, token),
    tilequery("place_label", lat, lng, 3000, signal, token),
  ]);

  const road = pickClosestRoad(roadResp);
  if (!road) {
    return { ok: false, status: 404, reason: "no road found near point" };
  }
  const place = pickClosestPlace(placeResp);
  const roadLabel = pickClosestRoadLabel(roadResp, 25);
  return { ok: true, result: classify(road, place, roadLabel) };
}
