import { describe, expect, it } from "vitest";

import { clearDetectionRelays, DEFAULT_SHOULDER } from "./index";
import type { Scenario } from "./types";

// #189-3 (Refs #197) — the clear-on-invalidate variant: relay facts are
// REMOVED from the scenario, not decorated, because they cross the wire.

describe("clearDetectionRelays (#189-3)", () => {
  const withRelays = {
    ...DEFAULT_SHOULDER,
    speed: 45,
    lanes: 3,
    detectedLanesTotal: 5,
    detectedLanesForward: 2,
    detectedLanesBackward: 2,
    detectedLanesBothWays: 1,
    oneway: "yes",
    detectionOverrides: [{ field: "lanes", kind: "shoulder_lane_edit" }],
  } as unknown as Scenario;

  it("removes every relay field and the #177 markers", () => {
    const cleared = clearDetectionRelays(withRelays) as unknown as Record<
      string,
      unknown
    >;
    for (const key of [
      "detectedLanesTotal",
      "detectedLanesForward",
      "detectedLanesBackward",
      "detectedLanesBothWays",
      "oneway",
      "detectionOverrides",
    ]) {
      expect(key in cleared, key).toBe(false);
    }
    // Absent, not undefined-valued: the wire payload must not carry the
    // keys at all.
    expect(JSON.stringify(cleared)).not.toContain("detectedLanes");
  });

  it("leaves reviewed form values and meta untouched", () => {
    const cleared = clearDetectionRelays(withRelays) as unknown as {
      speed: number;
      lanes: number;
      meta: unknown;
      kind: string;
    };
    expect(cleared.speed).toBe(45);
    expect(cleared.lanes).toBe(3);
    expect(cleared.kind).toBe("shoulder");
    expect(cleared.meta).toBe((withRelays as { meta: unknown }).meta);
  });

  it("is a no-op shape on a scenario with no relays", () => {
    const cleared = clearDetectionRelays(DEFAULT_SHOULDER as Scenario);
    expect(JSON.stringify(cleared)).toBe(JSON.stringify(DEFAULT_SHOULDER));
  });
});
