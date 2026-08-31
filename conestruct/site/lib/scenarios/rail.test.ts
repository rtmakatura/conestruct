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
    pendingSuggestions: 0,
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

// ---------------------------------------------------------------------------
// #228 — the per-step vocabulary, derived here and nowhere else
// ---------------------------------------------------------------------------

// deriveRail reads only the staleness key off the confirmed road — the
// minimal cast keeps the fixture honest about that.
function confirmedRoadAt(pinLat: number, pinLng: number) {
  return { pinLat, pinLng } as NonNullable<
    Scenario["meta"]["confirmedRoad"]
  >;
}

describe("#228 vocabulary — fields on the derivation, purity", () => {
  it("derives deterministically: two calls on one input are deep-equal", () => {
    const i = input(pinned(DEFAULT_NEAR_INTERSECTION), {
      pendingSuggestions: 2,
    });
    expect(deriveRail(i)).toEqual(deriveRail(i));
  });

  it("step indexes mirror the FieldGroup tags: shoulder 2–5, flagger 2–6", () => {
    expect(
      deriveRail(input(pinned(DEFAULT_SHOULDER))).entries.map((e) => e.step),
    ).toEqual([2, 3, 4, 5]);
    expect(
      deriveRail(input(pinned(DEFAULT_FLAGGER))).entries.map((e) => e.step),
    ).toEqual([2, 3, 4, 5, 6]);
  });

  it("glyph + word per state; a plain done carries no word", () => {
    const pre = deriveRail(input(DEFAULT_SHOULDER));
    expect(entryById(pre, "location").glyph).toBe("⚠");
    expect(entryById(pre, "location").word).toBe("needs attention");
    expect(entryById(pre, "road").glyph).toBe("◌");
    expect(entryById(pre, "road").word).toBe("pending");
    const post = deriveRail(input(pinned(DEFAULT_SHOULDER)));
    expect(entryById(post, "location").glyph).toBe("✓");
    expect(entryById(post, "location").word).toBeNull();
    expect(entryById(post, "schedule").glyph).toBe("◌");
    expect(entryById(post, "schedule").word).toBe("optional · not set");
  });

  it("aria strings are the pre-arc component strings, byte-identical", () => {
    const pre = deriveRail(input(DEFAULT_SHOULDER));
    expect(entryById(pre, "location").aria).toBe(
      "Location — needs attention: Set a location first — pick on map or enter manually. (current blocker)",
    );
    expect(entryById(pre, "road").aria).toBe(
      "Road — pending — set a location first",
    );
    const post = deriveRail(input(pinned(DEFAULT_SHOULDER)));
    expect(entryById(post, "location").aria).toBe("Location — done");
    expect(entryById(post, "schedule").aria).toBe("Schedule — not set");
  });
});

describe("#228 stale — the flagged fourth state (PDF p.5)", () => {
  it("a confirmed road at a moved pin flips Road to stale ▲ / 'detection stale'", () => {
    const s = pinned(DEFAULT_SHOULDER);
    const stale = {
      ...s,
      meta: { ...s.meta, confirmedRoad: confirmedRoadAt(40.0, -105.0) },
    };
    const road = entryById(deriveRail(input(stale)), "road");
    expect(road.state).toBe("stale");
    expect(road.glyph).toBe("▲");
    expect(road.word).toBe("detection stale");
    expect(road.aria).toBe("Road — detection stale");
  });

  it("a fresh confirmed road stays done (the DetectedVsApplied key)", () => {
    const s = pinned(DEFAULT_SHOULDER);
    const fresh = {
      ...s,
      meta: { ...s.meta, confirmedRoad: confirmedRoadAt(39.7, -104.9) },
    };
    expect(entryById(deriveRail(input(fresh)), "road").state).toBe("done");
  });

  it("attention outranks stale", () => {
    const s = {
      ...pinned(DEFAULT_SHOULDER),
      lanes: 4,
      laneWidth: 14,
      meta: {
        ...pinned(DEFAULT_SHOULDER).meta,
        confirmedRoad: confirmedRoadAt(40.0, -105.0),
      },
    };
    expect(entryById(deriveRail(input(s)), "road").state).toBe("attention");
  });

  it("stale never gates: the blocker stays null", () => {
    const s = pinned(DEFAULT_SHOULDER);
    const stale = {
      ...s,
      meta: { ...s.meta, confirmedRoad: confirmedRoadAt(40.0, -105.0) },
    };
    expect(deriveRail(input(stale)).blocker).toBeNull();
  });

  it("pre-pin, pending outranks stale (nothing to be stale against)", () => {
    const s = {
      ...DEFAULT_SHOULDER,
      meta: {
        ...DEFAULT_SHOULDER.meta,
        confirmedRoad: confirmedRoadAt(40.0, -105.0),
      },
    };
    expect(entryById(deriveRail(input(s)), "road").state).toBe("pending");
  });
});

