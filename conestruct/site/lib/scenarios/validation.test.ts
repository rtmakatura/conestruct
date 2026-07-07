// PR 7 (UX audit finding UX-21): validateWorkZone is the client-side
// gate that keeps the generate CTA honest — a work zone the backend
// would 400 (Pydantic gt=0, or WORK_ZONE_SHORTER_THAN_TAPER from
// validate_corridor_geometry) must fail here first, inline.

import { describe, expect, it } from "vitest";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "./index";
import { MAX_WORK_LEN_FT, validateWorkZone } from "./validation";

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
