// #290 — the scenario version field, ``meta.pinModel``, on the frontend.
//
// Rulings (validation-artifacts/committed/issue-290-pin-work/rulings.md,
// 2026-09-25): today's pin is "corridor_end" (1); the old value is
// "corridor_end" (3); nothing recorded before the change is silently
// re-read (10).  The backend reads the field first (tests/test_pin_model.py);
// these pin that every scenario the app can hold carries it — born stamped,
// carried through every meta writer, stamped at the one load gate.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLAGGER,
  DEFAULT_LANE_CLOSURE,
  DEFAULT_MOBILE_OP_2LANE,
  DEFAULT_MOBILE_OP_MULTILANE,
  DEFAULT_NEAR_INTERSECTION,
  DEFAULT_SHOULDER,
  DEFAULT_WORK_BEYOND_SHOULDER,
  SCENARIO_KINDS,
  carryAcrossKinds,
  carryMeta,
  defaultFor,
  toScenario,
  withPinModel,
} from "./index";
import { withPin } from "./site-corrections";
import { withRelayedCenterline } from "./centerline-relay";

const DEFAULTS = [
  DEFAULT_SHOULDER,
  DEFAULT_FLAGGER,
  DEFAULT_LANE_CLOSURE,
  DEFAULT_WORK_BEYOND_SHOULDER,
  DEFAULT_MOBILE_OP_2LANE,
  DEFAULT_MOBILE_OP_MULTILANE,
  DEFAULT_NEAR_INTERSECTION,
];

describe("born stamped", () => {
  it("every default scenario means corridor_end", () => {
    for (const d of DEFAULTS) expect(d.meta.pinModel, d.kind).toBe("corridor_end");
    for (const { v } of SCENARIO_KINDS) {
      expect(defaultFor(v).meta.pinModel, v).toBe("corridor_end");
    }
  });
});

describe("the load gate (saved plans, downloads)", () => {
  it("a stored scenario without the field is stamped corridor_end — and nothing else changes", () => {
    const stored = { ...DEFAULT_SHOULDER, meta: { project: "p", address: "a", lat: 39.7, lng: -104.9 } };
    const loaded = toScenario(JSON.parse(JSON.stringify(stored)));
    expect(loaded.meta.pinModel).toBe("corridor_end");
    const { pinModel: _dropped, ...restMeta } = loaded.meta;
    expect({ ...loaded, meta: restMeta }).toEqual(stored);
  });

  it("a present value is kept verbatim, never re-read", () => {
    const stored = { ...DEFAULT_SHOULDER, meta: { ...DEFAULT_SHOULDER.meta, pinModel: "work_start" } };
    expect(toScenario(stored).meta.pinModel).toBe("work_start");
  });

  it("a legacy flat plan is stamped corridor_end", () => {
    const legacy = {
      closure: "shoulder",
      project: "",
      address: "",
      lat: 39.7,
      lng: -104.9,
      roadType: "rural_divided",
      speed: 65,
      lanes: 2,
      laneWidth: 12,
      divided: true,
      workLen: 1000,
      night: false,
    };
    expect(toScenario(legacy).meta.pinModel).toBe("corridor_end");
  });

  it("withPinModel is idempotent", () => {
    const once = withPinModel(DEFAULT_FLAGGER);
    expect(withPinModel(once)).toBe(once);
  });
});

describe("carried through every meta writer", () => {
  it("the pin writer, the kind switches and the centerline relay keep it", () => {
    const moved = withPin(DEFAULT_SHOULDER.meta, { lat: 39.74, lng: -104.95 });
    expect(moved.pinModel).toBe("corridor_end");
    const pinned = { ...DEFAULT_SHOULDER, meta: moved };
    expect(carryMeta(pinned, DEFAULT_FLAGGER).meta.pinModel).toBe("corridor_end");
    expect(carryAcrossKinds(pinned, DEFAULT_FLAGGER).meta.pinModel).toBe("corridor_end");
    const relayed = withRelayedCenterline({
      ...pinned,
      meta: {
        ...moved,
        confirmedRoad: {
          pinLat: moved.lat,
          pinLng: moved.lng,
          candidate: { geometry: [[39.74, -104.95], [39.75, -104.95]] },
        },
      },
    } as unknown as typeof pinned);
    expect(relayed.meta.centerline).toBeDefined();
    expect(relayed.meta.pinModel).toBe("corridor_end");
  });
});
