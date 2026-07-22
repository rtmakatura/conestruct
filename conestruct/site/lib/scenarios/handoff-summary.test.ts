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

  it("emits NO roadType event for a divided/lanes-only handoff (deliberately not surfaced)", () => {
    // divided + lanes cross the seam but neither has a detect-then-override
    // path worth naming; only roadType does.  Locks that decision against a
    // future refactor manufacturing no-op noise.
    const events = summarizeHandoff({
      prior: DEFAULT_SHOULDER,
      classification: null,
      overrides: { divided: true, lanesPerDirection: 2 },
      final: { ...DEFAULT_SHOULDER, divided: true, lanes: 2 } as Scenario,
      delta: null,
    });
    expect(events).toEqual([]);
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
