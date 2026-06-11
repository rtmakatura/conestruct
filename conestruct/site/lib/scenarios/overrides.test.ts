// PR 4 (Q4): the LocationPicker's manual Road Properties override path
// must snap + clamp speed to the kind's server schema domain, same as
// the applyClassification path — the raw write let an accepted OSM
// 65 mph land on a flagger scenario whose schema caps at 55.

import { describe, expect, it } from "vitest";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "./index";
import { applyOverridesToScenario } from "./overrides";

describe("applyOverridesToScenario speed clamp", () => {
  it("clamps an OSM 65 mph override to 55 on flagger (schema domain [20, 55])", () => {
    const next = applyOverridesToScenario(DEFAULT_FLAGGER, { speedMph: 65 });
    expect(next.speed).toBe(55);
  });

  it("keeps 65 mph on shoulder (domain [20, 75] — no clamp change)", () => {
    const next = applyOverridesToScenario(DEFAULT_SHOULDER, { speedMph: 65 });
    expect(next.speed).toBe(65);
  });

  it("snaps off-grid km/h conversions to the 5-mph grid (62 → 60)", () => {
    const next = applyOverridesToScenario(DEFAULT_SHOULDER, { speedMph: 62 });
    expect(next.speed).toBe(60);
  });

  it("leaves speed untouched when the override is absent", () => {
    const next = applyOverridesToScenario(DEFAULT_FLAGGER, { roadType: "urban_arterial" });
    expect(next.speed).toBe(DEFAULT_FLAGGER.speed);
    expect(next.kind === "flagger_lane_closure" && next.roadType).toBe("urban_arterial");
  });

  it("rejects a roadType outside the kind's allowed set (flagger + freeway)", () => {
    const next = applyOverridesToScenario(DEFAULT_FLAGGER, { roadType: "freeway" });
    expect(next.kind === "flagger_lane_closure" && next.roadType).toBe(
      DEFAULT_FLAGGER.roadType,
    );
  });
});
