// R108 / R110 — the guesses: street class from the road, jurisdiction from
// the pin, prefilled with no confirm step and recorded as guesses.
//
// Authority: validation-artifacts/committed/setup-what-redesign/rulings.md.
//   R108: "No confirm step for guesses. Street class (from the road) and
//         jurisdiction (from the pin) are prefilled like Road type already
//         is, each marked '⚠ from the road' / '⚠ from the pin', and the
//         operator changes them if they're wrong."
//   R110 Q1: the wire carries the raw fact of each untouched guess
//         (`scenario.guesses`); the backend re-derives it and refuses a
//         stale one.  Q4: "Never overwrite a value the operator set, road
//         type included."
//
// THE INVARIANT.  A `guesses` entry exists iff its field holds the value
// that entry's fact guesses, at the plan's current pin and road.  Three
// kinds of write keep it:
//   · `withCurrentGuesses` — the shell runs EVERY scenario write through
//     it (GeneratorShell's `setScenario`), so a moved pin, a changed road
//     or a generic field write can never leave a stale entry on the wire;
//   · `applyJurisdictionGuess` — the pin lookup's answer, landing;
//   · the operator's writers (`setStreetClassByOperator`,
//     `setJurisdictionByOperator`, and what-writes' `setSpeed`, which
//     marks the speed operator-set) — the field becomes the operator's
//     and its entry goes, so a fresh guess never overwrites it (Q4).
//
// R126 / R127 add the speed: the road-class estimate, prefilled on a road
// with no readable posted speed (`speedGuessFor`, `reconcileSpeed`).
//
// Rule 3: nothing here decides a guess the backend does not re-derive.
// The class table is the backend's (src/rules/street_class.py), mirrored
// in `suggestStreetClass`; the jurisdiction is the backend lookup's own
// answer.  Every function returns its input unchanged (the same object)
// when nothing moves, so the shell's identity-keyed stamps do not churn.

import { speedEstimateForClass, suggestStreetClass } from "../road-detection/classify";
// A function-only cycle (auto-apply imports this module's operator-set
// helpers): nothing is read at module load, so the order is safe.
import { snapSpeedToDomain } from "./auto-apply";
import type { ConfirmedRoad } from "../road-detection/types";
import type {
  IntersectionRecord,
  NearIntersectionApproach,
  OperatorSetField,
  Scenario,
  ScenarioGuesses,
} from "./types";

type StreetClass = NonNullable<Scenario["street_class"]>;
type GuessField = keyof ScenarioGuesses;

/** The confirmed road AT the current pin — the staleness key every
 *  detection reader uses (#149's failure class: a stale road never
 *  speaks). */
function roadAtPin(s: Scenario): ConfirmedRoad | null {
  const r = s.meta.confirmedRoad ?? null;
  return r && r.pinLat === s.meta.lat && r.pinLng === s.meta.lng ? r : null;
}

/** `s` with its guesses replaced; the key is dropped, never `{}`. */
function withGuesses(s: Scenario, g: ScenarioGuesses): Scenario {
  const next = { ...s } as Record<string, unknown>;
  if (Object.values(g).every((v) => v === undefined)) {
    delete next.guesses;
  } else {
    next.guesses = g;
  }
  return next as unknown as Scenario;
}

/** `s` without `field` and without its guess — absence as absence
 *  (Rule 10): a dropped guess leaves the key unset, never null. */
function withoutGuessed(s: Scenario, field: GuessField): Scenario {
  const next = { ...s } as Record<string, unknown>;
  delete next[field];
  const g = { ...(s.guesses ?? {}) };
  delete g[field];
  return withGuesses(next as unknown as Scenario, g);
}

export function isGuessed(s: Scenario, field: GuessField): boolean {
  return s.guesses?.[field] !== undefined;
}

