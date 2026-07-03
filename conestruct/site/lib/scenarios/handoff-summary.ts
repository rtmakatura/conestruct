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
import type { RoadType, Scenario } from "./types";

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
    }
  // UX-02: the operator clicked "Use N mph" to accept a low-confidence
  // fallback the form would otherwise have skipped — name the explicit
  // opt-in so the value's provenance is on the record.
  | {
      field: "speed";
      kind: "accepted_low_confidence";
      valueMph: number;
      sourceLabel: string;
    }
  // UX-02: a low-confidence fallback speed was shown in the picker but
  // never applied (no OSM tag, not accepted), so the plan kept its prior
  // value — name what was skipped and what's actually in effect.
  | {
      field: "speed";
      kind: "skipped_low_confidence";
      detectedMph: number;
      inEffectMph: number;
      sourceLabel: string;
    }
  // #62: roadType crosses the same seam.  The picker detects a roadType
  // (OSM classification) or carries a manual override; applyClassification /
  // applyRoadTypeOverride only keep it when it's in the scenario kind's
  // allowed set, else the plan silently keeps its prior value.  These two
  // members name the roadType half the same way the speed members name the
  // clamp/snap/skip — reusing the structure, NOT a parallel mechanism.
  //
  // "applied" fires only when the detected/override roadType actually
  // CHANGED prior -> final (a clean, unchanged landing stays silent, just
  // like the speed path stays silent on an in-domain on-grid value).
  | {
      field: "roadType";
      kind: "applied";
      from: RoadType;
      to: RoadType;
      source: SpeedSource;
    }
  // "skipped_not_in_domain": the picker detected a roadType the scenario
  // kind doesn't accept (e.g. a freeway on a flagger plan), so it was
  // dropped and the plan kept its prior value — the consequential case.
  | {
      field: "roadType";
      kind: "skipped_not_in_domain";
      detected: RoadType;
      inEffect: RoadType;
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
      // Kind-level family label (Refs #100): this fires pre-generation
      // (picker clamp notes), so no backend summary.ta exists yet.
      // TA-3 generally, TA-5 on a freeway — static label, never a
      // road-type conditional here (rule #3).
      return "TA-3/TA-5";
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
  const { prior, classification, overrides, final, delta } = args;
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
  const speedField = classification?.fields.speed;

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
    } else if (
      // UX-02 opt-in: the override equals the low-confidence fallback and
      // OSM carried no high-confidence speed → the operator accepted the
      // fallback via click-to-accept.  Name the explicit choice.
      overrideSpeed !== undefined &&
      osmSpeed === undefined &&
      speedField?.confidence === "low" &&
      speedField.value === overrideSpeed
    ) {
      events.push({
        field: "speed",
        kind: "accepted_low_confidence",
        valueMph: applied,
        sourceLabel: speedField.source,
      });
    }
  } else if (
    // UX-02 silent evaporation: a low-confidence fallback was shown in the
    // picker but never applied (no OSM tag, no acceptance), so the plan
    // kept its prior speed.  Name what was skipped and what's in effect.
    classification &&
    delta &&
    !delta.speedApplied &&
    speedField?.confidence === "low" &&
    speedField.value != null
  ) {
    events.push({
      field: "speed",
      kind: "skipped_low_confidence",
      detectedMph: speedField.value,
      inEffectMph: final.speed,
      sourceLabel: speedField.source,
    });
  }

  // --- Road type ---------------------------------------------------------
  // The override wins over the OSM classification (apply order in
  // onPickerSave: applyClassification then applyOverridesToScenario), so
  // the value the operator effectively asked for is override ?? detected.
  // final.roadType already reflects whether the apply path kept it, so we
  // compare against final/prior rather than re-deriving the allowed sets.
  const sourceRoadType = overrides.roadType ?? classification?.roadType;
  const roadTypeSource: SpeedSource =
    overrides.roadType !== undefined ? "manual" : "osm";

  if (sourceRoadType !== undefined) {
    if (final.roadType === sourceRoadType && prior.roadType !== sourceRoadType) {
      // It landed AND changed the prior value — name the applied change.
      // (A clean, unchanged landing stays silent, like the speed path.)
      events.push({
        field: "roadType",
        kind: "applied",
        from: prior.roadType,
        to: final.roadType,
        source: roadTypeSource,
      });
    } else if (final.roadType !== sourceRoadType) {
      // Detected/overridden but not in the kind's allowed set, so it was
      // dropped and the plan kept its prior value.
      events.push({
        field: "roadType",
        kind: "skipped_not_in_domain",
        detected: sourceRoadType,
        inEffect: final.roadType,
        source: roadTypeSource,
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
    case "accepted_low_confidence":
      return scenario.speed === event.valueMph;
    case "skipped_low_confidence":
      return scenario.speed === event.inEffectMph;
    case "applied":
      return scenario.roadType === event.to;
    case "skipped_not_in_domain":
      return scenario.roadType === event.inEffect;
  }
}
