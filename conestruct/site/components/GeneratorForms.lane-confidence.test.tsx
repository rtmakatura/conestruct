// @vitest-environment happy-dom
//
// Lane-count confidence recovery affordances (issue #120), asserted on
// the MOUNTED forms (rule 11).  Detection relays the raw OSM lane tags
// (detectedLanesTotal / …Forward / …Backward / …BothWays); the backend
// 400s a near_intersection plan whose approach tags contradict each
// other, and the audit cautions on the other kinds.  These controls are
// the operator's recovery: confirming or editing a lane count clears
// the relays — an operator-owned count is no longer a detection claim —
// which lifts the block / caution.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_NEAR_INTERSECTION,
  DEFAULT_SHOULDER,
} from "@/lib/scenarios";
import type { NearIntersectionScenario } from "@/lib/scenarios/types";
import { NearIntersectionForm } from "./NearIntersectionForm";
import { ShoulderForm } from "./ShoulderForm";

afterEach(cleanup);

// The East Colfax defect (Denver survey): total 2 vs 1 forward + 2
// backward — the exact relay set the backend gate refuses.
const RELAYS = {
  detectedLanesTotal: 2,
  detectedLanesForward: 1,
  detectedLanesBackward: 2,
} as const;

function niWithRelays(): NearIntersectionScenario {
  return {
    ...DEFAULT_NEAR_INTERSECTION,
    approaches: DEFAULT_NEAR_INTERSECTION.approaches.map((a) => ({
      ...a,
      ...RELAYS,
    })),
  };
}

const noConfirm = { pending: false, reason: null };

describe("NearIntersectionForm — confirm clears the lane relays", () => {
  it("'Lane count is right' strips the relays from every leg and clears the hold", () => {
    const setScenario = vi.fn();
    const clearApproachConfirm = vi.fn();
    render(
      <NearIntersectionForm
        scenario={niWithRelays()}
        setScenario={setScenario}
        approachConfirm={{ pending: true, reason: null }}
        clearApproachConfirm={clearApproachConfirm}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Lane count is right" }),
    );
    expect(clearApproachConfirm).toHaveBeenCalledTimes(1);
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0] as NearIntersectionScenario;
    for (const leg of next.approaches) {
      expect(leg.detectedLanesTotal).toBeUndefined();
      expect(leg.detectedLanesForward).toBeUndefined();
      expect(leg.detectedLanesBackward).toBeUndefined();
      expect(leg.detectedLanesBothWays).toBeUndefined();
      // The count itself is untouched — confirming is not editing.
      expect(leg.lanesPerDirection).toBe(1);
    }
  });

  it("a manual lane edit clears the relays on every leg (the edit IS the confirmation)", () => {
    const setScenario = vi.fn();
    render(
      <NearIntersectionForm
        scenario={niWithRelays()}
        setScenario={setScenario}
        approachConfirm={noConfirm}
        clearApproachConfirm={() => {}}
      />,
    );
    // The approach lane chips (mainline lanes render as chips too, so
    // scope to the cross-street group by its label).
    fireEvent.click(
      screen.getAllByRole("button", { name: "3" }).at(-1)!,
    );
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0] as NearIntersectionScenario;
    expect(next.approaches[0].lanesPerDirection).toBe(3);
    for (const leg of next.approaches) {
      expect(leg.detectedLanesTotal).toBeUndefined();
      expect(leg.detectedLanesForward).toBeUndefined();
      expect(leg.detectedLanesBackward).toBeUndefined();
      expect(leg.detectedLanesBothWays).toBeUndefined();
    }
  });
});

describe("ShoulderForm — lane edit clears the #120 relays with the #136 one", () => {
  it("editing the lanes chip clears all four detection relays", () => {
    const setScenario = vi.fn();
    render(
      <ShoulderForm
        scenario={{ ...DEFAULT_SHOULDER, lanes: 1, ...RELAYS }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0];
    expect(next.lanes).toBe(2);
    expect(next.detectedLanesTotal).toBeUndefined();
    expect(next.detectedLanesForward).toBeUndefined();
    expect(next.detectedLanesBackward).toBeUndefined();
    expect(next.detectedLanesBothWays).toBeUndefined();
  });
});
