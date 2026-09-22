// #289 Phase 2 — the WHAT grid's per-kind table.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (d) "The grid switches on kind; every live kind renders it" · #281
// Part 1 §8.22 ("which fields render still switches on kind") · Part 2
// rules 116, 136.
//
// WHY A TABLE AND NOT A SWITCH IN THE COMPONENT.  Until this commit the
// three per-kind forms each carried their own `ROAD_TYPES` array, their
// own speed bounds and their own lane options — three copies of one
// vocabulary, differing in ways nobody had a reason for (the shoulder's
// "Rural — divided hwy" against the strip's "Rural — divided").  The grid
// renders one table, so a kind's domain is a row here rather than a
// literal three files apart.
//
// Rule 12: every bound below is TRACED, not chosen.  Each one is the value
// the kind's own form enforced at e60c91c, with the file and line it came
// from, so this table is a move rather than a re-decision.  Where the
// labels differed between copies, the one kept is named.
//
// Rule 3: no bound here is a compliance judgement.  The backend
// re-validates every render call; these are the domains the UI must not
// offer outside, which is the same job the sliders did.

import { MAX_LANES_PER_DIRECTION } from "./validation";
import type { RoadType, ScenarioKind } from "./types";

export interface WhatCellTable {
  /** Road-type options, in the kind's own order. */
  roadTypes: Array<{ v: RoadType; l: string }>;
  /** The kind's note under the road-type cell — its own sentence,
   *  verbatim from the form it came from.  Null where the form had
   *  none (the shoulder's). */
  roadTypeNote: string | null;
  /** Posted-speed domain.  Step is 5 everywhere (the 5-mph grid the
   *  handoff snaps to). */
  speedMin: number;
  speedMax: number;
  /** Lanes-per-direction options; null when the kind carries no lanes
   *  field, which is a fact about the kind rather than a hidden cell —
   *  the grid renders the cell read-only with the reason (#209). */
  lanes: number[] | null;
  /** Why this kind has no lane count, for the read-only cell. */
  lanesReason: string | null;
  /** Lane-width domain, in feet. */
  laneWidthMin: number;
  laneWidthMax: number;
  laneWidthStep: number;
}

// "Rural — divided hwy" (ShoulderForm.tsx:28) and "Rural — divided"
// (SetupStrip.tsx:41, the fact strip, the XLSX) were two labels for one
// enum value.  The strip's is kept: it is the one the deliverables carry,
// and #198's discipline is that a name crossing a seam has one spelling.
const LABEL: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

const opt = (...vs: RoadType[]) => vs.map((v) => ({ v, l: LABEL[v] }));

export const WHAT_CELLS: Record<ScenarioKind, WhatCellTable> = {
  // ShoulderForm.tsx:26-31 (types), :119 (speed 25-75 step 5),
  // :133 (lanes 1-4), :192 (lane width 9-14 step .5).
  shoulder: {
    roadTypes: opt("rural_undivided", "rural_divided", "urban_arterial", "freeway"),
    roadTypeNote: null,
    speedMin: 25,
    speedMax: 75,
    lanes: [1, 2, 3, 4],
    lanesReason: null,
    laneWidthMin: 9,
    laneWidthMax: 14,
    laneWidthStep: 0.5,
  },
  // FlaggerForm.tsx:29-32 (types), :124 (the note), SPEED_MAX in
  // SetupStrip.tsx:49 (55 — the form's own slider bound).
  flagger_lane_closure: {
    roadTypes: opt("rural_undivided", "urban_arterial"),
    roadTypeNote:
      "TA-10 applies to roads with one through lane in each direction",
    speedMin: 25,
    speedMax: 55,
    lanes: null,
    // #209's read-only-with-reason.  The kind has no `lanes` field at
    // all (types.ts, FlaggerLaneClosureScenario), and that is TA-10's
    // definition rather than an omission — so the cell states the count
    // the plan uses and why, instead of vanishing (rule 10).
    lanesReason:
      "1 each direction · TA-10's definition — the flagger alternates two opposing directions",
    laneWidthMin: 9,
    laneWidthMax: 14,
    laneWidthStep: 0.5,
  },
  // NearIntersectionForm.tsx:42-45 (types), :247 (the note), :256
  // (speed 25-55), :270 (lanes 2-4, "needs 2+"), :285 (width 9-14).
  near_intersection: {
    roadTypes: opt("rural_undivided", "urban_arterial"),
    roadTypeNote: "CDOT Cases 18/19 cover undivided and arterial roads",
    speedMin: 25,
    speedMax: 55,
    lanes: [2, 3, 4],
    lanesReason: null,
    laneWidthMin: 9,
    laneWidthMax: 14,
    laneWidthStep: 0.5,
  },
  // The four gated kinds.  They are not reachable — `isScenarioKindEnabled`
  // is false for each and the chips do not render them (R2) — but the
  // table is total rather than partial so a kind enabled later gets a
  // compile error here instead of an undefined lookup at runtime.  Each
  // carries its own form's domain where one exists; none is invented.
  lane_closure_divided: {
    roadTypes: opt("rural_divided", "freeway"),
    roadTypeNote: null,
    speedMin: 25,
    speedMax: 75,
    lanes: [2, 3, 4],
    lanesReason: null,
    laneWidthMin: 9,
    laneWidthMax: 14,
    laneWidthStep: 0.5,
  },
  work_beyond_shoulder: {
    roadTypes: opt("rural_undivided", "rural_divided", "urban_arterial", "freeway"),
    roadTypeNote: null,
    speedMin: 25,
    speedMax: 75,
    lanes: [1, 2, 3, 4],
    lanesReason: null,
    laneWidthMin: 9,
    laneWidthMax: 14,
    laneWidthStep: 0.5,
  },
  mobile_op_2lane: {
    roadTypes: opt("rural_undivided", "urban_arterial"),
    roadTypeNote: null,
    speedMin: 25,
    speedMax: 55,
    lanes: null,
    lanesReason: "1 each direction · the 2-lane mobile operation's definition",
    laneWidthMin: 9,
    laneWidthMax: 14,
    laneWidthStep: 0.5,
  },
  mobile_op_multilane: {
    roadTypes: opt("rural_divided", "freeway"),
    roadTypeNote: null,
    speedMin: 25,
    speedMax: 75,
    lanes: [2, 3, 4],
    lanesReason: null,
    laneWidthMin: 9,
    laneWidthMax: 14,
    laneWidthStep: 0.5,
  },
};

/** The 5-mph grid, as options — the same grid the picker handoff snaps
 *  a detected speed onto, so the cell can never offer a value the
 *  handoff would immediately re-snap. */
export function speedOptions(kind: ScenarioKind): number[] {
  const t = WHAT_CELLS[kind];
  const out: number[] = [];
  for (let s = t.speedMin; s <= t.speedMax; s += 5) out.push(s);
  return out;
}

export function laneWidthOptions(kind: ScenarioKind): number[] {
  const t = WHAT_CELLS[kind];
  const out: number[] = [];
  for (let w = t.laneWidthMin; w <= t.laneWidthMax + 1e-9; w += t.laneWidthStep) {
    out.push(Math.round(w * 10) / 10);
  }
  return out;
}

/** #209: the lanes cell never offers a count the plan cannot draw.  The
 *  domain ceiling is the one constant, not a per-form literal — the
 *  picker's own `max={6}` against this 4 is what #209 filed. */
export const LANES_CEILING = MAX_LANES_PER_DIRECTION;
