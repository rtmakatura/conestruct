// deriveRail (issue #221) — the single-source extraction of the CTA's
// disabled-reason chain plus the every-blocker-visible entries.
//
// The string pins below are the behavior-preservation contract: the
// seven ranked reasons must be byte-identical to what GeneratorSidebar
// rendered before the extraction.  The multi-blocker cases are the
// invisible-queue fix (rule 10): every simultaneously-true blocker
// appears on its home entry even though ``blocker`` names only the
// first-ranked one.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEAR_INTERSECTION,
  DEFAULT_SHOULDER,
  DEFAULT_FLAGGER,
  type NearIntersectionScenario,
  type Scenario,
} from "./index";
import {
  deriveRail,
  HOLD_BLOCKER,
  LOCATION_BLOCKER,
  RECHECK_BLOCKER,
  REFUSAL_BLOCKER,
  type RailInput,
} from "./rail";

const NO_HOLD = { pending: false, reason: null };

function input(scenario: Scenario, over: Partial<RailInput> = {}): RailInput {
  return {
    scenario,
    approachConfirm: NO_HOLD,
    refusal: null,
    refusalPending: false,
    ...over,
  };
}

function pinned<S extends Scenario>(s: S): S {
  return { ...s, meta: { ...s.meta, lat: 39.7, lng: -104.9 } };
}

function entryById(rail: ReturnType<typeof deriveRail>, id: string) {
  const e = rail.entries.find((x) => x.id === id);
  if (!e) throw new Error(`no entry ${id}`);
  return e;
}

describe("the extracted CTA chain — strings and rank (behavior pin)", () => {
  it("pins the four moved literals byte-identically", () => {
    expect(HOLD_BLOCKER).toBe(
      "Confirm the cross-street lane count first — it was filled from map data.",
    );
    expect(REFUSAL_BLOCKER).toBe("Generation declined — see the notice below.");
    expect(RECHECK_BLOCKER).toBe(
      "Re-checking the declined input — Generate re-enables when the verdict settles.",
    );
    expect(LOCATION_BLOCKER).toBe(
      "Set a location first — pick on map or enter manually.",
    );
  });

  it("blocker is null exactly when every gate condition clears", () => {
    const rail = deriveRail(input(pinned(DEFAULT_SHOULDER)));
    expect(rail.blocker).toBeNull();
    expect(rail.entries.map((e) => e.issues.length)).toEqual([0, 0, 0, 0]);
  });

  it("rank 1: an invalid work zone outranks everything, incl. the hold", () => {
    const s: NearIntersectionScenario = {
      ...pinned(DEFAULT_NEAR_INTERSECTION),
      workLen: 0,
    };
    const rail = deriveRail(
      input(s, { approachConfirm: { pending: true, reason: "r" } }),
    );
    expect(rail.blocker).toEqual({
      message: "Work zone length is required.",
      entryId: "work",
    });
  });

  it("rank 2: the lanes mirror (its message passes through verbatim)", () => {
    const s = { ...pinned(DEFAULT_SHOULDER), lanes: 4, laneWidth: 14 };
    const rail = deriveRail(input(s));
    expect(rail.blocker?.entryId).toBe("road");
    expect(rail.blocker?.message).toMatch(/wider than the plan sheet can draw/);
  });

  it("rank 3: the approaches mirror", () => {
    const s: NearIntersectionScenario = {
      ...pinned(DEFAULT_NEAR_INTERSECTION),
      approaches: DEFAULT_NEAR_INTERSECTION.approaches.map((a) => ({
        ...a,
        alongStationFt: 100, // inside the 500-ft work zone
      })),
    };
    const rail = deriveRail(input(s));
    expect(rail.blocker?.entryId).toBe("extra");
    expect(rail.blocker?.message).toMatch(
      /can't be inside the work zone/,
    );
  });

  it("rank 4: the needs-confirmation hold", () => {
    const rail = deriveRail(
      input(pinned(DEFAULT_NEAR_INTERSECTION), {
        approachConfirm: { pending: true, reason: "suspect" },
      }),
    );
    expect(rail.blocker).toEqual({ message: HOLD_BLOCKER, entryId: "extra" });
  });

  it("rank 5: a refusal (short pointer line, never the 400 text)", () => {
    const rail = deriveRail(
      input(pinned(DEFAULT_SHOULDER), {
        refusal: { message: "full 400 text", pointer: null },
      }),
    );
    expect(rail.blocker).toEqual({ message: REFUSAL_BLOCKER, entryId: null });
  });

  it("rank 6: the in-flight re-check", () => {
    const rail = deriveRail(
      input(pinned(DEFAULT_SHOULDER), { refusalPending: true }),
    );
    expect(rail.blocker).toEqual({ message: RECHECK_BLOCKER, entryId: null });
  });

  it("rank 7 (last by design): the missing pin", () => {
    const rail = deriveRail(input(DEFAULT_SHOULDER));
    expect(rail.blocker).toEqual({
      message: LOCATION_BLOCKER,
      entryId: "location",
    });
  });
});

