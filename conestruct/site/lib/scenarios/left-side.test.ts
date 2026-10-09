// #300 — the left-side mirror: leftSideBuilt and the work_side refusal row.
//
// Both mirror `schemas.left_side_built` (the backend is authoritative,
// Rule 3): shoulder work, the carriageway verdict "one_way_street", and a
// one-way tag on the relayed road (R79, R80, R119 Q5).  They decide only
// which pointer the rail shows (R119 Q4); the backend decides the plan.

import { describe, expect, it } from "vitest";

import { leftSideBuilt, matchRefusalAffordance } from "./auto-apply";
import { DEFAULT_NEAR_INTERSECTION, DEFAULT_SHOULDER } from "./index";
import type { Scenario, ShoulderScenario } from "./types";

const ONE_WAY_STREET = {
  oneway: "yes",
  highwayClass: "primary",
  twinDistanceM: null,
  twinSearched: true,
};

const BROADWAY_LEFT: ShoulderScenario = {
  ...DEFAULT_SHOULDER,
  carriageway: ONE_WAY_STREET,
  meta: {
    ...DEFAULT_SHOULDER.meta,
    lat: 39.7337,
    lng: -104.98753,
    pinModel: "work_start",
    roadDirection: { osmBearingDeg: 180, oneway: "yes" },
    work: { side: "left", travel: "with_geometry" },
  },
};

describe("leftSideBuilt (mirror of schemas.left_side_built)", () => {
  it("holds for shoulder work on a tagged one-way street", () => {
    expect(leftSideBuilt(BROADWAY_LEFT)).toBe(true);
  });

  it("fails on one carriageway of a divided road", () => {
    const divided = { ...BROADWAY_LEFT, carriageway: { ...ONE_WAY_STREET, twinDistanceM: 40 } };
    expect(leftSideBuilt(divided)).toBe(false);
  });

  it("fails while the carriageway is undecided", () => {
    const undecided = { ...BROADWAY_LEFT, carriageway: { ...ONE_WAY_STREET, twinSearched: false } };
    expect(leftSideBuilt(undecided)).toBe(false);
  });

  it("fails when the road isn't tagged one-way, even with an operator's answer (R119 Q5)", () => {
    const answered: ShoulderScenario = {
      ...BROADWAY_LEFT,
      carriageway: { ...ONE_WAY_STREET, confirmed: "one_way_street" },
      meta: { ...BROADWAY_LEFT.meta, roadDirection: { osmBearingDeg: 180, oneway: null } },
    };
    expect(leftSideBuilt(answered)).toBe(false);
  });

  it("fails for any kind but shoulder (R79)", () => {
    expect(leftSideBuilt(DEFAULT_NEAR_INTERSECTION)).toBe(false);
  });
});

describe("matchRefusalAffordance — the work_side row (#300, R119 Q4)", () => {
  it("is quiet when the left side is built", () => {
    expect(matchRefusalAffordance(BROADWAY_LEFT)).toBeNull();
  });

  it("points at the side control when a stored left isn't built", () => {
    const stale = {
      ...BROADWAY_LEFT,
      carriageway: { ...ONE_WAY_STREET, confirmed: "divided" as const },
    };
    expect(matchRefusalAffordance(stale)).toEqual({
      code: "work_side",
      pointer:
        "Left-side work is laid out only for shoulder work on a one-way street. Choose a side under Occupied side to proceed.",
    });
  });

  it("matches a stale left after a kind switch too", () => {
    const ni = {
      ...DEFAULT_NEAR_INTERSECTION,
      meta: { ...DEFAULT_NEAR_INTERSECTION.meta, ...BROADWAY_LEFT.meta },
    } as Scenario;
    expect(matchRefusalAffordance(ni)?.code).toBe("work_side");
  });

  it("leaves a right side alone", () => {
    const right = {
      ...BROADWAY_LEFT,
      carriageway: undefined,
      meta: { ...BROADWAY_LEFT.meta, work: { side: "right" as const, travel: "with_geometry" as const } },
    };
    expect(matchRefusalAffordance(right)).toBeNull();
  });
});
