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
import { clampLanesToDomain } from "./validation";
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
    }
  // #198 family 1: a CHANGED detection re-applies and overwrites lanes /
  // divided / laneWidth — including manual form edits made since the
  // last apply.  Applying new information is by design (the re-apply
  // guards in GeneratorSidebar already skip unchanged content); the
  // defect was the silence.  Same convention as roadType "applied":
  // emitted only when the value actually changed prior -> final.
  | {
      field: "lanes";
      kind: "applied";
      from: number;
      to: number;
      source: SpeedSource;
    }
  | {
      field: "divided";
      kind: "applied";
      from: boolean;
      to: boolean;
      source: SpeedSource;
    }
  | {
      field: "laneWidth";
      kind: "applied";
      fromFt: number;
      toFt: number;
    }
  // #198 family 3: the lane count was clamped into the schema domain
  // (1..MAX_LANES_PER_DIRECTION) — the lanes twin of the speed "clamped"
  // member.  Takes precedence over "applied" for the same handoff: the
  // clamp note already names the value that landed.
  | {
      field: "lanes";
      kind: "clamped";
      from: number;
      to: number;
      source: SpeedSource;
    }
  // #198 family 2: a picker-set lanes/divided override arrived on a kind
  // that has no such field (only shoulder carries them), so the apply
  // path discarded it.  The roadType "skipped_not_in_domain" shape,
  // minus an in-effect value — the kind has nothing to show instead.
  | {
      field: "lanes";
      kind: "skipped_not_applicable";
      value: number;
    }
  | {
      field: "divided";
      kind: "skipped_not_applicable";
      value: boolean;
    }
  // #198 family 4: the handoff lowered the posted speed below (or equal
  // to) the standing work-zone reduction, so the reduction was cleared
  // at the seam — the same reduction >= posted -> "no reduction" rule
  // ShoulderForm applies on a manual speed edit and the backend bridge
  // applies at scenario_to_call.  Without the clear, the payload is one
  // the backend validator rejects for a state the app itself created.
  | {
      field: "workZoneSpeed";
      kind: "cleared";
      wasMph: number;
      postedMph: number;
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
    case "near_intersection":
      // Kind-level family label like the shoulder case: CDOT S-630-1
      // Cases 18/19 (near/far side derives per plan, so no single-case
      // label here).
      return "Cases 18/19";
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
    case "near_intersection":
      return "near-intersection";
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

  // --- Lanes / divided / laneWidth (#198 families 1-3) -------------------
  // Same source order as the apply path: override wins over detection.
  // Only shoulder carries lanes/divided; every other kind discards a
  // picker override of them (family 2).  laneWidth exists on every kind
  // and applyClassification writes it unconditionally (family 1).
  const sourceLanes = overrides.lanesPerDirection ?? classification?.lanesPerDirection;
  const lanesSource: SpeedSource =
    overrides.lanesPerDirection !== undefined ? "manual" : "osm";

  if (final.kind === "shoulder" && prior.kind === "shoulder") {
    if (sourceLanes !== undefined) {
      const appliedLanes = clampLanesToDomain(sourceLanes);
      if (appliedLanes !== sourceLanes && final.lanes === appliedLanes) {
        // Family 3: the clamp fired.  Precedence over "applied" — the
        // note names both the raw value and the one that landed.
        events.push({
          field: "lanes",
          kind: "clamped",
          from: sourceLanes,
          to: appliedLanes,
          source: lanesSource,
        });
      } else if (final.lanes === sourceLanes && prior.lanes !== sourceLanes) {
        // Family 1: landed in-domain AND changed the prior value.
        events.push({
          field: "lanes",
          kind: "applied",
          from: prior.lanes,
          to: final.lanes,
          source: lanesSource,
        });
      }
    }

    const sourceDivided = overrides.divided ?? classification?.divided;
    if (
      sourceDivided !== undefined &&
      final.divided === sourceDivided &&
      prior.divided !== sourceDivided
    ) {
      events.push({
        field: "divided",
        kind: "applied",
        from: prior.divided,
        to: final.divided,
        source: overrides.divided !== undefined ? "manual" : "osm",
      });
    }
  } else if (final.kind !== "shoulder") {
    // Family 2: the picker offered the editors, the kind has no field.
    if (overrides.lanesPerDirection !== undefined) {
      events.push({
        field: "lanes",
        kind: "skipped_not_applicable",
        value: overrides.lanesPerDirection,
      });
    }
    if (overrides.divided !== undefined) {
      events.push({
        field: "divided",
        kind: "skipped_not_applicable",
        value: overrides.divided,
      });
    }
  }

  // laneWidth (family 1): written by applyClassification on every kind;
  // overrides carry no laneWidth, so detection is the only source.
  if (
    classification !== null &&
    final.laneWidth !== prior.laneWidth &&
    final.laneWidth === classification.laneWidthFt
  ) {
    events.push({
      field: "laneWidth",
      kind: "applied",
      fromFt: prior.laneWidth,
      toFt: final.laneWidth,
    });
  }

  // --- workZoneSpeed (#198 family 4) -------------------------------------
  // The apply paths normalize a standing reduction that the handoff's
  // lower posted speed invalidated (reduction >= posted -> undefined).
  // Name the clear whenever this handoff both wrote speed and dropped
  // the reduction.
  if (
    prior.kind === "shoulder" &&
    final.kind === "shoulder" &&
    prior.workZoneSpeed !== undefined &&
    final.workZoneSpeed === undefined &&
    sourceRaw !== undefined
  ) {
    events.push({
      field: "workZoneSpeed",
      kind: "cleared",
      wasMph: prior.workZoneSpeed,
      postedMph: final.speed,
    });
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
  // Discriminate on field first: "applied" and "clamped" are shared
  // across fields since #198 extended the union.
  switch (event.field) {
    case "speed":
      switch (event.kind) {
        case "clamped":
        case "snapped":
          return scenario.speed === event.toMph;
        case "accepted_low_confidence":
          return scenario.speed === event.valueMph;
        case "skipped_low_confidence":
          return scenario.speed === event.inEffectMph;
      }
      break;
    case "roadType":
      return event.kind === "applied"
        ? scenario.roadType === event.to
        : scenario.roadType === event.inEffect;
    case "lanes":
      if (event.kind === "skipped_not_applicable") {
        // The note claims the kind has no lane field; a switch to
        // shoulder makes that claim stale.
        return scenario.kind !== "shoulder";
      }
      return scenario.kind === "shoulder" && scenario.lanes === event.to;
    case "divided":
      if (event.kind === "skipped_not_applicable") {
        return scenario.kind !== "shoulder";
      }
      return scenario.kind === "shoulder" && scenario.divided === event.to;
    case "laneWidth":
      return scenario.laneWidth === event.toFt;
    case "workZoneSpeed":
      // Current while no reduction is set and the posted speed the note
      // names still stands; re-enabling a reduction or editing speed
      // retires it.
      return (
        scenario.kind === "shoulder" &&
        scenario.workZoneSpeed === undefined &&
        scenario.speed === event.postedMph
      );
  }
  // Exhaustive above; TS needs the terminator for the nested switch.
  return false;
}
