// Undo helpers for the confirm rows (issue #179) — the lib layer of the
// marker-reversal semantics.  The mounted round-trips live in
// GeneratorForms.confirm-undo.test.tsx; this file pins the list algebra:
// last-of-via removal, key-drop on empty, byte-identity of the restored
// object, and the cap-8 interaction.

import { describe, expect, it } from "vitest";
import {
  appendDetectionOverride,
  lastDetectionOverride,
  overrideDetectedClause,
  undoDetectionOverride,
} from "./auto-apply";
import type { DetectionOverride } from "./types";

const MULTILANE: DetectionOverride = {
  via: "flagger_multilane_confirm",
  detectedLanesTotal: 5,
  detectedLanesForward: 3,
  asserted: "one through lane in each direction",
};
const TWOWAY: DetectionOverride = {
  via: "flagger_twoway_confirm",
  detectedOneway: "yes",
  asserted: "two-way traffic",
};

describe("undoDetectionOverride (#179)", () => {
  it("removes the last matching via and returns its marker", () => {
    const { overrides, marker } = undoDetectionOverride(
      [MULTILANE, TWOWAY],
      "flagger_multilane_confirm",
    );
    expect(marker).toBe(MULTILANE);
    expect(overrides).toEqual([TWOWAY]);
  });

  it("an emptied list becomes undefined — the wire key drops", () => {
    const { overrides, marker } = undoDetectionOverride(
      [TWOWAY],
      "flagger_twoway_confirm",
    );
    expect(marker).toBe(TWOWAY);
    expect(overrides).toBeUndefined();
  });

  it("no matching via: list unchanged, no marker", () => {
    const { overrides, marker } = undoDetectionOverride(
      [MULTILANE],
      "flagger_twoway_confirm",
    );
    expect(marker).toBeNull();
    expect(overrides).toEqual([MULTILANE]);
    const empty = undoDetectionOverride(undefined, "flagger_twoway_confirm");
    expect(empty.marker).toBeNull();
    expect(empty.overrides).toBeUndefined();
  });

  it("append-then-undo round-trips to the original list (byte-identity)", () => {
    const before = [MULTILANE];
    const after = undoDetectionOverride(
      appendDetectionOverride(before, TWOWAY),
      "flagger_twoway_confirm",
    );
    expect(JSON.stringify(after.overrides)).toBe(JSON.stringify(before));
    // And from nothing back to nothing: the key drops entirely.
    const fromNothing = undoDetectionOverride(
      appendDetectionOverride(undefined, MULTILANE),
      "flagger_multilane_confirm",
    );
    expect(fromNothing.overrides).toBeUndefined();
  });

  it("removes the LAST of duplicate vias, preserving earlier history", () => {
    const older: DetectionOverride = {
      via: "approach_lane_confirm",
      detectedLanesTotal: 2,
      asserted: "approach lane count 1",
    };
    const newer: DetectionOverride = {
      via: "approach_lane_confirm",
      detectedLanesTotal: 3,
      asserted: "approach lane count 2",
    };
    const { overrides, marker } = undoDetectionOverride(
      [older, TWOWAY, newer],
      "approach_lane_confirm",
    );
    expect(marker).toBe(newer);
    expect(overrides).toEqual([older, TWOWAY]);
  });

  it("survives the cap-8 slice: undo still finds the newest matching marker", () => {
    let list: DetectionOverride[] | undefined;
    for (let n = 1; n <= 9; n++) {
      list = appendDetectionOverride(list, {
        via: "shoulder_lane_edit",
        asserted: `${n} lanes per direction`,
      });
    }
    list = appendDetectionOverride(list, MULTILANE);
    expect(list).toHaveLength(8);
    const { overrides, marker } = undoDetectionOverride(
      list,
      "flagger_multilane_confirm",
    );
    expect(marker?.detectedLanesTotal).toBe(5);
    expect(overrides).toHaveLength(7);
  });
});

describe("lastDetectionOverride (#179)", () => {
  it("returns the newest matching marker or null", () => {
    expect(lastDetectionOverride([MULTILANE, TWOWAY], "flagger_twoway_confirm")).toBe(
      TWOWAY,
    );
    expect(
      lastDetectionOverride([MULTILANE], "flagger_single_lane_confirm"),
    ).toBeNull();
    expect(lastDetectionOverride(undefined, "flagger_twoway_confirm")).toBeNull();
  });
});

describe("overrideDetectedClause (#179) — mirrors _override_detected_clause", () => {
  it("full lane shape", () => {
    expect(
      overrideDetectedClause({
        via: "flagger_multilane_confirm",
        detectedLanesTotal: 5,
        detectedLanesForward: 3,
        detectedLanesBackward: 2,
        asserted: "x",
      }),
    ).toBe("5 total lanes (3 forward, 2 backward)");
  });

  it("single lane uses the singular", () => {
    expect(
      overrideDetectedClause({
        via: "flagger_single_lane_confirm",
        detectedLanesTotal: 1,
        asserted: "x",
      }),
    ).toBe("1 total lane");
  });

  it("oneway-only marker", () => {
    expect(overrideDetectedClause(TWOWAY)).toBe("a one-way road (oneway=yes)");
  });

  it("never states a value detection didn't report", () => {
    expect(
      overrideDetectedClause({
        via: "flagger_multilane_confirm",
        detectedLanesTotal: 4,
        asserted: "x",
      }),
    ).toBe("4 total lanes");
  });
});
