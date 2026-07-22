// @vitest-environment happy-dom
//
// Surface B (#152): the post-generate strip edits jurisdiction and
// street class inline — the Speed-edit treatment — because a late
// jurisdiction change is a real estimator move and reopening the full
// setup for it is friction.  Mounted-flow tests: the cells show the
// current value, clicking reveals the control, and changing it writes
// the same scenario field the full panel writes (never a second store).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import type { StreetClass } from "@/lib/jurisdiction";
import { SetupStrip } from "./SetupStrip";

afterEach(cleanup);

function mountStrip(over: Partial<Scenario> = {}) {
  const scenario = { ...DEFAULT_SCENARIO, ...over } as Scenario;
  const setScenario = vi.fn();
  const setJurisdictionKey = vi.fn();
  const setStreetClass = vi.fn();
  render(
    <SetupStrip
      scenario={scenario}
      setScenario={setScenario}
      onReopen={vi.fn()}
      jurisdiction={null}
      setJurisdictionKey={setJurisdictionKey}
      setStreetClass={setStreetClass}
    />,
  );
  return { setJurisdictionKey, setStreetClass };
}

describe("strip inline jurisdiction + class edit (#152 B)", () => {
  it("shows the current jurisdiction and class; 'None'/'Not set' by default", () => {
    mountStrip();
    expect(screen.getByLabelText("Edit Jurisdiction").textContent).toContain(
      "None",
    );
    expect(screen.getByLabelText("Edit Class").textContent).toContain(
      "Not set",
    );
  });

  it("editing jurisdiction inline writes jurisdiction_key (not a reopen)", async () => {
    const user = userEvent.setup();
    const { setJurisdictionKey } = mountStrip();
    await user.click(screen.getByLabelText("Edit Jurisdiction"));
    const select = screen.getByLabelText<HTMLSelectElement>(/jurisdiction/i);
    await user.selectOptions(select, "parker");
    expect(setJurisdictionKey).toHaveBeenCalledWith("parker");
  });

  it("editing class inline writes street_class via a pressed pill", async () => {
    const user = userEvent.setup();
    const { setStreetClass } = mountStrip({
      street_class: "local",
    } as Partial<Scenario>);
    await user.click(screen.getByLabelText("Edit Class"));
    const arterial = screen.getByRole("button", { name: "Arterial" });
    await user.click(arterial);
    expect(setStreetClass).toHaveBeenCalledWith<[StreetClass]>("arterial");
  });

  it("reflects a set jurisdiction and class in the collapsed cells", () => {
    mountStrip({
      jurisdiction_key: "parker",
      street_class: "arterial",
    } as Partial<Scenario>);
    expect(screen.getByLabelText("Edit Jurisdiction").textContent).toContain(
      "Parker",
    );
    expect(screen.getByLabelText("Edit Class").textContent).toContain(
      "Arterial",
    );
  });

  it("omits the jurisdiction/class cells when no setters are provided", () => {
    render(
      <SetupStrip
        scenario={DEFAULT_SCENARIO}
        setScenario={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Edit Jurisdiction")).toBeNull();
    expect(screen.queryByLabelText("Edit Class")).toBeNull();
  });
});
