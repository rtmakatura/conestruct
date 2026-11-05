"use client";

// Jurisdiction layer — the five app components from the design handoff
// (docs/design/design_handoff_jurisdiction_layer), recreated in the
// codebase's own patterns (TSX + Tailwind + the workbench role tokens).
//
// Every number, verdict, citation, tier, and dollar figure renders from
// the backend's evaluated ``jurisdiction`` block (rule 3 — the frontend
// computes nothing but presentation).  Band segments are derived here
// from the semantic hours windows (spec §1.1 #3), and that is the only
// derivation in the file.
//
// Color system (CLAUDE.md): interactive = --act cyan · generated output
// and count-affecting = --dim orange · warning = --warn amber + glyph ·
// pass/fail = --pass/--fail · no verdict = chromaless --none.  No signal
// relies on hue alone — every state carries a glyph or a word.

import { type ReactNode } from "react";
import {
  activeBandRow,
  dayLabel,
  deriveBandRows,
  dollars,
  fmtDate,
  hhmm,
  hourTick,
  rowBoundaries,
  leadNoticeLabel,
  meterRateLabel,
  normalizeChainLink,
  startNoLaterThan,
  type ChainLink,
  type JurisdictionSuggestion,
  JURISDICTION_OPTIONS,
  type AppliedDelta,
  type Chip,
  type JurisdictionBlock,
  type StreetClass,
  type TriggerStatus,
  type WorkScheduleInput,
} from "@/lib/jurisdiction";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1 · The evidence behind the two guesses (R108)
// ---------------------------------------------------------------------------
//
// R108 (2026-10-07): "No confirm step for guesses. Street class (from the
// road) and jurisdiction (from the pin) are prefilled like Road type
// already is ... There are no confirm, dismiss or suggestion rows."  The
// proposal rows, the ✓/× records and their Undo (#227), the agree / differ
// rows and the "N to confirm" count are gone with the confirm step
// (checkpoint §3 lists every ruling this overrides).
//
// What is NOT gone is the evidence (Rule 10, checkpoint D4): the lookup's
// reason, its boundary warnings, the TIGER caveat and the classification
// map caveat.  They are the field's details now — the popover behind its
// marker — and the boundary warnings stay on show in the cell (P3).  The
// sentences are the slots' own, unchanged.

/** The pin's boundary lookup, as the shell holds it (R108). */
export interface JurisdictionLookup {
  status: "idle" | "loading" | "ready" | "error";
  data: JurisdictionSuggestion | null;
}

function jurisdictionLabel(key: string): string {
  return JURISDICTION_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

/** The lookup's boundary warnings (near a boundary, an unsupported area):
 *  the one part of the evidence that stays on show in the cell, because
 *  it tells the operator to check something now (P3). */
export function JurisdictionWarnings({ lookup }: { lookup: JurisdictionLookup }) {
  const warnings = lookup.status === "ready" ? (lookup.data?.warnings ?? []) : [];
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w) => (
        <span
          key={`${w.kind}:${w.message}`}
          className="tr-prov is-amber warnrow"
          data-testid="jurisdiction-warning"
        >
          <span aria-hidden>⚠ </span>
          {w.message}
        </span>
      ))}
    </>
  );
}

/** Everything else the lookup said, for the jurisdiction field's details. */
export function JurisdictionEvidence({ lookup }: { lookup: JurisdictionLookup }) {
  if (lookup.status === "loading") {
    return (
      <div className="jbar-suggest quiet">
        <span aria-hidden>◌</span>
        <span>Checking boundary data…</span>
      </div>
    );
  }
  if (lookup.status === "error") {
    return (
      <div className="jbar-suggest quiet">
        <span aria-hidden>◌</span>
        <span>The boundary check failed, so nothing was filled in from the pin.</span>
      </div>
    );
  }
  const data = lookup.status === "ready" ? lookup.data : null;
  if (!data) {
    return (
      <div className="jbar-suggest quiet">
        <span aria-hidden>◌</span>
        <span>Drop a site pin to look up the jurisdiction.</span>
      </div>
    );
  }
  return (
    <div className="jbar-suggest">
      {data.suggestion && (
        <div className="sugg-reason">
          The pin is in {jurisdictionLabel(data.suggestion)}
          {data.confidence === "near_boundary" && " (near a boundary)"}.
        </div>
      )}
      <div className="sugg-reason">{data.reason}</div>
      <div className="honesty">
        Boundary data is approximate ({data.boundary_source.source},{" "}
        {data.boundary_source.vintage.split(" ")[0]}). Confirm the jurisdiction
        with the permitting authority.
      </div>
    </div>
  );
}

