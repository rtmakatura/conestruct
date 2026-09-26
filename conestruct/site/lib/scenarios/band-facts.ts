// #289 Phase 2 — the band stack's one derivation.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (Ryan, 2026-09-22) and #281 Part 2 rules 56-60, 64-65, 114-119.
//
// WHY THIS FILE EXISTS AT ALL.  #228's sentinel rule, carried into this
// phase by #281's contract list: "the rail is replaced; its derived-entry
// contract moves to the move ledger and the fact lines".  The rail's
// lesson was that a component which decides its own state drifts from the
// thing that gates on it.  So the bands get the same treatment the rail
// got: state, label, value, verb and provenance are computed HERE, and
// the components render what they are handed.  Anything that composes a
// fact-line string outside this module is a defect.
//
// It is also the #234 contract's only honest shape.  The ruling: "the
// #234 rehydration contract holds both directions (fact line <-> modal
// agree on the intersection)".  Two surfaces cannot agree by both being
// careful; they agree by reading one function.  `whereValue()` is what
// the WHERE fact line prints and what the picker's own summary prints.
//
// Rule 3: nothing here judges.  `deriveRail()` still owns the blocker
// chain and the Generate gate; this module owns presentation only, and
// imports `hasLocation` rather than re-deriving "is there a pin".

import { candidateLabel, crossStreetLabel } from "../road-detection/labels";
import { SCENARIO_KINDS, hasConfirmedSide, hasLocation } from "./index";
import type { Scenario, ScenarioKind } from "./types";

/** The two bands, plus the GENERATE slot's id.
 *
 *  GENERATE is in this list because it is a row in the column and it has
 *  a collapsed form — Part 1 §2.1's "◌ Generate · pending" — but it is
 *  never `open`: it asks no question, so it carries no step question and
 *  has nothing to open.  See `components/bands/GenerateBand.tsx`. */
export type BandId = "where" | "what" | "generate";

/** #289 hand-check, 2026-09-23, defect 1: the kind choice as a person
 *  made it — separate from `scenario.kind`, which always holds a value.
 *  `none` → a chip click → `picked` → the WHERE primary → `confirmed`.
 *  Shell state only; it never rides the wire.  See rulings.md, "D1". */
export type KindState = "none" | "picked" | "confirmed";

/** Rule 58's verbs.  "MOVE" is Part 1 §7.14's — a map position is a drag,
 *  not a field edit.  "SET" marks an unset optional. */
export type FactVerb = "CHANGE" | "MOVE" | "SET" | "CHANGE ONE THING";

export interface BandFact {
  id: BandId;
  /** Rule 57's field label (type role 3). */
  label: string;
  /** Rule 57's value, or null on a pending line (rule 59). */
  value: string | null;
  /** Rule 58's link verb; null when the row offers a provenance word
   *  instead — rule 134: "a fact line either offers a link or offers a
   *  provenance word", never a disabled link. */
  verb: FactVerb | null;
  /** Rule 59's reason, present exactly when `verb` is null. */
  pending: string | null;
  /** Rule 18's fixed symbols: done, or not reached.  #289 fidelity F1:
   *  the pending glyph is rule 17's ◌ (U+25CC, dotted circle); it was ○
   *  (U+25CB, white circle), a character outside the vocabulary. */
  glyph: "✓" | "◌";
}

export interface BandModel {
  /** Rule 65: exactly one band is open.  Never an array. */
  open: BandId;
  /** Every band in column order.  The open one appears here too, so the
   *  stack can render the others around it without a second list. */
  facts: BandFact[];
  /** Rule 62's step index for the open band, type role 4.  Ruling 198's
   *  four steps are WHERE, WHAT, GENERATE and the results; the setup
   *  column shows the first three. */
  stepIndex: string;
  /** Has the GENERATE row been REACHED?  False renders §2.1 item 5's
   *  pending fact line, true renders §2.3's framed primary.  The word
   *  "ready" is deliberately not used: whether Generate is ENABLED is
   *  `deriveRail().blocker`'s answer and this module never asks it. */
  generateReached: boolean;
}

const STEP_OF: Record<BandId, number> = { where: 1, what: 2, generate: 3 };

