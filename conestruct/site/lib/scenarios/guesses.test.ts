// R108 / R110 — the guess bookkeeping, as pure functions.
//
// Authority: validation-artifacts/committed/setup-what-redesign/rulings.md.
// R108: "Street class (from the road) and jurisdiction (from the pin) are
// prefilled like Road type already is ... the operator changes them if
// they're wrong."  R110 Q1: the wire carries the raw fact of each untouched
// guess; Q4: "Never overwrite a value the operator set, road type
// included."

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, type Scenario } from "./index";
import type { ConfirmedRoad } from "../road-detection/types";
import { classifyFromOsmTags } from "../road-detection/classify";
import {
  applyJurisdictionGuess,
  guessCount,
  isGuessed,
  isOperatorSet,
  markOperatorSet,
  setJurisdictionByOperator,
  setStreetClassByOperator,
  withCurrentGuesses,
} from "./guesses";

const PIN = { lat: 39.7392, lng: -104.9903 };
const MOVED = { lat: 39.708, lng: -105.081 };

function road(highwayClass: string, at = PIN): ConfirmedRoad {
  const candidate = {
    way_id: "111001",
    highway_class: highwayClass,
    name: "Mainstreet",
    ref: null,
    bearing: 90,
    snap_distance_m: 5,
    snapped_lat: at.lat,
    snapped_lng: at.lng,
    tags: {
      oneway: null,
      maxspeed: "30 mph",
      lanes: "4",
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
    overrides: {},
    isUrban: true,
    placeName: "Denver",
    pinLat: at.lat,
    pinLng: at.lng,
  };
}

function pinned(over: Partial<Scenario> = {}, highwayClass: string | null = "primary"): Scenario {
  return {
    ...DEFAULT_SCENARIO,
    ...over,
    meta: {
      ...DEFAULT_SCENARIO.meta,
      lat: PIN.lat,
      lng: PIN.lng,
      confirmedRoad: highwayClass ? road(highwayClass) : null,
      ...(over.meta ?? {}),
    },
  } as Scenario;
}

describe("street class: prefilled from the road (R108)", () => {
  it("fills an absent class from the road and records the tag it came from", () => {
    const s = withCurrentGuesses(pinned());
    expect(s.street_class).toBe("arterial");
    expect(s.guesses).toEqual({ street_class: { highwayClass: "primary" } });
    expect(isGuessed(s, "street_class")).toBe(true);
  });

  it("guesses nothing from a tag the table does not map (Rule 10)", () => {
    const s = withCurrentGuesses(pinned({}, "footway"));
    expect("street_class" in s).toBe(false);
    expect(s.guesses ?? null).toBeNull();
  });

  it("guesses nothing with no road at the pin", () => {
    const s = withCurrentGuesses(pinned({}, null));
    expect("street_class" in s).toBe(false);
  });

  it("re-guesses for a new road, and drops the guess when the road goes", () => {
    const first = withCurrentGuesses(pinned());
    const tertiary = withCurrentGuesses({
      ...first,
      meta: { ...first.meta, confirmedRoad: road("tertiary") },
    } as Scenario);
    expect(tertiary.street_class).toBe("collector");
    expect(tertiary.guesses?.street_class).toEqual({ highwayClass: "tertiary" });
    const gone = withCurrentGuesses({
      ...first,
      meta: { ...first.meta, confirmedRoad: null },
    } as Scenario);
    expect("street_class" in gone).toBe(false);
    expect(gone.guesses ?? null).toBeNull();
  });

  it("never overwrites the operator's class (Q4)", () => {
    const set = setStreetClassByOperator(withCurrentGuesses(pinned()), "local");
    expect(set.street_class).toBe("local");
    expect(isGuessed(set, "street_class")).toBe(false);
    const newRoad = withCurrentGuesses({
      ...set,
      meta: { ...set.meta, confirmedRoad: road("tertiary") },
    } as Scenario);
    expect(newRoad.street_class).toBe("local");
  });

  it("picking the guessed value itself makes it the operator's", () => {
    const set = setStreetClassByOperator(withCurrentGuesses(pinned()), "arterial");
    expect(set.street_class).toBe("arterial");
    expect(set.guesses ?? null).toBeNull();
  });

  it("a generic write that changes the class drops its guess record", () => {
    const g = withCurrentGuesses(pinned());
    const s = withCurrentGuesses({ ...g, street_class: "collector" } as Scenario);
    expect(s.street_class).toBe("collector");
    expect(isGuessed(s, "street_class")).toBe(false);
  });

  it("an edit that does not touch the road never fills in a saved plan's class", () => {
    const saved = pinned();
    const edited = withCurrentGuesses({ ...saved, speed: 40 } as Scenario, saved);
    expect("street_class" in edited).toBe(false);
  });

  it("a newly confirmed road fills it in, given the scenario it replaced", () => {
    const before = pinned({}, null);
    const after = withCurrentGuesses(
      { ...before, meta: { ...before.meta, confirmedRoad: road("primary") } } as Scenario,
      before,
    );
    expect(after.street_class).toBe("arterial");
  });

  it("returns the same object when nothing changes", () => {
    const g = withCurrentGuesses(pinned());
    expect(withCurrentGuesses(g)).toBe(g);
  });
});

describe("jurisdiction: prefilled from the pin (R108)", () => {
  it("fills an empty key from the pin's lookup and records the pin", () => {
    const s = applyJurisdictionGuess(pinned({}, null), PIN, "denver");
    expect(s.jurisdiction_key).toBe("denver");
    expect(s.guesses).toEqual({ jurisdiction_key: PIN });
  });

  it("a lookup with no answer leaves the field not set", () => {
    const s0 = pinned({}, null);
    expect(applyJurisdictionGuess(s0, PIN, null)).toBe(s0);
  });

  it("ignores an answer for a pin the plan no longer has", () => {
    const s0 = pinned({}, null);
    expect(applyJurisdictionGuess(s0, MOVED, "lakewood")).toBe(s0);
  });

  it("never overwrites the operator's jurisdiction (Q4)", () => {
    const s0 = setJurisdictionByOperator(pinned({}, null), "lakewood");
    const s = applyJurisdictionGuess(s0, PIN, "denver");
    expect(s.jurisdiction_key).toBe("lakewood");
    expect(s.guesses ?? null).toBeNull();
  });

  it("a moved pin drops an untouched guess in the same write", () => {
    const g = applyJurisdictionGuess(pinned({}, null), PIN, "denver");
    const moved = withCurrentGuesses({
      ...g,
      meta: { ...g.meta, lat: MOVED.lat, lng: MOVED.lng },
    } as Scenario);
    expect("jurisdiction_key" in moved).toBe(false);
    expect(moved.guesses ?? null).toBeNull();
  });

  it("a moved pin keeps the operator's jurisdiction", () => {
    const s0 = setJurisdictionByOperator(pinned({}, null), "denver");
    const moved = withCurrentGuesses({
      ...s0,
      meta: { ...s0.meta, lat: MOVED.lat, lng: MOVED.lng },
    } as Scenario);
    expect(moved.jurisdiction_key).toBe("denver");
  });

  it("the operator's Not set drops the guess and stays not set", () => {
    const g = applyJurisdictionGuess(pinned({}, null), PIN, "denver");
    const s = setJurisdictionByOperator(g, null);
    expect(s.jurisdiction_key).toBeNull();
    expect(s.guesses ?? null).toBeNull();
  });
});

describe("the two guesses together", () => {
  it("counts the untouched guesses", () => {
    const both = applyJurisdictionGuess(withCurrentGuesses(pinned()), PIN, "denver");
    expect(both.guesses).toEqual({
      street_class: { highwayClass: "primary" },
      jurisdiction_key: PIN,
    });
    expect(guessCount(both)).toBe(2);
    expect(guessCount(setStreetClassByOperator(both, "local"))).toBe(1);
  });
});

describe("operator-set fields (R110 Q4, Q7, Q8)", () => {
  it("records each field once, and reads it back", () => {
    const s = markOperatorSet(markOperatorSet(pinned(), "night"), "night");
    expect(s.meta.operatorSet).toEqual(["night"]);
    expect(isOperatorSet(s, "night")).toBe(true);
    expect(isOperatorSet(s, "roadType")).toBe(false);
  });
});
