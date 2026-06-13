// UX-01: summarizeHandoff names the speed transformations the form applies
// at the picker → form handoff (clamp to domain, 5-mph grid snap), so the
// LocationSummary can surface them instead of the value changing silently.
// Commit 3 (UX-02) adds the low-confidence skip/accept cases.

import { describe, expect, it } from "vitest";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "./index";
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
