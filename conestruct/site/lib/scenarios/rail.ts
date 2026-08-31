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
//
// #228: the per-step vocabulary (state, glyph, word, info, aria) is
// ALSO derived here — fields on the same entries, never a parallel
// structure ("Navigation derives state; it never stores its own", PDF
// p.4).  The component renders these fields verbatim; anything that
// computes a rail row's state or strings outside this function is a
// defect (asserted by the sentinel test).

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
  | "notset"
  /** #228: the design PDF's flagged fourth state (p.5,
   *  complete-but-stale) — a confirmed road whose staleness key no
   *  longer matches the pin.  The values stand; their detection basis
   *  moved.  Road only; never gates; ``attention`` outranks it. */
  | "stale";

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
  /** #228: the visible STEP index (Location 2 … Schedule 5/6),
   *  mirroring GeneratorSidebar's FieldGroup tags — scheduleStep()'s
   *  logic over the same fifth-step table (FIFTH_STEP_LABEL below is
   *  KIND_HAS_FIFTH_STEP's twin). */
  step: number;
  /** #228: the entry's glyph from the reconciled vocabulary
   *  (✓ ⚠ ◌ ▲).  The component renders it, never chooses it; an
   *  attention entry repeats it once per issue (one ⚠ per hold). */
  glyph: string;
  /** #228: the visible state word ("pending", "optional · not set",
   *  "detection stale", "needs attention") — null for a plain done.
   *  The entry that owns the current blocker renders the blocker
   *  string in its place, exactly as before. */
  word: string | null;
  /** #228: informational subline — Location's pending-proposal count
   *  ("2 to confirm") or a set schedule's duration ("4 days").
   *  Never a state, never a blocker: suggestions never gate (#227
   *  product rule) and the duration is display-only date arithmetic
   *  (rule 3 — the backend's hours_eval stays the only schedule
   *  verdict). */
  info: string | null;
  /** #228: the entry's full accessible name.  Byte-identical to the
   *  pre-arc component strings for the pre-existing states; the new
   *  vocabulary joins with " · " in the same format. */
  aria: string;
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
  /** #228: how many suggestion proposals are awaiting Confirm/Dismiss
   *  (0–2).  Computed by GeneratorShell from the SAME expressions the
   *  two slots branch on (JurisdictionSection's SuggestSlot and
   *  ClassSuggestSlot proposal rows — rule 3 mirror comments on both
   *  sides name each other).  Informational only: it feeds Location's
   *  ``info`` subline and nothing else — never a state, never the
   *  blocker (suggestions never gate). */
  pendingSuggestions: number;
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

// #228: the per-state vocabulary — glyphs from the reconciled set
// (#227 addendum; the references' ● and — are NOT in that set and do
// not land).  ▲ + "detection stale" are CHOSEN: the PDF flagged the
// fourth state but declined to design its glyph (p.5).
const GLYPH: Record<RailEntryState, string> = {
  done: "✓",
  attention: "⚠",
  pending: "◌",
  notset: "◌",
  stale: "▲",
};

// The visible state words.  "optional · not set" is sheeted (PDF p.5:
// Schedule "reads 'optional · not set' and stays neutral"); the rest
// carry today's component strings forward.
const WORD: Record<RailEntryState, string | null> = {
  done: null,
  attention: "needs attention",
  pending: "pending",
  notset: "optional · not set",
  stale: "detection stale",
};

/** The aria state phrase — moved VERBATIM from ProgressRail's
 *  entryAria() so pre-existing states announce byte-identically
 *  (#228 ruling 8); "stale" extends the same format. */
function ariaPhrase(state: RailEntryState, issues: RailIssue[]): string {
  return state === "done"
    ? "done"
    : state === "notset"
      ? "not set"
      : state === "pending"
        ? "pending — set a location first"
        : state === "stale"
          ? "detection stale"
          : `needs attention: ${issues.map((i) => i.text).join(" Also: ")}`;
}

/** #228 ruling 5: a set schedule's duration subline.  Display-only
 *  date arithmetic (rule 3 — like the corridor bar's proportion, it
 *  carries no compliance meaning; the backend's hours_eval stays the
 *  only schedule verdict).  Inclusive count; a single date is
 *  "1 day"; anything unparsable says nothing rather than guessing
 *  (rule 10). */
function scheduleDuration(scenario: Scenario): string | null {
  const s = scenario.schedule;
  if (!s) return null;
  if (s.date_mode === "single") return s.work_date ? "1 day" : null;
  if (s.date_mode === "range" && s.work_date && s.work_date_end) {
    const start = Date.parse(`${s.work_date}T00:00:00Z`);
    const end = Date.parse(`${s.work_date_end}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    const days = Math.round((end - start) / 86_400_000) + 1;
    if (days < 1) return null;
    return days === 1 ? "1 day" : `${days} days`;
  }
  return null;
}

export function deriveRail({
  scenario,
  approachConfirm,
  refusal,
  refusalPending,
  pendingSuggestions,
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

  // #228: the fourth state's predicate — the confirmed road's
  // staleness key no longer matches the pin.  Rule 3 mirror: the SAME
  // comparison DetectedVsApplied.tsx and GeneratorShell's roadForPin
  // gate on (pinLat/pinLng equality, the #149 failure class) — those
  // surfaces go silent at a stale road; the rail says so instead.
  const road = scenario.meta.confirmedRoad ?? null;
  const roadStale =
    located &&
    road !== null &&
    !(road.pinLat === scenario.meta.lat && road.pinLng === scenario.meta.lng);

  const state = (id: RailEntryId): RailEntryState => {
    if (issues[id].length > 0) return "attention";
    if (id === "location") return located ? "done" : "attention";
    // #222: downstream sections are gated behind the pin — the rail
    // says so rather than showing a ✓ nobody earned (rule 10).
    if (!located) return "pending";
    if (id === "road" && roadStale) return "stale";
    if (id === "schedule") return scheduleSet ? "done" : "notset";
    return "done";
  };

  // The STEP index — scheduleStep()'s logic (GeneratorSidebar) over
  // the shared fifth-step table: Schedule is 6 when a fifth section
  // sits between Work and it, 5 otherwise.
  const stepOf = (id: RailEntryId): number =>
    id === "schedule"
      ? FIFTH_STEP_LABEL[scenario.kind]
        ? 6
        : 5
      : { location: 2, road: 3, work: 4, extra: 5 }[id];

  // Location's informational count / Schedule's duration — the only
  // two ``info`` producers (ruling 1/5); neither touches state or
  // blocker.
  const infoOf = (id: RailEntryId, st: RailEntryState): string | null => {
    if (id === "location" && pendingSuggestions > 0)
      return `${pendingSuggestions} to confirm`;
    if (id === "schedule" && st === "done") return scheduleDuration(scenario);
    return null;
  };

  const ownsBlocker = (id: RailEntryId): boolean =>
    blocker !== null && blocker.entryId === id;

  const entry = (id: RailEntryId, label: string): RailEntry => {
    const st = state(id);
    const info = infoOf(id, st);
    return {
      id,
      label,
      anchorId: `${RAIL_ANCHOR_PREFIX}${id}`,
      state: st,
      issues: issues[id],
      step: stepOf(id),
      glyph: GLYPH[st],
      word: WORD[st],
      info,
      // The "(current blocker)" suffix moved here from the component —
      // ``blocker`` is this module's own value, so the whole accessible
      // name derives in one place.
      aria: `${label} — ${ariaPhrase(st, issues[id])}${
        info ? ` · ${info}` : ""
      }${ownsBlocker(id) ? " (current blocker)" : ""}`,
    };
  };

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
