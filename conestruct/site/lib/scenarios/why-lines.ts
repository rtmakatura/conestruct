// #517 (UX group 7, the What section) — the section's words, in one place.
//
// Authority: validation-artifacts/committed/missions/ux-group7-what-section/
// issue-517/rulings.md (Ryan, 2026-11-11, boards B and D).
//   Ruling 2: "Each reason states that basis in plain words (e.g. 'Based on
//   the road's map tag', 'Based on where your pin is').  Rule 12: no reason
//   line without a source.  Rule 10: if the backend has no basis to state,
//   show 'Our guess' alone.  Never invent a reason."
//   Ruling 5: "Each field's source line is plain Inter 12.5: 'Measured from
//   the map' (pass check), 'Our guess. Check it.' (warn triangle),
//   'Default', 'Not set yet'. ... Remove 'OSM' and every other piece of
//   jargon from these tips."
//   S4 adds "Set by you" and "Checked".
//
// What is minted here: every source word, guess reason and why-tip
// sentence the section shows, and the section's own lines (intro, box
// heading, dates and file-details lines), from the same inputs the old
// clauses read (detection rows via `detectedRow` / `clauseIsAmber`, the
// guess records, `isOperatorSet`, `isKindDefault`).  This module decides no
// value and computes nothing the backend owns (Rule 3): it words facts the
// scenario already carries.  Not minted here (#521; strings.md names each
// string's file): the section's titles, button words and value words
// (components/bands/WhatBand.tsx), "Type of work" and "Work hours"
// (PlanDetails.tsx), the listbox's "Not set" (ui/Listbox.tsx), #198's
// handoff sentences (HandoffNotes.tsx, byte-identical), and the
// jurisdiction lookup's evidence (JurisdictionSection.tsx), whose
// `JurisdictionEvidence` and `JurisdictionWarnings` stay byte-identical
// while `StreetClassEvidence` is reworded (S20: no "OSM" in the tips).

import type { JurisdictionBlock } from "../jurisdiction";
import { JURISDICTION_OPTIONS } from "../jurisdiction";
import type {
  DetectedModel,
  DetectedRow,
  DetectedRowLabel,
} from "../road-detection/detected-rows";
import { clauseIsAmber, detectedRow } from "../road-detection/detected-rows";
import {
  carriagewayVerdict,
  TWIN_RADIUS_M,
  type CarriagewayFacts,
} from "../road-detection/carriageway";
import { speedEstimateForClass } from "../road-detection/classify";
import { DEFAULT_SHOULDER, isKindDefault } from "./index";
import { isGuessed, isOperatorSet, speedSet } from "./guesses";
import { shoulderRoadClassLanes } from "./what-writes";
import type { Scenario } from "./types";

// ---------------------------------------------------------------------------
// The source line's words (ruling 5, S4)
// ---------------------------------------------------------------------------

export type SourceKind =
  | "measured"
  | "guess"
  | "default"
  | "unset"
  | "mine"
  | "checked";

/** Ruling 5's four words and S4's two.  The glyph is the second channel
 *  (Rule 13): ✓ pass for a value read off the map or checked, ⚠ for a
 *  guess; the plain words carry the rest. */
export const SOURCE_WORDS: Record<
  SourceKind,
  { glyph: "✓" | "⚠" | null; word: string }
> = {
  measured: { glyph: "✓", word: "Measured from the map" },
  guess: { glyph: "⚠", word: "Our guess. Check it." },
  default: { glyph: null, word: "Default" },
  unset: { glyph: null, word: "Not set yet" },
  mine: { glyph: null, word: "Set by you" },
  checked: { glyph: "✓", word: "Checked" },
};

/** One field's why: its source word, the tip's sentences (first line the
 *  plain-words reason), and a line that needs the operator now (P3: on
 *  show under the control, never only in the tip). */
export interface Why {
  source: SourceKind;
  tip: string[];
  /** A ⚠ line on show under the control (the operator must act now). */
  alert?: string | null;
  /** An error on show under the control (validation). */
  error?: string | null;
  /** Does this field want a check (S5's closed-state ⚠ line)? */
  needsCheck?: boolean;
}

// ---------------------------------------------------------------------------
// Map tags in plain words
// ---------------------------------------------------------------------------

/** The road's map tag (`highway=*`) as a person would say it.  Unknown
 *  tags print as themselves with `_` read as a space: honest, never a
 *  guess at what they mean. */
