// #517 — the section's words have one producer (lib/scenarios/why-lines.ts).
// Ruling 2: a reason states the guess record's basis, or "Our guess" alone
// (Rule 10).  Ruling 5: no jargon.  Ruling 7: the date words, by hand.

import { describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "./types";
import {
  SOURCE_WORDS,
  dateButtonLabel,
  datesHint,
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

  it("the unset line names the jurisdiction, or asks for one (S9)", () => {
    expect(datesHint("Denver")).toBe("Optional. We check them against Denver's work hours.");
    expect(datesHint(null)).toBe("Optional. Pick a jurisdiction to check them against its work hours.");
  });
});
