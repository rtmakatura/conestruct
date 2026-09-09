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
import { dismissAllowed, fmtScanDuration, fmtScanStamp } from "./site-corrections";
import {
  applyStaged,
  deriveCorrectionsStanding,
  stage,
  stagedSentence,
  unstage,
  type StagedCorrection,
} from "./site-corrections";
import type { SiteScanProvenance } from "@/lib/render-types";

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

  // #254 (s2-arc26) — staging: a correction is a shell-held intent until
  // Apply folds the whole set into ONE scenario write (one request, one
  // band cycle).  ``marker: null`` is a staged Undo of an applied record.
  it("#254 stage / unstage: one entry per flag (a new intent replaces the old), unstage removes it, nothing else moves", () => {
    const a: StagedCorrection = { flag: "school_zone", marker: assertMarker("school_zone", NOW) };
    const d: StagedCorrection = {
      flag: "pedestrian_facility",
      marker: dismissMarker("pedestrian_facility", "fenced", "", NOW),
    };
    const one = stage([], a);
    expect(one).toEqual([a]);
    const two = stage(one, d);
    expect(two.map((s) => s.flag)).toEqual(["school_zone", "pedestrian_facility"]);
    // Same flag again: replaced in place (order kept), never a duplicate
    // (the backend refuses duplicate flags with an honest 400).
    const undoIntent: StagedCorrection = { flag: "school_zone", marker: null };
    const replaced = stage(two, undoIntent);
    expect(replaced).toEqual([undoIntent, d]);
    expect(unstage(replaced, "school_zone")).toEqual([d]);
    expect(unstage([d], "pedestrian_facility")).toEqual([]);
    expect(unstage([d], "school_zone")).toEqual([d]);
    // Pure: the inputs are never mutated.
    expect(one).toEqual([a]);
    expect(two).toHaveLength(2);
  });

  it("#254 applyStaged folds the set through the existing helpers: markers replace, null undoes, the key drops when empty", () => {
    const before = DEFAULT_SCENARIO.meta;
    // Nothing staged: the same meta object back (no spurious write).
    expect(applyStaged(before, [])).toBe(before);
    const staged: StagedCorrection[] = [
      { flag: "school_zone", marker: assertMarker("school_zone", NOW) },
      { flag: "pedestrian_facility", marker: dismissMarker("pedestrian_facility", "fenced", "", NOW) },
    ];
    const applied = applyStaged(before, staged);
    expect(applied.siteConditionOverrides).toEqual([
      assertMarker("school_zone", NOW),
      dismissMarker("pedestrian_facility", "fenced", "", NOW),
    ]);
    // A staged Undo of the school record plus a re-stated sidewalk marker.
    const next = applyStaged(applied, [
      { flag: "school_zone", marker: null },
      { flag: "pedestrian_facility", marker: dismissMarker("pedestrian_facility", "removed", "", NOW) },
    ]);
    expect(next.siteConditionOverrides).toEqual([dismissMarker("pedestrian_facility", "removed", "", NOW)]);
    // Undo the last one: byte-identical to the start (the #179 shape).
    const cleared = applyStaged(next, [{ flag: "pedestrian_facility", marker: null }]);
    expect(JSON.stringify(cleared)).toBe(JSON.stringify(before));
    expect("siteConditionOverrides" in cleared).toBe(false);
  });

  it("#254 deriveCorrectionsStanding counts the served scan + the staged set — never the mirror's five", () => {
    const scan = {
      status: "ok",
      buckets: {
        intersections: { detected: true, count: 26 },
        sidewalks: { detected: true, count: 18 },
        schools: { detected: false, count: 0 },
        hospitals: { detected: true, count: 1 }, // keyless: not counted
      },
      corrections: [
        { flag: "pedestrian_facility", action: "dismiss", status: "applied", disclosure: "x", record_clause: "x" },
        { flag: "school_zone", action: "assert", status: "applied", disclosure: "y", record_clause: "y" },
      ],
    } as unknown as SiteScanProvenance;
    const staged: StagedCorrection[] = [{ flag: "adjacent_intersection", marker: null }];
    expect(deriveCorrectionsStanding(scan, staged)).toEqual({
      total: 3, // three keyed buckets on the wire
      detected: 2,
      open: 1, // intersections: detected, no server record (sidewalks has one)
      applied: 2,
      staged: 1,
    });
    expect(deriveCorrectionsStanding(scan, [])).toMatchObject({ staged: 0, open: 1 });
    // No ok scan (a proceeded outage): only the records and the staged
    // set count; buckets contribute nothing (rule 10).
    const outage = {
      status: "unavailable",
      proceeded_anyway: true,
      corrections: [{ flag: "school_zone", action: "assert", status: "applied", disclosure: "y", record_clause: "y" }],
    } as unknown as SiteScanProvenance;
    expect(deriveCorrectionsStanding(outage, staged)).toEqual({ total: 0, detected: 0, open: 0, applied: 1, staged: 1 });
    expect(deriveCorrectionsStanding(null, [])).toEqual({ total: 0, detected: 0, open: 0, applied: 0, staged: 0 });
    // A moot record is not an applied one and does not close a detected row.
    const moot = {
      ...scan,
      corrections: [{ flag: "adjacent_intersection", action: "assert", status: "moot", disclosure: "m", record_clause: "m" }],
    } as unknown as SiteScanProvenance;
    expect(deriveCorrectionsStanding(moot, [])).toMatchObject({ applied: 0, open: 1 });
  });

  it("#254 stagedSentence: the count in words the block and the chip share; zero says so", () => {
    expect(stagedSentence(0)).toBe("no corrections staged");
    expect(stagedSentence(1)).toBe("1 correction staged · not yet applied");
    expect(stagedSentence(2)).toBe("2 corrections staged · not yet applied");
    expect(stagedSentence(5)).toBe("5 corrections staged · not yet applied");
  });

  it("#254 a staged marker for a flag the scan never keyed (assert under not_run) still folds — the backend decides moot/applied", () => {
    const staged: StagedCorrection[] = [{ flag: "adjacent_interchange", marker: assertMarker("adjacent_interchange", NOW) }];
    expect(applyStaged(DEFAULT_SCENARIO.meta, staged).siteConditionOverrides).toEqual([
      assertMarker("adjacent_interchange", NOW),
    ]);
    // A staged Undo of a flag with no marker is a no-op on the list.
    expect(applyStaged(DEFAULT_SCENARIO.meta, [{ flag: "school_zone", marker: null }])).toEqual(DEFAULT_SCENARIO.meta);
  });

  it("fmtScanDuration (#251, ruling d): the wire's duration_ms as seconds to one decimal; nothing else prints", () => {
    expect(fmtScanDuration(2739)).toBe("2.7 s");
    expect(fmtScanDuration(20299)).toBe("20.3 s");
    expect(fmtScanDuration(0)).toBe("0.0 s");
    expect(fmtScanDuration(950)).toBe("0.9 s"); // toFixed, never a rounded-up "1 s"
    for (const raw of [null, undefined, "2739", Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fmtScanDuration(raw)).toBeNull();
    }
  });
});
