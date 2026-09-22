// @vitest-environment happy-dom
//
// Multi-lane recovery affordance (issue #86), asserted on the MOUNTED
// flagger form (rule 11).  TA-10 applies where one through lane runs in
// each direction; when detection relays a total above the eligibility
// ceiling (4+, or an undecomposable 3) the backend blocks generation.
// This confirm is the operator's recovery — it clears ALL four lane
// relays, which lifts the block.  The consistently decomposed
// center-turn-lane 3 (1+1+1 both_ways) is eligible and shows no confirm.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_FLAGGER } from "@/lib/scenarios";
import { WHAT_CELLS } from "@/lib/scenarios/what-cells";
import { FlaggerForm } from "./FlaggerForm";

afterEach(cleanup);

const CONFIRM = /Road has one through lane in each direction/;

describe("FlaggerForm multi-lane confirm affordance", () => {
  it("shows the confirm on a detected 4-lane road", () => {
    render(
      <FlaggerForm
        scenario={{ ...DEFAULT_FLAGGER, detectedLanesTotal: 4 }}
        setScenario={() => {}}
      />,
    );
    expect(screen.getByRole("checkbox", { name: CONFIRM })).not.toBeNull();
  });

  it("shows the confirm on a bare 3 (no directional tags)", () => {
    render(
      <FlaggerForm
        scenario={{ ...DEFAULT_FLAGGER, detectedLanesTotal: 3 }}
        setScenario={() => {}}
      />,
    );
    expect(screen.getByRole("checkbox", { name: CONFIRM })).not.toBeNull();
  });

  it("hides the confirm at total 2 and on a decomposed TWLTL 3", () => {
    const { rerender } = render(
      <FlaggerForm
        scenario={{ ...DEFAULT_FLAGGER, detectedLanesTotal: 2 }}
        setScenario={() => {}}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: CONFIRM })).toBeNull();

    rerender(
      <FlaggerForm
        scenario={{
          ...DEFAULT_FLAGGER,
          detectedLanesTotal: 3,
          detectedLanesForward: 1,
          detectedLanesBackward: 1,
          detectedLanesBothWays: 1,
        }}
        setScenario={() => {}}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: CONFIRM })).toBeNull();
  });

  it("confirming clears all four lane relays, lifting the block", () => {
    const setScenario = vi.fn();
    render(
      <FlaggerForm
        scenario={{
          ...DEFAULT_FLAGGER,
          detectedLanesTotal: 4,
          detectedLanesForward: 2,
          detectedLanesBackward: 2,
        }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0];
    expect(next.detectedLanesTotal).toBeUndefined();
    expect(next.detectedLanesForward).toBeUndefined();
    expect(next.detectedLanesBackward).toBeUndefined();
    expect(next.detectedLanesBothWays).toBeUndefined();
  });
});

describe("the helper copy states the geometric truth (issue #86)", () => {
  it("names one through lane each direction, not road class", () => {
    // #289 Phase 2: the sentence moved with the road-type field it
    // annotates — into the WHAT grid's road-type cell, as that cell's
    // per-kind note (lib/scenarios/what-cells.ts).  Asserted against the
    // table rather than a render, because the table is where the string
    // lives now and a render would be asserting the cell's plumbing.
    expect(WHAT_CELLS.flagger_lane_closure.roadTypeNote).toBe(
      "TA-10 applies to roads with one through lane in each direction",
    );
  });
});
