// #316 (R129 Q3–Q5) — the cross street's approach speed, as pure functions.
//
// Authority: validation-artifacts/committed/issue-317-316/rulings.md (R129).
// R126's rule, per cross street: no readable posted speed and a class →
// the class estimate, marked "⚠ from the road" and recorded as a guess (one
// record for the cross street, Q5); no class → "◌ not set" and Generate
// waits.  The operator's speed is theirs; a new crossing starts fresh.

import { describe, expect, it } from "vitest";
import { DEFAULT_NEAR_INTERSECTION, DEFAULT_SHOULDER, type Scenario } from "./index";
import type { IntersectionRecord, NearIntersectionScenario } from "./types";
import {
  approachSpeedGuessFor,
  approachSpeedLine,
  approachSpeedSet,
  approachSpeedShown,
  guessCount,
  setApproachSpeed,
  withCurrentGuesses,
} from "./guesses";
import { APPROACH_SPEED_BLOCKER, deriveRail } from "./rail";
import { markerOf } from "./provenance-marker";

const PIN = { lat: 39.7337, lng: -104.98753 };

function crossing(over: Partial<IntersectionRecord> = {}): IntersectionRecord {
  return { lat: 39.73274, lng: -104.98753, name: "E 11th Ave", ...over };
}

function plan(intersection: IntersectionRecord | null, legs = 2): NearIntersectionScenario {
  const leg = {
    speed: 30,
    roadType: "urban_arterial" as const,
    lanesPerDirection: 1,
    laneWidth: 12,
    signalized: false,
  };
  return {
    ...DEFAULT_NEAR_INTERSECTION,
    approaches: [
      { id: "cross_a", ...leg },
      ...(legs === 2 ? [{ id: "cross_b", ...leg }] : []),
    ],
    // The mainline speed is the operator's (no road at this test pin), so
    // the rail reaches the cross street's ranks.
    meta: {
      ...DEFAULT_NEAR_INTERSECTION.meta,
      ...PIN,
      pinModel: "work_start",
      intersection,
      operatorSet: ["speed"],
    },
  } as NearIntersectionScenario;
}

const speeds = (s: Scenario) => (s as NearIntersectionScenario).approaches.map((a) => a.speed);

describe("the guess (R126's rule, per cross street)", () => {
  it("an untagged residential cross street guesses 25 on every approach, one record", () => {
    const s = withCurrentGuesses(plan(crossing({ highwayClass: "residential", postedSpeedMph: null })));
    expect(speeds(s)).toEqual([25, 25]);
    expect(s.guesses?.approach_speed).toEqual({ highwayClass: "residential" });
    expect(approachSpeedSet(s)).toBe(true);
    expect(approachSpeedLine(s)).toEqual({
      text: "guessed, not confirmed · OSM highway=residential · from the road",
      amber: true,
    });
    expect(markerOf(approachSpeedLine(s).text, { amber: true })?.glyph).toBe("⚠");
    expect(guessCount(s)).toBe(1);
  });

  it("a class past the approach's 55 snaps to it (R127 Q3's cap)", () => {
    expect(approachSpeedGuessFor(plan(crossing({ highwayClass: "motorway", postedSpeedMph: null }))))
      .toEqual({ mph: 55, highwayClass: "motorway" });
  });

  it("a posted speed is measured, never guessed", () => {
    const s = withCurrentGuesses(
      plan(crossing({ highwayClass: "tertiary", postedSpeedMph: 30 })),
    );
    expect(s.guesses?.approach_speed).toBeUndefined();
    expect(approachSpeedSet(s)).toBe(true);
    expect(approachSpeedLine(s)).toEqual({ text: "OSM · 30 mph · measured", amber: false });
  });

  it("no cross street detected (no class): not set, and the rail waits on it", () => {
    for (const c of [crossing(), crossing({ highwayClass: null, postedSpeedMph: null })]) {
      const s = withCurrentGuesses(plan(c));
      expect(s.guesses?.approach_speed).toBeUndefined();
      expect(approachSpeedSet(s)).toBe(false);
      expect(approachSpeedShown(s)).toBe(false);
      expect(approachSpeedLine(s)).toEqual({
        text: "not set · operator-set when picked",
        amber: false,
      });
      const rail = deriveRail({
        scenario: { ...s, meta: { ...s.meta, work: { side: "right", travel: "with_geometry" } } } as Scenario,
        approachConfirm: { pending: false, reason: null },
        refusal: null,
        refusalPending: false,
        kindConfirmed: true,
      });
      expect(rail.blocker).toEqual({ message: APPROACH_SPEED_BLOCKER, entryId: "extra" });
    }
  });

  it("before a crossing is marked, the speed is not shown and nothing is guessed (#317 speaks first)", () => {
    const s = withCurrentGuesses(plan(null));
    expect(approachSpeedSet(s)).toBe(true);
    expect(approachSpeedShown(s)).toBe(false);
    expect(s.guesses?.approach_speed).toBeUndefined();
  });
});

describe("the operator's speed (R110 Q4's rule)", () => {
  it("picking a speed sets every approach, drops the record and is theirs", () => {
    const guessed = withCurrentGuesses(plan(crossing({ highwayClass: "residential", postedSpeedMph: null })));
    const mine = withCurrentGuesses(setApproachSpeed(guessed, 35), guessed);
    expect(speeds(mine)).toEqual([35, 35]);
    expect(mine.guesses?.approach_speed).toBeUndefined();
    expect(approachSpeedLine(mine).text).toBe("your change · operator-set from here on");
    // A later write never re-guesses over it.
    expect(speeds(withCurrentGuesses({ ...mine } as Scenario, mine))).toEqual([35, 35]);
  });

  it("a new crossing drops a stale record; the same crossing re-saved keeps it", () => {
    const guessed = withCurrentGuesses(plan(crossing({ highwayClass: "residential", postedSpeedMph: null })));
    const same = withCurrentGuesses(
      { ...guessed, meta: { ...guessed.meta, intersection: { ...guessed.meta.intersection! } } } as Scenario,
      guessed,
    );
    expect(same.guesses?.approach_speed).toEqual({ highwayClass: "residential" });
    const tagged = withCurrentGuesses(
      {
        ...guessed,
        meta: { ...guessed.meta, intersection: crossing({ highwayClass: "tertiary", postedSpeedMph: 35 }) },
      } as Scenario,
      guessed,
    );
    expect(tagged.guesses?.approach_speed).toBeUndefined();
  });

  it("another kind carries no approach record", () => {
    const s = withCurrentGuesses({
      ...DEFAULT_SHOULDER,
      guesses: { approach_speed: { highwayClass: "residential" } },
    } as Scenario);
    expect(s.guesses).toBeUndefined();
    expect(approachSpeedSet(s)).toBe(true);
  });
});
