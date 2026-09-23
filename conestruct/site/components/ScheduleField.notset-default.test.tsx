// @vitest-environment happy-dom
//
// #199 — a fresh scenario used to present "Single day" as the chosen
// date mode: an asserted schedule shape nobody chose, under a caption
// promising that windows and lead times compute from it.  The fix made
// the default "Not set" and kept it display-only — nothing written until
// the user acts.
//
// #289 hand-check, 2026-09-23, fix 1: "Work dates is one control in the
// WHAT grid — the Single day / Date range / Not set buttons write the
// same field as the date input; keep one, drop the duplicate."  The
// chips are gone and the MODE DERIVES from the dates, which is the same
// claim made by the field itself rather than by a control beside it:
// there is no date, so the schedule is Not set.  Rule 11 — the claim is
// about what the wire carries, so these cases read the writer.

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { setWorkDates } from "@/lib/scenarios/what-writes";

const fresh = { ...DEFAULT_SCENARIO, schedule: undefined } as Scenario;

describe("#199 — 'Not set' is the default, and it is derived", () => {
  it("an untouched scenario carries no schedule at all", () => {
    // The strongest form of the #199 claim: not a mode nobody chose, and
    // not even an object nobody asked for.
    expect(fresh.schedule).toBeUndefined();
  });

  it("no date means tbd — the mode is read off the answer, never asserted", () => {
    const cleared = setWorkDates(
      { ...fresh, schedule: { date_mode: "single", work_date: "2026-08-04" } } as Scenario,
      { start: "" },
    );
    expect(cleared.schedule?.date_mode).toBe("tbd");
    expect(cleared.schedule?.work_date).toBeUndefined();
  });

  it("a date alone is a single day", () => {
    const one = setWorkDates(fresh, { start: "2026-08-04" });
    expect(one.schedule?.date_mode).toBe("single");
    expect(one.schedule?.work_date).toBe("2026-08-04");
    expect(one.schedule?.work_date_end).toBeUndefined();
  });

  it("a start and an end are a range", () => {
    const span = setWorkDates(
      setWorkDates(fresh, { start: "2026-08-04" }),
      { end: "2026-08-07" },
    );
    expect(span.schedule?.date_mode).toBe("range");
    expect(span.schedule?.work_date).toBe("2026-08-04");
    expect(span.schedule?.work_date_end).toBe("2026-08-07");
  });

  it("clearing the start drops the end with it — a range with no beginning is not one", () => {
    const span = setWorkDates(
      setWorkDates(fresh, { start: "2026-08-04" }),
      { end: "2026-08-07" },
    );
    const cleared = setWorkDates(span, { start: "" });
    expect(cleared.schedule?.date_mode).toBe("tbd");
    expect(cleared.schedule?.work_date_end).toBeUndefined();
  });

  it("the times survive a date edit — they are a different question", () => {
    const withTimes = {
      ...fresh,
      schedule: { date_mode: "single", work_date: "2026-08-04", start_time: 8, end_time: 16 },
    } as Scenario;
    const moved = setWorkDates(withTimes, { start: "2026-08-05" });
    expect(moved.schedule?.start_time).toBe(8);
    expect(moved.schedule?.end_time).toBe(16);
  });
});
