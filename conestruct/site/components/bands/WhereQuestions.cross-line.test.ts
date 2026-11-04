// #440 ruling 5 / X6 — the ✓ row's second line: each clause from a wire
// field, and left out while the wire hasn't carried it (Rule 3, Rule 10).

import { describe, expect, it } from "vitest";
import { crossLine } from "./WhereQuestions";
import type { CrossStreetTag } from "@/lib/cross-street-tag";

const tag = (marked: CrossStreetTag["marked"]): CrossStreetTag => ({
  text: "x",
  provenance: null,
  marked,
});

describe("crossLine", () => {
  it("two legs and the read's distance and direction", () => {
    expect(crossLine(2, tag({ name: "Race Street", offsetFt: 80, crossDirection: "east", at: false }), "Race Street")).toBe(
      "Two-way street · 80 ft east of where the work starts",
    );
  });

  it("one leg; the distance with the backend's thousands separator", () => {
    expect(
      crossLine(1, tag({ name: "Race Street", offsetFt: 1240, crossDirection: "northwest", at: false }), "Race Street"),
    ).toBe("One-way street · 1,240 ft northwest of where the work starts");
  });

  it("under the backend's threshold the work starts at the crossing", () => {
    expect(crossLine(2, tag({ name: "Race Street", offsetFt: 20, crossDirection: "east", at: true }), "Race Street")).toBe(
      "Two-way street · at where the work starts",
    );
  });

  it("the read pending, or an answer for another crossing: the clause is left out", () => {
    expect(crossLine(2, null, "Race Street")).toBe("Two-way street");
    expect(crossLine(2, { text: "x", provenance: null }, "Race Street")).toBe("Two-way street");
    expect(
      crossLine(2, tag({ name: "York Street", offsetFt: 80, crossDirection: "east", at: false }), "Race Street"),
    ).toBe("Two-way street");
  });

  it("no legs on the wire: no street word", () => {
    expect(crossLine(0, null, "Race Street")).toBe("");
  });
});
