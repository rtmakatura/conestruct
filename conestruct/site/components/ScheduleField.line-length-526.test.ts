// #526 round 2 (finding 1) and its rework (R145 S21; S20 withdrawn): every
// Work dates line fits the two lines the cell reserves, at every width.
// Ruling 2: "room reserved for two lines in every state".
//
// N is measured at the NARROWEST line (walk.md, "The line's capacity"): the
// 263 px line of the two-column grid at 1440x900, 1198x930 and 1024x768
// (390x844's line is 328 px).  In the page with the real font (Inter 12.5 px,
// line 17.5 px), the longest prefix, cut at a word end, that stays two lines
// was 81-83 characters for four probes in the line's own words with no mark,
// and 72-75 with the line's mark (the check or the --dim square and its gap
// take width).  N takes 5 % off the smallest of each: 77 for a line with no
// mark, 68 for a marked line.  The same run also rendered all 117 exact
// candidate lines (every state with every short name): none took a third
// line at any width.
//
// The test enumerates every state, every outside combination over both day
// kinds (inside, starting early, running late, both with 12:30 pm, a second
// "both", missing every window, no closures with 1, 2 and many dates, no
// record), with EVERY jurisdiction the picker offers (its short name, from
// JURISDICTION_OPTIONS; S21a).

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { JURISDICTION_OPTIONS, type DayKindEval, type HoursDays } from "@/lib/jurisdiction";
import { shortName } from "@/lib/scenarios/why-lines";
import { windowsSummary } from "./ScheduleField";
import { denverBlock, kindEval, NO_RECORD } from "./__fixtures__/what-section";

const N_PLAIN = 77;
const N_MARKED = 68;
const limit = (kind: "none" | "ok" | "bad") => (kind === "none" ? N_PLAIN : N_MARKED);

// The block's own name is long on purpose: the line must use the short name.
const BLOCK_NAME = "E-470 Public Highway Authority";

// 12:30 pm is the longest clock word the backend's half-hours can give.
const LATE = 12.5;
const KINDS: Record<string, DayKindEval> = {
  inside: kindEval({ status: "inside" }),
  start: kindEval({ status: "outside", starts_before: LATE, fix: [LATE, LATE], outside: [[0, 1]] }),
  end: kindEval({ status: "outside", ends_after: LATE, fix: [LATE, LATE], outside: [[0, 1]] }),
  both: kindEval({ status: "outside", starts_before: LATE, ends_after: LATE, fix: [LATE, LATE], outside: [[0, 1]] }),
  both2: kindEval({ status: "outside", starts_before: 10.5, ends_after: LATE, fix: [10.5, LATE], outside: [[0, 1]] }),
  misses: kindEval({ status: "outside", misses: true, fix: [LATE, LATE], outside: [[0, 1]] }),
  closed: kindEval({ allowed: [], no_closures: true, status: "outside", outside: [[0, 1]] }),
  none: NO_RECORD,
};

// The widest date words: "Dec 30 and 31"; three or more dates are counted.
const DATES: Record<string, { dates: string[]; count: number }> = {
  one: { dates: ["2026-12-30"], count: 1 },
  two: { dates: ["2026-12-30", "2026-12-31"], count: 2 },
  many: { dates: ["2026-11-28", "2026-11-29", "2026-12-05", "2026-12-06"], count: 128 },
};

function days(wd: DayKindEval, we: DayKindEval, dates: { dates: string[]; count: number }): HoursDays {
  const got = [wd.status, we.status];
  const status: HoursDays["status"] = got.includes("outside")
    ? "outside"
    : got.every((g) => g === "inside")
      ? "inside"
      : got.every((g) => g === "no_record")
        ? "no_record"
        : "partial";
  return {
    status,
    missing: null,
    holiday_rule: "none",
    kinds: { weekday: wd, weekend: we },
    job: {
      start: "2026-11-16",
      end: "2027-03-01",
      days: 300,
      kinds: ["weekday", "weekend"],
      kind_dates: { weekday: dates.dates, weekend: dates.dates },
      kind_days: { weekday: dates.count, weekend: dates.count },
      week: [],
    },
  };
}

const dated = (key: string) =>
  ({
    ...DEFAULT_SCENARIO,
    jurisdiction_key: key,
    street_class: "collector",
    schedule: { date_mode: "range", work_date: "2026-11-16", work_date_end: "2027-03-01", start_time: 7, end_time: LATE },
  }) as Scenario;

