// @vitest-environment happy-dom
//
// #278 — the one-way fact, which the two-column table had nowhere to put
// and the arc-30 ledger does.  Folded into #273's rebuild rather than
// filed for later: spec 6.1 lists One-way in the row set, and the row is
// the whole of the issue.
//
// The fact exists on the flagger kind ONLY, and that is the data's shape
// rather than a scoping choice.  Every other kind folds one-way into
// `divided` / `roadType` and carries no field for it; the raw tag is
// relayed for the flagger directionality gate alone (auto-apply.ts:492,
// the #158 refusal).  On a kind with a detected fact and no applied
// counterpart, Rule 10 says render no row — do not invent a side to
// compare against.
//
// The detected side reads `candidate.tags.oneway`, not the relay.  The
// relay is cleared the moment the operator confirms two-way traffic
// (FlaggerForm.tsx:275), while the candidate's tag survives the confirm
// and is the same evidence the backend gate read — so the block can
// still say what detection saw after the operator has overruled it,
// which is the entire point of the surface.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import {
  clauseIsAmber,
  deriveDetectedRows,
  type DetectedModel,
  type DetectedRowLabel,
} from "@/lib/road-detection/detected-rows";
import { provenanceClause } from "@/lib/road-detection/provenance";

afterEach(cleanup);

function road(tag: string | null): ConfirmedRoad {
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
        oneway: tag,
        maxspeed: "30 mph",
        lanes: "2",
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
      },
      geometry: [
        [39.714, -104.941],
        [39.715, -104.94],
      ],
    },
    classification: {
      roadType: "urban_arterial",
      divided: false,
      laneWidthFt: 12,
      lanesPerDirection: 1,
      speedLimitMph: 30,
      confidence: "high",
      source: "osm-tags",
      detectedOneway: tag ?? undefined,
      fields: {
        speed: { value: 30, confidence: "high", source: "maxspeed", method: "measured" },
        lanes: { value: 1, confidence: "high", source: "lanes", method: "measured" },
        roadType: { value: "urban_arterial", confidence: "high", source: "class", method: "measured" },
        divided: { value: false, confidence: "high", source: "oneway", method: "measured" },
      },
    },
    method: "auto_single",
    pinLat: 39.71466,
    pinLng: -104.94071,
  } as unknown as ConfirmedRoad;
}

function flagger(tag: string | null, over: Partial<Scenario> = {}): Scenario {
  return {
    ...DEFAULT_FLAGGER,
    speed: 30,
    roadType: "urban_arterial",
    oneway: tag ?? undefined,
    meta: {
      ...DEFAULT_FLAGGER.meta,
      lat: 39.71466,
      lng: -104.94071,
      bearingDeg: 85,
      confirmedRoad: road(tag),
    },
    ...over,
  } as Scenario;
}

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
  return modelRow(label);
}
const clauseOf = (label: string) =>
  provenanceClause({
    detectedValue: ledgerRow(label)!.detected,
    detectedToken: ledgerRow(label)!.detectedToken,
    appliedToken: ledgerRow(label)!.appliedToken,
  });
const appliedOf = (label: string) => ledgerRow(label)!.applied ?? "—";

describe("#278 the one-way row", () => {
  it("a one-way road detected and still one-way in the plan: agreement, stated", () => {
    mount(flagger("yes"));
    expect(appliedOf("One-way")).toBe("Yes");
    expect(clauseOf("One-way")).toMatch(/^OSM · Yes ·/);
    expect(ledgerRow("One-way")!.verdict).toBe("match");
  });

  it("a two-way road says so on both sides", () => {
    mount(flagger("no"));
    expect(appliedOf("One-way")).toBe("No");
    expect(clauseOf("One-way")).toMatch(/^OSM · No ·/);
  });

  it("the operator's two-way confirm shows BOTH sides, marked as an override", () => {
    // FlaggerForm's confirm clears the relay and records the marker
    // carrying the original tag (FlaggerForm.tsx:275-277).  The
    // detection is a fact the operator overruled, not one that never
    // happened — so it is named, and marked.
    mount(flagger("yes", { oneway: undefined, detectionOverrides: [ { via: "flagger_twoway_confirm", detectedOneway: "yes", asserted: "two-way traffic", }, ], } as unknown as Partial<Scenario>));
    expect(clauseOf("One-way")).toBe("OSM · Yes · overridden · operator-set");
    expect(appliedOf("One-way")).toBe("No");
    expect(ledgerRow("One-way")!.verdict).toBe("differ");
  });

  it("a relay cleared with nothing recorded is withdrawn, never a printed stale value", () => {
    mount(flagger("yes", { oneway: undefined } as unknown as Partial<Scenario>));
    expect(clauseOf("One-way")).toMatch(/withdrawn/);
    expect(clauseOf("One-way")).not.toMatch(/OSM · Yes/);
  });

  it("a lanes dispute does not make the one-way row look overridden", () => {
    // the mirror of the lanes row's own predicate: a marker about a
    // different fact never speaks for this one
    mount(flagger("yes", { oneway: undefined, detectionOverrides: [ { via: "flagger_lane_count_confirm", detectedLanesTotal: 1, asserted: "a lane in each direction", }, ], } as unknown as Partial<Scenario>));
    expect(clauseOf("One-way")).toMatch(/withdrawn/);
    expect(clauseOf("One-way")).not.toMatch(/overridden/);
  });

  it("a way OSM never tagged renders no row at all (Rule 10)", () => {
    mount(flagger(null));
    expect(ledgerRow("One-way")).toBeNull();
    // and the rest of the block is unaffected
    expect(ledgerRow("Bearing")).not.toBeNull();
  });

  it("kinds with no applied counterpart carry no row, even with the tag detected", () => {
    // shoulder folds one-way into divided/roadType and has no field for
    // it; a row would have a detected side and nothing to compare
    const shoulder = {
      ...DEFAULT_SHOULDER,
      speed: 30,
      lanes: 1,
      roadType: "urban_arterial",
      divided: false,
      meta: {
        ...DEFAULT_SHOULDER.meta,
        lat: 39.71466,
        lng: -104.94071,
        bearingDeg: 85,
        confirmedRoad: road("yes"),
      },
    } as Scenario;
    mount(shoulder);
    expect(ledgerRow("One-way")).toBeNull();
    expect(ledgerRow("Divided")).not.toBeNull();
  });

  it("the row sits last, in the spec's order", () => {
    mount(flagger("yes"));
    const labels = MODEL!.rows.map((r) => r.label);
    expect(labels[labels.length - 1]).toBe("One-way");
  });
});
