// R96 A / R98 — every WHAT field's provenance line as one quiet marker:
// symbol + word from the fixed vocabulary (P9), the full line one click
// away (rule 137 as amended by R98).  A line that needs the operator now
// (an error, "⚠ needs you") is not shortened: `null` keeps it inline.

import { describe, expect, it } from "vitest";

import { markerOf } from "./provenance-marker";

describe("markerOf", () => {
  it.each([
    ["OSM · 30 mph · measured", false, "✓", "measured", "ok"],
    ["OSM · 2 · measured", false, "✓", "measured", "ok"],
    // R108: a value inferred off the road reads as the mockup marks it.
    ["OSM · Urban arterial · inferred", true, "⚠", "from the road", "guess"],
    ["OSM · 3 · overridden", false, "✓", "overridden", "ok"],
    ["OSM · 30 mph · measured · operator-set", false, "✓", "yours", "ok"],
    ["OSM · 35 mph · measured · changed in plan", true, "⚠", "changed", "guess"],
    ["OSM · withdrawn", false, "◌", "withdrawn", "pending"],
    ["OSM · 30 mph · no source tag", false, "◌", "no tag", "pending"],
    ["your change · operator-set from here on", false, "✓", "yours", "ok"],
    ["your answer · operator-set from here on", false, "✓", "yours", "ok"],
    ["operator-set · names the file and the title block", false, "✓", "yours", "ok"],
    ["operator-set · one day · permit lead times read this", false, "✓", "yours", "ok"],
    ["not set · windows and permit lead times need a date", false, "◌", "not set", "pending"],
    ["not set · operator-set when picked", false, "◌", "not set", "pending"],
    ["optional · the address stands in when this is empty", false, "◌", "not set", "pending"],
    ["MUTCD + Colorado Supplement only", false, "◌", "not set", "pending"],
    ["evaluating: the option you picked, not yet confirmed for this plan", false, "◌", "evaluating", "pending"],
    ["evaluated · city & county · calls this plan a TCP", false, "✓", "evaluated", "ok"],
    ["detected · a same-name carriageway 9.82 m away", false, "✓", "detected", "ok"],
    ["detected · no same-name carriageway within 100 m", false, "✓", "detected", "ok"],
    // R108: the two guesses.
    ["guessed, not confirmed · OSM highway=primary · from the road", true, "⚠", "from the road", "guess"],
    ["guessed, not confirmed · from the pin", true, "⚠", "from the pin", "guess"],
    // R110 Q7 / Q8: a value the plan started from, until the operator changes it.
    ["default · the plan's standard lane; detection doesn't measure width", false, "✓", "default", "ok"],
    ["default · daytime; night work adds retroreflective devices", false, "✓", "default", "ok"],
    ["default · no lower limit through the zone", false, "✓", "default", "ok"],
    // R108: the pin's lookup in flight, for an empty jurisdiction.
    ["checking the pin's boundary data", false, "◌", "checking", "pending"],
    ["median present · every other road type sets this itself (#85)", false, "i", "about", "info"],
  ])("%s → %s %s", (text, amber, glyph, word, tone) => {
    expect(markerOf(text, { amber })).toEqual({ glyph, word, tone });
  });

  it("an error stays a full line", () => {
    expect(markerOf("4 lanes need a 12 ft lane at most", { error: true })).toBeNull();
    expect(
      markerOf("not evaluated: the check didn't answer; the option you picked stands", { error: true }),
    ).toBeNull();
  });

  it("a line that needs the operator now stays a full line", () => {
    expect(markerOf("⚠ needs you · the map couldn't tell")).toBeNull();
  });
});
