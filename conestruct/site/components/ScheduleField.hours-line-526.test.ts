// #526 (Ryan, 2026-11-11, item 1 ruling 3): "The 'set dates to check' bug.
// Trace why the check didn't run with dates set. ... add a test that fails
// on the old code."
//
// The trace (rulings.md R145 S2; plan.md §1): the old line mapped every
// `hours_eval.status === "unknown"` to "set dates to check", and the backend
// answers "unknown" both for dates with no times and for a class-scoped
// window with no street class (Denver's weekday windows are scoped to
// arterials and collectors).  The first test below is the red proof: on the
// old ScheduleField it reads "set dates to check" (red-proof.md).  The rest
// pin each of ruling 2's states, with the backend's hours_days shapes.

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { windowsSummary } from "./ScheduleField";
import { denverBlock, denverDays } from "./__fixtures__/what-section";

const DATES = {
  date_mode: "range" as const,
  work_date: "2026-11-16",
  work_date_end: "2026-11-20",
};

function denver(over: Partial<Scenario> = {}): Scenario {
  return { ...DEFAULT_SCENARIO, jurisdiction_key: "denver", street_class: "collector", ...over } as Scenario;
}

describe("#526 ruling 3: dates set, the check waits on the street class", () => {
  it("names the street class, never 'set dates to check' (red on the old code)", () => {
    const w = windowsSummary({
      scenario: denver({ street_class: null, schedule: { ...DATES, start_time: 9, end_time: 15 } } as Partial<Scenario>),
      jurisdiction: denverBlock(denverDays("street_class"), { status: "unknown", violations: [] }),
    });
    expect(w.text).toBe("Pick a street class to finish the check.");
    expect(w.kind).toBe("none");
  });
});

describe("#526 ruling 2: the Work dates line's states", () => {
  it("dates, no times", () => {
    const w = windowsSummary({ scenario: denver({ schedule: DATES } as Partial<Scenario>), jurisdiction: denverBlock(denverDays("times")) });
    expect(w).toEqual({ kind: "none", text: "Add a start and end time to finish the check." });
  });

  it("fits: a check mark", () => {
    const w = windowsSummary({
      scenario: denver({ schedule: { ...DATES, start_time: 9, end_time: 15 } }),
      jurisdiction: denverBlock(denverDays("inside"), { status: "inside", violations: [] }),
    });
    expect(w).toEqual({ kind: "ok", text: "Fits Denver's work hours on every day." });
  });

  it("outside: the orange mark and a plain sentence", () => {
    const w = windowsSummary({
      scenario: denver({ schedule: { ...DATES, start_time: 7, end_time: 17 } }),
      jurisdiction: denverBlock(denverDays("outside")),
    });
    expect(w).toEqual({ kind: "bad", text: "Starts before 8:30\u00a0am and ends after 3:30\u00a0pm on weekdays." });
  });

  it("a weekend with no closures", () => {
    const w = windowsSummary({
      scenario: denver({ schedule: { ...DATES, work_date_end: "2026-11-22", start_time: 9, end_time: 15 } }),
      jurisdiction: denverBlock(denverDays("weekend_closed")),
    });
    expect(w).toEqual({ kind: "bad", text: "Nov 21 and 22 are a weekend: no closures." });
  });

  it("no data for the jurisdiction (Rule 10)", () => {
    const w = windowsSummary({
      scenario: denver({ jurisdiction_key: "cdot", schedule: DATES } as Partial<Scenario>),
      jurisdiction: denverBlock(null, undefined, "CDOT"),
    });
    expect(w).toEqual({ kind: "none", text: "We don't have CDOT's work hours yet, so we can't check your dates." });
  });

  it("no dates", () => {
    const w = windowsSummary({ scenario: denver(), jurisdiction: denverBlock(denverDays("dates")) });
    expect(w).toEqual({ kind: "none", text: "Optional. We check your dates and times against Denver's work hours." });
  });
});

describe("#526 round 2 (R145 S10, Rule 10): no window on record is absence, never a fit", () => {
  const week = { ...DATES, work_date_end: "2026-11-22", start_time: 9, end_time: 15 };
  it("weekdays fit, weekends have no record: no check mark", () => {
    const w = windowsSummary({ scenario: denver({ schedule: week }), jurisdiction: denverBlock(denverDays("partial")) });
    expect(w).toEqual({ kind: "none", text: "Fits Denver's weekday hours. We don't have its weekend hours." });
  });
  it("no job day kind has a record", () => {
    const w = windowsSummary({
      scenario: denver({ street_class: "local", schedule: week } as Partial<Scenario>),
      jurisdiction: denverBlock(denverDays("no_record")),
    });
    expect(w).toEqual({ kind: "none", text: "We don't have Denver's hours for these days, so we can't check them." });
  });
});

describe("#526 round 2 (finding 5, R145 S15): an older backend with no hours_days", () => {
  const old = (ev: { status: "unknown" | "inside" | "outside"; note?: string }) =>
    ({ ...denverBlock(denverDays("dates")), hours_eval: { violations: [], ...ev }, hours_days: undefined }) as ReturnType<
      typeof denverBlock
    >;
  it("dates with no times, and the backend's no-schedule note: add the times", () => {
    const w = windowsSummary({
      scenario: denver({ schedule: DATES } as Partial<Scenario>),
      jurisdiction: old({ status: "unknown", note: "no work schedule provided" }),
    });
    expect(w).toEqual({ kind: "none", text: "Add a start and end time to finish the check." });
  });
  it("street class unset and any other unknown: pick a street class", () => {
    const w = windowsSummary({
      scenario: denver({ street_class: null, schedule: { ...DATES, start_time: 9, end_time: 15 } } as Partial<Scenario>),
      jurisdiction: old({ status: "unknown" }),
    });
    expect(w).toEqual({ kind: "none", text: "Pick a street class to finish the check." });
  });
  it("anything else: a plain line, never a verdict, never 'Checking' forever", () => {
    for (const ev of [{ status: "inside" as const }, { status: "outside" as const }, { status: "unknown" as const }]) {
      const w = windowsSummary({
        scenario: denver({ schedule: { ...DATES, start_time: 9, end_time: 15 } }),
        jurisdiction: old(ev),
      });
      expect(w).toEqual({ kind: "none", text: "We can't check your dates against Denver's work hours yet." });
    }
  });
});