/** R108's "N guesses", with R126's speed. */
export function guessCount(s: Scenario): number {
  return (
    (isGuessed(s, "street_class") ? 1 : 0) +
    (isGuessed(s, "jurisdiction_key") ? 1 : 0) +
    (isGuessed(s, "speed") ? 1 : 0) +
    (isGuessed(s, "approach_speed") ? 1 : 0)
  );
}

/** Which road is confirmed at the pin: way and pin, so a re-save of the
 *  same road at the same pin is not a new road. */
function roadKey(s: Scenario): string | null {
  const r = roadAtPin(s);
  return r ? `${r.candidate.way_id}@${r.pinLat},${r.pinLng}` : null;
}

function reconcileStreetClass(s: Scenario, prev?: Scenario): Scenario {
  const entry = s.guesses?.street_class;
  // A field that no longer holds its guess was written over: the value
  // is the operator's now, and only the record goes.
  if (entry && s.street_class !== suggestStreetClass(entry.highwayClass)) {
    const g = { ...s.guesses };
    delete g.street_class;
    return withGuesses(s, g);
  }
  // The operator's class: never overwritten (Q4).
  if (!entry && s.street_class) return s;

  const tag = roadAtPin(s)?.candidate.highway_class ?? null;
  const guess = tag ? suggestStreetClass(tag) : null;
  if (!guess || !tag) {
    // No road at the pin, or a tag that guesses nothing: an old guess
    // goes with its road; an unset field stays unset.
    return entry ? withoutGuessed(s, "street_class") : s;
  }
  if (entry && entry.highwayClass === tag && s.street_class === guess) return s;
  // An unset field is guessed when the road at the pin is NEW (R108's
  // "prefilled like Road type": at the road's confirmation).  An edit
  // that did not touch the road never fills in a saved plan's class.
  if (!entry && prev !== undefined && roadKey(prev) === roadKey(s)) return s;
  return withGuesses({ ...s, street_class: guess } as Scenario, {
    ...(s.guesses ?? {}),
    street_class: { highwayClass: tag },
  });
}

function reconcileJurisdiction(s: Scenario): Scenario {
  const entry = s.guesses?.jurisdiction_key;
  if (!entry) return s;
  // The operator cleared or replaced it through a generic write: the
  // record goes, the field stays as written.
  if (!s.jurisdiction_key) {
    const g = { ...s.guesses };
    delete g.jurisdiction_key;
    return withGuesses(s, g);
  }
  // Guessed at a pin the plan no longer has: the guess goes with the pin,
  // in the same write that moved it.  The lookup for the new pin answers
  // through `applyJurisdictionGuess`.
  if (entry.lat !== s.meta.lat || entry.lng !== s.meta.lng) {
    return withoutGuessed(s, "jurisdiction_key");
  }
  return s;
}

/** R126 (R127 Q2, Q3): the road-class guess for the road at the pin — the
 *  road carries no READABLE posted speed (no `maxspeed` tag, or one nobody
 *  can parse) and its class estimates one.  `mph` is the estimate snapped to
 *  the kind's range, the value the plan carries.  Null: no road at the pin,
 *  a readable posted speed, or a class with no estimate.  The table is the
 *  backend's, mirrored (`speedEstimateForClass`). */
export function speedGuessFor(s: Scenario): { mph: number; highwayClass: string } | null {
  const road = roadAtPin(s);
  // A partial record (no classification) reads as no readable speed only
  // when the class itself is known; nothing is guessed without one.
  if (!road || road.classification?.speedLimitMph !== undefined) return null;
  const tag = road.candidate.highway_class;
  const estimate = tag ? speedEstimateForClass(tag) : null;
  if (!tag || estimate === null) return null;
  return { mph: snapSpeedToDomain(s.kind, estimate), highwayClass: tag };
}

/** R127 Q1 (b): is the speed SET?  Measured (a readable posted speed on the
 *  road at the pin), guessed (R126's record) or written by the operator.
 *  Otherwise WHAT reads "◌ not set", the live checks hold and Generate is
 *  blocked until the operator picks one. */