/** The street class's evidence: the tier it was guessed from and, where
 *  the jurisdiction classifies by an adopted map, that map — the tier is a
 *  proxy; the map governs. */
export function StreetClassEvidence({
  tier,
  jurisdiction,
}: {
  tier: string | null;
  jurisdiction: JurisdictionBlock | null;
}) {
  const map = jurisdiction?.classification_map_url ?? null;
  if (!tier && !jurisdiction?.class_required) return null;
  return (
    <div className="jbar-suggest">
      {tier && <div className="sugg-reason">detected road tier: OSM {tier}</div>}
      {jurisdiction?.class_required && (
        <span className="mapchip">
          {map ? (
            <>
              <span aria-hidden>◎ </span>
              <a href={map} target="_blank" rel="noreferrer">
                per {jurisdiction.name} functional classification map
              </a>
            </>
          ) : (
            <>
              ◎ {jurisdiction.name} classifies streets on its published map. Look
              the street up before you submit.
            </>
          )}
        </span>
      )}
      {map && tier && (
        <div className="honesty">
          Verify against{" "}
          <a href={map} target="_blank" rel="noreferrer">
            {jurisdiction?.name}&apos;s functional-classification map
          </a>
          . The road tier is a proxy; the adopted map governs.
        </div>
      )}
    </div>
  );
}

/** The street-class options, in the order the segmented control shows. */
export const STREET_CLASSES: [StreetClass, string][] = [
  ["local", "Local"],
  ["collector", "Collector"],
  ["arterial", "Arterial"],
];

// ---------------------------------------------------------------------------
// 2 · Delta Panel — what this jurisdiction changes vs. the baseline
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 3 · Work-Hours Card — bands from semantic windows; verdict from hours_eval
// ---------------------------------------------------------------------------

/** Same-day overlay segments for the schedule band; end < start wraps
 *  past midnight (#188), matching the backend's segment convention. */
function scheduleOverlaySegments(
  start: number,
  end: number,
): [number, number][] {
  return end > start
    ? [[start, end]]
    : [
        [start, 24],
        [0, end],
      ];
}

interface WorkHoursProps {
  jurisdiction: JurisdictionBlock;
  streetClass: StreetClass | null;
  schedule: WorkScheduleInput | null;
  /** #152 D: true while a same-jurisdiction refetch is in flight (e.g. a
   *  street-class switch).  The card's CONTENT stays rendered — the
   *  windows and bands are jurisdiction facts — but ``hours_eval`` is a
   *  verdict computed for the previous input, so every verdict surface
   *  presents as checking instead (rule 10: a stale verdict may never
   *  display as current). */
  verifying?: boolean;
}

// #219 — the verdict block, extracted from WorkHoursCard so the tier
// containers and the Reference-tier card render the SAME single-sourced
// ``hours_eval`` (one backend verdict feeding both surfaces — never
// recomputed; the ruled hours split keeps the band chart in Reference
// while the verdict rides its tier).
/**
 * #215 — the boundary labels under one hours row.  Each sits at its
 * hour's own position on the 24-h bar.  Even-indexed labels take the
 * first line and odd-indexed the second, so two adjacent boundaries are
 * never on the same line; a label within an hour of either end is pinned
 * inside the bar instead of centred off its edge.  The row renders no
 * strip when it has no interior boundary (a whole-day window).
 */
export function BoundaryLabels({ hours }: { hours: number[] }) {
  if (hours.length === 0) return null;
  return (
    <div
      className={`relative ${hours.length > 1 ? "h-[22px]" : "h-[11px]"} font-mono text-[9px] leading-[11px] text-[color:var(--ink-faint)]`}
      data-testid="hours-boundaries"
    >
      {hours.map((h, i) => {
        const pin = h < 1 ? "translateX(0)" : h > 23 ? "translateX(-100%)" : "translateX(-50%)";
        return (
          <span
            key={h}
            className="absolute whitespace-nowrap"
            data-boundary-hour={h}
            data-boundary-line={i % 2}
            style={{ left: `${(h / 24) * 100}%`, top: i % 2 ? "11px" : "0", transform: pin }}
          >
            {hourTick(h)}
          </span>
        );
      })}
    </div>
  );
}

