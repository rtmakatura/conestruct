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
import { PlanDetails, showsDividedToggle } from "./PlanDetails";

afterEach(cleanup);

function mount(scenario: Scenario) {
  const setScenario = vi.fn();
  render(<PlanDetails scenario={scenario} setScenario={setScenario} />);
  return setScenario;
}

const cells = () =>
  Array.from(document.querySelectorAll('[data-testid^="cell-"]'));

describe("the group's shape", () => {
  it("is one sub-header over one grid — not three sections", () => {
    mount(DEFAULT_SHOULDER);
    const group = screen.getByTestId("plan-details");
    expect(group.querySelectorAll(".tr-section")).toHaveLength(1);
    expect(group.querySelector(".tr-section")?.textContent).toBe(
      "The rest of this plan",
    );
    expect(group.querySelectorAll(".a-grid")).toHaveLength(1);
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
    // a band whose controls are `.a-fld` and `.a-chip`.
    expect(group.querySelectorAll(".field-input")).toHaveLength(0);
    expect(group.querySelectorAll(".chip")).toHaveLength(0);
    expect(group.querySelectorAll(".field-select")).toHaveLength(0);
    expect(group.querySelectorAll(".check-row")).toHaveLength(0);
    expect(group.querySelectorAll(".a-fld").length).toBeGreaterThan(0);
    expect(group.querySelectorAll(".a-chip").length).toBeGreaterThan(0);
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

  it("a gated kind renders no group at all (rule 8)", () => {
    mount({ ...DEFAULT_SHOULDER, kind: "mobile_op_2lane" } as unknown as Scenario);
    expect(screen.queryByTestId("plan-details")).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: "No reduction" }));
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

// #289 hand-check, 2026-09-23, correction 1, last clause: "The
// street-class suggestion is the road-type field's own suggestion record
// (#198 strings byte-identical in the new container)."
//
// The band had no cell for street classification, so §8.21's other half
// rode a row of its own below the grid.  It belongs to the road-type
// cell — the same arrangement #201 already gives the jurisdiction cell
// and its pin suggestion: a confirm sits beside the control it applies
// to.  The container is all that moves, which is what keeps the strings
// identical, and that is what this case checks.
describe("the street-class record rides the road-type cell", () => {
  it("renders inside the cell, with its strings unchanged", async () => {
    const { WhatBand } = await import("./WhatBand");
    render(
      <WhatBand
        scenario={DEFAULT_SHOULDER}
        setScenario={() => {}}
        setMeta={() => {}}
        jurisdictionBlock={null}
        jurisdictionLoading={false}
        jurisdictionErrored={false}
        stepIndex="STEP 2 OF 4"
        classificationFields={
          <div data-testid="class-fields">Street classification</div>
        }
      />,
    );
    const cell = screen.getByTestId("cell-road-type");
    expect(cell.querySelector('[data-testid="class-fields"]')).not.toBeNull();
    // And nowhere else: a second home for one control is the thing this
    // arc keeps removing.
    expect(screen.getAllByTestId("class-fields")).toHaveLength(1);
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
      <PlanDetails
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
      <PlanDetails
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
