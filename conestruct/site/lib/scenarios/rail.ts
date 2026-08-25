// The progress rail's derivation (issue #221) — pure, Mapbox-free,
// unit-tested like lib/scenarios/overrides.ts.
//
// Rule 3: the rail POINTS, it never judges.  Every input here already
// exists — the schema-mirror validations (validation.ts), the sidebar's
// needs-confirmation hold, the shell's stamped refusal (#180) and its
// in-flight gate (#196/#179), the location sentinel (hasLocation), and
// schedule presence.  No new predicate is computed; the one derivation
// this module OWNS is the Generate CTA's disabled-reason chain, moved
// here verbatim from GeneratorSidebar so the rail's current-blocker
// string and the CTA's reason are the same string from the same source
// (single-sourced, asserted by test).  The rank order is the CTA's
// recorded design: problems with actual edits state their reason first;
// the missing pin ranks last.
//
// Rule 10: ``entries`` carry EVERY simultaneously-true blocker mapped
// to its home section — the pre-rail CTA showed only the first match,
// so clearing one blocker surfaced the next as a surprise (the
// invisible queue, measured live in the s2-arc8 baseline).  ``blocker``
// is that first match; the rail highlights it without hiding the rest.

import type { Refusal } from "@/lib/render-types";
import type { Scenario, ScenarioKind } from "./types";
import { hasLocation } from "./index";
import { matchRefusalAffordance } from "./auto-apply";
import {
  validateApproaches,
  validateLanes,
  validateWorkZone,
} from "./validation";

export type RailEntryId = "location" | "road" | "work" | "extra" | "schedule";

export type RailEntryState =
  /** Complete / no open problem. */
  | "done"
  /** Carries at least one unresolved blocker (one ⚠ per issue). */
  | "attention"
  /** Gated behind the location (#222) — nothing to do here yet. */
  | "pending"
  /** Honest empty (#199): the schedule nobody entered. Never blocks. */
  | "notset";

export interface RailIssue {
  /** The blocker's text — an existing string, never a paraphrase:
   *  either the CTA-chain string or the #180 affordance pointer. */
  text: string;
}

export interface RailEntry {
  id: RailEntryId;
  label: string;
  /** DOM id of the FieldGroup header the entry jumps to. */
  anchorId: string;
  state: RailEntryState;
  issues: RailIssue[];
}

export interface RailBlocker {
  /** The CTA's disabled-reason — byte-identical to the pre-rail chain. */
  message: string;
  /** The entry that owns the blocker; null when no section does (a
   *  refusal with no matched affordance) — the rail's Generate slot
   *  carries the string then. */
  entryId: RailEntryId | null;
}

export interface Rail {
  entries: RailEntry[];
  /** Null exactly when Generate is enabled (the gate's disjuncts and
   *  this chain test the same seven conditions). */
  blocker: RailBlocker | null;
}

export interface RailInput {
  scenario: Scenario;
  /** GeneratorSidebar's needs-confirmation hold on detection-filled
   *  approach lane counts (near_intersection only). */
  approachConfirm: { pending: boolean; reason: string | null };
  /** #180: the backend's stamped refusal of the input on screen. */
  refusal: Refusal | null;
  /** #196/#179: a declined input's re-check is still in flight. */
  refusalPending: boolean;
}

// The CTA-chain literals, moved here from GeneratorSidebar (#221
// single-source extraction).  These exist NOWHERE else — the sidebar
// and the rail both read deriveRail().
export const HOLD_BLOCKER =
  "Confirm the cross-street lane count first — it was filled from map data.";
export const REFUSAL_BLOCKER = "Generation declined — see the notice below.";
export const RECHECK_BLOCKER =
  "Re-checking the declined input — Generate re-enables when the verdict settles.";
export const LOCATION_BLOCKER =
  "Set a location first — pick on map or enter manually.";

export const RAIL_ANCHOR_PREFIX = "rail-step-";

// The kind's fifth section between Work and Schedule, matching the
// forms' FieldGroup labels (GeneratorSidebar's KIND_HAS_FIFTH_STEP is
// the boolean twin — scheduleStep()/siteStep() read it).
const FIFTH_STEP_LABEL: Record<ScenarioKind, string | null> = {
  shoulder: null,
  flagger_lane_closure: "Flagger",
  lane_closure_divided: "Protection",
  work_beyond_shoulder: null,
  mobile_op_2lane: "Protection",
  mobile_op_multilane: "Protection",
  near_intersection: "Cross street",
};