const TAG_WORDS: Record<string, string> = {
  motorway: "freeway",
  trunk: "major highway",
  primary: "main road",
  secondary: "secondary road",
  tertiary: "smaller through road",
  unclassified: "minor road",
  residential: "residential street",
  living_street: "living street",
  service: "service road",
};

export function tagWords(tag: string): string {
  if (TAG_WORDS[tag]) return TAG_WORDS[tag];
  const link = /^(.+)_link$/.exec(tag);
  if (link && TAG_WORDS[link[1]]) return `${TAG_WORDS[link[1]]} ramp`;
  return tag.replace(/_/g, " ");
}

/** "a residential street", "an unknown road". */
function aTag(tag: string): string {
  const w = tagWords(tag);
  return `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;
}

// ---------------------------------------------------------------------------
// The guesses box (rulings 1-3, S1, S2)
// ---------------------------------------------------------------------------

/** The four fields that carry a guess record (S1), in the box's fixed
 *  order: rows never move (P1). */
export const BOX_FIELDS = [
  "road_type",
  "street_class",
  "jurisdiction_key",
  "speed",
] as const;
export type BoxField = (typeof BOX_FIELDS)[number];

/** Is `field` still an untouched guess?  Road type also counts as checked
 *  once the operator has set it (S2: its record drops on the shell's next
 *  normalize, `reconcileRoadType`). */
export function isOpenGuess(s: Scenario, field: BoxField): boolean {
  if (!isGuessed(s, field)) return false;
  if (field === "road_type") return !isOperatorSet(s, "roadType");
  return true;
}

/** Ruling 2: the reason line, from the guess record's own basis.  Rule 10:
 *  a record with no basis to state reads "Our guess" alone. */
export function guessReason(s: Scenario, field: BoxField): string {
  const g = s.guesses ?? {};
  switch (field) {
    case "road_type": {
      const r = g.road_type;
      if (!r) return "Our guess";
      return r.urban
        ? "Based on the road's map tag and the built-up area around it"
        : "Based on the road's map tag and the open country around it";
    }
    case "street_class":
      return g.street_class ? "Based on the road's map tag" : "Our guess";
    case "jurisdiction_key":
      return g.jurisdiction_key ? "Based on where your pin is" : "Our guess";
    case "speed":
      return g.speed
        ? "Based on the road's map tag. The map has no posted speed here."
        : "Our guess";
  }
}

/** Ruling 1's intro line.  Zero rows: the second clause goes. */
export function introLine(boxRows: number, detected: boolean): string {
  if (!detected && boxRows === 0) {
    return "No confirmed road at this pin, so nothing was prefilled. Set what the plan needs.";
  }
  const first = detected
    ? "We filled this in from the road you confirmed."
    : "We filled in what we could from your pin.";
  if (boxRows === 0) return first;
  return `${first} Check our ${boxRows} ${boxRows === 1 ? "guess" : "guesses"}, then tell us about the work.`;
}

export function boxHeading(boxRows: number): string {
  return `Check ${boxRows === 1 ? "this guess" : `these ${boxRows} guesses`}`;
}

// ---------------------------------------------------------------------------
// Detection clauses in plain words
// ---------------------------------------------------------------------------

/** What a detection row says about its value, as a sentence.  The inputs
 *  are provenance.ts's tokens; the words replace "OSM · 2 · measured". */
export function detectionWords(r: DetectedRow): string {
  if (r.detected === null) {
    return "You changed it, so the plan no longer uses the map's value.";
  }
  if (r.detectedToken === "overridden") {
    return `You changed it. The map's ${r.detected} stays on the plan's record.`;
  }
  const base =
    r.detectedToken === "measured"
      ? `The road's map record says ${r.detected}.`
      : r.detectedToken === "inferred"
        ? `The map's ${r.detected} is an estimate. Check it on site.`
        : `The map gives ${r.detected}, with no note of where it came from.`;
  if (r.verdict === "differ") {
    return r.appliedToken === "changed in plan"
      ? `${base} The plan uses ${r.applied ?? "no value"}, the nearest value it offers.`
      : `${base} You changed it to ${r.applied ?? "no value"}.`;
  }
  return base;
}

/** The source word a detection row earns: measured and unchanged reads
 *  "Measured from the map"; an estimate is a guess to check; the
 *  operator's change is theirs. */
