import { describe, expect, it } from "vitest";
import { geocodeErrorMessage, geocodeFailureMessage, isPreciseGeocode } from "./geocode-precision";

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

describe("geocodeErrorMessage (#347)", () => {
  it.each([
    [503, "Geocoding not configured"],
    [404, "No match for that address"],
    [422, "Add a city to search cross streets."],
    [502, "Geocoding failed (502)"],
  ])("%i reads %s", (status, msg) => {
    expect(geocodeErrorMessage(status)).toBe(msg);
  });
});

describe("#376: the reason body picks the line", () => {
  it.each([
    [422, "outside colorado", "Plans cover Colorado roads only."],
    [404, "check spelling", "No match in Colorado for that city. Check the spelling."],
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
