// #289 Phase 2 — the detected-vs-applied derivation, lifted out of the
// component that used to own it.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (d) — "per-field provenance comes from lib/road-detection/provenance.ts
// — one producer; the #273 ledger's tests retire as layout and transfer as
// facts" — and #281 Part 1 §8.23: "Detected vs applied block — folded into
// the per-field provenance lines in the WHAT band … The separate block is
// gone; nothing it said is gone."
//
// WHAT MOVED AND WHAT DID NOT.  Every row predicate below is
// `DetectedVsApplied.tsx`'s, verbatim, comments included: the speed row's
// domain snap, the lanes row's withdrawn/overridden three-state story and
// its positive detection of a cleared relay, the road-type row's declared
// residue, and #278's flagger-only one-way row with the reason it is
// flagger-only. None of it is re-reasoned here, because re-reasoning it is
// how #273's two mints of one vocabulary happened in the first place.
//
// What did NOT move is the shape: the glyph gutter, the two-line row, the
// reserved clause slot, the block header and the list. Those retire with
// the block (§8.23), and the WHAT grid renders each row's clause under the
// field it is about.
//
// Rule 3: this module judges nothing. It reports what detection said and
// what the plan used, and `provenance.ts` — still the one producer — turns
// that into words.

import type { RoadType, Scenario } from "../scenarios";
import { snapSpeedToDomain } from "../scenarios";
import { ONEWAY_BLOCKING } from "../scenarios/auto-apply";
import { clampLanesToDomain } from "../scenarios/validation";
import {
  type AppliedToken,
  type DetectedToken,
  appliedTokenFor,
  valuesAgree,
} from "./provenance";

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

/**
 * A row's verdict.
 *
 * `match` / `differ` are the spec's two states.  `unset` is the third
 * the house vocabulary already had and the spec did not: the plan has
 * not taken a value for this fact yet, which is neither agreement nor
 * disagreement.  `◌` is the glyph for exactly that ("unevaluated / not
 * set / pending — never a verdict", DESIGN-SPACING) and Rule 10 says
 * the absence is rendered as an absence rather than dressed as one of
 * the two verdicts.
 */
export type Verdict = "match" | "differ" | "unset";

/** The row labels, as a closed set, so a consumer selects a row by a
 *  name the compiler checks rather than by a string that can drift. */
export type DetectedRowLabel =
  | "Speed limit"
  | "Lanes per direction"
  | "Road type"
  | "Divided"
  | "One-way";

export interface DetectedRow {
  label: DetectedRowLabel;
  /** What the plan used.  `null` when the plan has no value. */
  applied: string | null;
  /** The clause's detected value; `null` means the detection was withdrawn. */
  detected: string | null;
  detectedToken?: DetectedToken;
  appliedToken?: AppliedToken;
  verdict: Verdict;
}

export interface DetectedModel {
  rows: DetectedRow[];
  /** The road the rows are about, named the way the ledger named it. */
  roadName: string;
  wayId: string;
  method: "auto_single" | "operator_pick";
  /** #214: does road geometry govern the drawing, or the typed bearing? */
  geomDrives: boolean;
}

/**
 * Does the clause wear amber?
 *
 * Spec 5.4's honesty rule, widened to every verdict: "the plan used what
 * was detected" and "what was detected was a guess" are two different
 * facts, so a matching row whose detection was inferred renders a GREEN
 * glyph above an AMBER clause.  That pairing looks wrong to anyone who
 * does not know why, which is exactly why it is written down: green
 * means the plan used what was detected.  It never means measured.
 *
 * Contrast measured on the block's own background (prod b2a325a):
 * --warn 8.82:1, --pass 8.1:1.  Both well over the 4.5 floor, so nobody
 * needs to "fix" the pairing by dimming one of them.
 */
export function clauseIsAmber(r: DetectedRow): boolean {
  return (
    r.detected === null ||
    r.detectedToken === "inferred" ||
    r.detectedToken === "overridden"
  );
}

/**
 * The rows, or null when there is nothing honest to say.
 *
 * Rule 10 throughout: rows exist ONLY when a confirmed road exists at the
 * CURRENT pin (the pinLat/pinLng staleness key — a stale road never
 * speaks, the #149 failure class); a fact OSM never reported produces no
 * row; the no-road / manual path produces none at all.
 */