export function kindLabel(kind: ScenarioKind): string {
  return SCENARIO_KINDS.find((k) => k.v === kind)?.l ?? kind;
}

/** The kind's TA/sheet citation, verbatim from the one table that holds
 *  it.  Rule 135 puts it on the chip; the citation counter does not move
 *  because nothing new is authored. */
export function kindCitation(kind: ScenarioKind): string {
  return SCENARIO_KINDS.find((k) => k.v === kind)?.sub ?? "";
}

const ROAD_TYPE_LABEL: Record<string, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

export function roadTypeLabel(v: string): string {
  return ROAD_TYPE_LABEL[v] ?? v;
}

/**
 * The road as the column names it: "E Colfax Ave Eastbound".
 *
 * Composed from `candidateLabel()` — the picker's own producer — so the
 * fact line and the picker cannot print two different names for one road
 * (#234, both directions).  Null when no road has been confirmed.
 */
export function confirmedRoadLabel(scenario: Scenario): string | null {
  const road = scenario.meta.confirmedRoad;
  if (!road) return null;
  const l = candidateLabel(road.candidate);
  return `${l.primary} ${l.direction}`;
}

/**
 * Is the confirmed road still the road at this pin?
 *
 * The same comparison `deriveRail()` makes for its `stale` state and the
 * same one `DetectedVsApplied` and the shell's `roadForPin` gate on (the
 * #149 failure class).  Rule 3 mirror: this is a re-read of an existing
 * predicate for presentation, never a second definition of staleness —
 * if the two ever disagree, `rail.ts` is right and this is the defect.
 */
export function roadIsStale(scenario: Scenario): boolean {
  const road = scenario.meta.confirmedRoad;
  if (!road) return false;
  return !(road.pinLat === scenario.meta.lat && road.pinLng === scenario.meta.lng);
}

const ft = (n: number) => `${n.toLocaleString("en-US")} ft`;

/**
 * The WHERE band's answer, as one string.
 *
 * Part 1 §2.3 prints "E Colfax Ave EB · 210 ft N of W 38th Ave · 1,000 ft
 * · right shoulder".  Two of those four have no producer in this phase and
 * the checkpoint recorded both (§A.1):
 *
 *  · "210 ft N of W 38th Ave" needs the nearest intersection at pin time.
 *    `lib/road-detection/cross-street.ts` is the near_intersection kind's
 *    deliberate second pin, not a nearest-intersection producer.  #281's
 *    own ruling says what happens meanwhile: "the tag prints the road
 *    name, lat/lng in provenance".  The road name is already the first
 *    clause, so the position contributes nothing here and the coordinates
 *    ride `whereProvenance()`.
 *  · "right shoulder" is the side, which is Phase 3's work-segment model.
 *    The kind is what the column can say today, and it says the kind.
 *
 * Rule 10: what is absent is absent.  Nothing here invents a clause.
 *
 * #289 hand-check, 2026-09-23, defect 1: the kind clause prints only once
 * a person has confirmed it.  Before that `scenario.kind` holds the
 * default, and printing it would be the pre-selection the hand-check
 * found, restated as a fact.
 */
export function whereValue(
  scenario: Scenario,
  kindConfirmed = true,
): string | null {
  if (!hasLocation(scenario.meta)) return null;
  const parts: string[] = [];
  const road = confirmedRoadLabel(scenario);
  if (road) parts.push(road);
  else if (scenario.meta.address) parts.push(scenario.meta.address);
  // #234: the marked intersection, named by the picker's own producer
  // (crossStreetLabel) — near_intersection only, the one kind that
  // marks one.  "Fact line <-> modal agree on the intersection."
  const x = scenario.meta.intersection;
  if (scenario.kind === "near_intersection" && x) parts.push(`at ${crossStreetLabel(x.name)}`);
  if (scenario.workLen > 0) parts.push(ft(scenario.workLen));
  if (kindConfirmed) parts.push(kindLabel(scenario.kind).toLowerCase());
  return parts.join(" · ");
}

