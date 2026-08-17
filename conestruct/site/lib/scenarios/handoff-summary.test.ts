// UX-01: summarizeHandoff names the speed transformations the form applies
// at the picker → form handoff (clamp to domain, 5-mph grid snap), so the
// LocationSummary can surface them instead of the value changing silently.
// Commit 3 (UX-02) adds the low-confidence skip/accept cases.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLAGGER,
  DEFAULT_MOBILE_OP_MULTILANE,
  DEFAULT_SHOULDER,
} from "./index";
import type { AutoApplyDelta } from "./auto-apply";
import type { RoadClassification } from "../road-detection/types";
import type { RoadType, Scenario } from "./types";
import {
  handoffEventIsCurrent,
  scenarioNoun,
  scenarioTa,
  summarizeHandoff,
} from "./handoff-summary";

// Minimal high-confidence OSM classification carrying a parsed maxspeed.
function osmClassification(speedLimitMph: number): RoadClassification {
  return {
    roadType: "rural_undivided",
    divided: false,
    laneWidthFt: 12,
    lanesPerDirection: 1,
    speedLimitMph,
    confidence: "medium",
    source: "osm-tags",
    raw: {
      class: "secondary",
      oneway: false,
      roadName: null,
      roadRef: null,
      placeName: null,
      osmLanesTag: null,
      osmMaxspeedTag: `${speedLimitMph} mph`,
    },
    fields: {
      speed: {
        value: speedLimitMph,
        confidence: "high",
        source: "OSM maxspeed tag",
        method: "measured",
        rawData: `maxspeed=${speedLimitMph} mph`,
      },
      lanes: { value: 1, confidence: "low", source: "fallback", method: "inferred" },
      roadType: { value: "rural_undivided", confidence: "low", source: "x", method: "inferred" },
      divided: { value: false, confidence: "low", source: "x", method: "inferred" },
    },
  };
}

// No OSM maxspeed → speedLimitMph undefined, the speed field carries the
// low-confidence highway-class fallback (UX-02's tertiary-road case).
function fallbackClassification(fallbackMph: number): RoadClassification {
  return {
    roadType: "rural_undivided",
    divided: false,
    laneWidthFt: 12,
    confidence: "low",
    source: "osm-tags",
    raw: {
      class: "tertiary",
      oneway: false,
      roadName: null,
      roadRef: null,
      placeName: null,
      osmLanesTag: null,
      osmMaxspeedTag: null,
    },
    fields: {
      speed: {
        value: fallbackMph,
        confidence: "low",
        source: 'highway-class fallback ("tertiary")',
        method: "inferred",
        rawData: "class=tertiary",
      },
      lanes: { value: 1, confidence: "low", source: "fallback", method: "inferred" },
      roadType: { value: "rural_undivided", confidence: "low", source: "x", method: "inferred" },
      divided: { value: false, confidence: "low", source: "x", method: "inferred" },
    },
  };
}

// #62: a classification carrying a chosen roadType but NO maxspeed, so the
// speed path stays silent and the roadType assertions stand alone.
function roadTypeClassification(roadType: RoadType): RoadClassification {
  return {
    roadType,
    divided: false,
    laneWidthFt: 12,
    confidence: "high",
    source: "osm-tags",
    raw: {
      class: "motorway",
      oneway: false,
      roadName: null,
      roadRef: null,
      placeName: null,
      osmLanesTag: null,
      osmMaxspeedTag: null,
    },
    fields: {
      speed: { value: null, confidence: "high", source: "none", method: "measured" },
      lanes: { value: null, confidence: "low", source: "fallback", method: "inferred" },
      roadType: { value: roadType, confidence: "high", source: "OSM highway tag", method: "measured" },
      divided: { value: false, confidence: "high", source: "OSM oneway tag", method: "measured" },
    },
  };
}

const DELTA: AutoApplyDelta = {
  roadTypeApplied: true,
  roadTypeApplicable: true,
  dividedApplied: false,
  dividedApplicable: false,
  laneWidthApplied: true,
  laneWidthApplicable: true,
  speedApplied: true,
  speedApplicable: true,
  lanesApplied: false,
  lanesApplicable: false,
};

