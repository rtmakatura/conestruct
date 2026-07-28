// @vitest-environment happy-dom
//
// Override provenance (issue #177), asserted on the MOUNTED forms
// (rule 11).  The recovery affordances lift a gate refusal or caution by
// erasing the detection relays; each disputed erasure must now attach a
// DetectionOverride marker recording what detection reported and what
// the human asserted — the marker rides the wire payload and becomes
// the audit's detection_overridden item.  Undisputed edits stay silent
// (the #112 manual-supersede convention) and absent detection records
// nothing, ever: absence and override must not look alike.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_FLAGGER,
  DEFAULT_NEAR_INTERSECTION,
  DEFAULT_SHOULDER,
} from "@/lib/scenarios";
import type {
  FlaggerLaneClosureScenario,
  NearIntersectionScenario,
  ShoulderScenario,
} from "@/lib/scenarios/types";
import type { RoadClassification } from "@/lib/road-detection/types";
import {
  appendDetectionOverride,
  applyClassification,
  lanesArithmeticMismatch,
} from "@/lib/scenarios/auto-apply";
import { FlaggerForm } from "./FlaggerForm";
import { NearIntersectionForm } from "./NearIntersectionForm";
import { ShoulderForm } from "./ShoulderForm";

afterEach(cleanup);

const noConfirm = { pending: false, reason: null };

// The East Colfax mismatch relays (Denver survey): 2 ≠ 1 + 2.
const MISMATCH_RELAYS = {
  detectedLanesTotal: 2,
  detectedLanesForward: 1,
  detectedLanesBackward: 2,
} as const;

describe("FlaggerForm confirms record what they erase (#177)", () => {
  it("the #86 multilane confirm attaches the marker with the erased relays", () => {
    const setScenario = vi.fn();
    render(
      <FlaggerForm
        scenario={{
          ...DEFAULT_FLAGGER,
          detectedLanesTotal: 5,
          detectedLanesForward: 3,
        }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Road has one through lane in each direction/,
      }),
    );
    const next = setScenario.mock.calls[0][0] as FlaggerLaneClosureScenario;
    expect(next.detectedLanesTotal).toBeUndefined();
    expect(next.detectionOverrides).toHaveLength(1);
    expect(next.detectionOverrides![0]).toMatchObject({
      via: "flagger_multilane_confirm",
      detectedLanesTotal: 5,
      detectedLanesForward: 3,
      asserted: "one through lane in each direction",
    });
  });

  it("the #136 single-lane confirm attaches the marker", () => {
    const setScenario = vi.fn();
    render(
      <FlaggerForm
        scenario={{ ...DEFAULT_FLAGGER, detectedLanesTotal: 1 }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Road has one lane in each direction/,
      }),
    );
    const next = setScenario.mock.calls[0][0] as FlaggerLaneClosureScenario;
    expect(next.detectionOverrides![0]).toMatchObject({
      via: "flagger_single_lane_confirm",
      detectedLanesTotal: 1,
      asserted: "one lane in each direction",
    });
  });

  it("the #158 two-way confirm carries the raw oneway tag", () => {
    const setScenario = vi.fn();
    render(
      <FlaggerForm
        scenario={{ ...DEFAULT_FLAGGER, oneway: "yes" }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Road carries two-way traffic/ }),
    );
    const next = setScenario.mock.calls[0][0] as FlaggerLaneClosureScenario;
    expect(next.oneway).toBeUndefined();
    expect(next.detectionOverrides![0]).toMatchObject({
      via: "flagger_twoway_confirm",
      detectedOneway: "yes",
      asserted: "two-way traffic",
    });
  });

  it("a second confirm appends — one marker per override event", () => {
    const setScenario = vi.fn();
    render(
      <FlaggerForm
        scenario={{
          ...DEFAULT_FLAGGER,
          oneway: "yes",
          detectionOverrides: [
            {
              via: "flagger_multilane_confirm",
              detectedLanesTotal: 5,
              asserted: "one through lane in each direction",
            },
          ],
        }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Road carries two-way traffic/ }),
    );
    const next = setScenario.mock.calls[0][0] as FlaggerLaneClosureScenario;
    expect(next.detectionOverrides).toHaveLength(2);
    expect(next.detectionOverrides![1].via).toBe("flagger_twoway_confirm");
  });
});

