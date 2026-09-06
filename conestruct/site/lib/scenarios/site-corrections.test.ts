// #224 phase 4 (s2-arc18) — the correction marker helpers: one marker per
// condition, undo restores ``meta`` byte-identically (the #179 shape),
// a pin move clears the list, the dismiss vocabulary's cross-field rule.

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";
import {
  assertMarker,
  dismissIsComplete,
  dismissMarker,
  withSiteCorrection,
  withoutSiteCorrection,
  withoutSiteCorrections,
} from "./site-corrections";
import { dismissAllowed, fmtScanStamp } from "./site-corrections";

const NOW = new Date("2026-09-04T12:00:00.000Z");

describe("site-condition correction markers (#224 phase 4)", () => {
  it("dismiss / assert markers carry the backend's shape and a seconds stamp", () => {
    expect(dismissMarker("pedestrian_facility", "fenced", "", NOW)).toEqual({
      flag: "pedestrian_facility",
      action: "dismiss",
      reason: "fenced",
      recorded_at: "2026-09-04T12:00:00+00:00",
    });
    expect(dismissMarker("school_zone", "other", "  gate locked ", NOW)).toEqual({
      flag: "school_zone",
      action: "dismiss",
      reason: "other",
      note: "gate locked",
      recorded_at: "2026-09-04T12:00:00+00:00",
    });
    expect(assertMarker("school_zone", NOW)).toEqual({
      flag: "school_zone",
      action: "assert",
      recorded_at: "2026-09-04T12:00:00+00:00",
    });
  });

  it("one marker per condition — a new marker for a flag replaces the old one", () => {
    const m1 = withSiteCorrection(DEFAULT_SCENARIO.meta, dismissMarker("school_zone", "removed", "", NOW));
    const m2 = withSiteCorrection(m1, assertMarker("school_zone", NOW));
    expect(m2.siteConditionOverrides).toEqual([assertMarker("school_zone", NOW)]);
  });

  it("undo restores meta byte-identically (the key drops when the list empties)", () => {
    const before = JSON.stringify(DEFAULT_SCENARIO.meta);
    const corrected = withSiteCorrection(
      DEFAULT_SCENARIO.meta,
      dismissMarker("pedestrian_facility", "fenced", "", NOW),
    );
    expect(corrected.siteConditionOverrides).toHaveLength(1);
    const undone = withoutSiteCorrection(corrected, "pedestrian_facility");
    expect(JSON.stringify(undone)).toBe(before);
    expect("siteConditionOverrides" in undone).toBe(false);
  });

  it("undo of one of two markers keeps the other", () => {
    const two = withSiteCorrection(
      withSiteCorrection(DEFAULT_SCENARIO.meta, assertMarker("school_zone", NOW)),
      dismissMarker("pedestrian_facility", "fenced", "", NOW),
    );
    const one = withoutSiteCorrection(two, "school_zone");
    expect(one.siteConditionOverrides?.map((m) => m.flag)).toEqual(["pedestrian_facility"]);
  });

  it("a pin move clears every marker — key dropped, never an empty list", () => {
    const two = withSiteCorrection(
      withSiteCorrection(DEFAULT_SCENARIO.meta, assertMarker("school_zone", NOW)),
      dismissMarker("pedestrian_facility", "fenced", "", NOW),
    );
    const cleared = withoutSiteCorrections(two);
    expect("siteConditionOverrides" in cleared).toBe(false);
    // Nothing to clear ⇒ the same object back (no spurious re-render).
    expect(withoutSiteCorrections(DEFAULT_SCENARIO.meta)).toBe(DEFAULT_SCENARIO.meta);
  });

  it("dismissIsComplete mirrors the backend's cross-field rule", () => {
    expect(dismissIsComplete(null, "")).toBe(false);
    expect(dismissIsComplete("fenced", "")).toBe(true);
    expect(dismissIsComplete("fenced", "x")).toBe(false); // a note goes only with other
    expect(dismissIsComplete("other", "")).toBe(false);
    expect(dismissIsComplete("other", "  ")).toBe(false);
    expect(dismissIsComplete("other", "gate locked")).toBe(true);
  });

  // #249 (s2-arc21)
  it("dismissAllowed (spec 46): only a DETECTED served bucket may enter the reason state", () => {
    const buckets = {
      intersections: { detected: true, count: 3 },
      sidewalks: { detected: false, count: 0 },
    };
    expect(dismissAllowed(buckets, "adjacent_intersection")).toBe(true);
    expect(dismissAllowed(buckets, "pedestrian_facility")).toBe(false); // absent row
    expect(dismissAllowed(buckets, "school_zone")).toBe(false); // bucket not on the wire
    expect(dismissAllowed(null, "adjacent_intersection")).toBe(false);
    expect(dismissAllowed(undefined, "adjacent_intersection")).toBe(false);
  });

  it("fmtScanStamp (GO ruling e/a′): day · hh:mm utc by slicing the wire's UTC ISO; anything else verbatim", () => {
    expect(fmtScanStamp("2026-09-03T23:14:50+00:00")).toBe("3 sep · 23:14 utc");
    expect(fmtScanStamp("2026-12-25T00:05:00Z")).toBe("25 dec · 00:05 utc");
    expect(fmtScanStamp("2026-01-09T07:30:00.123+00:00")).toBe("9 jan · 07:30 utc");
    // Not UTC, not a full stamp, not a stamp at all: printed as sent, never converted.
    for (const raw of ["2026-09-03T23:14:50-06:00", "2026-09-03T23:14:50", "2026-09-03", "yesterday", ""]) {
      expect(fmtScanStamp(raw)).toBe(raw);
    }
    // An impossible month is not "fixed": verbatim.
    expect(fmtScanStamp("2026-13-03T23:14:50+00:00")).toBe("2026-13-03T23:14:50+00:00");
  });
});
