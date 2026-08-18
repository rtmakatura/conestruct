// @vitest-environment happy-dom
//
// #173 frontend half, asserted on the MOUNTED forms with real state
// (rule 11 — the seam the gate's recovery lives at):
//
//   * the flagger's new "Lane count is right" confirm row arms exactly
//     in the gate-refused state (mismatch AND signal within 30 m),
//     clears the four lane relays on tick (the signal fact STAYS — it
//     is true regardless and alone never blocks), records the
//     flagger_lane_count_confirm marker, and untick restores
//     byte-identically (#179);
//   * the shoulder's recovery is the existing lane edit: it clears the
//     relays while leaving signalDistanceM in place;
//   * the mirror (matchRefusalAffordance) names both new gates in
//     backend order, and the relay path (classifyFromCandidate →
//     applyClassificationToScenario) carries the fact onto both kinds.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type {
  FlaggerLaneClosureScenario,
  ShoulderScenario,
} from "@/lib/scenarios/types";
import {
  applyClassification,
  matchRefusalAffordance,
  signalProximityLaneConfidence,
} from "@/lib/scenarios/auto-apply";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import type { RoadCandidate } from "@/lib/road-detection/types";
import { FlaggerForm } from "./FlaggerForm";
import { ShoulderForm } from "./ShoulderForm";

afterEach(cleanup);

const MISMATCH = {
  detectedLanesTotal: 2,
  detectedLanesForward: 1,
  detectedLanesBackward: 2,
} as const;

// The live Colfax/Williams capture (s2-arc2 evidence): 26.84 m.
const NEAR_SIGNAL = { signalDistanceM: 26.84 } as const;

function FlaggerHarness({ initial }: { initial: FlaggerLaneClosureScenario }) {
  const [s, setS] = useState<FlaggerLaneClosureScenario>(initial);
  return (
    <>
      <FlaggerForm scenario={s} setScenario={setS} />
      <output data-testid="payload">{JSON.stringify(s)}</output>
    </>
  );
}

function ShoulderHarness({ initial }: { initial: ShoulderScenario }) {
  const [s, setS] = useState<ShoulderScenario>(initial);
  return (
    <>
      <ShoulderForm scenario={s} setScenario={setS} />
      <output data-testid="payload">{JSON.stringify(s)}</output>
    </>
  );
}

const payload = () => screen.getByTestId("payload").textContent!;
const ROW = /Lane count is right/;

describe("#173 flagger confirm row", () => {
  it("arms only in the gate-refused state (mismatch AND near signal)", () => {
    const { unmount } = render(
      <FlaggerHarness initial={{ ...DEFAULT_FLAGGER, ...MISMATCH }} />,
    );
    expect(screen.queryByRole("checkbox", { name: ROW })).toBeNull();
    unmount();

    const second = render(
      <FlaggerHarness initial={{ ...DEFAULT_FLAGGER, ...NEAR_SIGNAL }} />,
    );
    expect(screen.queryByRole("checkbox", { name: ROW })).toBeNull();
    second.unmount();

    render(
      <FlaggerHarness
        initial={{ ...DEFAULT_FLAGGER, ...MISMATCH, ...NEAR_SIGNAL }}
      />,
    );
    expect(screen.getByRole("checkbox", { name: ROW })).toBeTruthy();
  });

  it("tick clears the lane relays, keeps the signal fact, records the marker; untick restores byte-identically", () => {
    render(
      <FlaggerHarness
        initial={{ ...DEFAULT_FLAGGER, ...MISMATCH, ...NEAR_SIGNAL }}
      />,
    );
    const preTick = payload();
    const el = screen.getByRole("checkbox", { name: ROW }) as HTMLButtonElement;

    fireEvent.click(el);
    const ticked = JSON.parse(payload()) as FlaggerLaneClosureScenario;
    expect(ticked.detectedLanesTotal).toBeUndefined();
    expect(ticked.detectedLanesForward).toBeUndefined();
    expect(ticked.detectedLanesBackward).toBeUndefined();
    expect(ticked.signalDistanceM).toBe(26.84); // the fact stays
    expect(ticked.detectionOverrides?.[0]).toMatchObject({
      via: "flagger_lane_count_confirm",
      detectedLanesTotal: 2,
      detectedLanesForward: 1,
      detectedLanesBackward: 2,
      asserted: "lane count is right",
    });
    // Cleared relays no longer refuse — the mirror agrees.
    expect(matchRefusalAffordance(ticked)).toBeNull();
    // The row stays mounted, checked, describing what it overrode.
    expect(el.getAttribute("aria-checked")).toBe("true");
    expect(el.textContent).toMatch(/untick to restore detection/);

    fireEvent.click(el);
    expect(payload()).toBe(preTick); // byte-identical restore (#179)
  });
});