describe("entries — every simultaneous blocker visible (rule 10)", () => {
  it("the invisible-queue case: wz=0 on top of a pending hold shows BOTH", () => {
    const s: NearIntersectionScenario = {
      ...pinned(DEFAULT_NEAR_INTERSECTION),
      workLen: 0,
    };
    const rail = deriveRail(
      input(s, { approachConfirm: { pending: true, reason: "r" } }),
    );
    expect(rail.blocker?.message).toBe("Work zone length is required.");
    expect(entryById(rail, "work").issues).toEqual([
      { text: "Work zone length is required." },
    ]);
    expect(entryById(rail, "extra").issues).toEqual([{ text: HOLD_BLOCKER }]);
    expect(entryById(rail, "work").state).toBe("attention");
    expect(entryById(rail, "extra").state).toBe("attention");
  });

  it("the multi-dispute adversarial case: hold + NI refusal pointer + schedule unset, all distinct", () => {
    // Two signalized legs whose relayed lane tags dispute themselves —
    // the s2-arc6 adversarial shape.  The shell's refusal carries the
    // affordance pointer; the hold is pending on top.
    const s: NearIntersectionScenario = {
      ...pinned(DEFAULT_NEAR_INTERSECTION),
      approaches: [0, 1].map((i) => ({
        ...DEFAULT_NEAR_INTERSECTION.approaches[0],
        id: i === 0 ? "cross_a" : "cross_b",
        signalized: true,
        detectedLanesTotal: 5,
        detectedLanesForward: 2,
        detectedLanesBackward: 2,
      })),
    };
    const pointer =
      "The map's lane counts for the cross street contradict each other — confirm “Lane count is right” in the Cross street section to proceed.";
    const rail = deriveRail(
      input(s, {
        approachConfirm: { pending: true, reason: "suspect" },
        refusal: { message: "400 body", pointer },
      }),
    );
    const extra = entryById(rail, "extra");
    expect(extra.label).toBe("Cross street");
    // One ⚠ per unresolved hold: the confirm hold AND the refusal's
    // pointer render as separate issues — nothing queues invisibly.
    expect(extra.issues).toEqual([{ text: HOLD_BLOCKER }, { text: pointer }]);
    expect(extra.state).toBe("attention");
    // The hold outranks the refusal in the CTA chain.
    expect(rail.blocker).toEqual({ message: HOLD_BLOCKER, entryId: "extra" });
    // Schedule unset renders as the honest ◌, never silence, never ⚠.
    expect(entryById(rail, "schedule").state).toBe("notset");
    expect(entryById(rail, "schedule").issues).toEqual([]);
  });

  it("a shoulder refusal points at Road via the affordance mirror", () => {
    const s = {
      ...pinned(DEFAULT_SHOULDER),
      signalDistanceM: 20,
      detectedLanesTotal: 5,
      detectedLanesForward: 2,
      detectedLanesBackward: 2,
    } as Scenario;
    const pointer =
      "The map's lane counts contradict each other beside a signalized intersection — set Lanes per direction in the Road section to proceed.";
    const rail = deriveRail(input(s, { refusal: { message: "400", pointer } }));
    expect(entryById(rail, "road").issues).toEqual([{ text: pointer }]);
    expect(rail.blocker).toEqual({ message: REFUSAL_BLOCKER, entryId: "road" });
  });
});

describe("entry states — pending, notset, done", () => {
  it("pre-pin: Location carries the blocker; every downstream entry is pending", () => {
    const rail = deriveRail(input(DEFAULT_NEAR_INTERSECTION));
    expect(entryById(rail, "location").state).toBe("attention");
    for (const id of ["road", "work", "extra", "schedule"]) {
      expect(entryById(rail, id).state).toBe("pending");
      expect(entryById(rail, id).issues).toEqual([]);
    }
  });

  it("post-pin clean: done everywhere except the unset schedule's ◌", () => {
    const rail = deriveRail(input(pinned(DEFAULT_NEAR_INTERSECTION)));
    expect(entryById(rail, "location").state).toBe("done");
    expect(entryById(rail, "road").state).toBe("done");
    expect(entryById(rail, "work").state).toBe("done");
    expect(entryById(rail, "extra").state).toBe("done");
    expect(entryById(rail, "schedule").state).toBe("notset");
  });

  it("a set schedule flips ◌ to done", () => {
    const s: Scenario = {
      ...pinned(DEFAULT_SHOULDER),
      schedule: { date_mode: "single", work_date: "2026-09-01" },
    };
    expect(entryById(deriveRail(input(s)), "schedule").state).toBe("done");
  });

  it("an explicit 'Not set' choice stays ◌ (tbd is not a date)", () => {
    const s: Scenario = {
      ...pinned(DEFAULT_SHOULDER),
      schedule: { date_mode: "tbd" },
    };
    expect(entryById(deriveRail(input(s)), "schedule").state).toBe("notset");
  });

  it("the spine is kind-generic: shoulder has no fifth entry, flagger's is Flagger", () => {
    expect(
      deriveRail(input(pinned(DEFAULT_SHOULDER))).entries.map((e) => e.label),
    ).toEqual(["Location", "Road", "Work", "Schedule"]);
    expect(
      deriveRail(input(pinned(DEFAULT_FLAGGER))).entries.map((e) => e.label),
    ).toEqual(["Location", "Road", "Work", "Flagger", "Schedule"]);
  });
});
