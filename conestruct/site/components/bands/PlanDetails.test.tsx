// @vitest-environment happy-dom
//
// #289 hand-check, 2026-09-23, correction 1 — the second group.
//
// "WHAT is the 3×2 grid (rules 116, 136–138) plus a second group for the
// inputs the plan needs that the grid does not hold — work type, night
// operation, speed reduction, divided, and the dates control — laid out
// as grid fields with provenance lines, under one sub-header, not the
// old SCHEDULE / ROAD / WORK sections pasted inside the band."
//
// Rule 11 — where the defect lived.  Half of it was LAYOUT (three
// section headers and three FieldGroups inside one band) and half was
// REGISTER: the sections rendered `.field-input` / `.chip`, which are
// the setup panel's paper-and-orange, inside a band whose own controls
// are `.a-fld` / `.a-chip` on the dark ground.  So these cases assert
// both: the shape (cells, one sub-header, a provenance line on every
// field) and the register (no panel-era class survives in the band).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_FLAGGER,
  DEFAULT_NEAR_INTERSECTION,
  DEFAULT_SHOULDER,
} from "@/lib/scenarios";
import type { Scenario, ShoulderScenario } from "@/lib/scenarios";
import { PlanDetailCells, showsDividedToggle } from "./PlanDetails";

afterEach(cleanup);

// R107: the rows render into the WHAT band's two columns
// (PlanDetailCells, group "road" / "job"); this harness stands in for a
// column so the rows' behaviour is tested as before.
function mount(scenario: Scenario) {
  const setScenario = vi.fn();
  render(
    <div className="a-col" data-testid="plan-details">
      <PlanDetailCells group="job" scenario={scenario} setScenario={setScenario} />
      <PlanDetailCells group="road" scenario={scenario} setScenario={setScenario} />
    </div>,
  );
  return setScenario;
}

const cells = () =>
  Array.from(document.querySelectorAll('[data-testid^="cell-"]'));

describe("the group's shape", () => {
  it("declares no section of its own: its cells join the band's two groups (R96 A)", () => {
    mount(DEFAULT_SHOULDER);
    const group = screen.getByTestId("plan-details");
    // "The rest of this plan" is retired (R101, mockups/what.html): the
    // cells are a fragment in the WHAT band's "The road" / "The job" grids.
    expect(group.querySelectorAll(".tr-section")).toHaveLength(0);
    expect(group.querySelectorAll(".a-grid")).toHaveLength(0);
    // The panel's own section names are gone from this surface.
    for (const word of ["Road", "Work", "Schedule"]) {
      expect(
        Array.from(group.querySelectorAll(".tr-section")).some(
          (h) => h.textContent === word,
        ),
      ).toBe(false);
    }
  });

  it("every field carries a provenance line (rule 137)", () => {
    mount({ ...DEFAULT_SHOULDER, workZoneSpeed: 45 } as Scenario);
    expect(cells().length).toBeGreaterThan(0);
    for (const cell of cells()) {
      const id = cell.getAttribute("data-testid")!.replace("cell-", "");
      expect(cell.querySelector(`[data-testid="prov-${id}"]`)).not.toBeNull();
    }
  });

  it("uses the band's register, never the setup panel's", () => {
    mount({ ...DEFAULT_SHOULDER, workZoneSpeed: 45 } as Scenario);
    const group = screen.getByTestId("plan-details");
    // The panel's classes: `.field-input` is paper-on-navy with an
    // orange focus ring; `.chip` is orange-on-paper.  Neither belongs in
    // a band whose controls are `.a-fld` and R107's `.a-seg`.
    expect(group.querySelectorAll(".field-input")).toHaveLength(0);
    expect(group.querySelectorAll(".chip")).toHaveLength(0);
    expect(group.querySelectorAll(".field-select")).toHaveLength(0);
    expect(group.querySelectorAll(".check-row")).toHaveLength(0);
    expect(group.querySelectorAll(".a-fld").length).toBeGreaterThan(0);
    expect(group.querySelectorAll(".a-seg").length).toBeGreaterThan(0);
  });
});