export function deriveDetectedRows(scenario: Scenario): DetectedModel | null {
  const meta = scenario.meta;
  const road = meta.confirmedRoad ?? null;
  const fresh =
    road && road.pinLat === meta.lat && road.pinLng === meta.lng ? road : null;
  if (!fresh) return null;

  const cand = fresh.candidate;
  const cls = fresh.classification;
  const geomDrives = (cand.geometry?.length ?? 0) > 1;

  /** One row, with the verdict derived rather than asserted. */
  const mkRow = (o: {
    label: DetectedRowLabel;
    appliedValue: number | string | boolean | undefined;
    appliedDisplay: string | null;
    detectedValue: number | string | boolean | undefined;
    detectedDisplay: string | null;
    detectedToken?: DetectedToken;
    /** True when the difference is exactly what auto-apply's domain
     *  snap would produce — the system's rounding, not an operator. */
    isDomainSnap?: boolean;
  }): DetectedRow => {
    // Rule 10: no applied value is "not set", never a verdict.
    if (o.appliedValue === undefined || o.appliedDisplay === null) {
      return {
        label: o.label,
        applied: null,
        detected: o.detectedDisplay,
        detectedToken: o.detectedToken,
        verdict: "unset",
      };
    }
    // Compared as MODEL values, never as the strings on screen: both
    // sides are raw here (numbers, enums, booleans), so the spec's own
    // "30" vs "30 mph" defect cannot arise (#273 conflict 7).
    const agrees = valuesAgree(o.detectedValue, o.appliedValue);
    return {
      label: o.label,
      applied: o.appliedDisplay,
      detected: o.detectedDisplay,
      detectedToken: o.detectedToken,
      appliedToken: appliedTokenFor({
        differs: !agrees,
        isDomainSnap: o.isDomainSnap ?? false,
      }),
      verdict: agrees ? "match" : "differ",
    };
  };

  // #290: no "Bearing" row.  It compared the TYPED bearing with the
  // road's, and the typed bearing is retired (FLOW.md §5a, Rule 5): the
  // direction is derived from the road and the confirmed side, and the
  // WHERE band states it in the side's own words.
  const rows: DetectedRow[] = [];

  if (cls.speedLimitMph !== undefined && "speed" in scenario) {
    const detected = cls.speedLimitMph;
    const applied = scenario.speed;
    rows.push(
      mkRow({
        label: "Speed limit",
        appliedValue: applied,
        appliedDisplay: `${applied} mph`,
        detectedValue: detected,
        detectedDisplay: `${detected} mph`,
        // The classifier DOES hold this row's method
        // (classify.ts:237-294, `fields.speed.method`); #274 chose not
        // to render it, because in the two-column shape there was
        // nowhere honest to put a token for a row that carries no
        // guess.  Under the clause the token position exists on every
        // row and must be filled truthfully: printing `no source tag`
        // about a value read from a posted `maxspeed` is false.  Ruled
        // 2026-09-11; #274's "measured by construction carries no
        // marker" retires with the shape that needed it.
        detectedToken: cls.fields?.speed.method,
        // auto-apply runs the detected speed through the kind's domain
        // (auto-apply.ts:381) before the plan ever sees it, so a plan
        // can differ from detection with nobody having touched
        // anything.  Blaming that on the operator is a Rule 10 defect.
        isDomainSnap: snapSpeedToDomain(scenario.kind, detected) === applied,
      }),
    );
  }

  if (cls.lanesPerDirection !== undefined && "lanes" in scenario) {
    // #275.  Note this cell reads `cls.lanesPerDirection` — the halved,
    // floored per-direction figure — while the backend gates read the
    // `detectedLanesTotal` RELAY, the raw `lanes` tag.  Two numbers, two
    // derivations (classify.ts:78-90): on a `lanes=4` two-way road the
    // relay is 4 and this row is 2.
    //
    // The relay is cleared when the operator takes ownership of the
    // count.  Detect that POSITIVELY — detection reported a total and
    // the scenario's copy is gone — never from the scenario's absence
    // alone: a way tagged `lanes:forward` with no `lanes` has no relay
    // and no edit, and must not read as withdrawn.
    const relayCleared =
      cls.detectedLanesTotal !== undefined &&
      (scenario as { detectedLanesTotal?: number }).detectedLanesTotal === undefined;
    // Disputed erasures record a marker carrying the lane relays (#177);
    // ordinary ones record nothing (#112).  Only a marker that actually
    // carries a LANE relay speaks for this row — a one-way confirm's
    // marker is about a different fact.
    const laneOverride = (scenario.detectionOverrides ?? []).some(
      (o) =>
        o.detectedLanesTotal !== undefined ||
        o.detectedLanesForward !== undefined ||
        o.detectedLanesBackward !== undefined ||
        o.detectedLanesBothWays !== undefined,
    );
    // Disputed → the marker rides the wire and the audit reprints the
    // numbers, so the detection is a fact the operator OVERRODE: name
    // it, marked.  Undisputed → no relay, no marker, no audit item,
    // nothing anywhere: the detection is WITHDRAWN, and the clause says
    // so in the value's own position rather than printing a cleared
    // relay's number as though it still stood (ruled 2026-09-11 against
    // spec 4.5's example, which did exactly that).
    const withdrawn = relayCleared && !laneOverride;
    const detected = cls.lanesPerDirection;
    const applied = (scenario as { lanes: number }).lanes;
    rows.push(
      mkRow({
        label: "Lanes per direction",
        appliedValue: applied,
        appliedDisplay: String(applied),
        // A withdrawn detection has no value to compare, so it can
        // never read as agreement: `undefined` makes valuesAgree false
        // by construction.
        detectedValue: withdrawn ? undefined : detected,
        detectedDisplay: withdrawn ? null : String(detected),
        // `overridden` outranks the method: once the operator has
        // disputed the count, HOW detection arrived at it is no longer
        // the fact the row is about.  Otherwise the classifier's own
        // method stands (fields.lanes.method), for the same reason the
        // speed row now states its own.  A withdrawn detection has no
        // method to state, because it has no value.
        detectedToken: withdrawn
          ? undefined
          : relayCleared
            ? "overridden"
            : cls.fields?.lanes.method,
        isDomainSnap: !withdrawn && clampLanesToDomain(detected) === applied,
      }),
    );
  }

  if ("roadType" in scenario) {
    const detected = cls.roadType;
    const applied = (scenario as { roadType: RoadType }).roadType;
    rows.push(
      mkRow({
        label: "Road type",
        appliedValue: applied,
        appliedDisplay: ROAD_TYPE_LABELS[applied],
        detectedValue: detected,
        detectedDisplay: ROAD_TYPE_LABELS[detected],
        detectedToken: cls.fields?.roadType.method,
        // Known residue: auto-apply keeps the scenario's own type when
        // the detected one is not in the kind's set (auto-apply.ts:515,
        // :524) — a narrowing, not an operator edit — but it exposes no
        // predicate to ask that with, so such a row still reads
        // operator-set.  Declared rather than guessed at.
      }),
    );
  }

  if ("divided" in scenario) {
    const detected = cls.divided;
    const applied = (scenario as { divided: boolean }).divided;
    rows.push(
      mkRow({
        label: "Divided",
        appliedValue: applied,
        appliedDisplay: applied ? "Divided" : "Undivided",
        detectedValue: detected,
        detectedDisplay: detected ? "Divided" : "Undivided",
        detectedToken: cls.fields?.divided.method,
      }),
    );
  }

  // #278 — the one-way fact, which the old table had nowhere to put.
  //
  // It exists on the flagger kind ONLY, and that is the data's shape
  // rather than a scoping choice: every other kind folds one-way into
  // `divided`/`roadType` and carries no field for it (auto-apply.ts:492
  // relays the raw tag for the flagger directionality gate alone).  On
  // those kinds there is a detected fact and no applied counterpart, so
  // Rule 10 says render no row rather than invent a side to compare.
  //
  // The detected side reads the CANDIDATE's tag, not the relay: the
  // relay is cleared when the operator confirms two-way traffic, while
  // `candidate.tags.oneway` survives the confirm and is the same
  // evidence the backend gate read.  A way OSM never tagged renders no
  // row at all.
  if (scenario.kind === "flagger_lane_closure") {
    const tag = cand.tags.oneway;
    if (tag !== null && tag !== undefined) {
      const relay = (scenario as { oneway?: string }).oneway;
      // Same three-state story as the lanes row, with the marker that
      // belongs to THIS fact: a lanes dispute says nothing about
      // direction, so only a marker carrying `detectedOneway` speaks
      // here (the mirror of the lanes row's own predicate).
      const onewayMarker = (scenario.detectionOverrides ?? []).some(
        (o) => o.detectedOneway !== undefined,
      );
      const relayCleared = cls.detectedOneway !== undefined && relay === undefined;
      const withdrawn = relayCleared && !onewayMarker;
      const detectedOneWay = ONEWAY_BLOCKING.has(tag);
      const appliedOneWay = relay !== undefined && ONEWAY_BLOCKING.has(relay);
      rows.push(
        mkRow({
          label: "One-way",
          appliedValue: appliedOneWay,
          appliedDisplay: appliedOneWay ? "Yes" : "No",
          detectedValue: withdrawn ? undefined : detectedOneWay,
          detectedDisplay: withdrawn ? null : detectedOneWay ? "Yes" : "No",
          detectedToken: !withdrawn && relayCleared ? "overridden" : undefined,
        }),
      );
    }
  }

  // Spec 6.6: zero rows renders NOTHING.  Unreachable today (Bearing
  // always renders beside a fresh road), and written anyway so the rule
  // is structural rather than incidental on the day a kind carries none
  // of these facts.
  if (rows.length === 0) return null;

  return {
    rows,
    roadName: cand.name ?? cand.ref ?? `way ${cand.way_id}`,
    wayId: cand.way_id,
    method: fresh.method,
    geomDrives,
  };
}

/** Pick one row by label — the WHAT grid's way of asking "what does
 *  detection say about the field I am rendering?". */
export function detectedRow(
  model: DetectedModel | null,
  label: DetectedRowLabel,
): DetectedRow | null {
  return model?.rows.find((r) => r.label === label) ?? null;
}

// #214's caveat ("road geometry governs the drawing — the typed bearing
// sets the travel-direction sign only") RETIRES with the typed bearing it
// described, as FLOW.md §5a rules: "The typed bearing field retires
// deliberately (Rule 5); the #214 disclosure sentence and its
// byte-identity pin retire with it."  (#290)