describe("summarizeHandoff — speed clamp/snap (UX-01)", () => {
  it("emits a clamped event when an OSM 65 mph is capped to the flagger 55 domain", () => {
    const final = { ...DEFAULT_FLAGGER, speed: 55 } as Scenario;
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: osmClassification(65),
      overrides: {},
      final,
      delta: DELTA,
    });
    expect(events).toEqual([
      { field: "speed", kind: "clamped", fromMph: 65, toMph: 55, source: "osm" },
    ]);
  });

  it("tags a manual override as the clamp source (source: manual)", () => {
    const final = { ...DEFAULT_FLAGGER, speed: 55 } as Scenario;
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: null,
      overrides: { speedMph: 70 },
      final,
      delta: null,
    });
    expect(events).toEqual([
      { field: "speed", kind: "clamped", fromMph: 70, toMph: 55, source: "manual" },
    ]);
  });

  it("emits a snapped (not clamped) event for an in-domain off-grid value (62 → 60)", () => {
    const final = { ...DEFAULT_SHOULDER, speed: 60 } as Scenario;
    const events = summarizeHandoff({
      prior: DEFAULT_SHOULDER,
      // roadType matches the scenario so only the speed event fires (#62).
      classification: { ...osmClassification(62), roadType: "rural_divided" },
      overrides: {},
      final,
      delta: DELTA,
    });
    expect(events).toEqual([
      { field: "speed", kind: "snapped", fromMph: 62, toMph: 60, source: "osm" },
    ]);
  });

  it("emits nothing when the detected speed is already in-domain and on-grid", () => {
    const final = { ...DEFAULT_SHOULDER, speed: 65 } as Scenario;
    const events = summarizeHandoff({
      prior: DEFAULT_SHOULDER,
      // roadType matches the scenario so only the speed result is asserted (#62).
      classification: { ...osmClassification(65), roadType: "rural_divided" },
      overrides: {},
      final,
      delta: DELTA,
    });
    expect(events).toEqual([]);
  });

  it("emits nothing when no speed crossed the seam (no override, no OSM speed)", () => {
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: null,
      // a roadType override that's already the prior value → a no-op, so the
      // result stays empty and the test isolates the no-speed case (#62).
      overrides: { roadType: "rural_undivided" },
      final: DEFAULT_FLAGGER,
      delta: null,
    });
    expect(events).toEqual([]);
  });
});

describe("summarizeHandoff — low-confidence skip/accept (UX-02)", () => {
  const SKIP_DELTA: AutoApplyDelta = { ...DELTA, speedApplied: false };

  it("emits skipped_low_confidence when a fallback was shown but never applied", () => {
    // No override, no OSM speed → form keeps the prior 45; the 35 fallback
    // the operator saw in the picker evaporates.
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: fallbackClassification(35),
      overrides: {},
      final: DEFAULT_FLAGGER, // speed unchanged at 45
      delta: SKIP_DELTA,
    });
    expect(events).toEqual([
      {
        field: "speed",
        kind: "skipped_low_confidence",
        detectedMph: 35,
        inEffectMph: 45,
        sourceLabel: 'highway-class fallback ("tertiary")',
      },
    ]);
  });

  it("emits accepted_low_confidence when the operator opts in via click-to-accept", () => {
    // Click-to-accept writes the fallback as an override → it applies.
    const final = { ...DEFAULT_FLAGGER, speed: 35 } as Scenario;
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: fallbackClassification(35),
      overrides: { speedMph: 35 },
      final,
      delta: SKIP_DELTA,
    });
    expect(events).toEqual([
      {
        field: "speed",
        kind: "accepted_low_confidence",
        valueMph: 35,
        sourceLabel: 'highway-class fallback ("tertiary")',
      },
    ]);
  });

  it("an accepted fallback that is out of domain reports the clamp, not the accept", () => {
    // 35 mph fallback accepted on a multilane scenario (domain [45, 75])
    // → clamped up to 45; the clamp is the louder signal.
    const final = { ...DEFAULT_MOBILE_OP_MULTILANE, speed: 45 } as Scenario;
    const events = summarizeHandoff({
      prior: DEFAULT_MOBILE_OP_MULTILANE,
      // roadType matches the scenario so only the speed clamp is asserted (#62).
      classification: { ...fallbackClassification(35), roadType: "freeway" },
      overrides: { speedMph: 35 },
      final,
      delta: SKIP_DELTA,
    });
    expect(events).toEqual([
      { field: "speed", kind: "clamped", fromMph: 35, toMph: 45, source: "manual" },
    ]);
  });
});

describe("handoffEventIsCurrent — self-hide on manual edit", () => {
  const clamp = {
    field: "speed",
    kind: "clamped",
    fromMph: 65,
    toMph: 55,
    source: "osm",
  } as const;

  it("is current while the scenario still holds the post-handoff value", () => {
    const sc = { ...DEFAULT_FLAGGER, speed: 55 } as Scenario;
    expect(handoffEventIsCurrent(clamp, sc)).toBe(true);
  });

  it("self-hides once the operator edits the speed away from the clamped value", () => {
    const sc = { ...DEFAULT_FLAGGER, speed: 45 } as Scenario;
    expect(handoffEventIsCurrent(clamp, sc)).toBe(false);
  });
});