/** #443 X15: the 24 h bars, drawn the same in the card and the row's detail. */
export function HoursBars({
  jurisdiction,
  streetClass,
  schedule,
}: {
  jurisdiction: JurisdictionBlock;
  streetClass: StreetClass | null;
  schedule: WorkScheduleInput | null;
}) {
  const rows = deriveBandRows(jurisdiction.hours);
  const active = activeBandRow(rows, streetClass);
  const sched = schedule ?? null;
  const hoursKnown =
    sched != null &&
    sched.date_mode !== "tbd" &&
    sched.start_time != null &&
    sched.end_time != null;
  return (
        <div>
          {rows.map((r) => {
            const isActive = active === r;
            return (
              <div
                key={`${r.scope}-${r.days}`}
                // #215: at phone width the scope stacks above its bar, so
                // the bar — and its boundary labels — get the column.
                className="grid grid-cols-[130px_1fr] max-md:grid-cols-1 gap-2 items-center mb-1"
                data-testid="hours-row"
              >
                <div
                  className={`text-[11px] leading-tight ${
                    isActive
                      ? "text-[color:var(--ink)] font-semibold"
                      : "text-[color:var(--ink-faint)]"
                  }`}
                >
                  {r.scope}
                  <span className="block font-mono text-[9px] uppercase tracking-[0.06em] font-normal">
                    {dayLabel(r.days)}
                  </span>
                </div>
                <div>
                <div
                  className={`relative flex h-6 overflow-hidden ${
                    isActive ? "outline outline-1 outline-[color:var(--act)]" : ""
                  }`}
                >
                  {r.segments.map((s) => (
                    <div
                      key={`${s.startH}-${s.endH}`}
                      style={{ width: `${((s.endH - s.startH) / 24) * 100}%` }}
                      className={`flex items-center justify-center font-mono text-[8px] uppercase tracking-[0.1em] ${
                        s.t === "ban"
                          ? "bg-[repeating-linear-gradient(45deg,var(--paper-deep),var(--paper-deep)_4px,var(--paper-line-soft)_4px,var(--paper-line-soft)_8px)] text-[color:var(--ink-faint)]"
                          : "bg-[color:var(--pass-soft)] text-[color:var(--pass)]"
                      }`}
                    >
                      {s.endH - s.startH >= 3 ? (s.t === "ban" ? "banned" : "ok") : ""}
                    </div>
                  ))}
                  {isActive &&
                    hoursKnown &&
                    sched &&
                    // An overnight schedule (#188: end < start wraps past
                    // midnight) overlays as two segments, mirroring how the
                    // window bands themselves split at midnight.
                    scheduleOverlaySegments(
                      sched.start_time as number,
                      sched.end_time as number,
                    ).map(([a, b]) => (
                      <div
                        key={`sched-${a}`}
                        aria-hidden
                        className="absolute top-0 bottom-0 border-x-2 border-[color:var(--act)] bg-[color:var(--act-glow)]"
                        style={{
                          left: `${(a / 24) * 100}%`,
                          width: `${((b - a) / 24) * 100}%`,
                        }}
                      />
                    ))}
                </div>
                {/* #215: every window boundary labelled where it falls, so
                    no end time is inferred from an unlabeled gap.  The
                    hours are the data's (rowBoundaries), formatted as the
                    axis formats them (hourTick).  Labels alternate between
                    two lines, so neighbouring boundaries never sit on top
                    of each other at the column's width or at 380; the
                    first and last are pinned inside the bar's edges. */}
                <BoundaryLabels hours={rowBoundaries(r)} />
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-[130px_1fr] max-md:grid-cols-1 gap-2">
            <div />
            <div className="flex justify-between font-mono text-[9px] text-[color:var(--ink-faint)]">
              <span>12a</span>
              <span>4a</span>
              <span>8a</span>
              <span>12p</span>
              <span>4p</span>
              <span>8p</span>
              <span>12a</span>
            </div>
          </div>
        </div>
  );
}

// (#219 — the flat JurisdictionSection stack is retired: Zone 3 now
// renders TieredReference, which composes the exported pieces above —
// DeltaRowView, FactRows, HazardChip, WorkHoursCard/HoursVerdictBlock,
// PermitFYI — into the ruled consequence tiers.  JurisdictionControls
// and JurisdictionContextBar, Zone 1's and the top strip's surfaces,
// are untouched.)
