// #252 — the working band's derivation, against pairs of wire objects.
// Every branch is a true statement about ``prev`` (the last settled
// answer's scenario) and ``next`` (the wire now); nothing is a click.

import { describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER, type Scenario } from "./scenarios";
import type { SiteConditionOverride } from "./scenarios/types";
import { withSiteScan } from "./scenarios/site-scan";
import { deriveWorkingBand } from "./working-band";

const pinned: Scenario = {
  ...DEFAULT_SHOULDER,
  meta: { ...DEFAULT_SHOULDER.meta, lat: 39.73997, lng: -104.96632 },
};
const scanned = withSiteScan(pinned, false);
const MARK: SiteConditionOverride = { flag: "school_zone", action: "assert", recorded_at: "2026-09-07T12:00:00Z" };
const withMarker = (s: Scenario, m = MARK): Scenario => ({
  ...s,
  meta: { ...s.meta, siteConditionOverrides: [m] },
});

describe("deriveWorkingBand (#252)", () => {
  it("renders nothing when no request is open — whatever the two objects say", () => {
    expect(deriveWorkingBand({ plan: false, render: null, prev: null, next: scanned })).toBeNull();
    expect(deriveWorkingBand({ plan: false, render: null, prev: pinned, next: withMarker(scanned) })).toBeNull();
  });

  it("GENERATING when the settled answer carried no scan (or there is none): the address the user typed, in the named slot", () => {
    const addressed = { ...scanned, meta: { ...scanned.meta, address: "E Colfax Ave & Race St, Denver" } };
    expect(deriveWorkingBand({ plan: true, render: null, prev: pinned, next: addressed })).toEqual({
      verb: "GENERATING",
      lead: "new plan · ",
      named: "E Colfax Ave & Race St, Denver",
    });
    expect(deriveWorkingBand({ plan: true, render: null, prev: null, next: addressed })!.verb).toBe("GENERATING");
  });

  it("GENERATING with no address names the pin from the wire — never a placeholder name (rule 10)", () => {
    expect(deriveWorkingBand({ plan: true, render: null, prev: pinned, next: scanned })).toEqual({
      verb: "GENERATING",
      lead: "new plan · pin ",
      named: "39.7400, -104.9663",
    });
    const blank = { ...scanned, meta: { ...scanned.meta, address: "   " } };
    expect(deriveWorkingBand({ plan: true, render: null, prev: null, next: blank })!.named).toBe("39.7400, -104.9663");
  });

  it("RE-GENERATING after a correction: the condition's own words in the named slot; undoing one says so", () => {
    expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next: withMarker(scanned) })).toEqual({
      verb: "RE-GENERATING",
      lead: "after a correction to ",
      named: "School zone",
    });
    expect(deriveWorkingBand({ plan: true, render: null, prev: withMarker(scanned), next: scanned })).toEqual({
      verb: "RE-GENERATING",
      lead: "after undoing the correction to ",
      named: "School zone",
    });
    // A replaced marker (dismiss after assert) reads as the new correction.
    const dismissed: SiteConditionOverride = { ...MARK, action: "dismiss", reason: "fenced" };
    expect(
      deriveWorkingBand({ plan: true, render: null, prev: withMarker(scanned), next: withMarker(scanned, dismissed) })!.lead,
    ).toBe("after a correction to ");
  });

  // #254: Apply folds the staged set into ONE write — more than one
  // marker differs between the two objects, and the band says the count
  // (one condition's name would be a half-truth).  One marker: unchanged.
  it("RE-GENERATING · after N corrections when Apply changed more than one marker; one marker keeps the named branch", () => {
    const second: SiteConditionOverride = {
      flag: "pedestrian_facility",
      action: "dismiss",
      reason: "fenced",
      recorded_at: "2026-09-07T12:00:00Z",
    };
    const twoAdded = { ...scanned, meta: { ...scanned.meta, siteConditionOverrides: [MARK, second] } };
    expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next: twoAdded })).toEqual({
      verb: "RE-GENERATING",
      lead: "after 2 corrections",
      named: null,
    });
    // One added + one removed is two changes too.
    const swapped = { ...scanned, meta: { ...scanned.meta, siteConditionOverrides: [second] } };
    expect(deriveWorkingBand({ plan: true, render: null, prev: withMarker(scanned), next: swapped })!.lead).toBe(
      "after 2 corrections",
    );
    // Two removed (Apply of two staged Undos).
    expect(deriveWorkingBand({ plan: true, render: null, prev: twoAdded, next: scanned })!.lead).toBe(
      "after 2 corrections",
    );
    // Exactly one marker differing keeps the named sentence (#252).
    expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next: withMarker(scanned) })!.lead).toBe(
      "after a correction to ",
    );
    // A replaced marker for ONE flag (dismiss after assert) is one change, not two.
    const dismissed: SiteConditionOverride = { ...MARK, action: "dismiss", reason: "fenced" };
    expect(
      deriveWorkingBand({ plan: true, render: null, prev: withMarker(scanned), next: withMarker(scanned, dismissed) })!.lead,
    ).toBe("after a correction to ");
  });

  it("RE-GENERATING without the site check when the proceed acknowledgement is what changed", () => {
    expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next: withSiteScan(pinned, true) })).toEqual({
      verb: "RE-GENERATING",
      lead: "without the site check",
      named: null,
    });
  });

  it("RE-GENERATING after an edit: each of the strip's nine inline fields by its words", () => {
    const cases: Array<[Scenario, string]> = [
      [{ ...scanned, speed: 35 }, "speed"],
      [{ ...scanned, laneWidth: 11 }, "lane width"],
      [{ ...scanned, workLen: 750 }, "work zone length"],
      [{ ...scanned, jurisdiction_key: "denver" }, "jurisdiction"],
      [{ ...scanned, street_class: "arterial" } as Scenario, "street class"],
      [{ ...scanned, schedule: { date_mode: "single", work_date: "2026-09-08" } } as Scenario, "work date"],
      [{ ...scanned, schedule: { date_mode: "single", work_date_end: "2026-09-09" } } as Scenario, "end date"],
      [{ ...scanned, schedule: { date_mode: "single", start_time: 9 } } as Scenario, "start time"],
      [{ ...scanned, schedule: { date_mode: "single", end_time: 15 } } as Scenario, "end time"],
    ];
    for (const [next, label] of cases) {
      expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next })).toEqual({
        verb: "RE-GENERATING",
        lead: `after an edit to ${label}`,
        named: null,
      });
    }
  });

  it("the same wire object again is a Retry; an unnamed difference is 'the plan' — never a guess", () => {
    expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next: scanned })).toEqual({
      verb: "RE-GENERATING",
      lead: "retrying the site scan",
      named: null,
    });
    // Equal by value, new identity, nothing the band names: not a retry.
    const clone = { ...scanned };
    expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next: clone })!.lead).toBe("the plan");
    const other = { ...scanned, roadType: "urban_undivided" } as unknown as Scenario;
    expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next: other })!.lead).toBe("the plan");
  });

  it("a correction outranks an edit in the same flight (the debounce can fold two writes into one request)", () => {
    const both = withMarker({ ...scanned, speed: 35 });
    expect(deriveWorkingBand({ plan: true, render: null, prev: scanned, next: both })!.lead).toBe("after a correction to ");
  });

  it("RENDERING · the file's declared name when only a render is open; the plan pair outranks it; nothing open is nothing", () => {
    expect(deriveWorkingBand({ plan: false, render: "plan sheet PDF", prev: scanned, next: scanned })).toEqual({
      verb: "RENDERING",
      lead: "plan sheet PDF",
      named: null,
    });
    expect(deriveWorkingBand({ plan: true, render: "quote XLSX", prev: scanned, next: withMarker(scanned) })!.lead).toBe(
      "after a correction to ",
    );
    expect(deriveWorkingBand({ plan: false, render: null, prev: scanned, next: scanned })).toBeNull();
  });
});
