// PR 7 (UX audit finding UX-21), narrowed by engine-removal PR D:
// validateWorkZone mirrors the backend SCHEMA bounds only (Pydantic
// gt=0 / le=WORK_LEN_MAX_FT).  The MUTCD taper floor
// (WORK_ZONE_SHORTER_THAN_TAPER) is backend-owned and reaches the UI
// as the audit fetch's HTTP 400 — the negative guards below pin that
// no client-side floor quietly returns.

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

describe("validateWorkZone — schema bounds only (gt=0 mirror)", () => {
  it("accepts the live defaults", () => {
    expect(validateWorkZone(DEFAULT_FLAGGER)).toEqual({
      ok: true,
      message: null,
    });
    expect(validateWorkZone(DEFAULT_SHOULDER).ok).toBe(true);
  });

  it("rejects the cleared-field coercion (0) as required", () => {
    const v = validateWorkZone({ ...DEFAULT_FLAGGER, workLen: 0 });
    expect(v.ok).toBe(false);
    expect(v.message).toContain("required");
  });

  it("rejects NaN (defensive — onChange handlers coerce to 0)", () => {
    const v = validateWorkZone({ ...DEFAULT_FLAGGER, workLen: NaN });
    expect(v.ok).toBe(false);
  });
});

// Engine-removal PR D negative guards: a short-but-positive work zone
// is CLIENT-VALID.  The taper floor is the backend's 400 on the audit
// fetch; a computed floor reappearing here would recreate the retired
// frontend engine (rule 3).  These lengths are all below the floors the
// deleted mirror enforced (flagger 100 ft; shoulder L/3 = 184/147 ft at
// 55 mph) — if any of these start failing, someone re-added the mirror.
describe("validateWorkZone — no client-side MUTCD floor (PR D)", () => {
  it("flagger below the old 100-ft one-lane two-way floor passes client validation", () => {
    expect(validateWorkZone({ ...DEFAULT_FLAGGER, workLen: 99 }).ok).toBe(true);
    expect(validateWorkZone({ ...DEFAULT_FLAGGER, workLen: 1 }).ok).toBe(true);
  });

  it("shoulder below the old L/3 floor passes client validation at any speed", () => {
    const base = { ...DEFAULT_SHOULDER, divided: true, speed: 55 };
    expect(validateWorkZone({ ...base, workLen: 183 }).ok).toBe(true);
    expect(validateWorkZone({ ...base, workLen: 50 }).ok).toBe(true);
    expect(
      validateWorkZone({ ...DEFAULT_SHOULDER, divided: false, speed: 55, workLen: 146 })
        .ok,
    ).toBe(true);
  });

  it("a speed change alone never invalidates a positive in-ceiling length", () => {
    const at35 = { ...DEFAULT_SHOULDER, divided: true, speed: 35, workLen: 75 };
    expect(validateWorkZone(at35).ok).toBe(true);
    expect(validateWorkZone({ ...at35, speed: 55 }).ok).toBe(true);
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