describe("ShoulderForm lane edit — disputed-only recording (#177)", () => {
  it("a mismatch-disputed edit records the erased relays and the entered value", () => {
    const setScenario = vi.fn();
    render(
      <ShoulderForm
        scenario={{ ...DEFAULT_SHOULDER, lanes: 1, ...MISMATCH_RELAYS }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    const next = setScenario.mock.calls[0][0] as ShoulderScenario;
    expect(next.detectedLanesTotal).toBeUndefined();
    expect(next.detectionOverrides![0]).toMatchObject({
      via: "shoulder_lane_edit",
      detectedLanesTotal: 2,
      detectedLanesForward: 1,
      detectedLanesBackward: 2,
      asserted: "3 lanes per direction",
    });
  });

  it("a #136-disputed edit (detected single-lane) records too", () => {
    const setScenario = vi.fn();
    render(
      <ShoulderForm
        scenario={{ ...DEFAULT_SHOULDER, lanes: 1, detectedLanesTotal: 1 }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    const next = setScenario.mock.calls[0][0] as ShoulderScenario;
    expect(next.detectionOverrides![0]).toMatchObject({
      via: "shoulder_lane_edit",
      detectedLanesTotal: 1,
      asserted: "2 lanes per direction",
    });
  });

  it("an undisputed edit clears the relays but records nothing (#112 convention)", () => {
    const setScenario = vi.fn();
    render(
      <ShoulderForm
        scenario={{
          ...DEFAULT_SHOULDER,
          lanes: 2,
          detectedLanesTotal: 4,
          detectedLanesForward: 2,
          detectedLanesBackward: 2,
        }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    const next = setScenario.mock.calls[0][0] as ShoulderScenario;
    expect(next.detectedLanesTotal).toBeUndefined();
    expect(next.detectionOverrides).toBeUndefined();
  });
});

describe("NearIntersectionForm — confirm and edit record (#177)", () => {
  function niWithRelays(): NearIntersectionScenario {
    return {
      ...DEFAULT_NEAR_INTERSECTION,
      approaches: DEFAULT_NEAR_INTERSECTION.approaches.map((a) => ({
        ...a,
        ...MISMATCH_RELAYS,
      })),
    };
  }

  it("'Lane count is right' records the confirmed count and the erased relays", () => {
    const setScenario = vi.fn();
    render(
      <NearIntersectionForm
        scenario={niWithRelays()}
        setScenario={setScenario}
        approachConfirm={{ pending: true, reason: null }}
        clearApproachConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lane count is right" }));
    const next = setScenario.mock.calls[0][0] as NearIntersectionScenario;
    expect(next.approaches[0].detectedLanesTotal).toBeUndefined();
    expect(next.detectionOverrides![0]).toMatchObject({
      via: "approach_lane_confirm",
      detectedLanesTotal: 2,
      detectedLanesForward: 1,
      detectedLanesBackward: 2,
      asserted: "approach lane count 1",
    });
  });

  it("a disputed manual edit records via approach_lane_edit with the new value", () => {
    const setScenario = vi.fn();
    render(
      <NearIntersectionForm
        scenario={niWithRelays()}
        setScenario={setScenario}
        approachConfirm={noConfirm}
        clearApproachConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "3" }).at(-1)!);
    const next = setScenario.mock.calls[0][0] as NearIntersectionScenario;
    expect(next.approaches[0].lanesPerDirection).toBe(3);
    expect(next.detectionOverrides![0]).toMatchObject({
      via: "approach_lane_edit",
      asserted: "approach lane count 3",
    });
  });

  it("an undisputed edit (consistent relays, no hold) records nothing", () => {
    const setScenario = vi.fn();
    render(
      <NearIntersectionForm
        scenario={{
          ...DEFAULT_NEAR_INTERSECTION,
          approaches: DEFAULT_NEAR_INTERSECTION.approaches.map((a) => ({
            ...a,
            detectedLanesTotal: 2,
            detectedLanesForward: 1,
            detectedLanesBackward: 1,
          })),
        }}
        setScenario={setScenario}
        approachConfirm={noConfirm}
        clearApproachConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "3" }).at(-1)!);
    const next = setScenario.mock.calls[0][0] as NearIntersectionScenario;
    expect(next.approaches[0].detectedLanesTotal).toBeUndefined();
    expect(next.detectionOverrides).toBeUndefined();
  });

  it("a confirm with no relays present records nothing (nothing was erased)", () => {
    const setScenario = vi.fn();
    render(
      <NearIntersectionForm
        scenario={DEFAULT_NEAR_INTERSECTION}
        setScenario={setScenario}
        approachConfirm={{ pending: true, reason: null }}
        clearApproachConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lane count is right" }));
    const next = setScenario.mock.calls[0][0] as NearIntersectionScenario;
    expect(next.detectionOverrides).toBeUndefined();
  });
});

describe("the #177 lib pieces", () => {
  it("lanesArithmeticMismatch mirrors the backend predicate", () => {
    expect(lanesArithmeticMismatch(2, 1, 2, undefined)).toBe(true);
    expect(lanesArithmeticMismatch(3, 1, 1, 1)).toBe(false); // TWLTL
    expect(lanesArithmeticMismatch(3, 1, 1, undefined)).toBe(true);
    // Sparse tags are indeterminate, never disputed.
    expect(lanesArithmeticMismatch(undefined, 1, 1, undefined)).toBe(false);
    expect(lanesArithmeticMismatch(3, 1, undefined, undefined)).toBe(false);
  });

  it("appendDetectionOverride keeps the newest 8 (the backend cap)", () => {
    const marker = (n: number) =>
      ({ via: "shoulder_lane_edit", asserted: `${n} lanes per direction` }) as const;
    let list: ReturnType<typeof appendDetectionOverride> | undefined;
    for (let n = 1; n <= 10; n++) list = appendDetectionOverride(list, marker(n));
    expect(list).toHaveLength(8);
    expect(list![0].asserted).toBe("3 lanes per direction");
    expect(list![7].asserted).toBe("10 lanes per direction");
  });

  it("applyClassification resets the markers as it re-attaches relays", () => {
    const c: RoadClassification = {
      roadType: "urban_arterial",
      divided: false,
      laneWidthFt: 12,
      detectedLanesTotal: 2,
      confidence: "high",
      source: "osm-tags",
      raw: {
        class: "secondary",
        oneway: false,
        roadName: null,
        roadRef: null,
        placeName: null,
        osmLanesTag: "2",
        osmMaxspeedTag: null,
      },
      fields: {
        speed: { value: null, confidence: "low", source: "n/a", method: "inferred" },
        lanes: { value: 1, confidence: "high", source: "n/a", method: "measured" },
        roadType: {
          value: "urban_arterial",
          confidence: "high",
          source: "n/a",
          method: "measured",
        },
        divided: { value: false, confidence: "high", source: "n/a", method: "measured" },
      },
    };
    const prior: FlaggerLaneClosureScenario = {
      ...DEFAULT_FLAGGER,
      detectionOverrides: [
        {
          via: "flagger_multilane_confirm",
          detectedLanesTotal: 5,
          asserted: "one through lane in each direction",
        },
      ],
    };
    const { scenario: next } = applyClassification(prior, c);
    expect((next as FlaggerLaneClosureScenario).detectionOverrides).toBeUndefined();
    expect((next as FlaggerLaneClosureScenario).detectedLanesTotal).toBe(2);
  });
});
