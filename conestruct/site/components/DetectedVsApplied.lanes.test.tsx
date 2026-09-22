// @vitest-environment happy-dom
//
// s2-arc30: #275's two words are CLAUSE words now, not cell words.  The
// contract is unchanged and the wording of the withdrawn case is
// sharpened: the word takes the detected VALUE's position
// (`OSM · withdrawn · operator-set`), never the token's, so the cleared
// relay's number is not printed beside it.  Spec 4.5's own example did
// print it; ruled against, 2026-09-11.

//
// #275 — the Detected lanes cell after the operator edits lanes.
//
// TWO mechanism corrections underpin these cases, both established from
// the code rather than assumed:
//
// 1. The block does NOT read the relay.  It reads
//    `classification.lanesPerDirection`; the backend gates read
//    `detectedLanesTotal`.  They are different numbers by different
//    arithmetic (classify.ts:78-90): the relay is the raw `lanes` tag,
//    while lanesPerDirection prefers `lanes:forward` and otherwise halves
//    and floors.  On a `lanes=4` two-way road the relay is 4 and the block
//    shows 2.  "The relays were cleared" and "the cell still shows an OSM
//    count" are two independent facts about two independent values, and no
//    clear path touches meta.confirmedRoad.classification.
//
// 2. The honest rendering is CONDITIONAL, and the condition is already in
//    the code.  ShoulderForm records a DetectionOverride marker only when
//    the erasure was DISPUTED (detected total === 1, or an arithmetic
//    mismatch); an ordinary edit clears the relays and records nothing
//    (#112 convention, pinned by its own test).  So:
//
//      disputed   → the marker rides the wire and the audit reprints the
//                   detected numbers, so the detection is a fact the
//                   operator OVERRODE → show both, marked.
//      undisputed → no relay, no marker, no audit item, nothing anywhere
//                   → the detection is WITHDRAWN → the cell says so.
//
//    Rule 10: never a blank, and never a cleared relay's value presented
//    as current.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario, DetectionOverride } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import {
  clauseIsAmber,
  deriveDetectedRows,
  type DetectedModel,
  type DetectedRowLabel,
} from "@/lib/road-detection/detected-rows";
import { provenanceClause } from "@/lib/road-detection/provenance";

afterEach(cleanup);

function road(): ConfirmedRoad {
  return {
    candidate: {
      way_id: "1042",
      highway_class: "secondary",
      name: "E Bayaud Ave",
      ref: null,
      bearing: 85,
      snap_distance_m: 4,
      snapped_lat: 39.71466,
      snapped_lng: -104.94071,
      tags: {
        oneway: null,
        maxspeed: "30 mph",
        lanes: "4",
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
        highway: "secondary",
        name: "E Bayaud Ave",
        ref: null,
      },
      geometry: [
        [-104.9409, 39.7146],
        [-104.9404, 39.7147],
      ],
    },
    classification: {
      roadType: "urban_arterial",
      divided: false,
      // the halved, floored per-direction figure — NOT the relay
      lanesPerDirection: 2,
      speedLimitMph: 30,
      laneWidthFt: 11,
      confidence: "high",
      rationale: "test",
      detectedLanesTotal: 4,
      detectedOneway: false,
      fields: {
        speed: { value: 30, confidence: "high", source: "maxspeed", method: "measured" },
        lanes: { value: 2, confidence: "medium", source: "lanes", method: "measured" },
        roadType: { value: "urban_arterial", confidence: "high", source: "highway", method: "measured" },
        divided: { value: false, confidence: "high", source: "highway", method: "measured" },
      },
    },
    method: "operator_pick",
    pinLat: 39.71466,
    pinLng: -104.94071,
  } as unknown as ConfirmedRoad;
}

function scenario(over: Partial<Scenario> = {}): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    lanes: 2,
    roadType: "urban_arterial",
    divided: false,
    // the relay as detection left it — the gates' number, the raw tag
    detectedLanesTotal: 4,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.71466,
      lng: -104.94071,
      bearingDeg: 85,
      confirmedRoad: road(),
    },
    ...over,
  } as Scenario;
}

const DISPUTED: DetectionOverride = {
  via: "shoulder_lane_edit",
  detectedLanesTotal: 1,
  asserted: "3 lanes per direction",
};

