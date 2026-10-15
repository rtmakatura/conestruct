// #291 (R148): the inferred road type's record, on R108's pattern.
//
// Detection writes the road type; this pins only its record in
// `guesses.road_type`: present iff the plan's road type still holds the
// inferred value for the road at the pin and the operator has not set it.
// The backend re-derives the road type from the record's facts
// (src/api/schemas.py `road_type_from_facts`); the mirror test below holds
// that mapping to classify.ts for every inferred class.

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, type Scenario } from "./index";
import type { ConfirmedRoad } from "../road-detection/types";
import { classifyFromOsmTags } from "../road-detection/classify";
import { markOperatorSet, roadTypeGuessFor, withCurrentGuesses } from "./guesses";

const PIN = { lat: 39.7326, lng: -105.2405 };

function road(highwayClass: string, urban: boolean, oneway: string | null = null, at = PIN): ConfirmedRoad {
  const tags = {
    oneway,
    maxspeed: "20 mph",
    lanes: "2",
    lanes_forward: null,
    lanes_backward: null,
    lanes_both_ways: null,
    turn_lanes: null,
    turn_lanes_forward: null,
    turn_lanes_backward: null,
  };
  const candidate = {
    way_id: "1432422179",
    highway_class: highwayClass,
    name: "Lookout Mountain Road",
    ref: null,
    bearing: 90,
    snap_distance_m: 2,
    snapped_lat: at.lat,
    snapped_lng: at.lng,
    tags,
    signal_distance_m: null,
  };
  return {
    candidate,
    classification: classifyFromOsmTags(
      { highwayClass, name: candidate.name, ref: null, tags, twin: { distanceM: null, searched: true } },
      urban,
      urban ? "Golden" : null,
    ),
    method: "auto_single",
    isUrban: urban,
    placeName: urban ? "Golden" : null,
    pinLat: at.lat,
    pinLng: at.lng,
  };
}

function plan(r: ConfirmedRoad, over: Partial<Scenario> = {}): Scenario {
  return {
    ...DEFAULT_SCENARIO,
    roadType: r.classification.roadType,
    ...over,
    meta: { ...DEFAULT_SCENARIO.meta, ...PIN, confirmedRoad: r },
  } as Scenario;
}

// The backend's mapping (road_type_from_facts), mirrored to hold it to
// classify.ts.
const fromFacts = (urban: boolean, divided: boolean) =>
  urban ? "urban_arterial" : divided ? "rural_divided" : "rural_undivided";

describe("#291: the road type's record", () => {
  it("Lookout Mountain: urban street, recorded as a guess with its facts", () => {
    const s = withCurrentGuesses(plan(road("tertiary", true)));
    expect(s.roadType).toBe("urban_arterial");
    expect(s.guesses?.road_type).toEqual({ highwayClass: "tertiary", urban: true, divided: false });
  });

  it("a measured road type (motorway → freeway) is not a guess", () => {
    const s = withCurrentGuesses(plan(road("motorway", true, "yes")));
    expect(roadTypeGuessFor(s)).toBeNull();
    expect(s.guesses?.road_type).toBeUndefined();
  });

  it("the operator's road type drops the record and keeps the value", () => {
    const s = withCurrentGuesses(plan(road("tertiary", true)));
    const mine = withCurrentGuesses(markOperatorSet({ ...s, roadType: "rural_undivided" } as Scenario, "roadType"));
    expect(mine.roadType).toBe("rural_undivided");
    expect(mine.guesses?.road_type).toBeUndefined();
  });

  it("a road type that no longer holds the guess drops the record", () => {
    const s = withCurrentGuesses(plan(road("tertiary", true)));
    const moved = withCurrentGuesses({ ...s, roadType: "rural_divided" } as Scenario);
    expect(moved.guesses?.road_type).toBeUndefined();
  });

  it("no road at the pin, no record", () => {
    const s = withCurrentGuesses({ ...DEFAULT_SCENARIO, meta: { ...DEFAULT_SCENARIO.meta, ...PIN } } as Scenario);
    expect(s.guesses?.road_type).toBeUndefined();
  });

  it("never writes the road type", () => {
    const s = plan(road("tertiary", true), { roadType: "urban_arterial" });
    expect(withCurrentGuesses(s).roadType).toBe("urban_arterial");
  });
});

describe("#291: the backend's mapping agrees with classify.ts on every inferred road type", () => {
  const classes = ["trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "primary_link"];
  for (const cls of classes) {
    for (const urban of [true, false]) {
      for (const oneway of [null, "yes"]) {
        it(`${cls}, ${urban ? "urban" : "rural"}, oneway=${oneway}`, () => {
          const r = road(cls, urban, oneway);
          if (r.classification.fields.roadType.method !== "inferred") return;
          expect(fromFacts(urban, r.classification.divided)).toBe(r.classification.roadType);
        });
      }
    }
  }
});
