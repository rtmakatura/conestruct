import { describe, expect, it } from "vitest";
import {
  geocodeErrorMessage,
  geocodeFailureMessage,
  isPreciseGeocode,
  searchMessageLines,
  weakMatchNotice,
} from "./geocode-precision";

describe("isPreciseGeocode", () => {
  it("street-level classes are precise", () => {
    expect(isPreciseGeocode("address")).toBe(true);
    expect(isPreciseGeocode("poi")).toBe(true);
    expect(isPreciseGeocode("intersection")).toBe(true);
    expect(isPreciseGeocode("street")).toBe(true);
  });

  it("area-level classes are coarse — a town centroid must never trigger road detection", () => {
    for (const t of [
      "place", // "Lafayette, CO"
      "locality",
      "neighborhood",
      "district",
      "region",
      "postcode",
      "country",
    ]) {
      expect(isPreciseGeocode(t), t).toBe(false);
    }
  });

  it("unknown or missing type degrades to coarse, never to a silent detection", () => {
    expect(isPreciseGeocode(null)).toBe(false);
    expect(isPreciseGeocode("some_future_type")).toBe(false);
    expect(isPreciseGeocode("")).toBe(false);
  });
});

describe("weakMatchNotice (#554)", () => {
  it("names the place in Ryan's sentence", () => {
    expect(weakMatchNotice("39 North Main Street, Holly, Colorado 81047")).toBe(
      "Closest match: 39 North Main Street, Holly, Colorado 81047. Check the pin before you go on.",
    );
  });
});

describe("geocodeErrorMessage (#347)", () => {
  it.each([
    [503, "Address search isn't set up here."],
    [404, "No match for that address"],
    [422, "Add a city to search cross streets."],
    [502, "Address search failed (502). Try again."],
  ])("%i reads %s", (status, msg) => {
    expect(geocodeErrorMessage(status)).toBe(msg);
  });
});

describe("#376: the reason body picks the line", () => {
  it.each([
    [422, "outside colorado", "Plans cover Colorado roads only."],
    [404, "check spelling", "No match in Colorado for that city. Check the spelling."],
    [404, "check address", "No match in Colorado for that address. Check the spelling."],
    [422, "add a city", "Add a city to search cross streets."],
    [404, "no match", "No match for that address"],
    [404, "outside colorado", "No match for that address"],
  ])("%i %s reads %s", (status, reason, msg) => {
    expect(geocodeErrorMessage(status, reason)).toBe(msg);
  });

  it("geocodeFailureMessage reads the response body", async () => {
    const r = new Response("outside colorado", { status: 422 });
    expect(await geocodeFailureMessage(r)).toBe("Plans cover Colorado roads only.");
  });
});

// #565 (Ryan, 2026-11-24, ruling 2): the box's two lines, what happened and
// what to do next.  The last sentence is the next step; one sentence has
// none.
describe("searchMessageLines (#565)", () => {
  it.each([
    [
      "Closest match: 39 North Main Street, Holly, Colorado 81047. Check the pin before you go on.",
      "Closest match: 39 North Main Street, Holly, Colorado 81047.",
      "Check the pin before you go on.",
    ],
    [
      "Closest match: St. Vrain Rd, Longmont, Colorado 80503. Check the pin before you go on.",
      "Closest match: St. Vrain Rd, Longmont, Colorado 80503.",
      "Check the pin before you go on.",
    ],
    [
      "Closest match: 39.7401, -104.9811. Check the pin before you go on.",
      "Closest match: 39.7401, -104.9811.",
      "Check the pin before you go on.",
    ],
    ["No match in Colorado for that city. Check the spelling.", "No match in Colorado for that city.", "Check the spelling."],
    ["Address search failed (502). Try again.", "Address search failed (502).", "Try again."],
    ["Plans cover Colorado roads only.", "Plans cover Colorado roads only.", null],
    ["No match for that address", "No match for that address", null],
    ["Latitude must be between -90 and 90", "Latitude must be between -90 and 90", null],
  ])("%s", (text, happened, next) => {
    expect(searchMessageLines(text)).toEqual({ happened, next });
  });

  it("every line geocodeErrorMessage can give splits back into its own words", () => {
    for (const [status, reason] of [[422, "outside colorado"], [404, "check spelling"], [404, "check address"], [503, ""], [404, ""], [422, ""], [500, ""]] as const) {
      const text = geocodeErrorMessage(status, reason);
      const { happened, next } = searchMessageLines(text);
      expect(next === null ? happened : `${happened} ${next}`).toBe(text);
    }
  });
});