function detectionSource(r: DetectedRow): SourceKind {
  if (r.detected === null || r.detectedToken === "overridden") return "mine";
  if (r.verdict === "differ" && r.appliedToken !== "changed in plan")
    return "mine";
  return clauseIsAmber(r) ? "guess" : "measured";
}

/** A yes/no field's applied word as "yes" / "no"; anything else as is. */
function yesNo(name: string, applied: string | null | undefined): string {
  if (applied == null) return "not set";
  const a = applied.toLowerCase();
  if (a === name.toLowerCase() || a === "yes" || a === "true") return "yes";
  if (a === "undivided" || a === "two-way" || a === "no" || a === "false")
    return "no";
  return applied;
}

/** A detection line for a field that has no control of its own (one-way,
 *  or divided-ness where there is no Divided control). */
export function detectionLine(
  model: DetectedModel | null,
  label: DetectedRowLabel,
): { key: string; text: string; warn: boolean } | null {
  const r = detectedRow(model, label);
  if (!r) return null;
  const name = label === "One-way" ? "One-way" : label;
  return {
    key: label.toLowerCase().replace(/\s+/g, "-"),
    // #517 round 1: "Divided: yes.", never "Divided: Divided.".
    text: `${name}: ${yesNo(name, r.applied)}. ${detectionWords(r)}`,
    warn: clauseIsAmber(r),
  };
}

// ---------------------------------------------------------------------------
// The fields
// ---------------------------------------------------------------------------

export function speedWhy(s: Scenario, model: DetectedModel | null): Why {
  const g = s.guesses?.speed;
  if (g) {
    const est = speedEstimateForClass(g.highwayClass);
    return {
      source: "guess",
      tip: [
        `The map has no posted speed for this road, so we used the usual speed for ${aTag(g.highwayClass)}${est !== null ? `: ${s.speed} mph` : ""}. Check the sign on site.`,
      ],
    };
  }
  if (!speedSet(s)) {
    return {
      source: "unset",
      tip: [
        model
          ? "The map has no posted speed for this road and its type gives no estimate. Pick the posted speed."
          : "No confirmed road, so no speed came from the map. Pick the posted speed.",
      ],
      needsCheck: true,
    };
  }
  const r = detectedRow(model, "Speed limit");
  if (!r) {
    return { source: "mine", tip: ["You set this speed."] };
  }
  const src = detectionSource(r);
  if (src === "measured" && r.verdict === "match") {
    return {
      source: "measured",
      tip: [
        `The road's map record says the posted speed is ${r.detected}. If the sign on site says otherwise, change it here.`,
      ],
    };
  }
  return { source: src, tip: [detectionWords(r)], needsCheck: src === "guess" };
}

export interface LanesFacts {
  /** The kind takes a lane count. */
  takesCount: boolean;
  /** The kind's fixed-count reason (#209), when it takes none. */
  fixedReason: string | null;
  /** validateLanes' verdict. */
  valid: boolean;
  invalidMessage: string | null;
  /** #521: the carriageway reads one-way, so a count is not "each way". */
  oneWay?: boolean;
}

