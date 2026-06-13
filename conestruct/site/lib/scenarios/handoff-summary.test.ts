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
import type { Scenario } from "./types";
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
        rawData: `maxspeed=${speedLimitMph} mph`,
      },
      lanes: { value: 1, confidence: "low", source: "fallback" },
      roadType: { value: "rural_undivided", confidence: "low", source: "x" },
      divided: { value: false, confidence: "low", source: "x" },
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
        rawData: "class=tertiary",
      },
      lanes: { value: 1, confidence: "low", source: "fallback" },
      roadType: { value: "rural_undivided", confidence: "low", source: "x" },
      divided: { value: false, confidence: "low", source: "x" },
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
      classification: osmClassification(62),
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
      classification: osmClassification(65),
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
      overrides: { roadType: "urban_arterial" },
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
      classification: fallbackClassification(35),
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

describe("scenario vocabulary helpers", () => {
  it("maps kinds to their TA labels", () => {
    expect(scenarioTa("flagger_lane_closure")).toBe("TA-10");
    expect(scenarioTa("shoulder")).toBe("TA-2");
  });

  it("maps kinds to plain-language nouns", () => {
    expect(scenarioNoun("flagger_lane_closure")).toBe("flagger");
    expect(scenarioNoun("shoulder")).toBe("shoulder");
  });
});
