// @vitest-environment happy-dom
//
// R96 B (declutter-three-surfaces) — the post-Generate Setup line as a
// grid of label / value pairs, as mocked up (mockups/setup.html, R101):
// Work, Road, Length, Speed, Lanes, Road type, Jurisdiction (R104), Dates.  Every value
// stays the button it was (P22: each opens what it opened), with the same
// test id and the same accessible name; only the shape changes (P4).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import { ResultsHead } from "./ResultsHead";

afterEach(cleanup);

const SCENARIO = {
  ...DEFAULT_SHOULDER,
  speed: 30,
  lanes: 2,
  laneWidth: 12,
  roadType: "urban_arterial",
  workLen: 1000,
  meta: { ...DEFAULT_SHOULDER.meta, address: "East Colfax Avenue Westbound", lat: 39.7402, lng: -104.956 },
} as Scenario;

function mount(s: Scenario = SCENARIO, jurisdictionName: string | null = null) {
  const onChangeValue = vi.fn();
  render(
    <ResultsHead
      reserve
      settled
      scenario={s}
      jurisdictionName={jurisdictionName}
      onChangeValue={onChangeValue}
    />,
  );
  return onChangeValue;
}

const pairs = () =>
  [...document.querySelectorAll('[data-testid="setup-values"] .a-setup-pair')].map((p) => [
    p.querySelector(".a-setup-k")!.textContent,
    p.querySelector(".a-setup-v")!.textContent,
  ]);

describe("the Setup grid", () => {
  it("eight labelled pairs in the mocked-up order, no run-on sentence", () => {
    mount();
    expect(pairs()).toEqual([
      ["Work", "Shoulder work"],
      ["Road", "East Colfax Avenue Westbound"],
      ["Length", "1,000 ft"],
      ["Speed", "30 mph"],
      ["Lanes", "2 × 12 ft"],
      ["Road type", "Urban arterial"],
      ["Jurisdiction", "◌ not set"],
      ["Dates", "◌ not set"],
    ]);
    expect(screen.getByTestId("setup-values").textContent).not.toContain(" · ");
  });

  it("every value is still its own button, with its id and name", () => {
    const onChange = mount(SCENARIO, null);
    for (const k of ["kind", "location", "extent", "speed", "lanes", "laneWidth", "roadType", "jurisdiction", "dates"]) {
      expect(screen.getByTestId(`setup-link-${k}`), k).toBeTruthy();
    }
    expect(screen.getByTestId("setup-link-speed").getAttribute("aria-label")).toBe(
      "Change Speed limit: 30 mph",
    );
    expect(screen.getByTestId("setup-link-lanes").textContent).toBe("2");
    expect(screen.getByTestId("setup-link-laneWidth").textContent).toBe("12 ft");
    fireEvent.click(screen.getByTestId("setup-link-laneWidth"));
    expect(onChange).toHaveBeenCalledWith("laneWidth");
  });

  it("a set city and dates read as values", () => {
    mount(
      { ...SCENARIO, jurisdiction_key: "denver", schedule: { date_mode: "single", work_date: "2026-10-12" } } as Scenario,
      "Denver",
    );
    const v = Object.fromEntries(pairs());
    expect(v.Jurisdiction).toBe("Denver");
    expect(v.Dates).toBe("2026-10-12");
  });

  it("the hint stays", () => {
    mount();
    expect(within(screen.getByTestId("fact-setup")).getByText("pick a value to change it")).toBeTruthy();
  });
});