export function lanesWhy(
  s: Scenario,
  model: DetectedModel | null,
  f: LanesFacts,
): Why {
  if (!f.takesCount) {
    return {
      source: "default",
      tip: [
        f.fixedReason
          ? `This plan kind always uses this count. ${plainFixedReason(f.fixedReason)}`
          : "This plan kind always uses this count.",
      ],
    };
  }
  const lanes = (s as { lanes: number }).lanes;
  const mine =
    s.kind === "shoulder"
      ? isOperatorSet(s, "lanes")
      : "lanes" in s && !isKindDefault(s, "lanes");
  const error = f.valid ? null : f.invalidMessage;
  const way = f.oneWay ? "" : " each way";
  // A bare count reads "4 each way" on a two-way road, "4 lanes" on a one-way one.
  const per = (n: unknown) =>
    f.oneWay ? ` ${String(n) === "1" ? "lane" : "lanes"}` : " each way";
  if (s.kind === "near_intersection") {
    const mapLanes = model
      ? s.meta.confirmedRoad?.classification.lanesPerDirection
      : undefined;
    const doubt =
      !mine && mapLanes !== undefined
        ? mapLanes > lanes
          ? `The map reads ${mapLanes}${per(mapLanes)}, but turn lanes can inflate counts near an intersection.`
          : `The map reads ${mapLanes}${per(mapLanes)}.`
        : null;
    return {
      source: mine ? "mine" : "default",
      tip: mine
        ? ["You set this count."]
        : [
            "The plan's starting count. Set the real count.",
            ...(doubt ? [doubt] : []),
          ],
      error,
      needsCheck: !mine && doubt !== null,
    };
  }
  const r = detectedRow(model, "Lanes per direction");
  if (r) {
    const src = detectionSource(r);
    const tip =
      r.detectedToken === "inferred" &&
      r.detected !== null &&
      r.verdict === "match"
        ? [
            `The map has no lane count for this road, so ${r.detected}${per(r.detected)} is the usual count for its type. Check it on site.`,
          ]
        : src === "measured" && r.verdict === "match"
          ? [
              `The road's map record says ${r.detected} ${String(r.detected) === "1" ? "lane" : "lanes"}${way}. If the road on site differs, change it here.`,
            ]
          : [detectionWords(r)];
    return { source: src, tip, error, needsCheck: src === "guess" };
  }
  if (mine) return { source: "mine", tip: ["You set this count."], error };
  // #418: an untouched shoulder count that is none of the counts the tool
  // starts or resets to can only be an earlier road's map count.
  const carried =
    s.kind === "shoulder" &&
    lanes !== DEFAULT_SHOULDER.lanes &&
    lanes !== shoulderRoadClassLanes((s as { divided: boolean }).divided);
  if (carried) {
    return {
      source: "guess",
      tip: [
        "This count came from an earlier road. Set the real count for this one.",
      ],
      error,
      needsCheck: true,
    };
  }
  return {
    source: "default",
    tip: [
      model
        ? "The plan's starting count. The map has no count here, so set the real count."
        : "The plan's starting count. Set the real count.",
    ],
    error,
  };
}

/** #209's reasons, without their mid-dots. */
function plainFixedReason(reason: string): string {
  const parts = reason.split(" · ");
  const rest = parts.slice(1).join(". ");
  return rest ? `${rest.charAt(0).toUpperCase()}${rest.slice(1)}.` : "";
}

export function laneWidthWhy(s: Scenario): Why {
  return isOperatorSet(s, "laneWidth")
    ? { source: "mine", tip: ["You set this lane width."] }
    : {
        source: "default",
        tip: [
          "The plan's standard lane. The map doesn't measure lane width, so check it on site.",
        ],
      };
}

export function roadTypeWhy(s: Scenario, model: DetectedModel | null): Why {
  const g = s.guesses?.road_type;
  if (g && isOpenGuess(s, "road_type")) {
    return {
      source: "guess",
      tip: [
        `We read the road's map tag (${tagWords(g.highwayClass)}) and the ${g.urban ? "built-up area" : "open country"} around your pin.`,
      ],
    };
  }
  if (isOperatorSet(s, "roadType"))
    return { source: "mine", tip: ["You set this road type."] };
  const r = detectedRow(model, "Road type");
  if (r) {
    const tag = s.meta.confirmedRoad?.candidate.highway_class;
    const src = detectionSource(r);
    if (src === "measured" && r.verdict === "match" && tag) {
      return {
        source: "measured",
        tip: [`The road's map tag (${tagWords(tag)}) sets this road type.`],
      };
    }
    return { source: src, tip: [detectionWords(r)] };
  }
  return { source: "default", tip: ["The plan's starting road type."] };
}

/** The urban-arterial Divided control (R126's Carriageway row). */
export function dividedWhy(s: Scenario, model: DetectedModel | null): Why {
  const r = detectedRow(model, "Divided");
  if (r) {
    const src = detectionSource(r);
    return {
      source: src,
      tip: [detectionWords(r)],
      needsCheck: src === "guess",
    };
  }
  return (s as { divided?: boolean }).divided
    ? { source: "mine", tip: ["You set this."] }
    : { source: "default", tip: ["Undivided until you say otherwise."] };
}

/** #308's carriageway answer.  S6: the map window reads it; this field is
 *  its one writer. */
export function carriagewayWhy(f: CarriagewayFacts): Why {
  if (f.confirmed) return { source: "mine", tip: ["You answered this."] };
  const v = carriagewayVerdict(f);
  if (v === "undecided") {
    return {
      source: "unset",
      tip: [
        "The map couldn't tell whether the other direction runs on a separate road.",
      ],
      alert: "The map couldn't tell. Pick one.",
      needsCheck: true,
    };
  }
  if (v === "divided") {
    return {
      source: "measured",
      tip: [
        `The map shows a road with the same name ${f.twinDistanceM} m away, so we read it as divided.`,
      ],
    };
  }
  return {
    source: "measured",
    tip: [
      `The map shows no road with the same name within ${TWIN_RADIUS_M} m, so we read it as one-way.`,
    ],
  };
}