describe("summarizeHandoff — roadType applied/skipped (#62)", () => {
  it("emits skipped_not_in_domain when a detected freeway is dropped on a flagger plan", () => {
    // DEFAULT_FLAGGER carries rural_undivided; freeway isn't in FLAGGER_TYPES,
    // so applyClassification keeps the prior value — name the silent drop.
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: roadTypeClassification("freeway"),
      overrides: {},
      final: DEFAULT_FLAGGER, // roadType unchanged at rural_undivided
      delta: null,
    });
    expect(events).toEqual([
      {
        field: "roadType",
        kind: "skipped_not_in_domain",
        detected: "freeway",
        inEffect: "rural_undivided",
        source: "osm",
      },
    ]);
  });

  it("tags a manual roadType override drop as source: manual", () => {
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: null,
      overrides: { roadType: "freeway" },
      final: DEFAULT_FLAGGER, // freeway not in FLAGGER_TYPES → kept rural_undivided
      delta: null,
    });
    expect(events).toEqual([
      {
        field: "roadType",
        kind: "skipped_not_in_domain",
        detected: "freeway",
        inEffect: "rural_undivided",
        source: "manual",
      },
    ]);
  });

  it("emits applied when an allowed roadType changes prior → final", () => {
    // Shoulder accepts the full union; freeway lands and changes the prior
    // rural_divided.
    const final = { ...DEFAULT_SHOULDER, roadType: "freeway" } as Scenario;
    const events = summarizeHandoff({
      prior: DEFAULT_SHOULDER,
      classification: roadTypeClassification("freeway"),
      overrides: {},
      final,
      delta: null,
    });
    expect(events).toEqual([
      {
        field: "roadType",
        kind: "applied",
        from: "rural_divided",
        to: "freeway",
        source: "osm",
      },
    ]);
  });

  it("stays silent when the detected roadType equals prior and final (no change)", () => {
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: roadTypeClassification("rural_undivided"),
      overrides: {},
      final: DEFAULT_FLAGGER,
      delta: null,
    });
    expect(events).toEqual([]);
  });

  it("shoulder accepts everything: applied on change, silent on no-change, never skipped", () => {
    const changedFinal = { ...DEFAULT_SHOULDER, roadType: "freeway" } as Scenario;
    const changed = summarizeHandoff({
      prior: DEFAULT_SHOULDER,
      classification: null,
      overrides: { roadType: "freeway" },
      final: changedFinal,
      delta: null,
    });
    expect(changed).toEqual([
      {
        field: "roadType",
        kind: "applied",
        from: "rural_divided",
        to: "freeway",
        source: "manual",
      },
    ]);

    const unchanged = summarizeHandoff({
      prior: DEFAULT_SHOULDER,
      classification: null,
      overrides: { roadType: "rural_divided" }, // already the prior value
      final: DEFAULT_SHOULDER,
      delta: null,
    });
    expect(unchanged).toEqual([]);
  });

  // Formerly the a61f5f3 negative guard ("divided/lanes have no
  // detect-then-override path worth naming").  #198 disproved that claim
  // — the changed-detection clobber and the non-shoulder drop are
  // exactly such paths — so the lock-the-silence purpose is retired and
  // the fixture flips positive below (#198 families).  What survives of
  // the old intent: an UNCHANGED landing stays silent, same as speed and
  // roadType.
  it("stays silent when divided/lanes land unchanged (no no-op noise)", () => {
    const events = summarizeHandoff({
      prior: DEFAULT_SHOULDER, // already lanes: 2, divided: true
      classification: null,
      overrides: { divided: true, lanesPerDirection: 2 },
      final: { ...DEFAULT_SHOULDER, divided: true, lanes: 2 } as Scenario,
      delta: null,
    });
    expect(events).toEqual([]);
  });

  it("names divided/lanes overrides that land AND change the prior value (#198 family 1)", () => {
    const events = summarizeHandoff({
      prior: { ...DEFAULT_SHOULDER, lanes: 3, divided: false } as Scenario,
      classification: null,
      overrides: { divided: true, lanesPerDirection: 2 },
      final: { ...DEFAULT_SHOULDER, divided: true, lanes: 2 } as Scenario,
      delta: null,
    });
    expect(events).toContainEqual({
      field: "lanes",
      kind: "applied",
      from: 3,
      to: 2,
      source: "manual",
    });
    expect(events).toContainEqual({
      field: "divided",
      kind: "applied",
      from: false,
      to: true,
      source: "manual",
    });
  });
});