/** Which rail entry a matched refusal affordance's remedy lives in —
 *  read off the pointer texts themselves ("…in the Cross street
 *  section" / "…in the Road section"). */
function affordanceEntry(code: string): RailEntryId {
  return code === "ni_lane_confidence" ? "extra" : "road";
}

export function deriveRail({
  scenario,
  approachConfirm,
  refusal,
  refusalPending,
}: RailInput): Rail {
  const wz = validateWorkZone(scenario);
  const lanes = validateLanes(scenario);
  const approaches = validateApproaches(scenario);
  const located = hasLocation(scenario.meta);
  // The armed affordance (if any) decides which section a refusal or an
  // in-flight re-check points at — the same mirror predicate the shell
  // uses to build ``refusal.pointer`` and the gating-during-flight.
  const affordance = matchRefusalAffordance(scenario);

  const issues: Record<RailEntryId, RailIssue[]> = {
    location: [],
    road: [],
    work: [],
    extra: [],
    schedule: [],
  };
  if (!located) issues.location.push({ text: LOCATION_BLOCKER });
  if (!lanes.ok && lanes.message) issues.road.push({ text: lanes.message });
  if (!wz.ok && wz.message) issues.work.push({ text: wz.message });
  if (!approaches.ok && approaches.message)
    issues.extra.push({ text: approaches.message });
  if (approachConfirm.pending) issues.extra.push({ text: HOLD_BLOCKER });
  if (refusal) {
    // #180 one voice: the pointer IS the banner's string (built from the
    // same matchRefusalAffordance); with no affordance the short decline
    // line stands and no section owns it (the Generate slot renders it).
    const target = affordance ? affordanceEntry(affordance.code) : null;
    const text = refusal.pointer ?? REFUSAL_BLOCKER;
    if (target) issues[target].push({ text });
  } else if (refusalPending && affordance) {
    issues[affordanceEntry(affordance.code)].push({ text: RECHECK_BLOCKER });
  }

  // The CTA's disabled-reason — the ``??`` chain from GeneratorSidebar,
  // string-for-string and rank-for-rank identical (behavior-preserving
  // extraction; the pre-existing CTA suites are the proof).
  let blocker: RailBlocker | null = null;
  if (!wz.ok && wz.message) blocker = { message: wz.message, entryId: "work" };
  else if (!lanes.ok && lanes.message)
    blocker = { message: lanes.message, entryId: "road" };
  else if (!approaches.ok && approaches.message)
    blocker = { message: approaches.message, entryId: "extra" };
  else if (approachConfirm.pending)
    blocker = { message: HOLD_BLOCKER, entryId: "extra" };
  else if (refusal)
    blocker = {
      message: REFUSAL_BLOCKER,
      entryId: affordance ? affordanceEntry(affordance.code) : null,
    };
  else if (refusalPending)
    blocker = {
      message: RECHECK_BLOCKER,
      entryId: affordance ? affordanceEntry(affordance.code) : null,
    };
  else if (!located)
    blocker = { message: LOCATION_BLOCKER, entryId: "location" };

  const scheduleSet =
    scenario.schedule?.date_mode === "single" ||
    scenario.schedule?.date_mode === "range";

  const state = (id: RailEntryId): RailEntryState => {
    if (issues[id].length > 0) return "attention";
    if (id === "location") return located ? "done" : "attention";
    // #222: downstream sections are gated behind the pin — the rail
    // says so rather than showing a ✓ nobody earned (rule 10).
    if (!located) return "pending";
    if (id === "schedule") return scheduleSet ? "done" : "notset";
    return "done";
  };

  const entry = (id: RailEntryId, label: string): RailEntry => ({
    id,
    label,
    anchorId: `${RAIL_ANCHOR_PREFIX}${id}`,
    state: state(id),
    issues: issues[id],
  });

  const fifth = FIFTH_STEP_LABEL[scenario.kind];
  const entries: RailEntry[] = [
    entry("location", "Location"),
    entry("road", "Road"),
    entry("work", "Work"),
    ...(fifth ? [entry("extra", fifth)] : []),
    entry("schedule", "Schedule"),
  ];

  return { entries, blocker };
}