export function speedSet(s: Scenario): boolean {
  const road = roadAtPin(s);
  return (
    (road !== null && road.classification?.speedLimitMph !== undefined) ||
    isGuessed(s, "speed") ||
    isOperatorSet(s, "speed")
  );
}

/** `s` without its speed record; the speed itself stays. */
function withoutSpeedGuess(s: Scenario): Scenario {
  if (!s.guesses?.speed) return s;
  const g = { ...s.guesses };
  delete g.speed;
  return withGuesses(s, g);
}

/** R126: the speed guess, on the R108 pattern.  The record holds only while
 *  the speed is the guess for the road still at the pin: the operator's
 *  write (`setSpeed`, operator-set) or a new road, a moved pin or a road
 *  with a readable posted speed drops it.  A kind switch re-guesses at the
 *  new kind's snap (R127 Q3).  An unrecorded speed is guessed when the road
 *  at the pin is NEW, never over an operator's speed (R110 Q4). */
function reconcileSpeed(s: Scenario, prev?: Scenario): Scenario {
  const entry = s.guesses?.speed;
  const guess = speedGuessFor(s);
  if (entry) {
    if (isOperatorSet(s, "speed") || !guess || guess.highwayClass !== entry.highwayClass) {
      return withoutSpeedGuess(s);
    }
    return s.speed === guess.mph ? s : ({ ...s, speed: guess.mph } as Scenario);
  }
  if (!guess || isOperatorSet(s, "speed")) return s;
  if (prev !== undefined && roadKey(prev) === roadKey(s)) return s;
  return withGuesses({ ...s, speed: guess.mph } as Scenario, {
    ...(s.guesses ?? {}),
    speed: { highwayClass: guess.highwayClass },
  });
}

// --- #316 (R129 Q3–Q5): the cross street's approach speed ------------------

/** The marked crossing's own facts (#316), on a near-intersection plan. */
function crossing(s: Scenario): IntersectionRecord | null {
  return s.kind === "near_intersection" ? (s.meta.intersection ?? null) : null;
}

/** Which crossing, with its facts: a re-save of the same crossing is not a
 *  new one; a moved pin or a different cross street is. */
function crossingKey(s: Scenario): string | null {
  const c = crossing(s);
  return c ? JSON.stringify([c.lat, c.lng, c.highwayClass ?? null, c.postedSpeedMph ?? null]) : null;
}

function legs(s: Scenario): NearIntersectionApproach[] {
  return s.kind === "near_intersection" ? s.approaches : [];
}

function withLegSpeed(s: Scenario, mph: number): Scenario {
  if (s.kind !== "near_intersection") return s;
  return { ...s, approaches: s.approaches.map((a) => ({ ...a, speed: mph })) } as Scenario;
}

/** #316: R126's guess for the cross street — it carries no readable posted
 *  speed and its class estimates one (the backend's table, mirrored),
 *  snapped to the approach's 25–55 range.  Null otherwise, or before a
 *  crossing is marked. */
export function approachSpeedGuessFor(s: Scenario): { mph: number; highwayClass: string } | null {
  const c = crossing(s);
  if (!c || (c.postedSpeedMph ?? null) !== null || !c.highwayClass) return null;
  const estimate = speedEstimateForClass(c.highwayClass);
  if (estimate === null) return null;
  return { mph: snapSpeedToDomain("near_intersection", estimate), highwayClass: c.highwayClass };
}

/** #316 / R127 Q1 (b): is the cross-street speed SET?  Measured (the cross
 *  street's readable posted speed), guessed, or the operator's.  True for
 *  every other kind, and while no crossing is marked (#317's line is the
 *  next step then, never a second blocker). */
export function approachSpeedSet(s: Scenario): boolean {
  const c = crossing(s);
  if (s.kind !== "near_intersection" || !c) return true;
  return (
    (c.postedSpeedMph ?? null) !== null ||
    isGuessed(s, "approach_speed") ||
    isOperatorSet(s, "approachSpeed")
  );
}