describe("summarizeHandoff — #198 families (lanes/divided/laneWidth/workZoneSpeed)", () => {
  it("family 1: a changed detection that clobbers lanes/divided/laneWidth is named per field", () => {
    const c = {
      ...osmClassification(35),
      lanesPerDirection: 2,
      divided: false,
      laneWidthFt: 12,
    } as RoadClassification;
    const prior = {
      ...DEFAULT_SHOULDER,
      lanes: 3,
      divided: true,
      laneWidth: 11,
      speed: 45,
    } as Scenario;
    // What applyClassification produces for this input.
    const final = {
      ...prior,
      roadType: "rural_undivided",
      lanes: 2,
      divided: false,
      laneWidth: 12,
      speed: 35,
    } as Scenario;
    const events = summarizeHandoff({
      prior,
      classification: c,
      overrides: {},
      final,
      delta: null,
    });
    expect(events).toContainEqual({
      field: "lanes",
      kind: "applied",
      from: 3,
      to: 2,
      source: "osm",
    });
    expect(events).toContainEqual({
      field: "divided",
      kind: "applied",
      from: true,
      to: false,
      source: "osm",
    });
    expect(events).toContainEqual({
      field: "laneWidth",
      kind: "applied",
      fromFt: 11,
      toFt: 12,
    });
  });

  it("family 2: picker lanes/divided overrides on a non-shoulder kind are named as not applicable", () => {
    const events = summarizeHandoff({
      prior: DEFAULT_FLAGGER,
      classification: null,
      overrides: { lanesPerDirection: 2, divided: true },
      final: DEFAULT_FLAGGER,
      delta: null,
    });
    expect(events).toContainEqual({
      field: "lanes",
      kind: "skipped_not_applicable",
      value: 2,
    });
    expect(events).toContainEqual({
      field: "divided",
      kind: "skipped_not_applicable",
      value: true,
    });
  });

  it("family 3: an out-of-domain lane count is named as clamped, not applied (precedence)", () => {
    const events = summarizeHandoff({
      prior: DEFAULT_SHOULDER,
      classification: null,
      overrides: { lanesPerDirection: 6 },
      final: { ...DEFAULT_SHOULDER, lanes: 4 } as Scenario,
      delta: null,
    });
    expect(events).toEqual([
      { field: "lanes", kind: "clamped", from: 6, to: 4, source: "manual" },
    ]);
  });

  it("family 3: detection-side clamp carries the osm source", () => {
    const c = {
      ...osmClassification(35),
      lanesPerDirection: 5,
    } as RoadClassification;
    const events = summarizeHandoff({
      prior: { ...DEFAULT_SHOULDER, speed: 35, laneWidth: 12 } as Scenario,
      classification: c,
      overrides: {},
      final: { ...DEFAULT_SHOULDER, speed: 35, lanes: 4, divided: false, roadType: "rural_undivided" } as Scenario,
      delta: null,
    });
    expect(events).toContainEqual({
      field: "lanes",
      kind: "clamped",
      from: 5,
      to: 4,
      source: "osm",
    });
  });

  it("family 4: a reduction dropped by a lowered posted speed is named as cleared", () => {
    const prior = {
      ...DEFAULT_SHOULDER,
      speed: 55,
      workZoneSpeed: 45,
    } as Scenario;
    const final = {
      ...DEFAULT_SHOULDER,
      speed: 35,
      workZoneSpeed: undefined,
      roadType: "rural_undivided",
      divided: false,
      lanes: 1,
      laneWidth: 12,
    } as Scenario;
    const events = summarizeHandoff({
      prior,
      classification: osmClassification(35),
      overrides: {},
      final,
      delta: null,
    });
    expect(events).toContainEqual({
      field: "workZoneSpeed",
      kind: "cleared",
      wasMph: 45,
      postedMph: 35,
    });
  });

  it("family 4: no cleared event when the handoff didn't write speed", () => {
    const prior = {
      ...DEFAULT_SHOULDER,
      speed: 55,
      workZoneSpeed: undefined,
    } as Scenario;
    const events = summarizeHandoff({
      prior,
      classification: null,
      overrides: { roadType: "urban_arterial" as RoadType },
      final: { ...prior, roadType: "urban_arterial" } as Scenario,
      delta: null,
    });
    expect(events.some((e) => e.field === "workZoneSpeed")).toBe(false);
  });
});

