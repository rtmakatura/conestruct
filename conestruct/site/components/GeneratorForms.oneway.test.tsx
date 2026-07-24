// @vitest-environment happy-dom
//
// One-way recovery affordance (issue #158), asserted on the MOUNTED flagger
// form (rule 11).  Detection relays the raw OSM ``oneway`` tag and the
// backend refuses a flagger plan on a one-way road (TA-10 has no opposing
// direction to alternate with).  The "Road carries two-way traffic" confirm
// is the operator's recovery for a misdetection — toggling it clears the
// relayed signal, which lifts the block.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_FLAGGER } from "@/lib/scenarios";
import { FlaggerForm } from "./FlaggerForm";

afterEach(cleanup);

describe("FlaggerForm one-way confirm affordance", () => {
  it("shows the confirm only for one-directional OSM tags", () => {
    const { rerender } = render(
      <FlaggerForm scenario={DEFAULT_FLAGGER} setScenario={() => {}} />,
    );
    const query = () =>
      screen.queryByRole("checkbox", { name: /Road carries two-way traffic/ });
    // Two-way / no signal → no confirm.
    expect(query()).toBeNull();

    rerender(
      <FlaggerForm
        scenario={{ ...DEFAULT_FLAGGER, oneway: "no" }}
        setScenario={() => {}}
      />,
    );
    expect(query()).toBeNull();

    // Every one-directional value surfaces the confirm.
    for (const tag of ["yes", "-1", "reversible"]) {
      rerender(
        <FlaggerForm
          scenario={{ ...DEFAULT_FLAGGER, oneway: tag }}
          setScenario={() => {}}
        />,
      );
      expect(query()).not.toBeNull();
    }
  });

  it("confirming clears oneway, lifting the block", () => {
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
    expect(setScenario).toHaveBeenCalledTimes(1);
    expect(setScenario.mock.calls[0][0].oneway).toBeUndefined();
  });
});
