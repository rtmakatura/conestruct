// R96 C / R99 — NEEDS YOU lists what needs the operator, and its header
// count equals the rows listed.  The E Colfax pin (declutter-three-
// surfaces/today/needsyou-1440.png): sidewalks and intersections detected,
// interchanges / bikes / schools none found, both manual keys unasserted,
// and the sidewalk adjustment (+6 devices) on the wire.

import { describe, expect, it } from "vitest";

import { deriveNeedsYou, countProvenance, type NeedsYouItem } from "./needs-you";
import {
  conditionRows,
  conditionSummary,
  mergeConditions,
} from "./needs-you-conditions";
import type { SiteScanProvenance } from "./render-types";

const SCAN: SiteScanProvenance = {
  status: "ok",
  buckets: {
    intersections: { detected: true, count: 39, nearest_distance_ft: 56.1 },
    interchanges: { detected: false, count: 0 },
    sidewalks: { detected: true, count: 58, nearest_distance_ft: 54.1 },
    bike_facilities: { detected: false, count: 0 },
    schools: { detected: false, count: 0 },
  },
};

const SIDEWALK_ITEM: NeedsYouItem = {
  id: "audit:site:pedestrian_facility",
  tier: "changed",
  title: "Pedestrian sidewalks present",
  result: "APPLIED",
  cite: "MUTCD § 6C.02",
  evidence: "6 devices added",
  action: null,
};

describe("conditionRows — one classification for the rows and the count", () => {
  it("classifies the E Colfax scan in wire order, then the two manual keys", () => {
    const rows = conditionRows(SCAN, [], {});
    expect(rows.map((r) => [r.flag, r.kind])).toEqual([
      ["adjacent_intersection", "detected"],
      ["adjacent_interchange", "absent"],
      ["pedestrian_facility", "detected"],
      ["bicycle_facility", "absent"],
      ["school_zone", "absent"],
      ["limited_sight_distance", "manual-off"],
      ["driveways_present", "manual-off"],
    ]);
  });

  it("a staged intent, an applied record and an asserted manual key are listed", () => {
    const scan: SiteScanProvenance = {
      ...SCAN,
      corrections: [{ flag: "school_zone", action: "assert", status: "applied" } as never],
    };
    const rows = conditionRows(
      scan,
      [{ flag: "bicycle_facility", marker: { action: "assert" } } as never],
      { driveways_present: true },
    );
    const kinds = Object.fromEntries(rows.map((r) => [r.flag, r.kind]));
    expect(kinds.school_zone).toBe("record");
    expect(kinds.bicycle_facility).toBe("staged");
    expect(kinds.driveways_present).toBe("manual-on");
    expect(conditionSummary(rows)).toMatchObject({ listed: 5, noneFound: 1, notAsserted: 1 });
  });

  it("no ok scan and no records: no rows", () => {
    expect(conditionRows({ status: "unavailable" }, [], {})).toEqual([]);
  });
});

describe("mergeConditions — R99: the count equals the rows listed", () => {
  it("E Colfax: the sidewalk adjustment joins its detected row; the count is 2", () => {
    const model = mergeConditions(deriveNeedsYou([SIDEWALK_ITEM]), conditionRows(SCAN, [], {}));
    expect(model.items).toEqual([]);
    expect(model.count).toBe(2);
    expect(model.conditions).toBe(2);
    expect(countProvenance(model)).toBe("2 site conditions");
    expect(conditionSummary(conditionRows(SCAN, [], {}))).toMatchObject({
      listed: 2,
      noneFound: 3,
      notAsserted: 2,
    });
  });

  it("an adjustment with no listed row of its own stays an item and counts", () => {
    const model = mergeConditions(deriveNeedsYou([SIDEWALK_ITEM]), []);
    expect(model.items.map((i) => i.id)).toEqual(["audit:site:pedestrian_facility"]);
    expect(model.count).toBe(1);
    expect(countProvenance(model)).toBe("1 changed this plan");
  });

  it("⚠ items are untouched and still count", () => {
    const fail: NeedsYouItem = { ...SIDEWALK_ITEM, id: "audit:colorado:fail:0", tier: "attention" };
    const model = mergeConditions(deriveNeedsYou([SIDEWALK_ITEM, fail]), conditionRows(SCAN, [], {}));
    expect(model.items.map((i) => i.id)).toEqual(["audit:colorado:fail:0"]);
    expect(model.count).toBe(3);
    expect(countProvenance(model)).toBe("1 needs attention · 2 site conditions");
  });
});