/** The cross-street speed row's line (one producer: the form shows it, the
 *  WHAT header counts its ⚠ — R129 Q4). */
export function approachSpeedLine(s: Scenario): { text: string; amber: boolean } {
  const entry = s.guesses?.approach_speed;
  if (entry) {
    return {
      text: `guessed, not confirmed · OSM highway=${entry.highwayClass} · from the road`,
      amber: true,
    };
  }
  if (isOperatorSet(s, "approachSpeed")) {
    return { text: "your change · operator-set from here on", amber: false };
  }
  const c = crossing(s);
  if (c && (c.postedSpeedMph ?? null) !== null) {
    return { text: `OSM · ${legs(s)[0]?.speed ?? c.postedSpeedMph} mph · measured`, amber: false };
  }
  return { text: "not set · operator-set when picked", amber: false };
}

/** Does the row show a speed?  Measured, guessed or the operator's; "Not
 *  set" otherwise — before a crossing, too: the default is no fact (P16). */
export function approachSpeedShown(s: Scenario): boolean {
  return crossing(s) ? approachSpeedSet(s) : isOperatorSet(s, "approachSpeed");
}

function withoutApproachGuess(s: Scenario): Scenario {
  if (!s.guesses?.approach_speed) return s;
  const g = { ...s.guesses };
  delete g.approach_speed;
  return withGuesses(s, g);
}

/** #316: the cross-street guess, on R126's pattern.  The record holds only
 *  while every approach carries the guess for the crossing still marked;
 *  the operator's write or a new crossing drops it.  A new crossing with no
 *  posted speed is guessed, never over the operator's speed. */
function reconcileApproachSpeed(s: Scenario, prev?: Scenario): Scenario {
  if (s.kind !== "near_intersection") return withoutApproachGuess(s);
  const entry = s.guesses?.approach_speed;
  const guess = approachSpeedGuessFor(s);
  if (entry) {
    if (
      isOperatorSet(s, "approachSpeed") ||
      !guess ||
      guess.highwayClass !== entry.highwayClass
    ) {
      return withoutApproachGuess(s);
    }
    return s.approaches.every((a) => a.speed === guess.mph) ? s : withLegSpeed(s, guess.mph);
  }
  if (!guess || isOperatorSet(s, "approachSpeed")) return s;
  if (prev !== undefined && crossingKey(prev) === crossingKey(s)) return s;
  return withGuesses(withLegSpeed(s, guess.mph), {
    ...(s.guesses ?? {}),
    approach_speed: { highwayClass: guess.highwayClass },
  });
}

/** The operator picked the cross-street speed: theirs from here on, on
 *  every approach (one cross street, one speed — R129 Q5). */
export function setApproachSpeed(s: Scenario, mph: number): Scenario {
  return withoutApproachGuess(markOperatorSet(withLegSpeed(s, mph), "approachSpeed"));
}

// --- #291 (R148): the road type's urban/rural call ------------------------

/** R148: the road type is a guess when detection INFERRED it (every class
 *  but motorway → freeway folds in the urban/rural call, a guess off
 *  nearby places).  The facts it came from and the value it guessed; null
 *  when there is no confirmed road at the pin or the type was measured. */
export function roadTypeGuessFor(
  s: Scenario,
): { highwayClass: string; urban: boolean; divided: boolean; value: Scenario["roadType"] } | null {
  const road = roadAtPin(s);
  const c = road?.classification;
  if (!road || !c || c.fields?.roadType?.method !== "inferred") return null;
  return {
    highwayClass: road.candidate.highway_class,
    urban: road.isUrban,
    divided: c.divided,
    value: c.roadType as Scenario["roadType"],
  };
}

/** R148 on the R108 pattern.  Detection writes the road type itself; this
 *  keeps only its RECORD: present iff the plan's road type still holds the
 *  inferred value for the road at the pin and the operator has not set it.
 *  An operator change, a new road or a moved pin drops it.  Never writes
 *  `roadType`. */
