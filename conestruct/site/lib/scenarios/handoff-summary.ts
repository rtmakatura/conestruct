// UX-01/UX-02: a per-seam summary of the value transformations that
// happen at the LocationPicker → form handoff.  The picker hands back raw
// detected values + raw inline overrides; the form then clamps speed to
// the scenario kind's schema domain (snapSpeedToDomain, inside
// applyClassification / applyOverridesToScenario) and skips low-confidence
// fallback speeds (applyClassification gates on speedLimitMph).  Each of
// those is a silent mutation of a value the operator reviewed in the
// picker.  This module turns the handoff into a small list of
// {field, transformation, values} events the form summary renders, so the
// change is named at the seam instead of evaporating.
//
// Scope: frontend-only metadata, derived purely from the handoff inputs.
// It is NEVER written to scenario state or the backend payload — it lives
// in React state on the sidebar.  This is a per-seam patch (one handoff,
// one summary), NOT a unified value-provenance architecture (V1.1+ owns
// any such layer).
//
// Commit 2 (UX-01) covers the clamp/snap events.  Commit 3 (UX-02)
// extends summarizeHandoff with the low-confidence skip/accept events.

import { snapSpeedToDomain } from "./auto-apply";
import type { AutoApplyDelta } from "./auto-apply";
import type { RoadClassification } from "../road-detection/types";
import type { RoadFieldOverrides } from "./overrides";
import type { Scenario } from "./types";

export type SpeedSource = "osm" | "manual";

export type HandoffEvent =
  | {
      field: "speed";
      kind: "clamped";
      fromMph: number;
      toMph: number;
      source: SpeedSource;
    }
  | {
      field: "speed";
      kind: "snapped";
      fromMph: number;
      toMph: number;
      source: SpeedSource;
    };

export interface SummarizeHandoffArgs {
  prior: Scenario;
  classification: RoadClassification | null;
  overrides: RoadFieldOverrides;
  final: Scenario;
  delta: AutoApplyDelta | null;
}

// The CDOT/MUTCD typical-application label per scenario kind.  Exposed so
// the picker clamp annotation and the form provenance note speak one
// vocabulary (Q4: coherent trust signal across picker → form).
export function scenarioTa(kind: Scenario["kind"]): string {
  switch (kind) {
    case "shoulder":
      return "TA-2";
    case "flagger_lane_closure":
      return "TA-10";
    case "lane_closure_divided":
      return "TA-19";
    case "work_beyond_shoulder":
      return "TA-1";
    case "mobile_op_2lane":
      return "TA-35";
    case "mobile_op_multilane":
      return "TA-26";
  }
}

// Plain-language noun for the scenario kind, e.g. "flagger plans cap at
// 55 mph".  Pairs with scenarioTa to build the shared cap phrasing.
export function scenarioNoun(kind: Scenario["kind"]): string {
  switch (kind) {
    case "shoulder":
      return "shoulder";
    case "flagger_lane_closure":
      return "flagger";
    case "lane_closure_divided":
      return "divided lane-closure";
    case "work_beyond_shoulder":
      return "work-beyond-shoulder";
    case "mobile_op_2lane":
      return "2-lane mobile";
    case "mobile_op_multilane":
      return "multi-lane mobile";
  }
}

// snapSpeedToDomain = clamp(round-to-5-grid).  If the applied value
// differs from the pure grid snap, the domain min/max bound did the
// clamping (UX-01's cap case); otherwise it was only a 5-mph grid snap.
function isBoundClamp(rawMph: number, appliedMph: number): boolean {
  const gridSnapped = Math.round(rawMph / 5) * 5;
  return appliedMph !== gridSnapped;
}

export function summarizeHandoff(args: SummarizeHandoffArgs): HandoffEvent[] {
  const { classification, overrides, final } = args;
  const kind = final.kind;
  const events: HandoffEvent[] = [];

  // --- Speed -------------------------------------------------------------
  // The form sets speed from the override if present, else from the OSM
  // high-confidence speed (classification.speedLimitMph) — matching the
  // apply order in onPickerSave (applyClassification then applyOverrides).
  const overrideSpeed = overrides.speedMph;
  const osmSpeed = classification?.speedLimitMph;
  const sourceRaw = overrideSpeed ?? osmSpeed;
  const source: SpeedSource = overrideSpeed !== undefined ? "manual" : "osm";

  if (sourceRaw !== undefined) {
    const applied = snapSpeedToDomain(kind, sourceRaw); // === final.speed
    if (applied !== sourceRaw) {
      events.push({
        field: "speed",
        kind: isBoundClamp(sourceRaw, applied) ? "clamped" : "snapped",
        fromMph: sourceRaw,
        toMph: applied,
        source,
      });
    }
  }

  return events;
}

// Whether the event still describes the scenario's current state.  The
// form summary uses this to self-hide a note once the operator manually
// edits the field it described (e.g. changes speed in the per-kind form
// after the handoff) — so a stale clamp note can't linger.
export function handoffEventIsCurrent(
  event: HandoffEvent,
  scenario: Scenario,
): boolean {
  switch (event.kind) {
    case "clamped":
    case "snapped":
      return scenario.speed === event.toMph;
  }
}