describe("handoffEventIsCurrent — #198 members self-hide", () => {
  it("lanes applied/clamped: current while lanes holds, hides once edited away", () => {
    const applied = { field: "lanes", kind: "applied", from: 3, to: 2, source: "osm" } as const;
    expect(handoffEventIsCurrent(applied, { ...DEFAULT_SHOULDER, lanes: 2 } as Scenario)).toBe(true);
    expect(handoffEventIsCurrent(applied, { ...DEFAULT_SHOULDER, lanes: 3 } as Scenario)).toBe(false);
    const clamped = { field: "lanes", kind: "clamped", from: 6, to: 4, source: "manual" } as const;
    expect(handoffEventIsCurrent(clamped, { ...DEFAULT_SHOULDER, lanes: 4 } as Scenario)).toBe(true);
    expect(handoffEventIsCurrent(clamped, { ...DEFAULT_SHOULDER, lanes: 3 } as Scenario)).toBe(false);
  });

  it("divided applied: tracks the divided toggle", () => {
    const ev = { field: "divided", kind: "applied", from: true, to: false, source: "osm" } as const;
    expect(handoffEventIsCurrent(ev, { ...DEFAULT_SHOULDER, divided: false } as Scenario)).toBe(true);
    expect(handoffEventIsCurrent(ev, { ...DEFAULT_SHOULDER, divided: true } as Scenario)).toBe(false);
  });

  it("laneWidth applied: tracks the width field", () => {
    const ev = { field: "laneWidth", kind: "applied", fromFt: 11, toFt: 12 } as const;
    expect(handoffEventIsCurrent(ev, { ...DEFAULT_SHOULDER, laneWidth: 12 } as Scenario)).toBe(true);
    expect(handoffEventIsCurrent(ev, { ...DEFAULT_SHOULDER, laneWidth: 11 } as Scenario)).toBe(false);
  });

  it("skipped_not_applicable: current off-shoulder, stale after a switch to shoulder", () => {
    const ev = { field: "lanes", kind: "skipped_not_applicable", value: 2 } as const;
    expect(handoffEventIsCurrent(ev, DEFAULT_FLAGGER)).toBe(true);
    expect(handoffEventIsCurrent(ev, DEFAULT_SHOULDER)).toBe(false);
  });

  it("workZoneSpeed cleared: current while no reduction and the noted posted speed stand", () => {
    const ev = { field: "workZoneSpeed", kind: "cleared", wasMph: 45, postedMph: 35 } as const;
    expect(
      handoffEventIsCurrent(ev, { ...DEFAULT_SHOULDER, speed: 35, workZoneSpeed: undefined } as Scenario),
    ).toBe(true);
    expect(
      handoffEventIsCurrent(ev, { ...DEFAULT_SHOULDER, speed: 35, workZoneSpeed: 25 } as Scenario),
    ).toBe(false);
    expect(
      handoffEventIsCurrent(ev, { ...DEFAULT_SHOULDER, speed: 45, workZoneSpeed: undefined } as Scenario),
    ).toBe(false);
  });
});

describe("handoffEventIsCurrent — roadType self-hide (#62)", () => {
  const applied = {
    field: "roadType",
    kind: "applied",
    from: "rural_divided",
    to: "freeway",
    source: "osm",
  } as const;
  const skipped = {
    field: "roadType",
    kind: "skipped_not_in_domain",
    detected: "freeway",
    inEffect: "rural_undivided",
    source: "osm",
  } as const;

  it("applied: current while the scenario holds the applied roadType, hides once edited away", () => {
    expect(
      handoffEventIsCurrent(applied, { ...DEFAULT_SHOULDER, roadType: "freeway" } as Scenario),
    ).toBe(true);
    expect(
      handoffEventIsCurrent(applied, { ...DEFAULT_SHOULDER, roadType: "rural_divided" } as Scenario),
    ).toBe(false);
  });

  it("skipped_not_in_domain: current while the kept value stands, hides once edited away", () => {
    expect(handoffEventIsCurrent(skipped, DEFAULT_FLAGGER)).toBe(true);
    expect(
      handoffEventIsCurrent(skipped, { ...DEFAULT_FLAGGER, roadType: "urban_arterial" } as Scenario),
    ).toBe(false);
  });
});

describe("scenario vocabulary helpers", () => {
  it("maps kinds to their TA labels", () => {
    expect(scenarioTa("flagger_lane_closure")).toBe("TA-10");
    // Family label (Refs #100): pre-generation surface, so the shoulder
    // label covers both road-type variants (TA-3 general, TA-5 freeway).
    expect(scenarioTa("shoulder")).toBe("TA-3/TA-5");
  });

  it("maps kinds to plain-language nouns", () => {
    expect(scenarioNoun("flagger_lane_closure")).toBe("flagger");
    expect(scenarioNoun("shoulder")).toBe("shoulder");
  });
});
