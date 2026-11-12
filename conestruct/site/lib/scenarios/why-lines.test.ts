// #517 — the section's words have one producer (lib/scenarios/why-lines.ts).
// Ruling 2: a reason states the guess record's basis, or "Our guess" alone
// (Rule 10).  Ruling 5: no jargon.  Ruling 7: the date words, by hand.

import { describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "./types";
import {
  SOURCE_WORDS,
  dateButtonLabel,
  ADD_STREET_CLASS,
  ADD_TIMES,
  DATES_NO_JURISDICTION,
  clock,
  dateList,
  datesOptional,
  fitsEveryDay,
  fixButton,
  fixRecord,
  holidayLine,
  hoursRowLine,
  hoursSub,
  hoursTitle,
  monthDay,
  noHoursData,
  noHoursRowLine,
  outsideLine,
  shortName,
  hoursProblem,
  noClosures,
  fitsPartial,
  noRecordDays,
  cantCheckYet,
  weekdayNoRecord,
  seeHours,
  sourceLine,
  weekNote,
  weekdayVerdict,
  weekendLine,
  fileDetailsLine,
  guessReason,
  introLine,
  isOpenGuess,
  longDate,
  shortDate,
  tagWords,
} from "./why-lines";

const s = (g: Scenario["guesses"], extra: Partial<Scenario> = {}) =>
  ({ ...DEFAULT_SHOULDER, ...extra, guesses: g }) as Scenario;

describe("#517 ruling 2: guess reasons", () => {
  it("each reason states the record's basis", () => {
    const g = {
      road_type: { highwayClass: "primary", urban: false, divided: false },
      street_class: { highwayClass: "primary" },
      jurisdiction_key: { lat: 1, lng: 2 },
      speed: { highwayClass: "primary" },
    };
    expect(guessReason(s(g), "road_type")).toBe(
      "Based on the road's map tag and the open country around it",
    );
    expect(
      guessReason(s({ ...g, road_type: { ...g.road_type, urban: true } }), "road_type"),
    ).toBe("Based on the road's map tag and the built-up area around it");
    expect(guessReason(s(g), "street_class")).toBe("Based on the road's map tag");
    expect(guessReason(s(g), "jurisdiction_key")).toBe("Based on where your pin is");
    expect(guessReason(s(g), "speed")).toBe(
      "Based on the road's map tag. The map has no posted speed here.",
    );
  });

  it("no record, no basis: 'Our guess' alone (Rule 10)", () => {
    for (const f of ["road_type", "street_class", "jurisdiction_key", "speed"] as const) {
      expect(guessReason(s(undefined), f)).toBe("Our guess");
    }
  });

  it("a road type the operator set is no longer an open guess", () => {
    const g = { road_type: { highwayClass: "primary", urban: true, divided: false } };
    expect(isOpenGuess(s(g), "road_type")).toBe(true);
    const mine = s(g);
    mine.meta = { ...mine.meta, operatorSet: ["roadType"] };
    expect(isOpenGuess(mine, "road_type")).toBe(false);
  });
});

describe("#517 ruling 1, 5: the words", () => {
  it("map tags in plain words; unknown tags read as themselves", () => {
    expect(tagWords("residential")).toBe("residential street");
    expect(tagWords("primary")).toBe("main road");
    expect(tagWords("motorway_link")).toBe("freeway ramp");
    expect(tagWords("bus_guideway")).toBe("bus guideway");
  });

  it("the source words carry no jargon", () => {
    for (const { word } of Object.values(SOURCE_WORDS)) {
      expect(word).not.toMatch(/OSM|operator-set|·|highway=/);
    }
    expect(SOURCE_WORDS.measured).toEqual({ glyph: "✓", word: "Measured from the map" });
    expect(SOURCE_WORDS.guess).toEqual({ glyph: "⚠", word: "Our guess. Check it." });
  });

  it("the intro line and the file details line count what they say", () => {
    expect(introLine(2, true)).toBe(
      "We filled this in from the road you confirmed. Check our 2 guesses, then tell us about the work.",
    );
    expect(introLine(0, true)).toBe("We filled this in from the road you confirmed.");
    expect(fileDetailsLine(0)).toBe(
      "Project name and location description. They print on the plan's title block.",
    );
    expect(fileDetailsLine(1)).toBe(
      "Project name and location description. They print on the plan's title block. 1 not set.",
    );
  });
});

describe("#517 ruling 7: dates, by hand", () => {
  it("formats without a timezone shift", () => {
    expect(shortDate("2026-11-16")).toBe("Mon Nov 16");
    expect(shortDate("2026-01-01")).toBe("Thu Jan 1");
    expect(longDate("2026-11-20")).toBe("Friday, November 20, 2026");
    expect(dateButtonLabel("", "")).toBe("Pick start and end dates");
    expect(dateButtonLabel("2026-11-16", "")).toBe("Mon Nov 16");
    expect(dateButtonLabel("2026-11-16", "2026-11-20")).toBe("Mon Nov 16 to Fri Nov 20");
  });

  it("the unset line names the jurisdiction, or asks for one (#526 ruling 2, S2)", () => {
    expect(datesOptional("Denver")).toBe(
      "Optional. We check your dates and times against Denver's work hours.",
    );
    expect(DATES_NO_JURISDICTION).toBe(
      "Optional. Pick a jurisdiction to check your dates against its work hours.",
    );
  });
});

describe("#526: the work-hours words", () => {
  it("clock words: the board's own", () => {
    expect(clock(8.5)).toBe("8:30\u00a0am");
    expect(clock(15.5)).toBe("3:30\u00a0pm");
    expect(clock(0)).toBe("midnight");
    expect(clock(24)).toBe("midnight");
    expect(clock(12)).toBe("noon");
    expect(clock(20)).toBe("8\u00a0pm");
    expect(clock(5)).toBe("5\u00a0am");
  });

  it("dates: the month once per run", () => {
    expect(monthDay("2026-11-07")).toBe("Nov 7");
    expect(dateList(["2026-11-07"])).toBe("Nov 7");
    expect(dateList(["2026-11-07", "2026-11-08"])).toBe("Nov 7 and 8");
    expect(dateList(["2026-11-30", "2026-12-01", "2026-12-02"])).toBe("Nov 30, Dec 1 and 2");
  });

  it("ruling 2's states and S2's", () => {
    expect(ADD_TIMES).toBe("Add a start and end time to finish the check.");
    expect(ADD_STREET_CLASS).toBe("Pick a street class to finish the check.");
    expect(fitsEveryDay("Denver")).toBe("Fits Denver's work hours on every day.");
    expect(noHoursData("CDOT")).toBe(
      "We don't have CDOT's work hours yet, so we can't check your dates.",
    );
  });

  it("S4's hours problems", () => {
    const e = { no_closures: false, starts_before: null, ends_after: null, misses: false };
    expect(hoursProblem("weekdays", { ...e, starts_before: 8.5, ends_after: 15.5 })).toBe(
      "Starts before 8:30\u00a0am and ends after 3:30\u00a0pm on weekdays.",
    );
    expect(hoursProblem("weekdays", { ...e, starts_before: 9 })).toBe("Starts before 9\u00a0am on weekdays.");
    expect(hoursProblem("weekends", { ...e, ends_after: 17 })).toBe("Runs past 5\u00a0pm on weekends.");
    expect(hoursProblem("every day", { ...e, misses: true })).toBe("Falls outside the allowed hours on every day.");
    expect(hoursProblem("weekdays", e)).toBeNull();
  });

  it("round 2 (S12): no closures, one or two dates named, three or more counted", () => {
    expect(noClosures("weekend", ["2026-11-21"], 1)).toBe("Nov 21 is a weekend day: no closures.");
    expect(noClosures("weekend", ["2026-11-21", "2026-11-22"], 2)).toBe("Nov 21 and 22 are a weekend: no closures.");
    expect(noClosures("weekend", ["2026-11-21", "2026-11-22", "2026-11-28", "2026-11-29"], 6)).toBe(
      "6 weekend days in your dates: no closures.",
    );
    expect(noClosures("weekday", ["2026-11-16", "2026-11-17"], 2)).toBe("Nov 16 and 17 are weekdays: no closures.");
    expect(noClosures("weekday", ["2026-11-16"], 1)).toBe("Nov 16 is a weekday: no closures.");
    expect(noClosures("weekday", ["2026-11-16", "2026-11-17", "2026-11-18"], 3)).toBe(
      "3 weekdays in your dates: no closures.",
    );
  });

  it("round 2 (S12, reworked by S21b): the outside line is one name-free problem statement", () => {
    const k = (over: object) => ({
      status: "outside",
      no_closures: false,
      starts_before: null,
      ends_after: null,
      misses: false,
      ...over,
    });
    const inside = { status: "inside", no_closures: false, starts_before: null, ends_after: null, misses: false };
    const noRec = { ...inside, status: "no_record" };
    const both = {
      kinds: ["weekday", "weekend"] as ("weekday" | "weekend")[],
      kind_dates: { weekday: ["2026-11-16"], weekend: ["2026-11-21", "2026-11-22"] },
      kind_days: { weekday: 5, weekend: 2 },
    };
    // The same problem on both kinds: one sentence, "on every day".
    expect(outsideLine({ weekday: k({ starts_before: 9 }), weekend: k({ starts_before: 9 }) }, both)).toBe(
      "Starts before 9\u00a0am on every day.",
    );
    // Different problems on both kinds: merged, the detail left to the window.
    expect(
      outsideLine({ weekday: k({ starts_before: 8.5, ends_after: 15.5 }), weekend: k({ ends_after: 18 }) }, both),
    ).toBe("Outside the allowed hours on weekdays and weekends.");
    // Outside on one kind, no closures on the other (both ways round).
    expect(outsideLine({ weekday: k({ ends_after: 15.5 }), weekend: k({ no_closures: true }) }, both)).toBe(
      "Outside the allowed hours on weekdays; no closures on weekends.",
    );
    expect(outsideLine({ weekday: k({ no_closures: true }), weekend: k({ ends_after: 15.5 }) }, both)).toBe(
      "Outside the allowed hours on weekends; no closures on weekdays.",
    );
    expect(outsideLine({ weekday: k({ no_closures: true }), weekend: k({ no_closures: true }) }, both)).toBe(
      "No closures on weekdays or weekends.",
    );
    // One kind with a problem keeps its specific sentence.
    expect(outsideLine({ weekday: k({ starts_before: 8.5, ends_after: 15.5 }), weekend: inside }, both)).toBe(
      "Starts before 8:30\u00a0am and ends after 3:30\u00a0pm on weekdays.",
    );
    expect(outsideLine({ weekday: inside, weekend: k({ no_closures: true }) }, both)).toBe(
      "Nov 21 and 22 are a weekend: no closures.",
    );
    expect(outsideLine({ weekday: noRec, weekend: k({ starts_before: 8 }) }, both)).toBe(
      "Starts before 8\u00a0am on weekends.",
    );
    expect(outsideLine({ weekday: inside, weekend: noRec }, both)).toBeNull();
  });

  it("S21a: the short name is the picker's label without its parenthetical", () => {
    expect(shortName("cdot", "Colorado Department of Transportation")).toBe("CDOT");
    expect(shortName("e470", "E-470 Public Highway Authority")).toBe("E-470");
    expect(shortName("denver", "City and County of Denver")).toBe("Denver");
    expect(shortName("not_a_key", "El Paso County")).toBe("El Paso County");
    expect(shortName(null, null)).toBeNull();
  });

  it("round 2 (S10, Rule 10): partial and no-record lines; finding 5's plain line", () => {
    expect(fitsPartial("Denver", "weekday")).toBe("Fits Denver's weekday hours. We don't have its weekend hours.");
    expect(fitsPartial("Denver", "weekend")).toBe("Fits Denver's weekend hours. We don't have its weekday hours.");
    expect(noRecordDays("Denver")).toBe("We don't have Denver's hours for these days, so we can't check them.");
    expect(cantCheckYet("Denver")).toBe("We can't check your dates against Denver's work hours yet.");
    expect(weekdayNoRecord("Denver")).toBe("We don't have Denver's weekday hours for this street class.");
  });

  it("the hours row and the window's words", () => {
    expect(hoursRowLine("Denver")).toBe("Denver limits when you can close a lane.");
    expect(noHoursRowLine("CDOT")).toBe("We don't have CDOT's work hours yet.");
    expect(seeHours("Denver")).toBe("See Denver's work hours");
    expect(hoursTitle("Denver")).toBe("Denver's work hours");
    expect(hoursSub("collector", 9, 15)).toBe(
      "When you can close a lane on a collector street. Your hours: 9\u00a0am to 3\u00a0pm.",
    );
    expect(hoursSub("arterial", null, null)).toBe("When you can close a lane on an arterial street.");
    expect(hoursSub(null, 20, 5)).toBe(
      "Street class not set, so the hours for it aren't known. Your hours: 8\u00a0pm to 5\u00a0am.",
    );
    expect(fixButton(8.5, 15.5)).toBe("Change my hours to 8:30\u00a0am to 3:30\u00a0pm");
    expect(fixRecord(20, 5)).toBe("Hours changed to 8\u00a0pm to 5\u00a0am.");
    expect(weekdayVerdict("Denver", "inside")).toBe("Your hours fit on weekdays.");
    expect(weekdayVerdict("Denver", "outside")).toBe("Your hours go outside what Denver allows on weekdays.");
  });

  it("weekends: S8's absence, a ban, the job's weekend dates", () => {
    const w = (allowed: [number, number][] | null, record: "windows" | "none", no_closures = false) => ({
      allowed,
      record,
      no_closures,
    });
    // Round 2: absence comes from the backend's record, never from the spans.
    expect(weekendLine(w([[0, 24]], "none"), [])).toBe("Weekends: none on record.");
    expect(weekendLine(w([[0, 24]], "windows"), [])).toBe("Weekends: midnight to midnight.");
    expect(weekendLine(w([], "windows", true), [])).toBe("Weekends: no lane closures.");
    expect(weekendLine(w(null, "windows"), [])).toBe("Weekends: needs a street class.");
    expect(weekendLine(w([[9, 15]], "windows"), ["2026-11-21", "2026-11-22"])).toBe(
      "Weekends: 9\u00a0am to 3\u00a0pm. Your dates include Nov 21 and 22.",
    );
  });

  it("S7: holidays as a rule only", () => {
    expect(holidayLine("none")).toBeNull();
    expect(holidayLine("holidays_banned")).toBe(
      "No closures on holidays. We don't check your dates against holidays yet.",
    );
  });

  it("S5: the week note", () => {
    const week = (n: number) => Array.from({ length: 7 }, (_, i) => ({ in_job: i < n }));
    expect(weekNote(null)).toBe("Pick work dates on the page to see your days here.");
    expect(weekNote({ start: "2026-11-16", end: "2026-11-20", days: 5, week: week(5) })).toBe(
      "Your dates run Nov 16 to Nov 20, so the other days are greyed out.",
    );
    expect(weekNote({ start: "2026-11-16", end: "2026-11-22", days: 7, week: week(7) })).toBe(
      "Your dates run Nov 16 to Nov 22, the whole week.",
    );
    expect(weekNote({ start: "2026-11-16", end: "2026-12-04", days: 19, week: week(7) })).toBe(
      "Your dates run Nov 16 to Dec 4. This is the first week; every week has the same hours.",
    );
  });

  it("the source line, from the backend's sources", () => {
    expect(sourceLine([])).toBeNull();
    expect(sourceLine([{ doc: "Rule 22.3", section: "IV.4", date: "2022-04-22" }])).toBe(
      "Source: Rule 22.3 IV.4, Apr 22, 2022",
    );
  });
});
