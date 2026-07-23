// Single source of truth for corridor-zone identity across every surface
// (the live mapbox-gl picker map, the Static Images preview, and the
// on-screen legends).  #131: colour alone is invisible to a colour-vision-
// deficient reader and collapses in a grayscale/faxed/photocopied print —
// normal fates for a field document — so every zone also owns a *non-colour*
// channel here: a distinct dash signature and a monotonic stroke-width rank.
// Each surface keys off this one table, so the channels can never drift
// apart the way the old duplicated colour maps did.

export type CorridorZone =
  | "advance_warning"
  | "transition"
  | "buffer"
  | "work_zone"
  | "downstream";

// Corridor order, downstream (anchor, station 0) → upstream (advance
// warning).  Shared by every renderer so segment order and the width ramp
// stay in lockstep.
export const CORRIDOR_ZONES: readonly CorridorZone[] = [
  "downstream",
  "work_zone",
  "buffer",
  "transition",
  "advance_warning",
];

// Hex with leading ``#`` (mapbox-gl expressions accept either form; the rest
// of the component palette uses ``#``-prefixed strings).  The Static Images
// builder strips the ``#`` itself.
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

export interface ZoneChannel {
  // mapbox-gl ``line-dasharray``, in units of the line's own width.  A
  // single-element array is the sentinel for "solid" (renderers omit the
  // dasharray entirely rather than pass a 1-element array to GL).  Every
  // zone's array is distinct, and no two *adjacent* zones share one, so the
  // dash alone tells neighbours apart — asserted by the #131 guard test.
  dash: number[];
  // Monotonic stroke-width rank along ``CORRIDOR_ZONES``: 1 (downstream,
  // thinnest) → 5 (advance warning, thickest — the motorist's first
  // encounter reads loudest, matching the preview's existing intent).  Each
  // surface scales this rank to its own pixel budget.  Width is the ONLY
  // non-colour channel the Static Images preview can carry (its path
  // overlays cannot dash), so the ranks are all distinct and adjacent zones
  // always differ in width too.
  widthRank: number;
}

export const ZONE_CHANNEL: Record<CorridorZone, ZoneChannel> = {
  downstream: { dash: [1, 2], widthRank: 1 }, // fine dots — least critical
  work_zone: { dash: [1], widthRank: 2 }, // solid — the active work area
  buffer: { dash: [2, 2], widthRank: 3 }, // short dash
  transition: { dash: [3, 1, 1, 1], widthRank: 4 }, // dash-dot — the taper
  advance_warning: { dash: [6, 3], widthRank: 5 }, // long dash — loudest
};
