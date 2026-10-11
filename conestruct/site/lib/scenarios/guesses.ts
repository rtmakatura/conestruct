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
//     `setJurisdictionByOperator`) — the field becomes the operator's and
//     its entry goes, so a fresh guess never overwrites it (Q4).
//
// Rule 3: nothing here decides a guess the backend does not re-derive.
// The class table is the backend's (src/rules/street_class.py), mirrored
// in `suggestStreetClass`; the jurisdiction is the backend lookup's own
// answer.  Every function returns its input unchanged (the same object)
// when nothing moves, so the shell's identity-keyed stamps do not churn.

import { speedEstimateForClass, suggestStreetClass } from "../road-detection/classify";
import type { ConfirmedRoad } from "../road-detection/types";
import type { OperatorSetField, Scenario, ScenarioGuesses } from "./types";

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
  if (g.street_class === undefined && g.jurisdiction_key === undefined) {
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

/** R108's "N guesses" for the two guessed jurisdiction fields. */
export function guessCount(s: Scenario): number {
  return (isGuessed(s, "street_class") ? 1 : 0) + (isGuessed(s, "jurisdiction_key") ? 1 : 0);
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

/** R123 Q2 (#301): the road-class speed estimate WHAT's Speed row offers —
 *  the road at the pin carries no posted speed (its classification read no
 *  `maxspeed` tag at all: the low-confidence class fallback, the picker's
 *  old UX-02 condition) and its class estimates one.  Null: nothing to
 *  offer.  The table is the backend's, mirrored (`speedEstimateForClass`). */
export function speedEstimateOffer(s: Scenario): { mph: number; highwayClass: string } | null {
  const road = roadAtPin(s);
  if (!road) return null;
  const c = road.classification;
  if (c.speedLimitMph !== undefined || c.fields?.speed?.confidence !== "low") return null;
  const tag = road.candidate.highway_class;
  const mph = tag ? speedEstimateForClass(tag) : null;
  return tag && mph !== null ? { mph, highwayClass: tag } : null;
}

/** `s` without its speed-estimate record (the key dropped, never null). */
export function withoutSpeedEstimate(s: Scenario): Scenario {
  if (s.speed_estimate === undefined) return s;
  const next = { ...s } as Record<string, unknown>;
  delete next.speed_estimate;
  return next as unknown as Scenario;
}

/** R123 Q2: the record holds only while `speed` is still the estimate the
 *  operator chose, for the road still at the pin.  Any other write of the
 *  speed, a new road or a moved pin drops it in the same write. */
function reconcileSpeedEstimate(s: Scenario): Scenario {
  const entry = s.speed_estimate;
  if (!entry) return s;
  const offer = speedEstimateOffer(s);
  if (!offer || offer.highwayClass !== entry.highwayClass || s.speed !== offer.mph) {
    return withoutSpeedEstimate(s);
  }
  return s;
}

/** The shell's normalizer: run on every scenario write.  `prev` is the
 *  scenario the write replaced; omitted, the road counts as new. */
export function withCurrentGuesses(s: Scenario, prev?: Scenario): Scenario {
  return reconcileSpeedEstimate(reconcileJurisdiction(reconcileStreetClass(s, prev)));
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