describe("#228 pending-suggestion count — informational only (ruling 1)", () => {
  it("2 pending proposals read '2 to confirm' on Location, 1 reads '1 to confirm'", () => {
    const two = deriveRail(
      input(pinned(DEFAULT_SHOULDER), { pendingSuggestions: 2 }),
    );
    expect(entryById(two, "location").info).toBe("2 to confirm");
    expect(entryById(two, "location").aria).toBe(
      "Location — done · 2 to confirm",
    );
    const one = deriveRail(
      input(pinned(DEFAULT_SHOULDER), { pendingSuggestions: 1 }),
    );
    expect(entryById(one, "location").info).toBe("1 to confirm");
  });

  it("zero pending: no info line, aria byte-identical to pre-arc", () => {
    const rail = deriveRail(input(pinned(DEFAULT_SHOULDER)));
    expect(entryById(rail, "location").info).toBeNull();
    expect(entryById(rail, "location").aria).toBe("Location — done");
  });

  it("the count never changes state or blocker (suggestions never gate)", () => {
    const rail = deriveRail(
      input(pinned(DEFAULT_SHOULDER), { pendingSuggestions: 2 }),
    );
    expect(entryById(rail, "location").state).toBe("done");
    expect(rail.blocker).toBeNull();
  });

  it("dismiss-honesty (PDF p.4 corollary): the count dropping to 0 removes the line and flips nothing to ✓ that wasn't", () => {
    const before = deriveRail(
      input(pinned(DEFAULT_SHOULDER), { pendingSuggestions: 1 }),
    );
    const after = deriveRail(
      input(pinned(DEFAULT_SHOULDER), { pendingSuggestions: 0 }),
    );
    expect(entryById(after, "location").info).toBeNull();
    // Every state and glyph is unchanged by the resolution — the count
    // is the ONLY thing that moved.
    expect(after.entries.map((e) => e.state)).toEqual(
      before.entries.map((e) => e.state),
    );
    expect(after.entries.map((e) => e.glyph)).toEqual(
      before.entries.map((e) => e.glyph),
    );
  });
});

describe("#228 duration — display-only date arithmetic (ruling 5)", () => {
  it("a range reads inclusive days ('4 days')", () => {
    const s: Scenario = {
      ...pinned(DEFAULT_SHOULDER),
      schedule: {
        date_mode: "range",
        work_date: "2026-09-01",
        work_date_end: "2026-09-04",
      },
    };
    const sched = entryById(deriveRail(input(s)), "schedule");
    expect(sched.state).toBe("done");
    expect(sched.info).toBe("4 days");
    expect(sched.aria).toBe("Schedule — done · 4 days");
  });

  it("a single date reads '1 day'", () => {
    const s: Scenario = {
      ...pinned(DEFAULT_SHOULDER),
      schedule: { date_mode: "single", work_date: "2026-09-01" },
    };
    expect(entryById(deriveRail(input(s)), "schedule").info).toBe("1 day");
  });

  it("tbd/unset: notset with no duration", () => {
    const s: Scenario = {
      ...pinned(DEFAULT_SHOULDER),
      schedule: { date_mode: "tbd" },
    };
    const sched = entryById(deriveRail(input(s)), "schedule");
    expect(sched.state).toBe("notset");
    expect(sched.info).toBeNull();
  });
});
