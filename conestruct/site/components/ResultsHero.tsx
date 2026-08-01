// Zone 2 hero — device + type counts get the largest treatment on the
// page (the two numbers a CBC estimator prices from), with the backend
// zone-geometry strip beside them.  Every value renders verbatim from
// the device-breakdown response: counts from total_devices /
// unique_types, the jurisdiction-required tally from the backend's
// jurisdiction_required flags on devices[], and the geometry rows from
// zone_geometry (taper_l_ft / buffer_b_ft / device_spacing_ft /
// work_len_ft).  Nothing is computed here — when zone_geometry is
// absent (pre-extension backend) the meta rows hide rather than
// recompute (diff-note §6).

import type { DeviceBreakdownState } from "./DeviceBreakdown";
import type { JurisdictionBlock } from "@/lib/jurisdiction";

interface Props {
  breakdown: DeviceBreakdownState;
  jurisdiction: JurisdictionBlock | null;
}

export function ResultsHero({ breakdown, jurisdiction }: Props) {
  // #192: during a refetch the hero holds the carried previous answer —
  // the parent renders it dimmed under an explicit recomputing ribbon,
  // so the stale values are marked, never presented as current.
  const d =
    breakdown.state === "ready"
      ? breakdown.data
      : breakdown.state === "loading"
        ? (breakdown.lastReady ?? null)
        : null;
  if (d === null) return null;
  // Defensive against a malformed/partial response: a hero that crashes
  // takes the whole results zone with it.
  const jrCount = (d.devices ?? []).filter(
    (r) => r.jurisdiction_required,
  ).length;
  const g = d.zone_geometry ?? null;
  if (d.total_devices == null || d.unique_types == null) return null;

  return (
    <div className="hero">
      <span className="tick tl" aria-hidden />
      <span className="tick br" aria-hidden />
      <div className="hero-cell">
        <span className="k">Total devices</span>
        <div className="num">{d.total_devices}</div>
        <div className="sub">
          on the plan sheet
          {jrCount > 0 && (
            <>
              {" "}
              · incl. <b>+{jrCount}</b> jurisdiction-required
            </>
          )}
        </div>
      </div>
      <div className="hero-cell">
        <span className="k">Unique types</span>
        <div className="num">{d.unique_types}</div>
        <div className="sub">
          distinct device types to source
          {jrCount > 0 && jurisdiction && (
            <>
              {" "}
              · <b>{jrCount}</b> from {jurisdiction.name}
            </>
          )}
        </div>
      </div>
      <div className="hero-meta">
        <div className="caseid">
          {jurisdiction
            ? `${jurisdiction.name} · ${jurisdiction.tcp_term}`
            : "Baseline · MHT"}
        </div>
        {g ? (
          <>
            <div className="row">
              <span>Taper L</span>
              <span className="mv">{g.taper_l_ft} ft</span>
            </div>
            <div className="row">
              <span>Buffer B</span>
              <span className="mv">{g.buffer_b_ft} ft</span>
            </div>
            <div className="row">
              <span>Device spacing</span>
              <span className="mv">{g.device_spacing_ft} ft o.c.</span>
            </div>
            <div className="row">
              <span>Work zone</span>
              <span className="mv">
                {g.work_len_ft.toLocaleString("en-US")} ft
              </span>
            </div>
          </>
        ) : (
          <div className="row">
            <span>Zone geometry unavailable</span>
          </div>
        )}
      </div>
    </div>
  );
}