function reconcileRoadType(s: Scenario): Scenario {
  const entry = s.guesses?.road_type;
  const g = roadTypeGuessFor(s);
  const holds = g !== null && !isOperatorSet(s, "roadType") && s.roadType === g.value;
  if (!holds) {
    if (!entry) return s;
    const rest = { ...s.guesses };
    delete rest.road_type;
    return withGuesses(s, rest);
  }
  if (
    entry &&
    entry.highwayClass === g.highwayClass &&
    entry.urban === g.urban &&
    entry.divided === g.divided
  ) {
    return s;
  }
  return withGuesses(s, {
    ...(s.guesses ?? {}),
    road_type: { highwayClass: g.highwayClass, urban: g.urban, divided: g.divided },
  });
}

/** The shell's normalizer: run on every scenario write.  `prev` is the
 *  scenario the write replaced; omitted, the road counts as new. */
export function withCurrentGuesses(s: Scenario, prev?: Scenario): Scenario {
  return reconcileRoadType(
    reconcileApproachSpeed(
      reconcileSpeed(reconcileJurisdiction(reconcileStreetClass(s, prev)), prev),
      prev,
    ),
  );
}

/** The pin lookup's answer, landing.  `at` is the pin it ran at; an
 *  answer for a pin the plan no longer has is dropped.  `key` null (an
 *  unsupported area, a failed lookup) leaves the field as it is. */
export function applyJurisdictionGuess(
  s: Scenario,
  at: { lat: number; lng: number },
  key: string | null,
): Scenario {
  if (at.lat !== s.meta.lat || at.lng !== s.meta.lng) return s;
  const entry = s.guesses?.jurisdiction_key;
  // The operator's jurisdiction: never overwritten (Q4).
  if (!entry && s.jurisdiction_key) return s;
  if (!key) return entry ? withoutGuessed(s, "jurisdiction_key") : s;
  if (entry && s.jurisdiction_key === key) return s;
  return withGuesses({ ...s, jurisdiction_key: key } as Scenario, {
    ...(s.guesses ?? {}),
    jurisdiction_key: { lat: at.lat, lng: at.lng },
  });
}

/** The operator picked a class: theirs from here on (R108, Q4). */
export function setStreetClassByOperator(s: Scenario, c: StreetClass): Scenario {
  const g = { ...(s.guesses ?? {}) };
  delete g.street_class;
  return withGuesses({ ...s, street_class: c } as Scenario, g);
}

/** The operator picked a jurisdiction, or "Not set" (null). */
export function setJurisdictionByOperator(s: Scenario, key: string | null): Scenario {
  const g = { ...(s.guesses ?? {}) };
  delete g.jurisdiction_key;
  return withGuesses({ ...s, jurisdiction_key: key } as Scenario, g);
}

export function isOperatorSet(s: Scenario, field: OperatorSetField): boolean {
  return s.meta.operatorSet?.includes(field) ?? false;
}

/** Record that the operator wrote `field` (R110 Q4 / Q7 / Q8). */
export function markOperatorSet(s: Scenario, field: OperatorSetField): Scenario {
  if (isOperatorSet(s, field)) return s;
  return {
    ...s,
    meta: { ...s.meta, operatorSet: [...(s.meta.operatorSet ?? []), field] },
  } as Scenario;
}

/** The operator's record of `field` goes: the value is the system's
 *  again (a re-fit width, a kind switch that starts the field fresh). */
export function withoutOperatorSet(s: Scenario, field: OperatorSetField): Scenario {
  if (!isOperatorSet(s, field)) return s;
  const rest = (s.meta.operatorSet ?? []).filter((f) => f !== field);
  const meta = { ...s.meta } as Record<string, unknown>;
  if (rest.length === 0) delete meta.operatorSet;
  else meta.operatorSet = rest;
  return { ...s, meta } as unknown as Scenario;
}
