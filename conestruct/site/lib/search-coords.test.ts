// #541 ruling 1 (docs/prompts/cc-prompt-ux-coords-in-search.md): "Record
// the formats you accept and test each one."  One case per accepted format
// and per refusal; the mounted flow (no /api/geocode request) is
// components/LocationPickerModal.coords-bar.test.tsx.

import { describe, expect, it } from "vitest";
import { readSearchCoords } from "./search-coords";

const POINT = { kind: "point", lat: 39.7401, lng: -104.9811 };

describe("readSearchCoords: accepted formats", () => {
  it.each([
    // The four ruled ones.
    "39.7401, -104.9811",
    "39.7401 -104.9811",
    "39.7401,-104.9811",
    "39.7401° N, 104.9811° W",
    // Degree forms "like" the ruled one.
    "39.7401°N, 104.9811°W",
    "39.7401° N 104.9811° W",
    "39.7401 N 104.9811 W",
    "39.7401N, 104.9811W",
    "39.7401n, 104.9811w",
    "N 39.7401, W 104.9811",
    "N39.7401 W104.9811",
    "39.7401°, -104.9811°",
    "39.7401º N, 104.9811º W", // the ordinal sign, often typed for the degree
    // Letters name the axis, so longitude may come first.
    "104.9811° W, 39.7401° N",
    "W 104.9811, N 39.7401",
    // One letter is enough to name both.
    "39.7401 N, -104.9811",
    "39.7401, 104.9811 W",
    // #230: what people paste.
    "39.7401, −104.9811", // Unicode minus
    "39.7401, –104.9811", // en dash
    " 39.7401, -104.9811 ", // NBSP
    "  39.7401 ,   -104.9811  ",
    "39.7401\t-104.9811",
    "+39.7401, -104.9811",
  ])("%s", (text) => {
    expect(readSearchCoords(text)).toEqual(POINT);
  });

  it("southern and eastern letters carry their sign", () => {
    expect(readSearchCoords("33.8688° S, 151.2093° E")).toEqual({
      kind: "point",
      lat: -33.8688,
      lng: 151.2093,
    });
  });

  it("whole numbers with a comma, and numbers with no leading or trailing digit", () => {
    expect(readSearchCoords("39, -105")).toEqual({ kind: "point", lat: 39, lng: -105 });
    expect(readSearchCoords(".5, -.5")).toEqual({ kind: "point", lat: 0.5, lng: -0.5 });
    expect(readSearchCoords("39., -105.")).toEqual({ kind: "point", lat: 39, lng: -105 });
    expect(readSearchCoords("39 -105")).toEqual({ kind: "point", lat: 39, lng: -105 });
  });

  it("the limits themselves are in range", () => {
    expect(readSearchCoords("90, 180")).toEqual({ kind: "point", lat: 90, lng: 180 });
    expect(readSearchCoords("-90, -180")).toEqual({ kind: "point", lat: -90, lng: -180 });
  });

  it("a pair with both numbers under 90 is taken as typed (nothing is swapped silently)", () => {
    expect(readSearchCoords("-75.1, 39.9")).toEqual({ kind: "point", lat: -75.1, lng: 39.9 });
  });
});

describe("readSearchCoords: out of range (never a clamped pin, Rule 10)", () => {
  it("latitude out of range, no valid swap", () => {
    expect(readSearchCoords("139.7401, -104.9811")).toEqual({
      kind: "out-of-range",
      axis: "lat",
      swap: null,
    });
  });

  it("longitude out of range", () => {
    expect(readSearchCoords("39.7401, -204.9811")).toEqual({
      kind: "out-of-range",
      axis: "lng",
      swap: null,
    });
  });

  it("swapped: out of range as typed, a valid point the other way round", () => {
    expect(readSearchCoords("-104.9811, 39.7401")).toEqual({
      kind: "out-of-range",
      axis: "lat",
      swap: { lat: 39.7401, lng: -104.9811 },
    });
    expect(readSearchCoords("-104.9811 39.7401")).toEqual({
      kind: "out-of-range",
      axis: "lat",
      swap: { lat: 39.7401, lng: -104.9811 },
    });
  });

  it("no swap is offered when letters already name the axes", () => {
    expect(readSearchCoords("95 N, 104 W")).toEqual({ kind: "out-of-range", axis: "lat", swap: null });
    expect(readSearchCoords("39.7 N, 204.5 W")).toEqual({ kind: "out-of-range", axis: "lng", swap: null });
  });

  it("just past the limits", () => {
    expect(readSearchCoords("90.0001, 0")).toMatchObject({ kind: "out-of-range", axis: "lat" });
    expect(readSearchCoords("0, 180.0001")).toMatchObject({ kind: "out-of-range", axis: "lng" });
  });
});

describe("readSearchCoords: looks like coordinates, can't be read", () => {
  it.each([
    "39°44'24\"N 104°59'W", // degrees, minutes, seconds
    "39° 44.4' N, 104° 58.9' W", // degrees and decimal minutes
    "39.7401°", // half a pair
    "39.7401° N",
    "39.7401 N, 40.1 N", // two latitudes
    "104.9 W, 105.1 E", // two longitudes
    "-39.7401 S, 104.9811 W", // a minus sign and a letter can disagree
    "39.7401 N, -104.9811 W",
  ])("%s", (text) => {
    expect(readSearchCoords(text)).toEqual({ kind: "unreadable" });
  });
});

describe("readSearchCoords: an address (the geocoder's business)", () => {
  it.each([
    "",
    "   ",
    "1600 E Colfax Ave, Denver",
    "I-25 & Bijou St, Colorado Springs",
    "E Colfax Ave & Pennsylvania St",
    "80202",
    "39.7401", // one number
    "1600 80202", // two bare whole numbers, a space between
    "500 N 200 W", // a grid address
    "50 N 100 W",
    "39.7401, -104.9811, 5280", // three numbers
    "39.7401, -104.9811 Denver",
    "Denver 39.7401, -104.9811",
    "1e3, 2e2", // no exponents
    "39,7401 -104,9811", // decimal commas
    "N, W",
    "5th, 6th",
  ])("%j", (text) => {
    expect(readSearchCoords(text)).toEqual({ kind: "address" });
  });
});
