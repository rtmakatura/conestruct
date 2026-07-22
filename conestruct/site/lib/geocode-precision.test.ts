import { describe, expect, it } from "vitest";
import { isPreciseGeocode } from "./geocode-precision";

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
