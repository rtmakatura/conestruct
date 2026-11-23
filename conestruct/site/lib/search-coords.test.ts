// #541 ruling 1 (docs/prompts/cc-prompt-ux-coords-in-search.md): "Record
// the formats you accept and test each one."  One case per accepted format
// and per refusal; the mounted flow (no /api/geocode request) is
// components/LocationPickerModal.coords-bar.test.tsx.
//
// #548 (Ryan, 2026-11-23, gate round 4): a pin only for two numbers that
// each have a decimal point, or a full degrees-minutes(-seconds) pair with
// a letter on both halves; everything else is an address.  The blocks at
// the end hold every example in #548, #550, #551 and #552.

import { describe, expect, it } from "vitest";
import { MAX_COORDS_TEXT, readSearchCoords } from "./search-coords";

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

  it("numbers with no leading digit", () => {
    expect(readSearchCoords(".5, -.5")).toEqual({ kind: "point", lat: 0.5, lng: -0.5 });
  });

  it("the limits themselves are in range", () => {
    expect(readSearchCoords("90.0, 180.0")).toEqual({ kind: "point", lat: 90, lng: 180 });
    expect(readSearchCoords("-90.0, -180.0")).toEqual({ kind: "point", lat: -90, lng: -180 });
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
    expect(readSearchCoords("95.5 N, 104.5 W")).toEqual({ kind: "out-of-range", axis: "lat", swap: null });
    expect(readSearchCoords("39.7 N, 204.5 W")).toEqual({ kind: "out-of-range", axis: "lng", swap: null });
  });

  it("just past the limits", () => {
    expect(readSearchCoords("90.0001, 0.0")).toMatchObject({ kind: "out-of-range", axis: "lat" });
    expect(readSearchCoords("0.0, 180.0001")).toMatchObject({ kind: "out-of-range", axis: "lng" });
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

// #544 (mission ux-map-window-tidy, ruling 3): "Coordinates in brackets,
// e.g. "(39.7401, -104.9811)" or "[39.7401, -104.9811]", parse as
// coordinates and never reach the geocoder.  Add a test for each form."
describe("readSearchCoords: one pair of brackets round the whole text (#544)", () => {
  it("round brackets: (39.7401, -104.9811) is the point", () => {
    expect(readSearchCoords("(39.7401, -104.9811)")).toEqual(POINT);
  });

  it("square brackets: [39.7401, -104.9811] is the point", () => {
    expect(readSearchCoords("[39.7401, -104.9811]")).toEqual(POINT);
  });

  it.each([
    "( 39.7401, -104.9811 )", // spaces inside
    " [39.7401 -104.9811] ", // spaces outside, a space between
    "(39.7401° N, 104.9811° W)",
    "[104.9811° W, 39.7401° N]",
  ])("the bracketed text is read as the bare text is: %s", (text) => {
    expect(readSearchCoords(text)).toEqual(POINT);
  });

  it("brackets change nothing else: out of range and swapped are still refused", () => {
    expect(readSearchCoords("(139.7401, -104.9811)")).toEqual({ kind: "out-of-range", axis: "lat", swap: null });
    expect(readSearchCoords("[-104.9811, 39.7401]")).toEqual({
      kind: "out-of-range",
      axis: "lat",
      swap: { lat: 39.7401, lng: -104.9811 },
    });
  });

  it.each([
    "(39.7401, -104.9811]", // a mismatched pair
    "[39.7401, -104.9811)",
    "(39.7401, -104.9811", // one bracket alone
    "39.7401, -104.9811)",
    "((39.7401, -104.9811))", // two pairs
    "(39.7401), (-104.9811)", // brackets round each number
    "{39.7401, -104.9811}", // not a ruled bracket
    "(39.7401, -104.9811) Denver", // text outside the brackets
    "(1600 80202)", // two bare whole numbers are an address, bracketed or not
    "(Denver)",
    "()",
    "[]",
  ])("still an address: %j", (text) => {
    expect(readSearchCoords(text)).toEqual({ kind: "address" });
  });
});

// #548, Ryan's ruling of 2026-11-23 (gate round 4; validation-artifacts/
// committed/missions/coords-wrong-pin/issue-548/rulings.md): "the
// coordinate parser places a pin ONLY for (a) two numbers that both contain
// a decimal point and are in lat/long range, optionally with brackets,
// degree signs or N/S/E/W letters, or (b) a full degrees-minutes(-seconds)
// pair with a hemisphere letter on both halves.  Everything else goes to
// the geocoder exactly as on main."
const ADDRESS = { kind: "address" };

describe("#548: half a coordinate is an address, never a pin", () => {
  it.each([
    "39° 44.4", // the bare form: a pin at 39, 44.4 before
    "(39° 44.4)",
    "[39° 44.4]",
    "39 N, 44.4", // named in the ruling
    "105° W, 39.7401", // named in the ruling
  ])("%s", (text) => {
    expect(readSearchCoords(text)).toEqual(ADDRESS);
  });
});

describe("#548 (a): a pair needs a decimal point in both numbers", () => {
  it.each([
    "39, -105",
    "39 -105",
    "39., -105.", // a full stop with no digit after it is not a decimal
    "39.7401, -105",
    "39, -104.9811",
    "90, 180",
    "39 44.4",
    "39°, 44.4",
    "39°, 44",
    "39° 44.4°",
    "39°, 44.4°",
    "39° N, 44.4",
    "39° N, 44.4 E",
    "39 N, 104 W",
    "39° N, 104° W",
    "104° W, 39",
    "104°, 39", // the range line with a swap offer before
    "95 N, 104 W", // the range line before
    "91, 200",
  ])("one number has none, so it is an address: %s", (text) => {
    expect(readSearchCoords(text)).toEqual(ADDRESS);
  });

  it.each([
    "39.7401°, -104.9811",
    "39.7401, -104.9811°",
    "39.7401° -104.9811",
    "39.7401° -104.9811°",
    "39.7401 N -104.9811",
    "39.7401 N, -104.9811",
    "(39.7401 N 104.9811 W)",
  ])("both have one, so it is the pin it was: %s", (text) => {
    expect(readSearchCoords(text)).toEqual(POINT);
  });

  it.each([
    "39.7401°", // each of these got the "Use decimal degrees" line before
    "39.7401° N",
    "(39.7401°)",
    "39.7401 N, 40.1 N", // two latitudes
    "104.9 W, 105.1 E", // two longitudes
    "-39.7401 S, 104.9811 W", // a minus sign and a letter
    "39.7401 N, -104.9811 W",
    "N-39.7401, W-104.9811",
    "39.7401 N -104.9811 W",
  ])("no new refusal and no old one: %s is an address", (text) => {
    expect(readSearchCoords(text)).toEqual(ADDRESS);
  });
});

describe("#548 (b): a full degrees-minutes(-seconds) pair with a letter on both halves", () => {
  it.each([
    "39° 44.406' N, 104° 58.866' W", // the ruling's example
    "39°44.406'N 104°58.866'W",
    "N 39° 44.406', W 104° 58.866'", // the letters in front
    "104° 58.866' W, 39° 44.406' N", // either order
    "39° 44.406′ N, 104° 58.866′ W", // the prime
    "39° 44.406’ N, 104° 58.866’ W", // a curly apostrophe
    "39º 44.406' N, 104º 58.866' W", // the ordinal sign
    "(39° 44.406' N, 104° 58.866' W)",
    "[39° 44.406' N, 104° 58.866' W]",
    "39° 44' 24.36\" N, 104° 58' 51.96\" W", // seconds
  ])("%s is 39.7401, -104.9811", (text) => {
    const read = readSearchCoords(text);
    expect(read.kind).toBe("point");
    if (read.kind !== "point") return;
    expect(read.lat).toBeCloseTo(39.7401, 9);
    expect(read.lng).toBeCloseTo(-104.9811, 9);
  });

  it.each([
    "39°44'24\"N 104°59'W",
    "39°44’24”N 104°59’W", // curly quotes
    "39°44′24″N 104°59′W", // prime and double prime
    "39°44'24''N 104°59'W", // two apostrophes for seconds
  ])("%s is degrees + minutes/60 + seconds/3600, nothing rounded", (text) => {
    expect(readSearchCoords(text)).toEqual({ kind: "point", lat: 143064 / 3600, lng: -377940 / 3600 });
  });

  it("southern and eastern letters carry their sign", () => {
    expect(readSearchCoords("33° 52' 7.5\" S, 151° 12' 30\" E")).toEqual({
      kind: "point",
      lat: -(33 * 3600 + 52 * 60 + 7.5) / 3600,
      lng: (151 * 3600 + 12 * 60 + 30) / 3600,
    });
  });

  it("out of range keeps #541's range line, with no swap (the letters name the axes)", () => {
    expect(readSearchCoords("91° 0' N, 104° 0' W")).toEqual({ kind: "out-of-range", axis: "lat", swap: null });
    expect(readSearchCoords("39° 0' N, 181° 0' W")).toEqual({ kind: "out-of-range", axis: "lng", swap: null });
  });

  it.each([
    "39° 44.406' N", // half a pair
    "39° 44.406', 104° 58.866'", // no letters
    "39° 44.406' N, 104° 58.866'", // a letter on one half only
    "39 44.406' N, 104 58.866' W", // no degree signs
    "39° 44.406 N, 104° 58.866 W", // no minutes marks
    "39° 60' N, 104° 58' W", // 60 minutes
    "39° 44' 60\" N, 104° 58' 0\" W", // 60 seconds
    "39.5° 30' N, 104° 0' W", // a fraction in the degrees
    "39° 44.5' 24\" N, 104° 58' 0\" W", // a fraction in the minutes, with seconds
    "39° 24\" N, 104° 58' W", // seconds without minutes
    "-39° 44' N, 104° 58' W", // a sign
    "39° 44' N, 40° 1' N", // two latitudes
    "39° 44.406' N, 104.9811° W", // one half in degrees and minutes, one in decimals
    "39° N, 104° 58' W",
    "39°44'24\"N104°59'W", // nothing between the halves
    "39 44 24 N 104 58 51 W",
    "39 44 N 104 58 W",
  ])("not a full pair, so an address: %s", (text) => {
    expect(readSearchCoords(text)).toEqual(ADDRESS);
  });
});

describe("#550: every input it names", () => {
  it.each([
    // Finding 1: a letter between digits, two letters together, another character.
    "39.7401N104.9811W",
    "N39.7401W104.9811",
    "39N104W",
    "39.7401 NE",
    "39.7401 N; 104.9811 W",
    "39.7401 N/104.9811 W",
    "39:44:24 N",
    "39.7401 N;",
    "(39.7401 N",
    // Finding 2.
    "39°, 44.4",
    "39° 44.4°",
    // Finding 3: lookalike degree marks.
    "39˚ 44.4",
    "39* 44.4",
    "39d 44.4",
    "39˚ 44.4' N",
    "39˚ 44.406' N, 104˚ 58.866' W",
  ])("an address: %s", (text) => {
    expect(readSearchCoords(text)).toEqual(ADDRESS);
  });

  it.each(["39.7401°, -104.9811", "39.7401, -104.9811°", "39.7401° -104.9811°"])(
    "still the pin: %s",
    (text) => {
      expect(readSearchCoords(text)).toEqual(POINT);
    },
  );
});

describe("#551: road names always search", () => {
  it.each([
    "E-470",
    "E-470 N",
    "W-470",
    "N-25",
    "W. 6",
    "N. 39",
    "S-630-1",
    "E 470",
    "E470",
    "C-470",
    "I-70 E",
    "E-470 & Parker",
    "-104.98 W",
    "E-470, N-25",
    "N-25 E-470",
    "N-39, W-104",
    "100 N.",
  ])("an address: %s", (text) => {
    expect(readSearchCoords(text)).toEqual(ADDRESS);
  });
});

describe("#552: every input it names", () => {
  it.each([
    // Finding 1: E-470 with a direction, with or without its hyphen.
    "E 470 N",
    "E470 N",
    "E 470 S",
    "N E470",
    "E 470 W 6",
    "E470 120",
    "N 287 S",
    "S 85 N",
    "E 36 W",
    "E 470.",
    "W 6.",
    // Finding 2: a grid address with a ZIP; a house number, a direction and a numbered street.
    "500 N 200 W 84103",
    "500 N 200 W, 84103",
    "100 S 200 E 84111",
    "1437 N 14",
    "120 W 14",
    "200 E 9",
    "W 6 80204",
    "500 N 200 W",
    "120 W 14th",
    // Finding 3.
    "105° W, 39.7401",
    "104° W, 39",
    "104°, 39",
    "39° N, 44.4",
    "39 N, 44.4",
    "E -470",
    "E- 470",
    "E.-470",
    "E-470.5",
    "E-470 6'",
    "E-470 39°",
    // The proposed solution's examples.
    "39 44 24 N 104 58 51 W",
    "39 44 N",
    "39.7401 N",
    "39 44.4 N",
    "39° 44.4",
    // Grid shapes kept since #541.
    "39 N",
    "N 39",
    "39N 104W",
    "39 N 104 W",
    "39 N 104",
  ])("an address: %s", (text) => {
    expect(readSearchCoords(text)).toEqual(ADDRESS);
  });

  it("finding 3: a 30,000-digit run is answered at once (4 s before)", () => {
    const started = performance.now();
    expect(readSearchCoords("9".repeat(30000))).toEqual(ADDRESS);
    expect(readSearchCoords("9".repeat(30000) + " N")).toEqual(ADDRESS);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

// #553 (folded into #554; validation-artifacts/committed/
// issue-554-weak-match-notice/rulings.md § #553).
describe("#553: the round-4 findings", () => {
  it("finding 1: a long digit run after a degree sign is answered at once (650 ms and 7.6 s before)", () => {
    const started = performance.now();
    expect(readSearchCoords("39° " + "9".repeat(30000))).toEqual(ADDRESS);
    expect(readSearchCoords("39° " + "9".repeat(100000))).toEqual(ADDRESS);
    expect(readSearchCoords("39° " + "9".repeat(100000) + "' N, 104° 59' W")).toEqual(ADDRESS);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("finding 1: text is read as coordinates up to 100 characters, and not past it", () => {
    expect(MAX_COORDS_TEXT).toBe(100);
    // A run of spaces counts as one space.
    expect(readSearchCoords("39.7401," + " ".repeat(300) + "-104.9811")).toEqual(POINT);
    // Zeros after the last decimal count in full.
    const long = (n: number) => "39.7401" + "0".repeat(n - 18) + ", -104.9811";
    expect(long(100)).toHaveLength(100);
    expect(readSearchCoords(long(100))).toEqual(POINT);
    expect(readSearchCoords(long(101))).toEqual(ADDRESS);
  });

  it.each([
    "39° 44.' N, 104° 58.' W", // minutes with nothing after the point
    "39° 44' 24.\" N, 104° 58' 51.\" W", // seconds the same
  ])("finding 2: %s is an address (a pin before)", (text) => {
    expect(readSearchCoords(text)).toEqual(ADDRESS);
  });

  it("finding 2: minutes written .5 are still read, as .5 is for a decimal number", () => {
    expect(readSearchCoords("39° .5' N, 104° .5' W")).toEqual({
      kind: "point",
      lat: 39 + 0.5 / 60,
      lng: -(104 + 0.5 / 60),
    });
  });

  it("finding 3: one letter in front and one behind is a pin", () => {
    expect(readSearchCoords("N 39° 44', 104° 59' W")).toEqual({
      kind: "point",
      lat: (39 * 3600 + 44 * 60) / 3600,
      lng: -(104 * 3600 + 59 * 60) / 3600,
    });
  });

  it("finding 3: 39° 44.4' N, 104° 58.9' W is a pin (the old \"can't be read\" line before #548)", () => {
    expect(readSearchCoords("39° 44.4' N, 104° 58.9' W")).toEqual({
      kind: "point",
      lat: (39 * 3600 + 44.4 * 60) / 3600,
      lng: -(104 * 3600 + 58.9 * 60) / 3600,
    });
  });
});