// ─── #289 Phase 2: the ledger retired as LAYOUT; its facts are here ───
//
// Ruling (d), 2026-09-22: "the #273 ledger's tests retire as layout and
// transfer as facts."  Every assertion below is unchanged — what changed
// is where it reads from.  `DetectedVsApplied` is gone (§8.23) and its
// derivation is `lib/road-detection/detected-rows.ts`, so the helpers
// that used to walk `.dva-row` walk the model instead.  The clause is
// still composed by `provenance.ts`, still the one producer, so a
// renamed token still fails these tests.
//
// The rendered half — that the clause reaches the screen, on the right
// cell, in the provenance role — is asserted in WhatBand.detection.test.tsx.
let MODEL: DetectedModel | null = null;
function mount(s: Scenario): void {
  MODEL = deriveDetectedRows(s);
}
function modelRow(label: string) {
  return MODEL?.rows.find((r) => r.label === label) ?? null;
}
function ledgerRow(label: string) {
  const row = modelRow(label);
  if (!row) throw new Error(`no row labelled "${label}"`);
  return row;
}
const lanesClause = () => clause("Lanes per direction");
const lanesApplied = () => ledgerRow("Lanes per direction").applied ?? "—";
function clause(label: string): string {
  const r = ledgerRow(label);
  return provenanceClause({
    detectedValue: r.detected,
    detectedToken: r.detectedToken,
    appliedToken: r.appliedToken,
  });
}

describe("#275 the detected lanes fact after a lanes edit", () => {
  it("detection standing: the clause reports the per-direction figure", () => {
    mount(scenario());
    expect(lanesClause()).toMatch(/OSM · 2 ·/);
    expect(lanesApplied()).toBe("2");
  });

  it("the clause reads the classification, not the relay (different numbers)", () => {
    // the relay says 4 (raw `lanes`); the block must say 2 (per direction)
    mount(scenario());
    expect(lanesClause()).not.toMatch(/4/);
  });

  it("UNDISPUTED edit — relays cleared, nothing recorded: the detection is withdrawn", () => {
    mount(scenario({ lanes: 3, detectedLanesTotal: undefined }));
    // never a blank (Rule 10) — the clause always speaks
    expect(lanesClause()).not.toBe("");
    expect(lanesClause()).toMatch(/withdrawn/i);
    // and never the cleared relay's value as current.  Ruled 2026-09-11
    // against spec 4.5's own example (`OSM · 2 · withdrawn`), which
    // printed exactly the number #275 refused: the word takes the
    // VALUE's position, so there is no number to misread.
    expect(lanesClause()).not.toMatch(/OSM · 2/);
    // the plan's own value still stands on line 1
    expect(lanesApplied()).toBe("3");
  });

  it("a withdrawn detection never reads as agreement", () => {
    mount(scenario({ lanes: 3, detectedLanesTotal: undefined }));
    expect(ledgerRow("Lanes per direction").verdict).not.toBe("match");
  });

  it("DISPUTED edit — the marker rides the wire and the audit reprints it: show both, marked", () => {
    mount(scenario({ lanes: 3, detectedLanesTotal: undefined, detectionOverrides: [DISPUTED], }));
    // both sides still readable: the detected figure stands in the clause...
    expect(lanesClause()).toMatch(/OSM · 2 ·/);
    expect(lanesApplied()).toBe("3");
    // ...and it is marked as an override rather than presented as current
    expect(lanesClause()).toMatch(/overridden/i);
    expect(lanesClause()).not.toMatch(/withdrawn/i);
  });

  it("a marker from another surface does not make a lanes edit look disputed", () => {
    mount(scenario({ lanes: 3, detectedLanesTotal: undefined, detectionOverrides: [ { via: "flagger_twoway_confirm", detectedOneway: "yes", asserted: "two-way" }, ], }));
    // that marker carries no lane relay, so the lanes erasure was undisputed
    expect(lanesClause()).toMatch(/withdrawn/i);
  });

  it("both #275 words are clause words now, and they wear the provenance role", () => {
    mount(scenario({ lanes: 3, detectedLanesTotal: undefined, detectionOverrides: [DISPUTED], }));
    // The clause is the producer's output, and the amber is the
    // producer's predicate — both travelled with the derivation.
    expect(lanesClause()).toMatch(/overridden/i);
    // a disputed or withdrawn detection is a guess-grade fact, so the
    // clause is ambered on the same rule as `inferred` (spec 5.4)
    expect(clauseIsAmber(ledgerRow("Lanes per direction"))).toBe(true);
  });

  it("the other rows are untouched by a lanes edit", () => {
    mount(scenario({ lanes: 3, detectedLanesTotal: undefined }));
    const road = ledgerRow("Road type");
    expect(road.applied).toMatch(/Urban arterial/);
    expect(clause("Road type")).not.toMatch(/withdrawn|overridden/i);
  });
});