describe("which cells a kind gets", () => {
  it("the shoulder gets work type, night and the reduction", () => {
    mount(DEFAULT_SHOULDER);
    expect(screen.getByTestId("cell-work-type")).toBeTruthy();
    expect(screen.getByTestId("cell-night")).toBeTruthy();
    expect(screen.getByTestId("cell-reduction")).toBeTruthy();
    // The limit appears only once a reduction is asked for.
    expect(screen.queryByTestId("cell-wz-speed")).toBeNull();
  });

  it("the flagger and near-intersection kinds get no reduction cell", () => {
    mount(DEFAULT_FLAGGER);
    expect(screen.getByTestId("cell-work-type")).toBeTruthy();
    expect(screen.queryByTestId("cell-reduction")).toBeNull();
    cleanup();
    mount(DEFAULT_NEAR_INTERSECTION);
    expect(screen.getByTestId("cell-work-type")).toBeTruthy();
    expect(screen.queryByTestId("cell-reduction")).toBeNull();
  });

  it("divided is a cell only where the operator owns it (#85)", () => {
    // Every road type but urban_arterial derives `divided` from itself,
    // so a toggle there would be a second writer for one value.
    expect(showsDividedToggle(DEFAULT_SHOULDER)).toBe(false);
    expect(
      showsDividedToggle({
        ...DEFAULT_SHOULDER,
        roadType: "urban_arterial",
      } as Scenario),
    ).toBe(true);
    mount({ ...DEFAULT_SHOULDER, roadType: "urban_arterial" } as Scenario);
    expect(screen.getByTestId("cell-divided")).toBeTruthy();
  });

  it("a gated kind renders no cells at all (rule 8)", () => {
    mount({ ...DEFAULT_SHOULDER, kind: "mobile_op_2lane" } as unknown as Scenario);
    expect(cells()).toHaveLength(0);
  });
});

describe("the writes are the forms' own", () => {
  it("asking for a reduction opens at 10 mph below the posted speed", () => {
    const setScenario = mount({
      ...DEFAULT_SHOULDER,
      speed: 45,
    } as Scenario);
    fireEvent.click(screen.getByRole("button", { name: "Reduced" }));
    const next = setScenario.mock.calls[0][0] as ShoulderScenario;
    expect(next.workZoneSpeed).toBe(35);
  });

  it("the reduction's limit cites S-630-1 Sheet 2 Note 3, with the stepped count", () => {
    // Δ20 > 15, so the note's arithmetic asks for two installations.
    mount({ ...DEFAULT_SHOULDER, speed: 55, workZoneSpeed: 35 } as Scenario);
    expect(screen.getByTestId("prov-wz-speed").textContent).toBe(
      "Δ20 mph · S-630-1 Sheet 2 Note 3: 2 stepped sign installations",
    );
  });

  it("clearing the reduction drops the field rather than zeroing it", () => {
    const setScenario = mount({
      ...DEFAULT_SHOULDER,
      speed: 45,
      workZoneSpeed: 35,
    } as Scenario);
    // R110 Q8: "The off option reads 'None'."
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    const next = setScenario.mock.calls[0][0] as ShoulderScenario;
    expect(next.workZoneSpeed).toBeUndefined();
  });

  it("the divided flip drags the lane default with it (#85)", () => {
    const setScenario = mount({
      ...DEFAULT_SHOULDER,
      roadType: "urban_arterial",
      divided: false,
      lanes: 1,
    } as Scenario);
    fireEvent.click(screen.getByRole("button", { name: "Divided" }));
    const next = setScenario.mock.calls[0][0] as ShoulderScenario;
    expect(next.divided).toBe(true);
    expect(next.lanes).toBe(2);
  });

  it("night is a two-state answer, and writes only on a change", () => {
    const setScenario = mount(DEFAULT_SHOULDER);
    // Already "Daytime": pressing it again is not a write.
    fireEvent.click(screen.getByRole("button", { name: "Daytime" }));
    expect(setScenario).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Night" }));
    expect((setScenario.mock.calls[0][0] as ShoulderScenario).night).toBe(true);
  });
});

