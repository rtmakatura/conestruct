// @vitest-environment happy-dom
//
// #308 — the WHAT band asks "one-way street or divided road?" on a
// one-way road, and only the answer it shows can be wrong.
//
// Ruling R83: "If the test can't decide, the operator confirms; the plan
// doesn't guess."  The cell is the confirm row the backend's 400 points at
// (carriageway_undecided).  On a one-way road it stands in for the Divided
// toggle: one fact, one control (P2).  Mounted, clicked, and read off the
// scenario it writes (Rule 11).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario, ShoulderScenario } from "@/lib/scenarios";
import { PlanDetailCells } from "./PlanDetails";

afterEach(cleanup);

const FACTS = { oneway: "yes", highwayClass: "primary", twinDistanceM: null };

function oneWay(carriageway: ShoulderScenario["carriageway"]): ShoulderScenario {
  return {
    ...(DEFAULT_SHOULDER as ShoulderScenario),
    roadType: "urban_arterial",
    lanes: 4,
    laneWidth: 11,
    divided: false,
    carriageway,
  };
}

function mount(scenario: Scenario) {
  const setScenario = vi.fn();
  // R96 A: the carriageway cell is a cell of the WHAT band's "The road" group.
  render(
    <div className="a-grid">
      <PlanDetailCells group="road" scenario={scenario} setScenario={setScenario} />
    </div>,
  );
  return setScenario;
}

const chip = (name: string) => screen.getByRole("button", { name });

describe("the carriageway cell", () => {
  it("asks when the test couldn't decide: neither answer pressed, ⚠ needs you", () => {
    mount(oneWay({ ...FACTS, twinSearched: false }));
    expect(screen.getByTestId("cell-carriageway")).toBeTruthy();
    expect(screen.getByTestId("prov-carriageway").textContent).toBe(
      "⚠ needs you · the map couldn't tell",
    );
    expect(chip("One-way street").getAttribute("aria-pressed")).toBe("false");
    expect(chip("One side of a divided road").getAttribute("aria-pressed")).toBe("false");
  });

  it("writes the operator's answer and the divided-ness it implies", () => {
    const set = mount(oneWay({ ...FACTS, twinSearched: false }));
    fireEvent.click(chip("One-way street"));
    const next = set.mock.calls[0][0] as ShoulderScenario;
    expect(next.carriageway?.confirmed).toBe("one_way_street");
    expect(next.divided).toBe(false);
  });

  it("shows a decided one-way street with its evidence", () => {
    mount(oneWay({ ...FACTS, twinSearched: true }));
    expect(chip("One-way street").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("prov-carriageway").textContent).toBe(
      "detected · no same-name carriageway within 100 m",
    );
  });

  it("shows a twinned road as divided, and the operator can overrule it", () => {
    const set = mount(oneWay({ ...FACTS, twinDistanceM: 21.7, twinSearched: true }));
    expect(chip("One side of a divided road").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("prov-carriageway").textContent).toBe(
      "detected · a same-name carriageway 21.7 m away",
    );
    fireEvent.click(chip("One-way street"));
    const next = set.mock.calls[0][0] as ShoulderScenario;
    expect(next.carriageway?.confirmed).toBe("one_way_street");
    expect(next.divided).toBe(false);
  });

  it("fits the lane width when divided-ness widens the shoulder", () => {
    // 4 x 11 ft + an 8 ft shoulder = 52 ft; divided's 10 ft shoulder would
    // overrun the sheet, so the lanes narrow to the ceiling (42 / 4 = 10.5).
    const set = mount(oneWay({ ...FACTS, twinSearched: true }));
    fireEvent.click(chip("One side of a divided road"));
    const next = set.mock.calls[0][0] as ShoulderScenario;
    expect(next.divided).toBe(true);
    expect(next.laneWidth).toBe(10.5);
  });

  it("says the answer is the operator's once given", () => {
    mount(oneWay({ ...FACTS, twinSearched: false, confirmed: "divided" }));
    expect(chip("One side of a divided road").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("prov-carriageway").textContent).toBe(
      "your answer · operator-set from here on",
    );
  });

  it("stands in for the Divided toggle on a one-way road (one control per fact)", () => {
    mount(oneWay({ ...FACTS, twinSearched: true }));
    expect(screen.queryByTestId("cell-divided")).toBeNull();
  });

  it("is absent on a road with no carriageway facts; the Divided toggle stays", () => {
    mount({ ...(DEFAULT_SHOULDER as ShoulderScenario), roadType: "urban_arterial" });
    expect(screen.queryByTestId("cell-carriageway")).toBeNull();
    expect(screen.getByTestId("cell-divided")).toBeTruthy();
  });
});
