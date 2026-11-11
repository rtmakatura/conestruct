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

/** Ruling 7: the line under unset dates; S9 when no jurisdiction is set. */
export function datesHint(name: string | null): string {
  return name
    ? `Optional. We check them against ${name}'s work hours.`
    : "Optional. Pick a jurisdiction to check them against its work hours.";
}

export function hoursFrame(name: string | null): string {
  return name ? `${name}'s work hours:` : "Work hours:";
}

export function seeAllHours(name: string): string {
  return `See all of ${name}'s work hours`;
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