export function streetClassWhy(s: Scenario): Why {
  const g = s.guesses?.street_class;
  if (g && isGuessed(s, "street_class")) {
    return {
      source: "guess",
      tip: [
        `We matched the road's map tag (${tagWords(g.highwayClass)}) to a street class.`,
      ],
    };
  }
  return s.street_class
    ? { source: "mine", tip: ["You set this street class."] }
    : {
        source: "unset",
        tip: ["Pick the street class. The work-hour rules can depend on it."],
      };
}

export type JurisdictionState =
  | "unset"
  | "evaluated"
  | "evaluating"
  | "declined"
  | "check-failed";

export function jurisdictionLabel(
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  return JURISDICTION_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

/** #526 round-2 rework (R145 S21a): the jurisdiction's short name for the
 *  Work dates line and the row under the grid: the picker's own label
 *  without its parenthetical ("CDOT (state highway)" reads "CDOT"), else
 *  the block's name.  Ruling 2's <jurisdiction> is the picked one, so this
 *  stays inside it.  The work-hours window's title keeps the block's name. */
export function shortName(
  key: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const label = key ? JURISDICTION_OPTIONS.find((o) => o.key === key)?.label : undefined;
  if (label) return label.replace(/\s*\([^)]*\)\s*$/, "").trim() || label;
  return fallback ?? null;
}

export function jurisdictionWhy(opts: {
  s: Scenario;
  state: JurisdictionState;
  block: JurisdictionBlock | null;
  lookupLoading: boolean;
}): Why {
  const { s, state, block, lookupLoading } = opts;
  const picked = jurisdictionLabel(s.jurisdiction_key);
  const status: string[] = [];
  if (state === "evaluated" && block) {
    status.push(`${block.name} calls this plan a ${block.tcp_term}.`);
    if (picked && block.name !== picked)
      status.push(`Checked as ${block.name}.`);
  } else if (state === "evaluating") {
    status.push("Checking the jurisdiction for this plan.");
  } else if (state === "declined") {
    status.push("Not checked: the plan was declined. The option shown stands.");
  } else if (state === "check-failed") {
    status.push("The check didn't answer. The option shown stands.");
  }
  if (isGuessed(s, "jurisdiction_key")) {
    return {
      source: "guess",
      tip: ["We looked up which boundary your pin falls in.", ...status],
    };
  }
  if (state === "unset") {
    return {
      source: "unset",
      tip: [
        lookupLoading
          ? "Checking which boundary your pin falls in."
          : "No jurisdiction yet, so the plan follows the MUTCD and the Colorado Supplement only.",
      ],
    };
  }
  return { source: "mine", tip: ["You picked this jurisdiction.", ...status] };
}

export function workTypeWhy(mine: boolean): Why {
  return mine
    ? { source: "mine", tip: ["You set the type of work."] }
    : {
        source: "default",
        tip: ["This plan kind's usual job. Change it if the job differs."],
      };
}

export function nightWhy(mine: boolean): Why {
  return mine
    ? { source: "mine", tip: ["You set the work hours."] }
    : {
        source: "default",
        tip: ["Daytime. Night work adds retroreflective devices."],
      };
}

export function reductionWhy(mine: boolean): Why {
  return mine
    ? { source: "mine", tip: ["You set the speed reduction."] }
    : { source: "default", tip: ["No lower limit through the work zone."] };
}

/** The work-zone limit's note: the S-630-1 citation is kept as it was. */
export function workZoneSpeedWhy(delta: number): Why {
  const signs =
    delta > 15
      ? `S-630-1 Sheet 2 Note 3: ${Math.ceil(delta / 15)} stepped sign installations.`
      : "S-630-1 Sheet 2 Note 3: 1 advance sign.";
  return {
    source: "mine",
    tip: [`${delta} mph below the posted speed.`, signs],
  };
}

export function workDatesWhy(start: string, end: string): Why {
  return start
    ? {
        source: "mine",
        tip: [
          end ? "You set a range of days." : "You set one day.",
          "The work-hour check and permit lead times read these dates.",
        ],
      }
    : {
        source: "unset",
        tip: ["The work-hour check and permit lead times need a date."],
      };
}