/**
 * The WHERE band's right-aligned header provenance (rule 62).
 *
 * Pre-pin it is the design's own sentence.  Post-pin it carries the road
 * and the place, and the coordinates the fact line no longer prints —
 * Part 1 §7.15: "I show the pin's position as '210 ft N of W 38th Ave'
 * everywhere in the controls and reserve the lat/lng for provenance
 * lines."  Until the tag has a producer, the coordinates ARE the position
 * and they belong here rather than nowhere.
 */
export function whereProvenance(scenario: Scenario): string {
  if (!hasLocation(scenario.meta)) return "the work — not the first sign";
  const road = scenario.meta.confirmedRoad;
  const coords = `${scenario.meta.lat.toFixed(5)}, ${scenario.meta.lng.toFixed(5)}`;
  if (!road) return `pin at ${coords}`;
  const l = candidateLabel(road.candidate);
  const place = road.placeName ? ` · ${road.placeName}` : "";
  // #289 hand-check, 2026-09-23, fix 3: "detection source and way id
  // under the WHERE fact line's provenance".  They were two clauses of a
  // loose block under the WHAT grid, describing no field there — where
  // the road CAME FROM is a fact about the pin, and this is the pin's
  // own line.  The words are the block's, unchanged.
  const source = `OSM detection · way ${road.candidate.way_id} · ${
    road.method === "auto_single" ? "sole match auto-adopted" : "operator pick"
  }`;
  return `${l.primary} ${l.direction.toLowerCase()}${place} · ${coords} · ${source}`;
}

/**
 * The WHAT band's answer, as one string — Part 1 §2.4's order:
 * kind · speed · lanes · lane width · road type · jurisdiction.
 *
 * `lanes` is omitted for the flagger kind because the kind has no lanes
 * field: TA-10 is definitionally one through lane each direction, so a
 * lane count would be a number nobody set (rule 10).  The grid says the
 * same thing in its own read-only cell (#209).
 */
export function whatValue(
  scenario: Scenario,
  jurisdictionName: string | null,
): string {
  const parts: string[] = [kindLabel(scenario.kind).toLowerCase()];
  parts.push(`${scenario.speed} mph`);
  if ("lanes" in scenario) {
    const n = scenario.lanes as number;
    parts.push(`${n} lane${n === 1 ? "" : "s"}`);
  }
  if ("laneWidth" in scenario) parts.push(`${scenario.laneWidth} ft`);
  parts.push(roadTypeLabel(scenario.roadType as string));
  // #257 / #260: one word for an unset jurisdiction on every surface.
  parts.push(
    scenario.jurisdiction_key ? (jurisdictionName ?? scenario.jurisdiction_key) : "Not set",
  );
  return parts.join(" · ");
}

/**
 * Rule 119's post-generate setup line: "the whole scenario in one string,
 * ordered: kind · road and direction · extent · side · speed ·
 * jurisdiction".
 *
 * `side` is Phase 3's, as above, and is omitted rather than guessed.
 * Exported here in the phase that builds the producer even though its
 * occupant — rule 28's reserved first row — mounts in the S4/S5 commit:
 * one derivation, declared where the rest of the column's strings live.
 */
export function setupValue(
  scenario: Scenario,
  jurisdictionName: string | null,
): string {
  return setupSegments(scenario, jurisdictionName)
    .map((s) => s.text)
    .join(" · ");
}

/**
 * The setup fact line's values, one per thing the operator can change.
 *
 * #289 hand-check, 2026-09-23, defect 2: "the setup fact line's values
 * each become their own link (speed, lanes, width, road type,
 * jurisdiction, dates, kind, location)".  Chosen over a field picker —
 * rulings.md, "D2 — the choice, recorded".
 *
 * Rule 119's order, with the hand-check's additions slotted where the
 * WHAT band's own order puts them: kind · location · extent · speed ·
 * lanes · width · road type · jurisdiction · dates.  `side` is still
 * Phase 3's and is still omitted rather than guessed.
 *
 * Rule 10, per segment: `lanes` is absent for a kind that has no lane
 * count (TA-10's definition, #209), because a link to change a number
 * nobody set would be a control about nothing.  Every other segment is
 * always present — an unset jurisdiction or date reads "Not set", which
 * is exactly the value a person would press to set.
 */
