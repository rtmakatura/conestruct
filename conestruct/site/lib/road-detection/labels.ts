import type { RoadCandidate } from "./types";

// Translate a compass bearing into the closest cardinal/intercardinal
// label DOT crews use for travel direction.  Cardinal directions take
// the "-bound" suffix ("Northbound"); intercardinal use the shorter
// compass form ("Northeast") since "Northeastbound" is awkward.
export function bearingToDirectionLabel(deg: number): string {
  const n = ((deg % 360) + 360) % 360;
  if (n < 22.5 || n >= 337.5) return "Northbound";
  if (n < 67.5) return "Northeast";
  if (n < 112.5) return "Eastbound";
  if (n < 157.5) return "Southeast";
  if (n < 202.5) return "Southbound";
  if (n < 247.5) return "Southwest";
  if (n < 292.5) return "Westbound";
  return "Northwest";
}

// Human-readable form of an OSM highway class for use as a sub-label
// in the candidate picker.  The picker shows this under the primary
// (name) label so two same-named roads of different classes — e.g., a
// frontage road tagged `service` parallel to a main `primary` arterial
// — are distinguishable at a glance.
export function humanizeHighwayClass(cls: string): string {
  switch (cls) {
    case "motorway": return "Freeway";
    case "motorway_link": return "Freeway ramp";
    case "trunk": return "Trunk";
    case "trunk_link": return "Trunk ramp";
    case "primary": return "Primary";
    case "primary_link": return "Primary ramp";
    case "secondary": return "Secondary";
    case "secondary_link": return "Secondary ramp";
    case "tertiary": return "Tertiary";
    case "tertiary_link": return "Tertiary ramp";
    case "unclassified": return "Local road";
    case "residential": return "Residential";
    default: return cls;
  }
}

// Build the visible label for a candidate in the picker.  `primary` is
// the road identifier (name → ref → "Unnamed <class>"), `sub` is the
// humanized highway class, `direction` is the cardinal/intercardinal
// bearing label.  Splitting into three pieces lets the picker render
// each in its own typographic weight without re-parsing.
export interface CandidateLabel {
  primary: string;
  sub: string;
  direction: string;
}

export function candidateLabel(c: RoadCandidate): CandidateLabel {
  const direction = bearingToDirectionLabel(c.bearing);
  const sub = humanizeHighwayClass(c.highway_class);
  const primary = c.name ?? c.ref ?? `Unnamed ${sub.toLowerCase()}`;
  return { primary, sub, direction };
}
