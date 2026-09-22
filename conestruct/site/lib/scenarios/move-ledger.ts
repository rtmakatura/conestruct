// #289 Phase 2 — C5's derivation, the WHERE band's own progress surface.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// · #281 Part 1 §4 (FLOW.md §5a's five moves) and Part 2 rules 67-71.
//
// Rule 71, verbatim: "State, glyph, word and subline are computed outside
// the component, as today.  The component decides nothing."  `as today` is
// `lib/scenarios/rail.ts`, and this module is its sibling rather than its
// replacement: `deriveRail()` still owns the blocker chain, the Generate
// gate and the section vocabulary.  What moves here is the WHERE step's
// own five rows, which the rail never had.
//
// THE HONESTY THIS MODULE IS RESPONSIBLE FOR (checkpoint §A.1, accepted in
// the ruling).  Three of the five moves have no producer in this phase,
// and the module says so in the rows rather than leaving the reader to
// find out:
//
//   · Move 2's tag, "210 ft N of W 38th Ave", needs the nearest
//     intersection at pin time.  `lib/road-detection/cross-street.ts` is
//     the near_intersection kind's deliberate second pin, not a
//     nearest-intersection producer for any kind.  #281's own ruling:
//     "until then the tag prints the road name, lat/lng in provenance".
//   · Move 4's proposal, "Your tap looks like a right-shoulder closure",
//     has no derivation.  #281: "the chips render unselected with no
//     '✓ proposed'".  The row asks the question; it proposes nothing.
//   · Move 5, "See the plan grow", is Phase 3's approaches.  It is
//     `pending` with the design's own subline.

import { hasLocation } from "./index";
import type { Scenario } from "./types";
import { confirmedRoadLabel } from "./band-facts";

/** Rule 70's states, inherited from the rail's derived entries
 *  unchanged.  `notset` and `stale` are not reachable here: no move is
 *  optional, and staleness is the road's own fact, reported by the
 *  band's provenance rather than by a move. */
export type MoveState = "done" | "attention" | "pending";

export type MoveId = "spot" | "start" | "extent" | "side" | "grow";

/** Rule 68's right track: a link verb, or a provenance word. */
export type MoveVerb = "CHANGE" | "MOVE";

export interface MoveRow {
  id: MoveId;
  label: string;
  state: MoveState;
  /** Rule 70's glyph — the component renders it, never chooses it. */
  glyph: string;
  /** The answer, when there is one. */
  value: string | null;
  /** Rule 68's verb; null when the row offers a word instead. */
  verb: MoveVerb | null;
  /** Rule 68's provenance word, present exactly when `verb` is null. */
  word: string | null;
  /** Rule 69's second line — the current row's sentence.  Only the
   *  washed row carries one. */
  subline: string | null;
}

// Rule 70's vocabulary, from the reconciled set (#227 addendum) — the
// same three this surface can reach.
const GLYPH: Record<MoveState, string> = {
  done: "✓",
  attention: "⚠",
  pending: "○",
};

export interface MoveLedger {
  rows: MoveRow[];
  /** Which row is the washed one (rule 69) — the first that is not done.
   *  Null when every move is answered. */
  currentId: MoveId | null;
}

export function deriveMoveLedger(scenario: Scenario): MoveLedger {
  const located = hasLocation(scenario.meta);
  const road = confirmedRoadLabel(scenario);
  const extent = scenario.workLen > 0;

  const rows: MoveRow[] = [
    {
      id: "spot",
      label: "Found the spot",
      state: road ? "done" : located ? "attention" : "pending",
      glyph: GLYPH[road ? "done" : located ? "attention" : "pending"],
      value: road ?? (located ? (scenario.meta.address || null) : null),
      verb: located ? "CHANGE" : null,
      word: located ? null : "pending",
      subline: null,
    },
    {
      id: "start",
      label: "Work starts",
      state: located ? "done" : "pending",
      glyph: GLYPH[located ? "done" : "pending"],
      // The lesser value, deliberately: the road name is what the tag
      // can honestly carry until the nearest-intersection producer
      // exists.  The coordinates ride the band's provenance (Part 1
      // §7.15 reserves the lat/lng for provenance lines).
      value: located ? (road ?? (scenario.meta.address || "pin set")) : null,
      verb: located ? "MOVE" : null,
      word: located ? null : "pending",
      subline: null,
    },
    {
      id: "extent",
      label: "Extent",
      state: extent ? "done" : located ? "attention" : "pending",
      glyph: GLYPH[extent ? "done" : located ? "attention" : "pending"],
      // "typed" states which producer set it — the word is Part 1
      // §4.3's, and it is the only producer this phase has.
      value: extent ? `${scenario.workLen.toLocaleString("en-US")} ft, typed` : null,
      // Rule 68's invariant, caught by this arc's own sentinel: a row
      // offers a link OR a word, never neither.  A set extent offers
      // CHANGE — the picker carries `workZoneFt`, so the same control
      // that set it is the one that changes it (Part 1 §4.3's own verb).
      verb: extent ? "CHANGE" : null,
      word: extent ? null : located ? "needs you" : "pending",
      subline: null,
    },
    {
      id: "side",
      label: "Which side is occupied?",
      // Move 4 is THE ONE MOVE THE USER MUST MAKE (Part 1 §4.4), and
      // this phase cannot propose an answer — so it is attention from
      // the moment there is a pin, and it never reads as done: the kind
      // chips below it are where it is answered, and the chip selection
      // is a confirmation, never an inference.
      state: located ? "attention" : "pending",
      glyph: GLYPH[located ? "attention" : "pending"],
      value: null,
      verb: null,
      word: located ? "needs you" : "pending",
      subline: located
        ? // The design's sentence, minus its proposal clause, which has
          // no producer.  What survives is the part that is true today
          // and is the whole point of the row.
          "Conestruct never sets the kind for you — confirm it below."
        : null,
    },
    {
      id: "grow",
      label: "See the plan grow",
      state: "pending",
      glyph: GLYPH.pending,
      value: null,
      verb: null,
      word: "pending",
      subline: "approaches lay out after you confirm",
    },
  ];

  const current = rows.find((r) => r.state !== "done") ?? null;
  return { rows, currentId: current?.id ?? null };
}
