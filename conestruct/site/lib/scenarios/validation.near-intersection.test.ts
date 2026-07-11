// Frontend 422 mirror for the near_intersection kind (#117, Option C
// inc. 4).  One test per backend rejection the form must catch before
// submit — including the three placement-generator ValueErrors
// (src/generation/layout.py) that the Pydantic schema can't see and
// that would surface as 500s, not 422s, if they ever reached the API.

import { describe, expect, it } from "vitest";

import { DEFAULT_NEAR_INTERSECTION } from "@/lib/scenarios";
import type {
  NearIntersectionApproach,
  NearIntersectionScenario,
} from "@/lib/scenarios/types";
import {
  validateApproaches,
  validateLanes,
  validateWorkZone,
} from "@/lib/scenarios/validation";

function scenario(
  over: Partial<NearIntersectionScenario> = {},
): NearIntersectionScenario {
  return { ...DEFAULT_NEAR_INTERSECTION, ...over };
}

function leg(
  over: Partial<NearIntersectionApproach> = {},
): NearIntersectionApproach {
  return { ...DEFAULT_NEAR_INTERSECTION.approaches[0], ...over };
}

describe("validateLanes — near_intersection mainline", () => {
  it("accepts the default (2 lanes per direction)", () => {
    expect(validateLanes(scenario()).ok).toBe(true);
  });

  it("rejects 1 lane per direction with the flagger explanation (generator floor)", () => {
    const v = validateLanes(scenario({ lanes: 1 }));
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/flagger/i);
  });

  it("rejects more than 4 lanes per direction", () => {
    expect(validateLanes(scenario({ lanes: 5 })).ok).toBe(false);
  });

  it("mirrors the drawable half-road cap (lanes x width + 8 ft shoulder <= 52)", () => {
    // 4 x 12 + 8 = 56 > 52 — same numbers the backend 422s.
    const v = validateLanes(scenario({ lanes: 4, laneWidth: 12 }));
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/plan sheet can draw/);
    // 4 x 11 + 8 = 52 fits exactly.
    expect(validateLanes(scenario({ lanes: 4, laneWidth: 11 })).ok).toBe(true);
  });
});

describe("validateWorkZone — near_intersection", () => {
  it("no client-side merging-taper floor (engine-removal PR D — backend 400 owns it)", () => {
    // 35 mph, 12-ft lane: the old mirror floored at L = 12 * 35^2 / 60
    // = 245 ft.  The floor now lives only in validate_corridor_geometry
    // (backend); the client accepts any positive in-ceiling length.
    expect(validateWorkZone(scenario({ workLen: 244 })).ok).toBe(true);
    expect(validateWorkZone(scenario({ workLen: 245 })).ok).toBe(true);
    expect(validateWorkZone(scenario({ workLen: 0 })).ok).toBe(false);
  });
});

describe("validateApproaches — the 422 + generator mirror", () => {
  it("accepts the default scenario", () => {
    const v = validateApproaches(scenario());
    expect(v).toEqual({ ok: true, message: null });
  });

  it("is ok:true for every other kind", () => {
    const v = validateApproaches({
      ...DEFAULT_NEAR_INTERSECTION,
      kind: "shoulder",
    } as never);
    expect(v.ok).toBe(true);
  });

  it("rejects an empty approaches list", () => {
    expect(validateApproaches(scenario({ approaches: [] })).ok).toBe(false);
  });

  it("rejects a third approach (multi-road scope)", () => {
    const v = validateApproaches(
      scenario({
        approaches: [leg({ id: "a" }), leg({ id: "b" }), leg({ id: "c" })],
      }),
    );
    expect(v.ok).toBe(false);
  });

  it("rejects speeds outside 25-55 (floor 25 per the increment-1 ruling)", () => {
    expect(
      validateApproaches(scenario({ approaches: [leg({ speed: 20 })] })).ok,
    ).toBe(false);
    expect(
      validateApproaches(scenario({ approaches: [leg({ speed: 60 })] })).ok,
    ).toBe(false);
    expect(
      validateApproaches(scenario({ approaches: [leg({ speed: 25 })] })).ok,
    ).toBe(true);
    expect(
      validateApproaches(scenario({ approaches: [leg({ speed: 55 })] })).ok,
    ).toBe(true);
  });

  it("rejects an off-grid speed", () => {
    expect(
      validateApproaches(scenario({ approaches: [leg({ speed: 42 })] })).ok,
    ).toBe(false);
  });

  it("rejects lane counts outside 1-4", () => {
    expect(
      validateApproaches(
        scenario({ approaches: [leg({ lanesPerDirection: 0 })] }),
      ).ok,
    ).toBe(false);
    expect(
      validateApproaches(
        scenario({ approaches: [leg({ lanesPerDirection: 5 })] }),
      ).ok,
    ).toBe(false);
  });

  it("rejects lane widths outside 9-14 ft", () => {
    expect(
      validateApproaches(scenario({ approaches: [leg({ laneWidth: 8 })] })).ok,
    ).toBe(false);
    expect(
      validateApproaches(scenario({ approaches: [leg({ laneWidth: 15 })] }))
        .ok,
    ).toBe(false);
  });

  it("rejects legs that disagree on the crossing point (two cross streets)", () => {
    const v = validateApproaches(
      scenario({
        approaches: [
          leg({ id: "cross_a", alongStationFt: -200 }),
          leg({ id: "cross_b", alongStationFt: -300 }),
        ],
      }),
    );
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/same distance/i);
  });

  it("rejects a crossing point beyond the 20,000 ft envelope", () => {
    expect(
      validateApproaches(
        scenario({ approaches: [leg({ alongStationFt: -20001 })] }),
      ).ok,
    ).toBe(false);
  });

  it("rejects a crossing inside the work zone (in-intersection work)", () => {
    const v = validateApproaches(
      scenario({ workLen: 500, approaches: [leg({ alongStationFt: 250 })] }),
    );
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/near an intersection, not in it/);
  });

  it("rejects a curb-to-curb box reaching into the work zone (generator check)", () => {
    // Near side: crossing 20 ft past the work zone, but the widest leg
    // is 2 lanes x 12 ft = 24 ft half-width — the box overlaps.
    const v = validateApproaches(
      scenario({
        approaches: [leg({ alongStationFt: -20, lanesPerDirection: 2 })],
      }),
    );
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/pavement/i);
    // Far side mirror: crossing 20 ft before the upstream end.
    const far = validateApproaches(
      scenario({
        workLen: 500,
        approaches: [leg({ alongStationFt: 520, lanesPerDirection: 2 })],
      }),
    );
    expect(far.ok).toBe(false);
  });

  it("accepts a far-side crossing with clearance", () => {
    const v = validateApproaches(
      scenario({
        workLen: 500,
        approaches: [leg({ alongStationFt: 700, lanesPerDirection: 1 })],
      }),
    );
    expect(v).toEqual({ ok: true, message: null });
  });
});