export function projectWhy(value: string): Why {
  return {
    source: value ? "mine" : "unset",
    tip: ["Names the file and prints on the plan's title block."],
  };
}

export function locationWhy(value: string): Why {
  return {
    source: value ? "mine" : "unset",
    tip: value
      ? ["Prints in the title block's location row."]
      : [
          "Optional. When it is empty, the address prints in the title block instead.",
        ],
  };
}

// ---------------------------------------------------------------------------
// The rows under the guesses (ruling 1, ruling 7, S9)
// ---------------------------------------------------------------------------

export function fileDetailsLine(unset: number): string {
  const base =
    "Project name and location description. They print on the plan's title block.";
  return unset > 0 ? `${base} ${unset} not set.` : base;
}

/** #521 (R145 S25): the measured row's second line, the values in it that
 *  the map did not measure (set by you, a default, or not set yet). */
export function notFromMap(values: string[]): string {
  return `Not from the map: ${values.join(" · ")}`;
}

/** #521 (ruling 5, S4): Start time and End time's source lines. */
export function timeWhy(which: "start" | "end", set: boolean): Why {
  return set
    ? { source: "mine", tip: [`You set this ${which} time.`] }
    : {
        source: "unset",
        tip: [
          `You have not picked a${which === "end" ? "n" : ""} ${which} time yet.`,
        ],
      };
}

// ---------------------------------------------------------------------------
// #526 (Ryan, 2026-11-11, item 1 ruling 2): the Work dates result line, the
// row under the grid and the work-hours window.  Every hour and date here
// is the backend's (`hours_days`), formatted; the words are the ruling's or
// rulings.md's R145 S2-S9.
// ---------------------------------------------------------------------------

/** "8:30 am", "noon", "midnight": the ruling's own clock words (a
 *  non-breaking space before am/pm). */
export function clock(h: number): string {
  const t = ((h % 24) + 24) % 24;
  if (t === 0) return "midnight";
  if (t === 12) return "noon";
  const hr = Math.floor(t);
  const m = Math.round((t - hr) * 60);
  const h12 = ((hr + 11) % 12) + 1;
  // Round 3 (#531, S26): a non-breaking space, so "3:30 pm" never breaks.
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}\u00a0${hr < 12 ? "am" : "pm"}`;
}

/** "Nov 21": an ISO date, by hand (no timezone shift). */
export function monthDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

/** "Nov 7 and 8", "Nov 30, Dec 1 and 2": the month once per run. */
export function dateList(isos: string[]): string {
  const parts = isos.map((iso, i) => {
    const prev = isos[i - 1];
    return prev && prev.slice(0, 7) === iso.slice(0, 7)
      ? String(Number(iso.slice(8)))
      : monthDay(iso);
  });
  return parts.length < 2
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export const DATES_NO_JURISDICTION =
  "Optional. Pick a jurisdiction to check your dates against its work hours.";
export function datesOptional(name: string): string {
  return `Optional. We check your dates and times against ${name}'s work hours.`;
}
export const ADD_TIMES = "Add a start and end time to finish the check.";
/** R145 S2: the second cause of "set dates to check". */
export const ADD_STREET_CLASS = "Pick a street class to finish the check.";
export function fitsEveryDay(name: string): string {
  return `Fits ${name}'s work hours on every day.`;
}
export function noHoursData(name: string): string {
  return `We don't have ${name}'s work hours yet, so we can't check your dates.`;
}
export function checkingDates(name: string): string {
  return `Checking your dates against ${name}'s work hours.`;
}
export const DATES_DECLINED = "Not checked: the plan was declined.";
export const DATES_CHECK_FAILED = "Check failed: the check didn't answer.";

/** The facts of one day kind's problem (the backend's `DayKindEval`). */
export interface KindProblem {
  no_closures: boolean;
  starts_before: number | null;
  ends_after: number | null;
  misses: boolean;
}

/** R145 S4: an hours problem on one day kind (or "on every day"). */
export function hoursProblem(on: "weekdays" | "weekends" | "every day", e: KindProblem): string | null {
  const at = `on ${on}`;
  if (e.misses) return `Falls outside the allowed hours ${at}.`;
  if (e.starts_before != null && e.ends_after != null) {
    return `Starts before ${clock(e.starts_before)} and ends after ${clock(e.ends_after)} ${at}.`;
  }
  if (e.starts_before != null) return `Starts before ${clock(e.starts_before)} ${at}.`;
  if (e.ends_after != null) return `Runs past ${clock(e.ends_after)} ${at}.`;
  return null;
}

