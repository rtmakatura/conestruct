// #181: kind-switch must carry the kind-agnostic user fields and the
// detection-override provenance — carryMeta (meta-only) was the erase
// site that let a kind switch silently drop the safety relays AND the
// operator's shared inputs.  Scope is shared-fields-only by ruling
// (2026-07-30): kind-specific fields (pilotCar, AFAD, lanes, duration
// where absent on the target kind) still start from the target kind's
// defaults.  Relay re-derivation is the sidebar's job (onKindChange
// re-runs applyClassification from meta.confirmedRoad) — this helper
// only moves the fields no detection owns.

import { describe, expect, it } from "vitest";
import {
  carryAcrossKinds,
  DEFAULT_FLAGGER,
  DEFAULT_LANE_CLOSURE,
  DEFAULT_SHOULDER,
  defaultFor,
} from "./index";
import type {
  DetectionOverride,
  FlaggerLaneClosureScenario,
  ShoulderScenario,
} from "./types";

const META = {
  project: "Colfax resurfacing",
  address: "E Colfax Ave & Race St, Denver",
  lat: 39.73997,
  lng: -104.96632,
};

const OVERRIDES: DetectionOverride[] = [
  {
    via: "shoulder_lane_edit",
    detectedLanesTotal: 5,
    asserted: "lane count 3",
  },
];

function shoulderWithInputs(): ShoulderScenario {
  return {
    ...DEFAULT_SHOULDER,
    meta: META,
    speed: 65,
    workLen: 850,
    night: true,
    jurisdiction_key: "denver",
    street_class: "arterial",
    schedule: { date_mode: "single", work_date: "2026-08-03" },
    detectionOverrides: OVERRIDES,
  };
}

describe("carryAcrossKinds (#181)", () => {
  it("carries meta + shared fields shoulder → flagger, snapping speed to the target domain", () => {
    const next = carryAcrossKinds(
      shoulderWithInputs(),
      defaultFor("flagger_lane_closure"),
    ) as FlaggerLaneClosureScenario;

    expect(next.kind).toBe("flagger_lane_closure");
    expect(next.meta).toEqual(META);
    // 65 mph is off the flagger schema domain (caps at 55) — snapped,
    // never handed to the user as a validation error (B-04 class).
    expect(next.speed).toBe(55);
    expect(next.workLen).toBe(850);
    expect(next.night).toBe(true);
    expect(next.jurisdiction_key).toBe("denver");
    expect(next.street_class).toBe("arterial");
    expect(next.schedule).toEqual({
      date_mode: "single",
      work_date: "2026-08-03",
    });
    // Provenance survives the switch (#177): the record of what a
    // confirm erased must not be erased by an unrelated UI event.
    expect(next.detectionOverrides).toEqual(OVERRIDES);
  });

  it("kind-specific fields start from the target kind's defaults (shared-fields-only ruling)", () => {
    const next = carryAcrossKinds(
      shoulderWithInputs(),
      defaultFor("flagger_lane_closure"),
    ) as FlaggerLaneClosureScenario;

    expect(next.pilotCar).toBe(DEFAULT_FLAGGER.pilotCar);
    expect(next.afad).toBe(DEFAULT_FLAGGER.afad);
    expect(next.pedestrianAccess).toBe(DEFAULT_FLAGGER.pedestrianAccess);
    expect(next.roadType).toBe(DEFAULT_FLAGGER.roadType);
    // Relays are NOT copied field-by-field across kinds — the sidebar
    // re-derives them from the confirmed detection so each kind gets
    // its own relay shape (flagger gains `oneway`; shoulder does not).
    expect(next.detectedLanesTotal).toBeUndefined();
    expect(next.oneway).toBeUndefined();
  });

  it("does not attach detectionOverrides to a kind that has no such field", () => {
    const next = carryAcrossKinds(
      shoulderWithInputs(),
      defaultFor("lane_closure_divided"),
    );
    expect(next.kind).toBe("lane_closure_divided");
    expect(
      (next as unknown as Record<string, unknown>).detectionOverrides,
    ).toBeUndefined();
    // Shared fields still carry.
    expect(next.workLen).toBe(850);
    expect(next.speed).toBe(65); // in the divided domain (35..75) — unchanged
  });

  it("round trip returns the shared inputs, not the defaults", () => {
    const toFlagger = carryAcrossKinds(
      shoulderWithInputs(),
      defaultFor("flagger_lane_closure"),
    );
    const back = carryAcrossKinds(
      toFlagger,
      defaultFor("shoulder"),
    ) as ShoulderScenario;

    expect(back.workLen).toBe(850);
    expect(back.night).toBe(true);
    expect(back.jurisdiction_key).toBe("denver");
    expect(back.schedule?.work_date).toBe("2026-08-03");
    // Speed was snapped 65 → 55 on the way out and stays 55 on the way
    // back: the snap is a real domain clamp, not a hidden stash — the
    // operator saw 55 on the flagger form and 55 is what returns.
    expect(back.speed).toBe(55);
    // Absent on DEFAULT_LANE_CLOSURE-style kinds is covered above;
    // shoulder declares the field, so the carried provenance returns.
    expect(back.detectionOverrides).toEqual(OVERRIDES);
    expect([DEFAULT_SHOULDER.workLen, DEFAULT_FLAGGER.workLen, DEFAULT_LANE_CLOSURE.workLen]).not.toContain(850); // fixture sanity: 850 is no kind default
  });
});
