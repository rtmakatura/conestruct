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
  // #290: under the work-start model the road's raw direction facts ride
  // with its geometry, behind the same staleness key — the backend
  // honours the one-way tag with them (ruling 8, #298).  Never on a
  // corridor_end pin, whose backend gate refuses the key.
  const roadDirection =
    meta.pinModel === "work_start"
      ? {
          roadDirection: {
            osmBearingDeg: ((confirmed.candidate.bearing % 360) + 360) % 360,
            oneway: confirmed.candidate.tags?.oneway ?? null,
          },
        }
      : {};
  return { ...scenario, meta: { ...meta, centerline: geometry, ...roadDirection } };
}