// R107 / R108 — street class is a row of "The road": a segmented control
// split evenly, prefilled from the road and marked as a guess, with no
// confirm, dismiss or suggestion row anywhere (R108).
describe("street class is a row of The road, marked when guessed", () => {
  const guessed = {
    ...DEFAULT_SHOULDER,
    street_class: "arterial",
    guesses: { street_class: { highwayClass: "primary" } },
  } as Scenario;

  it("reads '⚠ from the road', and its full line names the tag", async () => {
    const { WhatBand } = await import("./WhatBand");
    render(
      <WhatBand
        scenario={guessed}
        setScenario={() => {}}
        setMeta={() => {}}
        jurisdictionBlock={null}
        jurisdictionLoading={false}
        jurisdictionErrored={false}
        stepIndex="STEP 2 OF 4"
      />,
    );
    const cell = screen.getByTestId("cell-street-class");
    expect(screen.getByTestId("what-group-road").contains(cell)).toBe(true);
    // R107's label.
    expect(cell.querySelector(".tr-field")!.textContent).toBe("Street class");
    expect(screen.getByTestId("info-toggle-street-class").textContent).toBe("⚠ from the road");
    expect(screen.getByTestId("prov-street-class").textContent).toBe(
      "⚠ guessed, not confirmed · OSM highway=primary · from the road",
    );
    // R108: no confirm step, anywhere in the band.
    for (const name of [/^Confirm/, /^Dismiss$/, /^Undo$/]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    // R107: three options, one track each.
    const seg = cell.querySelector(".a-seg") as HTMLElement;
    expect(seg.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    expect(screen.getByRole("button", { name: "Arterial" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("the operator's pick replaces the guess and drops its record", () => {
    const setScenario = mount(guessed);
    fireEvent.click(screen.getByRole("button", { name: "Local" }));
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(next.street_class).toBe("local");
    expect(next.guesses ?? null).toBeNull();
  });

  it("the operator's own class reads '✓ yours'; none reads '◌ not set'", () => {
    mount({ ...DEFAULT_SHOULDER, street_class: "collector" } as Scenario);
    expect(screen.getByTestId("info-toggle-street-class").textContent).toBe("✓ yours");
    cleanup();
    mount(DEFAULT_SHOULDER);
    expect(screen.getByTestId("info-toggle-street-class").textContent).toBe("◌ not set");
  });
});

// R110 Q8 — Hours and Speed reduction: "✓ default" until changed, then
// "✓ yours".
describe("hours and the speed reduction say whose value they show", () => {
  it("default until changed", () => {
    mount(DEFAULT_SHOULDER);
    expect(screen.getByTestId("cell-night").querySelector(".tr-field")!.textContent).toBe("Hours");
    expect(screen.getByTestId("info-toggle-night").textContent).toBe("✓ default");
    expect(
      screen.getByTestId("cell-reduction").querySelector(".tr-field")!.textContent,
    ).toBe("Speed reduction");
    expect(screen.getByTestId("info-toggle-reduction").textContent).toBe("✓ default");
  });

  it("yours once the operator has written it, even back to the default", () => {
    mount({
      ...DEFAULT_SHOULDER,
      night: false,
      meta: { ...DEFAULT_SHOULDER.meta, operatorSet: ["night", "workZoneSpeed"] },
    } as Scenario);
    expect(screen.getByTestId("info-toggle-night").textContent).toBe("✓ yours");
    expect(screen.getByTestId("info-toggle-reduction").textContent).toBe("✓ yours");
  });

  it("the writes record the operator", () => {
    const setScenario = mount(DEFAULT_SHOULDER);
    fireEvent.click(screen.getByRole("button", { name: "Night" }));
    expect((setScenario.mock.calls[0][0] as Scenario).meta.operatorSet).toEqual(["night"]);
  });
});

// #289 hand-check, 2026-09-23 — the three fixes, at the surfaces they
// changed.
describe("fix 1 — work dates is ONE control", () => {
  it("the second group holds no date control at all", async () => {
    const { ScheduleField } = await import("../ScheduleField");
    render(
      <ScheduleField
        scenario={
          {
            ...DEFAULT_SHOULDER,
            schedule: { date_mode: "single", work_date: "2026-08-04" },
          } as Scenario
        }
        setScenario={() => {}}
      />,
    );
    // The duplicate: this cell wrote `work_date`, and so did the grid's.
    expect(document.querySelector('[data-testid="cell-work-date"]')).toBeNull();
    expect(document.querySelector('[data-testid="cell-date-mode"]')).toBeNull();
    expect(document.getElementById("sched-date")).toBeNull();
    // What is left here is the TIMES — a different question, a different
    // field, and #188's whole contract.
    expect(document.querySelector('[data-testid="cell-start-time"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="cell-end-time"]')).not.toBeNull();
  });

  it("the mode chips are gone from the page", async () => {
    const { ScheduleField } = await import("../ScheduleField");
    render(
      <ScheduleField
        scenario={
          { ...DEFAULT_SHOULDER, schedule: { date_mode: "single" } } as Scenario
        }
        setScenario={() => {}}
      />,
    );
    for (const name of ["Single day", "Date range", "Not set"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });
});

describe("fix 3 — divided's detection line sits under its control", () => {
  it("renders the line the WHAT band hands it, in the divided cell", () => {
    render(
      <PlanDetailCells
        group="road"
        scenario={
          { ...DEFAULT_SHOULDER, roadType: "urban_arterial" } as Scenario
        }
        setScenario={() => {}}
        dividedLine={{ key: "divided", text: "Divided no · OSM · no", amber: false }}
      />,
    );
    const cell = screen.getByTestId("cell-divided");
    expect(cell.querySelector('[data-testid="detect-divided"]')?.textContent).toBe(
      "Divided no · OSM · no",
    );
  });

  it("an amber clause keeps rule 13's second channel", () => {
    render(
      <PlanDetailCells
        group="road"
        scenario={
          { ...DEFAULT_SHOULDER, roadType: "urban_arterial" } as Scenario
        }
        setScenario={() => {}}
        dividedLine={{ key: "divided", text: "Divided no · assumed", amber: true }}
      />,
    );
    const line = screen.getByTestId("detect-divided");
    expect(line.textContent).toBe("⚠ Divided no · assumed");
    expect(line.className).toContain("is-amber");
  });
});
