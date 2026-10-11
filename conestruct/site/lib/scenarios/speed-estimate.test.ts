// R123 Q2 (#301) — the road-class speed estimate, as pure functions.
//
// Authority: validation-artifacts/committed/issue-301-picker-pieces/rulings.md.
// R123 Q2: "Move the road-class speed estimate to WHAT's Speed row as a ⚠
// line, and keep a "Use N mph" button there. Nothing is prefilled; the
// operator's click sets it, and the audit records the speed as estimated
// from the road class and chosen by the operator."

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, DEFAULT_FLAGGER, carryAcrossKinds, type Scenario } from "./index";
import type { ConfirmedRoad } from "../road-detection/types";
import { classifyFromOsmTags } from "../road-detection/classify";
import { speedEstimateOffer, withCurrentGuesses } from "./guesses";
import { setSpeed, takeSpeedEstimate } from "./what-writes";

const PIN = { lat: 39.7392, lng: -104.9903 };
const MOVED = { lat: 39.708, lng: -105.081 };

function road(highwayClass: string, maxspeed: string | null, at = PIN): ConfirmedRoad {
  const candidate = {
    way_id: "222002",
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

describe("the offer (R123 Q2)", () => {
  it("a road with no posted speed offers its class's estimate", () => {
    expect(speedEstimateOffer(pinned(road("residential", null)))).toEqual({
      mph: 25,
      highwayClass: "residential",
    });
  });

  it("a posted speed offers nothing; so does an unreadable tag, a class with no estimate, or no road", () => {
    expect(speedEstimateOffer(pinned(road("residential", "30 mph")))).toBeNull();
    expect(speedEstimateOffer(pinned(road("residential", "signals")))).toBeNull();
    expect(speedEstimateOffer(pinned(road("footway", null)))).toBeNull();
    expect(speedEstimateOffer(pinned(null))).toBeNull();
  });
});

describe("the click is the record; nothing is prefilled", () => {
  it("a road with no posted speed leaves the speed and the record alone until the click", () => {
    const s = withCurrentGuesses(pinned(road("residential", null), { speed: 45 } as Partial<Scenario>));
    expect(s.speed).toBe(45);
    expect(s.speed_estimate ?? null).toBeNull();
  });

  it("Use N mph sets the speed and records the class it came from", () => {
    const s = takeSpeedEstimate(pinned(road("residential", null), { speed: 45 } as Partial<Scenario>));
    expect(s.speed).toBe(25);
    expect(s.speed_estimate).toEqual({ highwayClass: "residential" });
    // The shell's normalizer keeps a record that still holds (it may add
    // R108's street-class guess for the same road; the speed is untouched).
    const n = withCurrentGuesses(s);
    expect(n.speed).toBe(25);
    expect(n.speed_estimate).toEqual({ highwayClass: "residential" });
  });

  it("an estimate the kind's domain moves is set but never recorded (the audit never claims it)", () => {
    // Flagger plans cap at 55 mph; motorway estimates 65.
    const flagger = {
      ...DEFAULT_FLAGGER,
      meta: { ...DEFAULT_FLAGGER.meta, lat: PIN.lat, lng: PIN.lng, confirmedRoad: road("motorway", null) },
    } as Scenario;
    const s = takeSpeedEstimate(flagger);
    expect(s.speed).toBe(55);
    expect(s.speed_estimate ?? null).toBeNull();
  });
});

describe("the record goes the moment it stops holding", () => {
  const taken = () => takeSpeedEstimate(pinned(road("residential", null), { speed: 45 } as Partial<Scenario>));

  it("another speed written on the row drops it", () => {
    const s = withCurrentGuesses(setSpeed(taken(), 30));
    expect(s.speed).toBe(30);
    expect("speed_estimate" in s).toBe(false);
  });

  it("a moved pin (the road no longer at the pin) drops it", () => {
    const t = taken();
    const s = withCurrentGuesses({ ...t, meta: { ...t.meta, lat: MOVED.lat, lng: MOVED.lng } } as Scenario);
    expect("speed_estimate" in s).toBe(false);
  });

  it("a kind switch carries it with the speed", () => {
    const t = taken();
    const s = withCurrentGuesses(carryAcrossKinds(t, DEFAULT_FLAGGER));
    expect(s.speed).toBe(25);
    expect(s.speed_estimate).toEqual({ highwayClass: "residential" });
  });
});