export type SetupSegmentKey =
  | "kind"
  | "location"
  | "extent"
  | "speed"
  | "lanes"
  | "laneWidth"
  | "roadType"
  | "jurisdiction"
  | "dates";

export interface SetupSegment {
  key: SetupSegmentKey;
  text: string;
  /** What the link says to a screen reader: the field and its value,
   *  because "35 mph" alone does not say it is the speed. */
  label: string;
}

/** The work dates as the line prints them.  The mode is derived from
 *  the dates (what-writes.ts `setWorkDates`), so this reads the dates and
 *  not the mode.  Dates are printed as stored (ISO), never re-formatted
 *  into a locale the backend did not see. */
export function datesText(scenario: Scenario): string {
  const s = scenario.schedule;
  if (!s?.work_date) return "dates not set";
  return s.work_date_end ? `${s.work_date} – ${s.work_date_end}` : s.work_date;
}

export function setupSegments(
  scenario: Scenario,
  jurisdictionName: string | null,
): SetupSegment[] {
  const seg = (key: SetupSegmentKey, field: string, text: string) => ({
    key,
    text,
    label: `${field}: ${text} — change`,
  });
  const out: SetupSegment[] = [seg("kind", "Kind of work", kindLabel(scenario.kind))];
  const road = confirmedRoadLabel(scenario);
  out.push(
    seg(
      "location",
      "Location",
      road ??
        (scenario.meta.address ||
          `pin at ${scenario.meta.lat.toFixed(5)}, ${scenario.meta.lng.toFixed(5)}`),
    ),
  );
  if (scenario.workLen > 0) out.push(seg("extent", "Work zone length", ft(scenario.workLen)));
  out.push(seg("speed", "Speed limit", `${scenario.speed} mph`));
  if ("lanes" in scenario) {
    const n = scenario.lanes as number;
    out.push(seg("lanes", "Lanes per direction", `${n} lane${n === 1 ? "" : "s"}`));
  }
  if ("laneWidth" in scenario) {
    out.push(seg("laneWidth", "Lane width", `${scenario.laneWidth} ft lanes`));
  }
  out.push(seg("roadType", "Road type", roadTypeLabel(scenario.roadType as string)));
  out.push(
    seg(
      "jurisdiction",
      "Jurisdiction",
      scenario.jurisdiction_key
        ? (jurisdictionName ?? scenario.jurisdiction_key)
        : "Not set",
    ),
  );
  out.push(seg("dates", "Work dates", datesText(scenario)));
  return out;
}

export interface BandInput {
  scenario: Scenario;
  /** The evaluated jurisdiction's display name, when one has landed.
   *  Null is not an error state — it is "not set" or "not evaluated", and
   *  the WHAT grid's own cell says which (ruling 196). */
  jurisdictionName: string | null;
  /**
   * Which band the user has opened by hand, if any.  Null means "the
   * column decides", which is the load path and every collapse.  A CHANGE
   * link sets it; confirming a band clears it, so the column moves on.
   */
  openOverride: BandId | null;
  /** `deriveRail().blocker`'s string, or null when nothing is blocking.
   *  This module does not derive it and never will — rule 139 keeps the
   *  chain single-sourced.  It is here because rule 59 gives the pending
   *  line's right track the job of stating WHY, and before there is a pin
   *  the reason Generate cannot run is the only thing worth saying in
   *  that slot. */
  blockerReason?: string | null;
  /** #289 hand-check, 2026-09-23, defect 1: has a person confirmed the
   *  kind (a chip click, then the WHERE primary)?  The shell owns it;
   *  `scenario.kind` cannot say, because it always holds a value.
   *  Defaults to true for callers that do not ask. */
  kindConfirmed?: boolean;
}

/**
 * The band model.  Rule 65's one-open invariant is a property of this
 * return value, not of the component: `open` is a single id, so a
 * multi-open state is unrepresentable rather than merely undesirable.
 */