describe("#173 shoulder recovery — the lane edit", () => {
  it("editing lanes clears the relays (lifting the gate) and leaves the signal fact", () => {
    render(
      <ShoulderHarness
        initial={{ ...DEFAULT_SHOULDER, ...MISMATCH, ...NEAR_SIGNAL }}
      />,
    );
    const before = JSON.parse(payload()) as ShoulderScenario;
    expect(matchRefusalAffordance(before)?.code).toBe(
      "shoulder_lane_confidence",
    );

    fireEvent.click(screen.getByRole("button", { name: "3" }));
    const after = JSON.parse(payload()) as ShoulderScenario;
    expect(after.lanes).toBe(3);
    expect(after.detectedLanesTotal).toBeUndefined();
    expect(after.detectedLanesForward).toBeUndefined();
    expect(after.signalDistanceM).toBe(26.84);
    expect(after.detectionOverrides?.[0]?.via).toBe("shoulder_lane_edit");
    expect(matchRefusalAffordance(after)).toBeNull();
  });
});

describe("#173 mirror — matchRefusalAffordance", () => {
  it("shoulder: names the signal gate only when both facts hold", () => {
    const armed = { ...DEFAULT_SHOULDER, ...MISMATCH, ...NEAR_SIGNAL };
    expect(matchRefusalAffordance(armed)?.code).toBe(
      "shoulder_lane_confidence",
    );
    expect(matchRefusalAffordance(armed)?.pointer).toMatch(
      /set Lanes per direction in the Road section/,
    );
    expect(
      matchRefusalAffordance({ ...DEFAULT_SHOULDER, ...MISMATCH }),
    ).toBeNull();
    expect(
      matchRefusalAffordance({ ...DEFAULT_SHOULDER, ...NEAR_SIGNAL }),
    ).toBeNull();
  });

  it("mirrors the backend's inclusive 30.0 m boundary", () => {
    expect(
      signalProximityLaneConfidence({ ...MISMATCH, signalDistanceM: 30.0 }),
    ).toBe(true);
    expect(
      signalProximityLaneConfidence({ ...MISMATCH, signalDistanceM: 30.01 }),
    ).toBe(false);
  });

  it("flagger: earlier gates win, matching the backend order", () => {
    // one-way (#158) fires before lane-confidence (#173) at the backend
    // chokepoint; the mirror names the gate that actually refused.
    const both = {
      ...DEFAULT_FLAGGER,
      ...MISMATCH,
      ...NEAR_SIGNAL,
      oneway: "yes",
    };
    expect(matchRefusalAffordance(both)?.code).toBe("flagger_oneway");
    const laneOnly = { ...DEFAULT_FLAGGER, ...MISMATCH, ...NEAR_SIGNAL };
    expect(matchRefusalAffordance(laneOnly)?.code).toBe(
      "flagger_lane_confidence",
    );
    expect(matchRefusalAffordance(laneOnly)?.pointer).toMatch(
      /confirm “Lane count is right” in the Road section/,
    );
  });
});

describe("#173 relay path — candidate → classification → scenario", () => {
  // The Colfax/Williams live shape, reduced to what the path consumes.
  const CANDIDATE: RoadCandidate = {
    way_id: "1",
    highway_class: "primary",
    name: "East Colfax Avenue",
    ref: null,
    bearing: 90,
    snap_distance_m: 0.77,
    snapped_lat: 39.73997,
    snapped_lng: -104.96632,
    tags: {
      oneway: null,
      maxspeed: "35 mph",
      lanes: "2",
      lanes_forward: "1",
      lanes_backward: "2",
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: 26.84,
    geometry: [
      [39.73997, -104.96632],
      [39.73997, -104.965],
    ],
  };

  it("signal_distance_m rides the classification and both kinds' payloads", () => {
    const c = classifyFromCandidate(CANDIDATE, true, "Denver");
    expect(c.signalDistanceM).toBe(26.84);

    const shoulder = applyClassification(DEFAULT_SHOULDER, c).scenario;
    expect(
      (shoulder as ShoulderScenario).signalDistanceM,
    ).toBe(26.84);

    const flagger = applyClassification(DEFAULT_FLAGGER, c).scenario;
    expect(
      (flagger as FlaggerLaneClosureScenario).signalDistanceM,
    ).toBe(26.84);
  });

  it("a signal-free candidate relays nothing (omitted, never false-blocks)", () => {
    const c = classifyFromCandidate(
      { ...CANDIDATE, signal_distance_m: null },
      true,
      "Denver",
    );
    expect(c.signalDistanceM).toBeUndefined();
    const shoulder = applyClassification(DEFAULT_SHOULDER, c).scenario;
    expect((shoulder as ShoulderScenario).signalDistanceM).toBeUndefined();
  });
});
