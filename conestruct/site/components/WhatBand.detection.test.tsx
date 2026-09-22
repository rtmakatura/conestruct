// @vitest-environment happy-dom
//
// #289 Phase 2 — the detection facts, where they render NOW.
//
// This file was `DetectedVsApplied.test.tsx`.  §8.23 folded the block
// into the WHAT band's per-field provenance lines — "the separate block
// is gone; nothing it said is gone" — so the suite follows the facts
// rather than the component.  The derivation's own cases live in
// `DetectedVsApplied.{confidence,lanes,oneway}.test.tsx`, which now read
// `deriveDetectedRows` directly; what is asserted HERE is the half that
// only a render can prove: that each clause reaches the screen, under
// the field it is about, in the provenance role.
//
// #214's acceptance is unchanged and still the reason the file exists:
// with road geometry on file the surface states the typed bearing's
// actual role BEFORE the user types.  The sentence is byte-identical
// (`bearingCaveat`, lib/road-detection/detected-rows.ts) — it is
// restyled, never deleted.
//
// Rule 10: no confirmed road at the CURRENT pin → no detection footer at
// all, and the manual path keeps today's surfaces.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_SHOULDER, DEFAULT_FLAGGER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { WhatBand } from "./bands/WhatBand";

afterEach(cleanup);

/** The band, with the jurisdiction cell in its unset state — this suite
 *  is about detection, and ruling 196's three states have their own. */
function mount(scenario: Scenario) {
  return render(
    <WhatBand
      scenario={scenario}
      setScenario={() => {}}
      setMeta={() => {}}
      jurisdictionBlock={null}
      jurisdictionLoading={false}
      jurisdictionErrored={false}
      stepIndex="STEP 2 OF 4"
    />,
  );
}

/** A cell's provenance line, by the cell's test id. */
const prov = (testid: string) =>
  document.querySelector(`[data-testid="prov-${testid}"]`)!.textContent!.trim();

function confirmedRoad(over: Partial<ConfirmedRoad> = {}): ConfirmedRoad {
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
        lanes: "2",
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
      },
      signal_distance_m: null,
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
      raw: {
        class: "secondary",
        oneway: false,
        roadName: "E Bayaud Ave",
        roadRef: null,
        placeName: "Denver",
        osmLanesTag: "2",
        osmMaxspeedTag: "30 mph",
      },
      fields: {
        speed: { value: 30, confidence: "high", source: "OSM maxspeed tag", method: "measured" },
        lanes: { value: 1, confidence: "medium", source: "OSM lanes tag", method: "measured" },
        roadType: { value: "urban_arterial", confidence: "high", source: "class", method: "measured" },
        divided: { value: false, confidence: "high", source: "oneway", method: "measured" },
      },
    },
    method: "auto_single",
    overrides: {},
    isUrban: true,
    placeName: "Denver",
    pinLat: 39.71466,
    pinLng: -104.94071,
    ...over,
  } as unknown as ConfirmedRoad;
}

function pinnedShoulder(over: Partial<Scenario> = {}): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    lanes: 1,
    roadType: "urban_arterial",
    divided: false,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.71466,
      lng: -104.94071,
      bearingDeg: 90,
      confirmedRoad: confirmedRoad(),
    },
    ...over,
  } as Scenario;
}

describe("#289 §8.23 — the clauses under the fields they are about", () => {
  it("no confirmed road: no detection footer (manual path untouched)", () => {
    mount(DEFAULT_SHOULDER);
    expect(document.querySelector('[data-testid="what-detection"]')).toBeNull();
  });

  it("a stale confirmed road (pin moved) never speaks", () => {
    const s = pinnedShoulder();
    (s.meta as { lat: number }).lat = 39.9999;
    mount(s);
    expect(document.querySelector('[data-testid="what-detection"]')).toBeNull();
  });

  it("#214 repro: typed 90 over detected 85 — both values render, and the role sentence stands before any typing", () => {
    mount(pinnedShoulder());
    // The plan's value and detection's, in the bearing's own line —
    // which is the detection footer now, because the 3 × 2 grid has no
    // bearing cell and §8.23 says nothing it said is gone.
    const bearing = document.querySelector(
      '[data-testid="detect-bearing"]',
    )!.textContent!;
    expect(bearing).toMatch(/90°/);
    expect(bearing).toMatch(/OSM · 85° ·/);
    // #214's sentence, byte-identical, before the user types anything.
    expect(
      screen.getByText(
        /road geometry governs the drawing — the typed bearing sets the travel-direction sign only/,
      ),
    ).toBeTruthy();
    // Source line: OSM detection with the road's identity.
    expect(
      screen.getByText(/OSM detection · E Bayaud Ave · way 1042/),
    ).toBeTruthy();
  });

  it("no geometry on file: the honest inverse sentence (typed bearing drives)", () => {
    const road = confirmedRoad();
    (road.candidate as { geometry: null }).geometry = null;
    mount(
      pinnedShoulder({
        meta: {
          ...pinnedShoulder().meta,
          confirmedRoad: road,
        },
      } as Partial<Scenario>),
    );
    expect(
      screen.getByText(
        /no road geometry on file — the typed bearing drives the drawing/,
      ),
    ).toBeTruthy();
  });

  it("each cell carries its own clause, under its own field (rule 137)", () => {
    mount(pinnedShoulder());
    expect(prov("speed")).toMatch(/^OSM · 30 mph ·/);
    expect(prov("lanes")).toMatch(/^OSM · 1 ·/);
    expect(prov("road-type")).toMatch(/OSM · Urban arterial ·/);
    // rule 137: a field with no provenance line is a defect — and the
    // two the ledger never had a row for say so in words rather than
    // being left blank.
    expect(prov("lane-width")).toBe("your change · operator-set from here on");
    expect(prov("work-dates")).toBe("optional · permit lead times need it");
  });

  it("every provenance line rides the provenance role, not a new one", () => {
    mount(pinnedShoulder());
    for (const id of ["speed", "lanes", "lane-width", "road-type", "jurisdiction", "work-dates"]) {
      const el = document.querySelector(`[data-testid="prov-${id}"]`)!;
      expect(el.className, `${id} is tr-prov`).toContain("tr-prov");
    }
  });

  it("a fact the kind does not carry renders no footer row — flagger has no lanes or divided detection line", () => {
    const flagger = {
      ...DEFAULT_FLAGGER,
      speed: 30,
      meta: {
        ...DEFAULT_FLAGGER.meta,
        lat: 39.71466,
        lng: -104.94071,
        bearingDeg: 85,
        confirmedRoad: confirmedRoad(),
      },
    } as Scenario;
    mount(flagger);
    expect(document.querySelector('[data-testid="detect-divided"]')).toBeNull();
    expect(document.querySelector('[data-testid="detect-bearing"]')).not.toBeNull();
    // #209, and it is a DELIBERATE change from the ledger's behaviour:
    // the ledger rendered no lanes ROW for a kind with no lane count, and
    // the grid renders the CELL read-only with the reason instead — rule
    // 136's read-only-with-reason.  An absent control tells the operator
    // nothing; a stated one tells them TA-10 fixes the count.
    expect(prov("lanes")).toMatch(/TA-10/);
    expect(
      document.querySelector('[data-testid="cell-lanes"] input'),
    ).toHaveProperty("readOnly", true);
  });
});
