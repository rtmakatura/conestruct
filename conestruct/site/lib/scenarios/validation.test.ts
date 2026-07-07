// PR 7 (UX audit finding UX-21): validateWorkZone is the client-side
// gate that keeps the generate CTA honest — a work zone the backend
// would 400 (Pydantic gt=0, or WORK_ZONE_SHORTER_THAN_TAPER from
// validate_corridor_geometry) must fail here first, inline.

import { describe, expect, it } from "vitest";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "./index";
import {
  clampLanesToDomain,
  MAX_DRAWABLE_HALF_ROAD_FT,
  MAX_LANES_PER_DIRECTION,
  MAX_WORK_LEN_FT,
  validateLanes,
  validateWorkZone,
} from "./validation";

describe("validateWorkZone — flagger (100 ft one-lane two-way floor)", () => {
  it("accepts the live default (400 ft)", () => {
    const v = validateWorkZone(DEFAULT_FLAGGER);
    expect(v.ok).toBe(true);
    expect(v.minFt).toBe(100);
    expect(v.message).toBeNull();
  });

  it("accepts exactly the minimum", () => {
    const v = validateWorkZone({ ...DEFAULT_FLAGGER, workLen: 100 });
    expect(v.ok).toBe(true);
  });

  it("rejects below the minimum with the taper-derived message", () => {
    const v = validateWorkZone({ ...DEFAULT_FLAGGER, workLen: 99 });
    expect(v.ok).toBe(false);
    expect(v.minFt).toBe(100);
    expect(v.message).toContain("at least 100 ft");
    expect(v.message).toContain("one-lane two-way taper");
    expect(v.message).toContain("MUTCD § 6C.08");
  });

  it("rejects the cleared-field coercion (0) as required", () => {
    const v = validateWorkZone({ ...DEFAULT_FLAGGER, workLen: 0 });
    expect(v.ok).toBe(false);
    expect(v.message).toContain("required");
    expect(v.message).toContain("100 ft");
  });

  it("rejects NaN (defensive — onChange handlers coerce to 0)", () => {
    const v = validateWorkZone({ ...DEFAULT_FLAGGER, workLen: NaN });
    expect(v.ok).toBe(false);
  });
});

describe("validateWorkZone — shoulder (L/3 floor, width per divided)", () => {
  it("accepts the live default", () => {
    expect(validateWorkZone(DEFAULT_SHOULDER).ok).toBe(true);
  });

  it("divided at 55 mph floors at ceil((10×55)/3) = 184 ft", () => {
    const base = { ...DEFAULT_SHOULDER, divided: true, speed: 55 };
    expect(validateWorkZone({ ...base, workLen: 183 })).toMatchObject({
      ok: false,
      minFt: 184,
    });
    expect(validateWorkZone({ ...base, workLen: 184 }).ok).toBe(true);
    const msg = validateWorkZone({ ...base, workLen: 50 }).message;
    expect(msg).toContain("shoulder taper (L/3)");
    expect(msg).toContain("55 mph");
  });

  it("undivided at 55 mph floors at ceil((8×55)/3) = 147 ft", () => {
    const base = { ...DEFAULT_SHOULDER, divided: false, speed: 55 };
    expect(validateWorkZone({ ...base, workLen: 146 }).ok).toBe(false);
    expect(validateWorkZone({ ...base, workLen: 147 }).ok).toBe(true);
  });

  it("speed change alone can invalidate a previously-valid length", () => {
    // Drift guard for the rule's coupling: same workLen, higher speed.
    const at35 = { ...DEFAULT_SHOULDER, divided: true, speed: 35, workLen: 75 };
    // (10 × 35² / 60) / 3 ≈ 68.06 → ok at 75 ft.
    expect(validateWorkZone(at35).ok).toBe(true);
    // (10 × 55) / 3 ≈ 183.33 → 75 ft now under the floor.
    expect(validateWorkZone({ ...at35, speed: 55 }).ok).toBe(false);
  });
});

// Mirror of the backend WORK_LEN_MAX_FT ceiling (schemas.py le=20000):
// without this the form happily submits a workLen the render API 422s.
describe("validateWorkZone — 20,000 ft ceiling (backend le= mirror)", () => {
  it("accepts exactly the ceiling", () => {
    const v = validateWorkZone({ ...DEFAULT_SHOULDER, workLen: MAX_WORK_LEN_FT });
    expect(v.ok).toBe(true);
  });

  it("rejects just above the ceiling with the split-the-project message", () => {
    const v = validateWorkZone({
      ...DEFAULT_SHOULDER,
      workLen: MAX_WORK_LEN_FT + 1,
    });
    expect(v.ok).toBe(false);
    expect(v.message).toContain("20,000 ft");
    expect(v.message).toContain("multiple plans");
  });

  it("rejects a huge finite value on every kind's default", () => {
    for (const base of [DEFAULT_SHOULDER, DEFAULT_FLAGGER]) {
      expect(validateWorkZone({ ...base, workLen: 5e7 }).ok).toBe(false);
    }
  });

  it("Infinity stays rejected (Number.isFinite guard, pre-existing)", () => {
    const v = validateWorkZone({ ...DEFAULT_SHOULDER, workLen: Infinity });
    expect(v.ok).toBe(false);
  });
});

// Mirror of the backend multi-lane bounds (schemas.py): lanes 1..4 and
// lanes x laneWidth + shoulder <= MAX_DRAWABLE_HALF_ROAD_FT.
describe("validateLanes — drawable half-road mirror", () => {
  it("accepts the live default (2 lanes x 12 ft divided)", () => {
    expect(validateLanes(DEFAULT_SHOULDER)).toEqual({ ok: true, message: null });
  });

  it("accepts the widest drawable combination (3 x 14 + 10 = 52)", () => {
    const v = validateLanes({ ...DEFAULT_SHOULDER, lanes: 3, laneWidth: 14 });
    expect(v.ok).toBe(true);
  });

  it("rejects 4 x 12 divided (58 ft) with an actionable message", () => {
    const v = validateLanes({ ...DEFAULT_SHOULDER, lanes: 4, laneWidth: 12 });
    expect(v.ok).toBe(false);
    expect(v.message).toContain(`${MAX_DRAWABLE_HALF_ROAD_FT} ft`);
    expect(v.message).toContain("lane width of 10.5 ft or less");
  });

  it("undivided uses the 8-ft shoulder (4 x 11 + 8 = 52 fits)", () => {
    const base = { ...DEFAULT_SHOULDER, divided: false, lanes: 4 };
    expect(validateLanes({ ...base, laneWidth: 11 }).ok).toBe(true);
    expect(validateLanes({ ...base, laneWidth: 11.5 }).ok).toBe(false);
  });

  it("rejects lane counts outside 1..4", () => {
    expect(validateLanes({ ...DEFAULT_SHOULDER, lanes: 5 }).ok).toBe(false);
    expect(validateLanes({ ...DEFAULT_SHOULDER, lanes: 0 }).ok).toBe(false);
  });

  it("is a no-op for kinds without a lanes field", () => {
    expect(validateLanes(DEFAULT_FLAGGER).ok).toBe(true);
  });
});

describe("clampLanesToDomain", () => {
  it("clamps into 1..MAX_LANES_PER_DIRECTION", () => {
    expect(clampLanesToDomain(0)).toBe(1);
    expect(clampLanesToDomain(3)).toBe(3);
    expect(clampLanesToDomain(6)).toBe(MAX_LANES_PER_DIRECTION);
  });
});
