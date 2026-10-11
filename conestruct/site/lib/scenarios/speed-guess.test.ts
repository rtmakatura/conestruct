// R126 / R127 — the road-class speed guess, as pure functions.
//
// Authority: validation-artifacts/committed/r126-step2/rulings.md.
// R126: "Speed: on a road with no posted speed, prefill the road-class
// estimate like R108's guesses, marked "⚠ from the road" ... If the road has
// no class either, Speed reads "◌ not set" and the plan can't be generated
// until it's set."  R127: Q1 (b), Q2 (an unreadable tag counts), Q3 (the
// kind's cap applies).

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, DEFAULT_FLAGGER, carryAcrossKinds, type Scenario } from "./index";
import type { ConfirmedRoad } from "../road-detection/types";
import { classifyFromOsmTags } from "../road-detection/classify";
import { isOperatorSet, speedGuessFor, speedSet, withCurrentGuesses } from "./guesses";
import { setSpeed } from "./what-writes";
import { applyClassification } from "./auto-apply";
import { speedOptions } from "./what-cells";

const PIN = { lat: 39.7392, lng: -104.9903 };
const MOVED = { lat: 39.708, lng: -105.081 };

function road(highwayClass: string, maxspeed: string | null, at = PIN, wayId = "222002"): ConfirmedRoad {
  const candidate = {
    way_id: wayId,
    highway_class: highwayClass,
    name: "Sidestreet",
    ref: null,
    bearing: 0,
    snap_distance_m: 4,
    snapped_lat: at.lat,
    snapped_lng: at.lng,
    tags: {
      oneway: null,
      maxspeed,
      lanes: null,
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
  };
  return {
    candidate,
    classification: classifyFromOsmTags(
      { highwayClass, name: candidate.name, ref: candidate.ref, tags: candidate.tags },
      true,
      "Denver",
    ),
    method: "auto_single",
    isUrban: true,
    placeName: "Denver",
    pinLat: at.lat,
    pinLng: at.lng,
  };
}

function pinned(r: ConfirmedRoad | null, over: Partial<Scenario> = {}): Scenario {
  return {
    ...DEFAULT_SCENARIO,
    ...over,
    meta: { ...DEFAULT_SCENARIO.meta, lat: PIN.lat, lng: PIN.lng, confirmedRoad: r },
  } as Scenario;
}

describe("the guess (R126; R127 Q2, Q3)", () => {
  it("a road with no posted speed is guessed at its class's estimate", () => {
    expect(speedGuessFor(pinned(road("residential", null)))).toEqual({
      mph: 25,
      highwayClass: "residential",
    });
  });

  it("an unreadable posted speed is guessed too (Q2)", () => {
    expect(speedGuessFor(pinned(road("residential", "signals")))?.mph).toBe(25);
  });

  it("a readable posted speed, a class with no estimate, or no road guesses nothing", () => {
    expect(speedGuessFor(pinned(road("residential", "30 mph")))).toBeNull();
    expect(speedGuessFor(pinned(road("footway", null)))).toBeNull();
    expect(speedGuessFor(pinned(null))).toBeNull();
  });

  it("the kind's range caps the estimate (Q3: motorway on flagger is 55)", () => {
    const flagger = {
      ...DEFAULT_FLAGGER,
      meta: { ...DEFAULT_FLAGGER.meta, lat: PIN.lat, lng: PIN.lng, confirmedRoad: road("motorway", null) },
    } as Scenario;
    expect(speedGuessFor(flagger)?.mph).toBe(55);
  });
});

describe("prefilled, marked, and set", () => {
  it("a new road with no posted speed replaces the default with the guess and records it", () => {
    const s = withCurrentGuesses(pinned(road("residential", null), { speed: 65 } as Partial<Scenario>));
    expect(s.speed).toBe(25);
    expect(s.guesses?.speed).toEqual({ highwayClass: "residential" });
    expect(speedSet(s)).toBe(true);
  });

  it("a tagged road measures the speed; nothing is guessed", () => {
    const s = withCurrentGuesses(pinned(road("residential", "30 mph")));
    expect(s.guesses?.speed).toBeUndefined();
    expect(speedSet(s)).toBe(true);
  });

  it("no road at the pin: the speed is not set (Q1 b)", () => {
    const s = withCurrentGuesses(pinned(null));
    expect(s.guesses?.speed).toBeUndefined();
    expect(speedSet(s)).toBe(false);
  });
});

describe("the record goes the moment it stops holding", () => {
  const guessed = () => withCurrentGuesses(pinned(road("residential", null), { speed: 65 } as Partial<Scenario>));

  it("the operator's speed is theirs: operator-set, the record gone, never re-guessed", () => {
    const prev = guessed();
    const s = withCurrentGuesses(setSpeed(prev, 30), prev);
    expect(s.speed).toBe(30);
    expect(s.guesses?.speed).toBeUndefined();
    expect(isOperatorSet(s, "speed")).toBe(true);
    expect(speedSet(s)).toBe(true);
  });

  it("a moved pin (no road there) drops the record, and the speed is not set", () => {
    const t = guessed();
    const s = withCurrentGuesses({ ...t, meta: { ...t.meta, lat: MOVED.lat, lng: MOVED.lng } } as Scenario, t);
    expect(s.guesses?.speed).toBeUndefined();
    expect(speedSet(s)).toBe(false);
  });

  it("a kind switch re-guesses at the new kind's cap", () => {
    const motorway = withCurrentGuesses(pinned(road("motorway", null), { speed: 65 } as Partial<Scenario>));
    expect(motorway.speed).toBe(65);
    const s = withCurrentGuesses(carryAcrossKinds(motorway, DEFAULT_FLAGGER), motorway);
    expect(s.speed).toBe(55);
    expect(s.guesses?.speed).toEqual({ highwayClass: "motorway" });
  });

  it("a detection never overwrites the operator's speed (R110 Q4)", () => {
    const mine = setSpeed(pinned(null), 40);
    const tagged = road("residential", "30 mph");
    const { scenario } = applyClassification(mine, tagged.classification);
    expect(scenario.speed).toBe(40);
  });
});

describe("R127: the 20 mph option", () => {
  it("starts at 20 where the schema allows it, and stays at 25 elsewhere", () => {
    expect(speedOptions("shoulder")[0]).toBe(20);
    expect(speedOptions("flagger_lane_closure")[0]).toBe(20);
    expect(speedOptions("work_beyond_shoulder")[0]).toBe(20);
    expect(speedOptions("near_intersection")[0]).toBe(25);
  });
});
