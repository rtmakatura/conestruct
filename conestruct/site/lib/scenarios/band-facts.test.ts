// #289 hand-check, 2026-09-23 — the two derivations the defects changed.
//
// The mounted suites (GeneratorShell.kind-confirm, .value-links) carry
// the payload claims; this file pins the STRINGS and the one-open model
// where they are produced, because a fact line that composes its own
// string anywhere else is the defect band-facts.ts exists to prevent.

import { describe, expect, it } from "vitest";
import {
  deriveBands,
  setupSegments,
  setupValue,
  whereValue,
} from "./band-facts";
import { KIND_BLOCKER, LOCATION_BLOCKER, deriveRail } from "./rail";
import { PINNED_FLAGGER, PINNED_SHOULDER } from "@/components/test-fixtures";
import { DEFAULT_SHOULDER } from "./index";
import type { Scenario } from "./types";

const rail = (scenario: Scenario, kindConfirmed?: boolean) =>
  deriveRail({
    scenario,
    approachConfirm: { pending: false, reason: null },
    refusal: null,
    refusalPending: false,
    pendingSuggestions: 0,
    kindConfirmed,
  });

describe("defect 1 — an unconfirmed kind is not printed, not opened, not generated", () => {
  it("the WHERE value drops the placeholder kind until it is confirmed", () => {
    expect(whereValue(PINNED_SHOULDER, true)).toContain("shoulder work");
    expect(whereValue(PINNED_SHOULDER, false)).not.toContain("shoulder");
  });

  it("a pin with no confirmed kind keeps WHERE open and WHAT pending, with the reason", () => {
    const m = deriveBands({
      scenario: PINNED_SHOULDER,
      jurisdictionName: null,
      openOverride: null,
      kindConfirmed: false,
    });
    expect(m.open).toBe("where");
    const what = m.facts.find((f) => f.id === "what")!;
    expect(what.value).toBeNull();
    expect(what.verb).toBeNull();
    expect(what.pending).toBe("pending — kind of work not chosen");
  });

  it("an override onto WHAT is refused while the kind is unconfirmed", () => {
    const m = deriveBands({
      scenario: PINNED_SHOULDER,
      jurisdictionName: null,
      openOverride: "what",
      kindConfirmed: false,
    });
    expect(m.open).toBe("where");
  });

  it("confirmed: the column opens WHAT, as it did", () => {
    const m = deriveBands({
      scenario: PINNED_SHOULDER,
      jurisdictionName: null,
      openOverride: null,
      kindConfirmed: true,
    });
    expect(m.open).toBe("what");
  });

  it("the rail blocks Generate with Ryan's reason — only once there is a pin", () => {
    expect(rail(PINNED_SHOULDER, false).blocker?.message).toBe(KIND_BLOCKER);
    expect(rail(PINNED_SHOULDER, true).blocker).toBeNull();
    // No pin: the location is the true reason, and there are no chips yet.
    expect(rail(DEFAULT_SHOULDER, false).blocker?.message).toBe(LOCATION_BLOCKER);
    // A caller that does not ask reads the chain it always read.
    expect(rail(PINNED_SHOULDER).blocker).toBeNull();
  });
});

describe("defect 2 — the setup line is its values, each one a target", () => {
  it("rule 119's order with the hand-check's additions", () => {
    const keys = setupSegments(PINNED_SHOULDER, null).map((s) => s.key);
    expect(keys).toEqual([
      "kind",
      "location",
      "extent",
      "speed",
      "lanes",
      "laneWidth",
      "roadType",
      "jurisdiction",
      "dates",
    ]);
  });

  it("a kind with no lane count has no lanes value to press (#209)", () => {
    const keys = setupSegments(PINNED_FLAGGER, null).map((s) => s.key);
    expect(keys).not.toContain("lanes");
  });

  it("unset reads as unset — a value a person would press to set", () => {
    const segs = setupSegments(PINNED_SHOULDER, null);
    expect(segs.find((s) => s.key === "jurisdiction")!.text).toBe("Not set");
    expect(segs.find((s) => s.key === "dates")!.text).toBe("dates not set");
  });

  it("dates print as stored: one day, or a range", () => {
    const single = {
      ...PINNED_SHOULDER,
      schedule: { date_mode: "single", work_date: "2026-10-01" },
    } as Scenario;
    const range = {
      ...PINNED_SHOULDER,
      schedule: { date_mode: "range", work_date: "2026-10-01", work_date_end: "2026-10-03" },
    } as Scenario;
    expect(setupSegments(single, null).at(-1)!.text).toBe("2026-10-01");
    expect(setupSegments(range, null).at(-1)!.text).toBe("2026-10-01 – 2026-10-03");
  });

  it("each link names its field for a screen reader", () => {
    const speed = setupSegments(PINNED_SHOULDER, null).find((s) => s.key === "speed")!;
    expect(speed.label).toBe(`Speed limit: ${PINNED_SHOULDER.speed} mph — change`);
  });

  it("setupValue is the segments joined — one producer, one sentence", () => {
    expect(setupValue(PINNED_SHOULDER, "Denver")).toBe(
      setupSegments(PINNED_SHOULDER, "Denver")
        .map((s) => s.text)
        .join(" · "),
    );
  });
});


// #290 prod sweep finding (Ryan, 2026-09-25): "WHERE's Confirm doesn't
// move on to WHAT while the side is owed, and the side control stays open
// on WHERE until chosen."
describe("the column waits on the occupied side (#290 sweep)", () => {
  const { work: _side, ...unsidedMeta } = PINNED_SHOULDER.meta;
  const UNSIDED = { ...PINNED_SHOULDER, meta: unsidedMeta } as Scenario;

  it("kind confirmed, side owed: the column's own choice is WHERE", () => {
    expect(deriveBands({ scenario: UNSIDED, jurisdictionName: null, openOverride: null, kindConfirmed: true }).open).toBe("where");
  });

  it("the side answered: the column moves on to WHAT", () => {
    expect(deriveBands({ scenario: PINNED_SHOULDER, jurisdictionName: null, openOverride: null, kindConfirmed: true }).open).toBe("what");
  });

  it("WHAT stays reachable by its link while the side is owed — an explicit request", () => {
    const m = deriveBands({ scenario: UNSIDED, jurisdictionName: null, kindConfirmed: true, openOverride: "what" });
    expect(m.open).toBe("what");
  });
});