const KEYS = JURISDICTION_OPTIONS.map((o) => o.key);

describe("#526 round-2 rework (S21): every Work dates line fits two lines at the narrowest width", () => {
  it("the picker offers short names only (the parenthetical goes)", () => {
    expect(KEYS.length).toBeGreaterThanOrEqual(10);
    for (const k of KEYS) expect(shortName(k, BLOCK_NAME), k).not.toMatch(/\(/);
    expect(shortName("cdot", BLOCK_NAME)).toBe("CDOT");
  });

  it("every outside combination over both day kinds, for every jurisdiction", () => {
    let n = 0;
    for (const key of KEYS) {
      for (const [a, wd] of Object.entries(KINDS)) {
        for (const [b, we] of Object.entries(KINDS)) {
          for (const d of Object.values(DATES)) {
            const w = windowsSummary({ scenario: dated(key), jurisdiction: denverBlock(days(wd, we, d), undefined, BLOCK_NAME) });
            expect(w.text.length, `${key} ${a}/${b}: ${w.text}`).toBeLessThanOrEqual(limit(w.kind));
            expect(w.text, w.text).not.toContain(BLOCK_NAME);
            // One problem statement: never more than one sentence for a problem.
            if (w.kind === "bad") expect(w.text.split(/\.\s/).length, w.text).toBe(1);
            n += 1;
          }
        }
      }
    }
    expect(n).toBe(KEYS.length * 8 * 8 * 3);
  });

  it("every other state, the ruled verbatim lines included, for every jurisdiction", () => {
    for (const key of KEYS) {
      const s = dated(key);
      const undated = { ...s, schedule: undefined } as unknown as Scenario;
      const noTimes = { ...s, schedule: { date_mode: "range", work_date: "2026-11-16", work_date_end: "2026-11-20" } } as Scenario;
      const fits = denverBlock(days(KINDS.inside, KINDS.inside, DATES.one), undefined, BLOCK_NAME);
      const states = [
        windowsSummary({ scenario: { ...s, jurisdiction_key: null } as Scenario }),
        windowsSummary({ scenario: s, name: BLOCK_NAME }),
        windowsSummary({ scenario: s, name: BLOCK_NAME, declined: true }),
        windowsSummary({ scenario: s, name: BLOCK_NAME, errored: true }),
        // Ruled verbatim: no dates, dates with no times, fits, no data.
        windowsSummary({ scenario: undated, jurisdiction: fits }),
        windowsSummary({ scenario: noTimes, jurisdiction: denverBlock({ ...days(KINDS.inside, KINDS.inside, DATES.one), status: "unknown", missing: "times" }, undefined, BLOCK_NAME) }),
        windowsSummary({ scenario: s, jurisdiction: fits }),
        windowsSummary({ scenario: s, jurisdiction: denverBlock(null, undefined, BLOCK_NAME) }),
        // S2, S10, S15 and the wait states.
        windowsSummary({ scenario: s, jurisdiction: denverBlock({ ...days(KINDS.inside, KINDS.inside, DATES.one), status: "unknown", missing: "street_class" }, undefined, BLOCK_NAME) }),
        windowsSummary({ scenario: s, jurisdiction: denverBlock(days(KINDS.inside, NO_RECORD, DATES.one), undefined, BLOCK_NAME) }),
        windowsSummary({ scenario: s, jurisdiction: denverBlock(days(NO_RECORD, KINDS.inside, DATES.one), undefined, BLOCK_NAME) }),
        windowsSummary({ scenario: s, jurisdiction: denverBlock(days(NO_RECORD, NO_RECORD, DATES.one), undefined, BLOCK_NAME) }),
        windowsSummary({ scenario: s, jurisdiction: { ...fits, hours_days: undefined } }),
        windowsSummary({ scenario: s, jurisdiction: fits, verifying: true }),
      ];
      expect(states[4].text).toMatch(/^Optional\. We check your dates and times against .+'s work hours\.$/);
      expect(states[5].text).toBe("Add a start and end time to finish the check.");
      expect(states[6].text).toMatch(/^Fits .+'s work hours on every day\.$/);
      expect(states[7].text).toMatch(/^We don't have .+'s work hours yet, so we can't check your dates\.$/);
      for (const w of states) {
        expect(w.text.length, `${key}: ${w.text}`).toBeLessThanOrEqual(limit(w.kind));
        expect(w.text).not.toContain(BLOCK_NAME);
      }
    }
  });
});