export function deriveBands({
  scenario,
  jurisdictionName,
  openOverride,
  blockerReason = null,
  kindConfirmed = true,
}: BandInput): BandModel {
  const located = hasLocation(scenario.meta);
  const where = whereValue(scenario, kindConfirmed);
  // WHAT is reachable once the pin is down AND a person has confirmed the
  // kind.  Before that it is a pending line, and its reason is the one
  // thing still owed.
  const whatReady = located && kindConfirmed;
  // #290 prod sweep finding (Ryan, 2026-09-25: "WHERE's Confirm doesn't
  // move on to WHAT while the side is owed, and the side control stays
  // open on WHERE until chosen").  The side is WHERE's question too, so
  // the column's OWN reading of the live question stays on WHERE while it
  // is owed — the side control is in that band.  Confirming the kind
  // first used to open WHAT while the strip said AWAITING OCCUPIED SIDE,
  // with the side control folded away.  WHAT stays REACHABLE (its CHANGE
  // link is an explicit request, honoured below); only the column's own
  // move waits, and it moves the moment the side is chosen.
  const sideOwed = located && !hasConfirmedSide(scenario.meta);

  // The column's own reading of "which question is live".
  //
  // #289 hand-check, 2026-09-23, defect 1 — THIS REVERSES A RECORDED
  // PHASE 2 DEVIATION.  The column used to open WHAT the moment a pin
  // existed, on the reasoning that with no proposal producer a mandatory
  // confirm would confirm "a decision nobody made".  But the decision
  // WAS made — by the default, silently: shoulder work arrived
  // pre-selected and the operator was never asked.  The guardrail is
  // "the kind is confirmed, never inferred" (FLOW.md §5a, #281 §4.4,
  // P21), and #281's own audit ruling says the chips render UNSELECTED,
  // which only means something if nothing is selected for them.
  //
  // So Part 1 §2.3's reading comes back: the WHERE band stays open until
  // the confirm press, and the press is what collapses it.  The chips
  // start with none pressed (components/bands/WhereBand.tsx), so the
  // confirm is now a decision again rather than ceremony.
  const natural: BandId = whatReady && !sideOwed ? "what" : "where";
  // An override onto WHAT before the kind is confirmed is refused here
  // rather than trusted: WHAT is pending, and a pending line has no band
  // to open (rule 59).
  const open: BandId =
    openOverride && openOverride !== "generate" && (openOverride !== "what" || whatReady)
      ? openOverride
      : natural;

  const facts: BandFact[] = [
    {
      id: "where",
      label: "Where",
      value: where,
      verb: located ? "CHANGE" : null,
      pending: located ? null : "pending — find the work first",
      glyph: located ? "✓" : "◌",
    },
    {
      id: "what",
      label: "What's the job?",
      value: whatReady ? whatValue(scenario, jurisdictionName) : null,
      verb: whatReady ? "CHANGE" : null,
      pending: whatReady
        ? null
        : located
          ? // Defect 1: the pin is down and the kind is not confirmed.
            // Ruled 2026-09-23: "WHAT's pending line reads 'pending —
            // kind of work not chosen'" — a STATE, not the instruction.
            // The instruction ("choose the kind of work") lives only on
            // the disabled primaries (the strip-wording ruling, a04bd73).
            "pending — kind of work not chosen"
          : // Part 1 §2.2's own string once a road exists; §2.1's before.
            scenario.meta.confirmedRoad
            ? `road facts prefill from ${confirmedRoadLabel(scenario)}`
            : "kind of work, extent, side · pending — find the work first",
      glyph: whatReady ? "✓" : "◌",
    },
    {
      id: "generate",
      label: "Generate",
      value: null,
      verb: null,
      // Rule 59: the pending line's right track states WHY.  Part 1 §2.1
      // item 5 prints the bare word "pending"; rule 59 asks for a reason,
      // and before there is a pin there IS one — the blocker chain's own
      // string, which is also the verdict strip's and the disabled
      // primary's (rule 139, one derivation, three surfaces).  Putting it
      // here is what keeps the gate sentence on screen in the one state
      // where the generate frame is not: the alternative is a column that
      // says "pending" and never says why.
      pending: blockerReason ?? "pending",
      glyph: "◌",
    },
  ];

  return {
    open,
    facts,
    stepIndex: `STEP ${STEP_OF[open]} OF 4`,
    generateReached: located,
  };
}
