// @vitest-environment happy-dom
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
import { cleanup, render } from "@testing-library/react";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario, DetectionOverride } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { DetectedVsApplied } from "./DetectedVsApplied";

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

function lanesCell(): HTMLElement {
  const rows = Array.from(document.querySelectorAll(".dva-grid > .contents")).filter(
    (e) => !e.classList.contains("dva-head"),
  );
  const row = rows.find(
    (r) => r.children[0]?.textContent?.trim() === "Lanes per direction",
  );
  if (!row) throw new Error("no lanes row");
  return row.children[1] as HTMLElement;
}

/** The cell's OWN text — its value, without the provenance line beneath it.
 *  textContent would run the two together ("2overridden"). */
function lanesValue(): string {
  return Array.from(lanesCell().childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent!.trim())
    .join("")
    .trim();
}

describe("#275 the Detected lanes cell after a lanes edit", () => {
  it("detection standing: the cell reports the per-direction figure", () => {
    render(<DetectedVsApplied scenario={scenario()} />);
    expect(lanesValue()).toBe("2");
  });

  it("the cell reads the classification, not the relay (different numbers)", () => {
    // the relay says 4 (raw `lanes`); the block must say 2 (per direction)
    render(<DetectedVsApplied scenario={scenario()} />);
    expect(lanesValue()).not.toMatch(/4/);
  });

  it("UNDISPUTED edit — relays cleared, nothing recorded: the detection is withdrawn", () => {
    render(
      <DetectedVsApplied
        scenario={scenario({ lanes: 3, detectedLanesTotal: undefined })}
      />,
    );
    const cell = lanesCell();
    // never a blank (Rule 10), and never the cleared relay's value as current
    expect(cell.textContent!.trim()).not.toBe("");
    expect(lanesValue()).toMatch(/withdrawn/i);
    expect(lanesValue()).not.toMatch(/2/);
  });

  it("DISPUTED edit — the marker rides the wire and the audit reprints it: show both, marked", () => {
    render(
      <DetectedVsApplied
        scenario={scenario({
          lanes: 3,
          detectedLanesTotal: undefined,
          detectionOverrides: [DISPUTED],
        })}
      />,
    );
    const cell = lanesCell();
    // both sides still readable: the detected figure stands...
    expect(lanesValue()).toBe("2");
    // ...and it is marked as an override rather than presented as current
    expect(cell.textContent).toMatch(/overridden/i);
    expect(cell.textContent).not.toMatch(/withdrawn/i);
  });

  it("a marker from another surface does not make a lanes edit look disputed", () => {
    render(
      <DetectedVsApplied
        scenario={scenario({
          lanes: 3,
          detectedLanesTotal: undefined,
          detectionOverrides: [
            { via: "flagger_twoway_confirm", detectedOneway: "yes", asserted: "two-way" },
          ],
        })}
      />,
    );
    // that marker carries no lane relay, so the lanes erasure was undisputed
    expect(lanesCell().textContent).toMatch(/withdrawn/i);
  });

  it("the override marking is a word, and it rides the provenance role", () => {
    render(
      <DetectedVsApplied
        scenario={scenario({
          lanes: 3,
          detectedLanesTotal: undefined,
          detectionOverrides: [DISPUTED],
        })}
      />,
    );
    const marker = lanesCell().querySelector(".tr-prov");
    expect(marker).not.toBeNull();
    expect(marker!.textContent!.trim()).toMatch(/overridden/i);
  });

  it("the other rows are untouched by a lanes edit", () => {
    render(
      <DetectedVsApplied
        scenario={scenario({ lanes: 3, detectedLanesTotal: undefined })}
      />,
    );
    const rows = Array.from(document.querySelectorAll(".dva-grid > .contents")).filter(
      (e) => !e.classList.contains("dva-head"),
    );
    const road = rows.find((r) => r.children[0]?.textContent?.trim() === "Road type");
    expect(road!.children[1].textContent).toMatch(/Urban arterial/);
    expect(road!.children[1].textContent).not.toMatch(/withdrawn|overridden/i);
  });
});
