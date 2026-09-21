// Zone 2 counts hero — device + type counts get the largest treatment on the
// page (the two numbers a CBC estimator prices from), with the backend
// zone-geometry strip beside them.  Every value renders verbatim from
// the device-breakdown response: counts from total_devices /
// unique_types, the jurisdiction-required tally from the backend's
// jurisdiction_required flags on devices[], and the geometry rows from
// zone_geometry (taper_l_ft / buffer_b_ft / device_spacing_ft /
// work_len_ft).  Nothing is computed here — when zone_geometry is
// absent (pre-extension backend) the meta rows hide rather than
// recompute (diff-note §6).
//
// #288 Phase 1 clause 2 (rulings.md) — restyled to #281 comment 1 rules
// 80–83.  Part 1 §8.7 renames it "counts hero" and KEEPS its behaviour:
// both numerals, both sub-lines, the case-ID line, the four geometry rows
// and rule 83's degradations are untouched below.  The diff is the shell
// (globals.css) plus two role classes and one deletion:
//   · the sub-line and the case-ID line take .tr-prov, the provenance
//     role rules 81 and 82 name, instead of declaring their own size —
//     so the restyle REMOVES two rows from #263's census rather than
//     moving them;
//   · the two corner ticks are deleted.  Rule 80 specifies the shell
//     completely — 1 px border, ground, three tracks — and the ticks are
//     decoration it does not carry.  Declared, not quietly dropped
//     (Rule 5).
// Rule 83 is unchanged and still lives here, not in CSS: an absent
// zone_geometry renders ONE "Zone geometry unavailable" row and nothing
// is recomputed locally; a response missing either count renders no hero
// at all.

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
      <div className="hero-cell">
        <span className="k">Total devices</span>
        <div className="num">{d.total_devices}</div>
        <div className="sub tr-prov">
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
        <div className="sub tr-prov">
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
        <div className="caseid tr-prov">
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
