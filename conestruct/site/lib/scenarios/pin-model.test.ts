// #290 — the scenario version field, ``meta.pinModel``, on the frontend.
//
// Rulings (validation-artifacts/committed/issue-290-pin-work/rulings.md):
// today's pin was "corridor_end" (1); the old value is "corridor_end" (3);
// "Pre-change plans and fixtures open with side unset, marked needs-you;
// never silently re-read" (10).  Since the visible ship every scenario is
// born "work_start"; a stored corridor_end plan opens in the work-start
// model with its pin kept, its typed bearing dropped, its side unset and
// the conversion recorded.  RULE 5 (stated): the first ship's version of
// this suite pinned "born corridor_end" — that is what this ship changes.

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
  hasConfirmedSide,
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
const PIN = { lat: 39.74, lng: -104.95 };

describe("born in the work-start model", () => {
  it("every default scenario means work_start, with no side yet", () => {
    for (const d of DEFAULTS) {
      expect(d.meta.pinModel, d.kind).toBe("work_start");
      expect(d.meta.work, d.kind).toBeUndefined();
    }
    for (const { v } of SCENARIO_KINDS) {
      expect(defaultFor(v).meta.pinModel, v).toBe("work_start");
    }
  });

  it("the near_intersection default carries no cross-street station", () => {
    for (const a of DEFAULT_NEAR_INTERSECTION.approaches) {
      expect(a.alongStationFt).toBeUndefined();
    }
  });
});

describe("the load gate: a pre-change plan opens with its side unset (ruling 10)", () => {
  const stored = {
    ...DEFAULT_SHOULDER,
    meta: { project: "p", address: "a", ...PIN, pinModel: "corridor_end", bearingDeg: 180 },
  };

  it("keeps the pin, drops the typed bearing, leaves the side unset, records the conversion", () => {
    const loaded = toScenario(JSON.parse(JSON.stringify(stored)));
    expect(loaded.meta.pinModel).toBe("work_start");
    expect(loaded.meta.lat).toBe(PIN.lat);
    expect(loaded.meta.lng).toBe(PIN.lng);
    expect(loaded.meta.bearingDeg).toBeUndefined();
    expect(loaded.meta.work).toBeUndefined();
    expect(loaded.meta.pinModelFrom).toBe("corridor_end");
    expect(hasConfirmedSide(loaded.meta)).toBe(false);
    // Nothing else about the plan moves.
    const { meta: _a, ...restA } = loaded;
    const { meta: _b, ...restB } = stored;
    expect(restA).toEqual(restB);
  });

  it("a plan saved before the field existed is read as corridor_end, and converted the same way", () => {
    const { pinModel: _p, ...meta } = stored.meta;
    const loaded = toScenario({ ...stored, meta });
    expect(loaded.meta.pinModel).toBe("work_start");
    expect(loaded.meta.pinModelFrom).toBe("corridor_end");
  });

  it("a stored plan with no pin is converted without the needs-you record", () => {
    const loaded = toScenario({ ...DEFAULT_SHOULDER, meta: { ...DEFAULT_SHOULDER.meta, pinModel: "corridor_end" } });
    expect(loaded.meta.pinModel).toBe("work_start");
    expect(loaded.meta.pinModelFrom).toBeUndefined();
  });

  it("a near_intersection plan's frontend-computed station is dropped; its marked intersection stays", () => {
    const ni = {
      ...DEFAULT_NEAR_INTERSECTION,
      meta: {
        ...DEFAULT_NEAR_INTERSECTION.meta,
        ...PIN,
        pinModel: "corridor_end",
        intersection: { lat: 39.741, lng: -104.95, name: "E 17th Ave" },
      },
      approaches: DEFAULT_NEAR_INTERSECTION.approaches.map((a) => ({ ...a, alongStationFt: -200 })),
    };
    const loaded = toScenario(ni);
    if (loaded.kind !== "near_intersection") throw new Error("kind");
    for (const a of loaded.approaches) expect(a.alongStationFt).toBeUndefined();
    expect(loaded.meta.intersection?.name).toBe("E 17th Ave");
  });

  it("a legacy flat plan opens in the work-start model too", () => {
    const legacy = {
      closure: "shoulder",
      project: "",
      address: "",
      ...PIN,
      roadType: "rural_divided",
      speed: 65,
      lanes: 2,
      laneWidth: 12,
      divided: true,
      workLen: 1000,
      night: false,
    };
    const loaded = toScenario(legacy);
    expect(loaded.meta.pinModel).toBe("work_start");
    expect(loaded.meta.pinModelFrom).toBe("corridor_end");
  });

  it("a work_start plan is returned untouched", () => {
    const ws = { ...DEFAULT_SHOULDER, meta: { ...DEFAULT_SHOULDER.meta, ...PIN, work: { side: "right" as const, heading: "N" as const } } };
    expect(withPinModel(ws)).toBe(ws);
  });
});

describe("the side: confirmed only when built, cleared when the pin moves", () => {
  it("only the right side counts; a corridor_end scenario has no side to confirm", () => {
    const base = { ...DEFAULT_SHOULDER.meta, ...PIN };
    expect(hasConfirmedSide(base)).toBe(false);
    expect(hasConfirmedSide({ ...base, work: { side: "right", heading: "N" } })).toBe(true);
    expect(hasConfirmedSide({ ...base, work: { side: "left", heading: "N" } })).toBe(false);
    expect(hasConfirmedSide({ ...base, pinModel: "corridor_end" })).toBe(true);
  });

  it("a pin move drops the side (its direction named the road at the old pin)", () => {
    const meta = { ...DEFAULT_SHOULDER.meta, ...PIN, work: { side: "right" as const, heading: "N" as const } };
    expect(withPin(meta, { lat: PIN.lat + 0.01 }).work).toBeUndefined();
    expect(withPin(meta, { lat: PIN.lat }).work).toEqual(meta.work);
  });
});

describe("carried through the meta writers that do not move the pin", () => {
  it("the kind switches and the relay keep the pin model and the side", () => {
    const sided = {
      ...DEFAULT_SHOULDER,
      meta: { ...DEFAULT_SHOULDER.meta, ...PIN, work: { side: "right" as const, travel: "with_geometry" as const } },
    };
    expect(carryMeta(sided, DEFAULT_FLAGGER).meta.work).toEqual(sided.meta.work);
    expect(carryAcrossKinds(sided, DEFAULT_FLAGGER).meta.pinModel).toBe("work_start");
  });

  it("the relay sends the road's raw direction facts beside its geometry — only under work_start", () => {
    const road = {
      pinLat: PIN.lat,
      pinLng: PIN.lng,
      candidate: {
        bearing: 180.49,
        tags: { oneway: "yes" },
        geometry: [
          [39.74, -104.95],
          [39.73, -104.95],
        ],
      },
    };
    const ws = { ...DEFAULT_SHOULDER, meta: { ...DEFAULT_SHOULDER.meta, ...PIN, confirmedRoad: road } };
    const relayed = withRelayedCenterline(ws as unknown as typeof DEFAULT_SHOULDER);
    expect(relayed.meta.centerline).toBeDefined();
    expect(relayed.meta.roadDirection).toEqual({ osmBearingDeg: 180.49, oneway: "yes" });
    const ce = { ...ws, meta: { ...ws.meta, pinModel: "corridor_end" as const } };
    expect(withRelayedCenterline(ce as unknown as typeof DEFAULT_SHOULDER).meta.roadDirection).toBeUndefined();
  });
});
