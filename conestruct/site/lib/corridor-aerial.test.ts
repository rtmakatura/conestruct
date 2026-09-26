// #301 piece 1 — which picture the band asks for, read off the backend's
// own geometry answer (never a second read, never a coordinate).

import { describe, expect, it } from "vitest";
import { aerialStage } from "./corridor-aerial";
import type { CorridorGeometry } from "./corridor-geometry";

const answer = (status: CorridorGeometry["status"]): CorridorGeometry => ({
  status,
  pin_model: "work_start",
  pin: [39.7, -104.9],
  travel_bearing_deg: null,
  work: null,
  approaches: [],
  coverage_ft: null,
  message: null,
  side_options: [],
});

describe("aerialStage", () => {
  it("before the side: the pin alone (#290's pre-side ruling)", () => {
    expect(aerialStage(answer("side_not_confirmed"), false)).toBe("pin");
    expect(aerialStage(answer("side_not_confirmed"), true)).toBe("pin");
  });

  it("the side chosen, the kind owed: the work segment only (rule 112)", () => {
    expect(aerialStage(answer("laid_out"), false)).toBe("work");
  });

  it("both answered: the whole corridor", () => {
    expect(aerialStage(answer("laid_out"), true)).toBe("laid_out");
  });

  it("no answer, no pin, or a refusal: no picture (the refusal is stated in words)", () => {
    expect(aerialStage(null, true)).toBeNull();
    for (const s of ["no_pin", "no_bearing", "corridor_unbuildable"] as const) {
      expect(aerialStage(answer(s), true)).toBeNull();
    }
  });
});
