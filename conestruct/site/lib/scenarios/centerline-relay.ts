// #140 — materialize ``meta.centerline`` on the outgoing wire scenario.
//
// The confirmed road candidate's OSM way geometry lives on
// ``meta.confirmedRoad`` (the picker's persistence record).  The
// backend needs it as a first-class field to draw the PDF corridor
// along the road, but duplicating it into mutable scenario state would
// mean tracking every confirmedRoad invalidation site.  Instead the
// wire field is derived HERE, at serialization time, behind the same
// staleness key the picker itself uses (exact pinLat/pinLng equality —
// LocationPickerModal's restore guard): a moved pin means the geometry
// no longer describes the site, so the render falls back to the
// straight frame rather than relaying a stale road.

import type { Scenario } from "./types";

export function withRelayedCenterline<S extends Scenario>(scenario: S): S {
  const meta = scenario.meta;
  const confirmed = meta.confirmedRoad;
  const geometry = confirmed?.candidate.geometry;
  if (!confirmed || !geometry || geometry.length < 2) return scenario;
  if (confirmed.pinLat !== meta.lat || confirmed.pinLng !== meta.lng) return scenario;
  return { ...scenario, meta: { ...meta, centerline: geometry } };
}
