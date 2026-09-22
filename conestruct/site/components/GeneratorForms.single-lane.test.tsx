// @vitest-environment happy-dom
//
// Single-lane recovery affordances (issue #136), asserted on the MOUNTED
// forms (rule 11).  Detection relays ``detectedLanesTotal`` and the
// backend blocks a genuinely single-lane road; these controls are the
// operator's recovery — editing them clears the relayed signal, which
// lifts the block.  Shoulder reuses its existing "Lanes per direction"
// chip; flagger (which has no lane-count field — TA-10 is one lane each
// direction) gets a dedicated confirm.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import { ShoulderForm } from "./ShoulderForm";
import { FlaggerForm } from "./FlaggerForm";
import type { ShoulderScenario } from "@/lib/scenarios/types";
import { setLanes } from "@/lib/scenarios/what-writes";

// #289 Phase 2 — the lanes CELL moved into the WHAT band's grid (§8.22)
// and its bookkeeping moved with it, to `lib/scenarios/what-writes.ts`.
// These cases were always about the bookkeeping — which relays clear, and
// whether an erasure records a #177 marker — so they call the writer
// directly.  Rule 11: test where the bug lives.

afterEach(cleanup);

describe("ShoulderForm lane-count edit clears the single-lane signal", () => {
  it("editing the lanes chip sets the count and clears detectedLanesTotal", () => {
    const next = setLanes(
      { ...DEFAULT_SHOULDER, lanes: 1, detectedLanesTotal: 1 } as ShoulderScenario,
      2,
    ) as ShoulderScenario;
    expect(next.lanes).toBe(2);
    expect(next.detectedLanesTotal).toBeUndefined();
  });
});

describe("FlaggerForm single-lane confirm affordance", () => {
  it("shows the confirm only when a single-lane road was detected", () => {
    const { rerender } = render(
      <FlaggerForm scenario={DEFAULT_FLAGGER} setScenario={() => {}} />,
    );
    expect(
      screen.queryByRole("checkbox", { name: /Road has one lane in each direction/ }),
    ).toBeNull();

    rerender(
      <FlaggerForm
        scenario={{ ...DEFAULT_FLAGGER, detectedLanesTotal: 1 }}
        setScenario={() => {}}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: /Road has one lane in each direction/ }),
    ).not.toBeNull();
  });

  it("confirming clears detectedLanesTotal, lifting the block", () => {
    const setScenario = vi.fn();
    render(
      <FlaggerForm
        scenario={{ ...DEFAULT_FLAGGER, detectedLanesTotal: 1 }}
        setScenario={setScenario}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Road has one lane in each direction/ }),
    );
    expect(setScenario).toHaveBeenCalledTimes(1);
    expect(setScenario.mock.calls[0][0].detectedLanesTotal).toBeUndefined();
  });
});