/** R145 S4 / S12: a day kind with no closures allowed.  One date or two are
 *  named; three or more are counted (the window keeps the detail). */
export function noClosures(kind: "weekday" | "weekend", dates: string[], count: number): string {
  if (count >= 3 || dates.length >= 3) {
    return `${Math.max(count, dates.length)} ${kind === "weekday" ? "weekdays" : "weekend days"} in your dates: no closures.`;
  }
  if (dates.length === 2) {
    return `${dateList(dates)} are ${kind === "weekday" ? "weekdays" : "a weekend"}: no closures.`;
  }
  return `${dateList(dates)} is ${kind === "weekday" ? "a weekday" : "a weekend day"}: no closures.`;
}

/** Round 2 (R145 S12, reworked by S21b): the Work dates line for an
 *  "outside" answer is ONE problem statement, name-free.  One day kind with
 *  a problem keeps its specific sentence ("Starts before ... on weekdays.",
 *  "Runs past ...", "Falls outside ...", the no-closures date forms).  Both
 *  kinds with the same hours problem: "... on every day."  Both with a
 *  problem otherwise: one merged sentence, the detail left to the window:
 *  "Outside the allowed hours on weekdays and weekends.", "Outside the
 *  allowed hours on weekdays; no closures on weekends." (or swapped), "No
 *  closures on weekdays or weekends."  A kind inside or with no record adds
 *  nothing. */
export function outsideLine(
  kinds: Record<"weekday" | "weekend", KindProblem & { status: string | null }>,
  job: { kinds: ("weekday" | "weekend")[]; kind_dates: Record<"weekday" | "weekend", string[]>; kind_days?: Record<"weekday" | "weekend", number> },
): string | null {
  const hours = job.kinds.filter((k) => kinds[k].status === "outside" && !kinds[k].no_closures);
  const closed = job.kinds.filter((k) => kinds[k].no_closures);
  const plural = (k: "weekday" | "weekend") => (k === "weekday" ? "weekdays" : "weekends");
  if (hours.length === 2) {
    const [a, b] = hours.map((k) => kinds[k]);
    return a.starts_before === b.starts_before && a.ends_after === b.ends_after && a.misses === b.misses
      ? hoursProblem("every day", a)
      : "Outside the allowed hours on weekdays and weekends.";
  }
  if (hours.length === 1 && closed.length === 1) {
    return `Outside the allowed hours on ${plural(hours[0])}; no closures on ${plural(closed[0])}.`;
  }
  if (closed.length === 2) return "No closures on weekdays or weekends.";
  if (hours.length === 1) return hoursProblem(plural(hours[0]), kinds[hours[0]]);
  if (closed.length === 1) {
    const k = closed[0];
    return noClosures(k, job.kind_dates[k] ?? [], job.kind_days?.[k] ?? 0);
  }
  return null;
}

/** Round 2 (R145 S10, Rule 10): some day kinds fit, the rest have no record. */
export function fitsPartial(name: string, fits: "weekday" | "weekend"): string {
  const [a, b] = fits === "weekday" ? ["weekday", "weekend"] : ["weekend", "weekday"];
  return `Fits ${name}'s ${a} hours. We don't have its ${b} hours.`;
}
/** Round 2: no job day kind has a window on record. */
export function noRecordDays(name: string): string {
  return `We don't have ${name}'s hours for these days, so we can't check them.`;
}
/** Round 2 (finding 5): an older backend's answer the line can't word. */
export function cantCheckYet(name: string): string {
  return `We can't check your dates against ${name}'s work hours yet.`;
}

/** Ruling 2: the row under the grid. */
export function hoursRowLine(name: string): string {
  return `${name} limits when you can close a lane.`;
}
export function noHoursRowLine(name: string): string {
  return `We don't have ${name}'s work hours yet.`;
}
export function seeHours(name: string): string {
  return `See ${name}'s work hours`;
}

