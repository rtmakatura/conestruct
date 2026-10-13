// Rule 169 (R144 Q4): the zone geometry's second home.  Rule 169 drops the
// counts hero's geometry cell at the phone width "because its four rows are
// reachable in the reference disclosure"; this group is where they are
// reachable, at every width.  The rows are the hero's own
// (``zoneGeometryRows``), from the same device-breakdown response, and the
// same degradation applies (rule 83): no ``zone_geometry`` renders one
// "Zone geometry unavailable" row and nothing is computed here.  During a
// refetch the group holds the previous answer, as the hero does; the
// results stack's cue says so (#187).

import type { DeviceBreakdownState } from "./DeviceBreakdown";
import { zoneGeometryRows } from "./ResultsHero";

export function ZoneGeometryGroup({ breakdown }: { breakdown: DeviceBreakdownState }) {
  const d =
    breakdown.state === "ready"
      ? breakdown.data
      : breakdown.state === "loading"
        ? (breakdown.lastReady ?? null)
        : null;
  // No answer yet, or a failed one: the device schedule chip below names
  // the loading or the failure; this group says nothing it doesn't have.
  if (d === null) return null;
  const g = d.zone_geometry ?? null;
  return (
    <div className="zone-geo">
      <div className="ref-group-label">Zone geometry</div>
      {g ? (
        zoneGeometryRows(g).map((row) => (
          <div className="zg-row" key={row.label}>
            <span>{row.label}</span>
            <span className="zg-val">{row.value}</span>
          </div>
        ))
      ) : (
        <div className="zg-row">
          <span>Zone geometry unavailable</span>
        </div>
      )}
    </div>
  );
}
