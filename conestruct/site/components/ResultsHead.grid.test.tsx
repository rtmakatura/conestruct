// @vitest-environment happy-dom
//
// R106 (setup-what-redesign) — the Setup box after Generate as the
// title-block layout in design-refs/SetupB.dc.html: "a boxed grid of
// label/value cells with mono caps labels, and Road spans two cells so it
// doesn't wrap.  Every cell is a button with the target it has today.
// Unset values read '◌ not set'."  R110 Q9: "Two full-height buttons in
// the Setup Lanes cell.  No ⚠ on the Setup box."

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
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

const cells = () => [...document.querySelectorAll('[data-testid="setup-values"] > .a-setupcell')];
const pairs = () =>
  cells().map((c) => [
    c.querySelector(".a-setup-k")!.textContent,
    [...c.querySelectorAll(".a-setup-v")].map((v) => v.textContent).join(" "),
  ]);

describe("the Setup box (R106)", () => {
  it("eight labelled cells in SetupB's order, no run-on sentence", () => {
    mount();
    expect(pairs()).toEqual([
      ["Road", "East Colfax Avenue Westbound"],
      ["Work", "Shoulder work"],
      ["Length", "1,000 ft"],
      ["Speed", "30 mph"],
      ["Lanes", "2 × 12 ft"],
      ["Road type", "Urban arterial"],
      ["Jurisdiction", "◌ not set"],
      ["Dates", "◌ not set"],
    ]);
    expect(screen.getByTestId("setup-values").textContent).not.toContain(" · ");
  });

  it("Road spans two cells, and so do Dates (the row's last)", () => {
    mount();
    const span2 = cells()
      .filter((c) => c.classList.contains("is-span2"))
      .map((c) => c.querySelector(".a-setup-k")!.textContent);
    expect(span2).toEqual(["Road", "Dates"]);
  });

  it("every cell IS its button, with the target it has today", () => {
    const onChange = mount();
    for (const k of ["kind", "location", "extent", "speed", "roadType", "jurisdiction", "dates"]) {
      const b = screen.getByTestId(`setup-link-${k}`);
      expect(b.tagName, k).toBe("BUTTON");
      expect(b.classList.contains("a-setupcell"), k).toBe(true);
    }
    expect(screen.getByTestId("setup-link-speed").getAttribute("aria-label")).toBe(
      "Change Speed limit: 30 mph",
    );
    fireEvent.click(screen.getByTestId("setup-link-location"));
    expect(onChange).toHaveBeenCalledWith("location");
  });

  it("the Lanes cell holds two full-height buttons, each with its own target (Q9)", () => {
    const onChange = mount();
    const lanes = screen.getByTestId("setup-link-lanes");
    const width = screen.getByTestId("setup-link-laneWidth");
    expect(lanes.tagName).toBe("BUTTON");
    expect(width.tagName).toBe("BUTTON");
    expect(lanes.parentElement).toBe(width.parentElement);
    expect(lanes.parentElement!.classList.contains("is-pair")).toBe(true);
    fireEvent.click(width);
    expect(onChange).toHaveBeenCalledWith("laneWidth");
    fireEvent.click(lanes);
    expect(onChange).toHaveBeenCalledWith("lanes");
  });

  it("a kind with no lane count states the count it uses; only the width is a button", () => {
    mount({ ...DEFAULT_FLAGGER, workLen: 500 } as Scenario);
    const cell = cells().find((c) => c.querySelector(".a-setup-k")!.textContent === "Lanes")!;
    expect(cell.querySelectorAll("button")).toHaveLength(1);
    expect(screen.queryByTestId("setup-link-lanes")).toBeNull();
    expect(cell.textContent).toContain("1 ×");
  });

  it("a set jurisdiction and dates read as values; a guessed one carries no ⚠ (Q9)", () => {
    mount(
      {
        ...SCENARIO,
        jurisdiction_key: "denver",
        guesses: { jurisdiction_key: { lat: 39.7402, lng: -104.956 } },
        schedule: { date_mode: "single", work_date: "2026-10-12" },
      } as Scenario,
      "Denver",
    );
    const v = Object.fromEntries(pairs());
    expect(v.Jurisdiction).toBe("Denver");
    expect(v.Dates).toBe("2026-10-12");
    expect(screen.getByTestId("fact-setup").textContent).not.toContain("⚠");
  });

  it("the head says how it works: ✓ SETUP, pick a cell to change it", () => {
    mount();
    const box = screen.getByTestId("fact-setup");
    expect(box.querySelector(".a-setupbox-head .a-sym")!.textContent).toBe("✓");
    expect(within(box).getByText("Setup")).toBeTruthy();
    expect(within(box).getByText("pick a cell to change it")).toBeTruthy();
  });
});