// The work-hours window (ruling 4).
export function hoursTitle(name: string): string {
  return `${name}'s work hours`;
}
export function hoursSub(
  streetClass: string | null,
  start: number | null,
  end: number | null,
): string {
  const cls = streetClass
    ? `When you can close a lane on ${streetClass === "arterial" ? "an arterial" : `a ${streetClass}`} street.`
    : "Street class not set, so the hours for it aren't known.";
  return start != null && end != null
    ? `${cls} Your hours: ${clock(start)} to ${clock(end)}.`
    : cls;
}
export function fixButton(a: number, b: number): string {
  return `Change my hours to ${clock(a)} to ${clock(b)}`;
}
/** R145 S9: the fix's record, beside the shared Undo. */
export function fixRecord(a: number, b: number): string {
  return `Hours changed to ${clock(a)} to ${clock(b)}.`;
}
export function weekdayVerdict(name: string, status: "inside" | "outside"): string {
  return status === "inside"
    ? "Your hours fit on weekdays."
    : `Your hours go outside what ${name} allows on weekdays.`;
}
export const SET_TIMES_TO_SEE = "Set a start and end time on the page to see your hours here.";
export const SET_CLASS_TO_SEE = "Pick a street class on the page to see its hours here.";
/** R145 S8 / round 2 (S10): the weekend line, from the backend's `record`
 *  (Rule 10: no window on record is absence, never an allowed-all-day). */
export function weekendLine(
  e: { allowed: [number, number][] | null; record: "windows" | "none"; no_closures: boolean },
  jobWeekend: string[],
): string {
  const base =
    e.record === "none"
      ? "Weekends: none on record."
      : e.no_closures
        ? "Weekends: no lane closures."
        : e.allowed === null
          ? "Weekends: needs a street class."
          : `Weekends: ${e.allowed.map(([s, t]) => `${clock(s)} to ${clock(t)}`).join(" and ")}.`;
  return jobWeekend.length
    ? `${base} Your dates include ${dateList(jobWeekend)}.`
    : base;
}
/** Round 2: the weekday view when weekdays have no window on record. */
export function weekdayNoRecord(name: string): string {
  return `We don't have ${name}'s weekday hours for this street class.`;
}
/** Round 2: the whole week's label for a day with no window on record. */
export const NO_RECORD_LABEL = "No record";
export const NO_RECORD_SR = "No hours on record.";
/** R145 S7: holidays are in the data as a rule only. */
export function holidayLine(rule: "none" | "holidays_banned" | "holidays_and_eves_banned"): string | null {
  if (rule === "none") return null;
  const what = rule === "holidays_banned" ? "holidays" : "holidays and the day before";
  return `No closures on ${what}. We don't check your dates against holidays yet.`;
}
export function weekNote(job: { start: string; end: string; days: number; week: { in_job: boolean }[] } | null): string {
  if (!job) return "Pick work dates on the page to see your days here.";
  const span = job.days === 1 ? monthDay(job.start) : `${monthDay(job.start)} to ${monthDay(job.end)}`;
  if (job.days > job.week.filter((d) => d.in_job).length) {
    return `Your dates run ${span}. This is the first week; every week has the same hours.`;
  }
  return job.week.every((d) => d.in_job)
    ? `Your dates run ${span}, the whole week.`
    : `Your dates run ${span}, so the other days are greyed out.`;
}
export function sourceLine(sources: { doc: string; section?: string; date?: string }[]): string | null {
  if (!sources.length) return null;
  return `Source: ${sources
    .map((s) => {
      const d = s.date ? `, ${monthDay(s.date)}, ${s.date.slice(0, 4)}` : "";
      return `${s.doc}${s.section ? ` ${s.section}` : ""}${d}`;
    })
    .join("; ")}`;
}

// ---------------------------------------------------------------------------
// Dates, by hand (no timezone shift)
// ---------------------------------------------------------------------------

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function parseYmd(
  v: string,
): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function weekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "Mon Nov 16". */
export function shortDate(v: string): string {
  const p = parseYmd(v);
  if (!p) return v;
  return `${DAYS[weekday(p.y, p.m, p.d)]} ${MONTHS[p.m - 1].slice(0, 3)} ${p.d}`;
}

/** "Monday, November 16, 2026" (a day button's name). */
export function longDate(v: string): string {
  const p = parseYmd(v);
  if (!p) return v;
  const full = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return `${full[weekday(p.y, p.m, p.d)]}, ${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

/** Ruling 7's button: unset, one day, a range. */
export function dateButtonLabel(start: string, end: string): string {
  if (!start) return "Pick start and end dates";
  return end && end !== start
    ? `${shortDate(start)} to ${shortDate(end)}`
    : shortDate(start);
}
