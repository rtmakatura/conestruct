// @vitest-environment happy-dom
//
// #199 mounted-flow tests: a fresh scenario presented "Single day" as
// the chosen date mode — an asserted schedule shape nobody chose, under
// a caption promising that windows and lead times compute from it.  The
// default chip is now "Not set", and it stays display-only: nothing is
// written until the user interacts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { ScheduleField } from "./ScheduleField";

afterEach(cleanup);

function mountFresh() {
  const scenario = { ...DEFAULT_SCENARIO, schedule: undefined } as Scenario;
  const setScenario = vi.fn();
  render(<ScheduleField scenario={scenario} setScenario={setScenario} step={4} />);
  return setScenario;
}

describe("ScheduleField — 'Not set' default (#199)", () => {
  it("presents 'Not set' as the selected mode on an untouched scenario", () => {
    mountFresh();
    const notSet = screen.getByRole("button", { name: "Not set" });
    const singleDay = screen.getByRole("button", { name: "Single day" });
    expect(notSet.getAttribute("aria-pressed")).toBe("true");
    expect(singleDay.getAttribute("aria-pressed")).toBe("false");
    // No date/time inputs asserted for a schedule nobody entered.
    expect(screen.queryByLabelText("Work date")).toBeNull();
    expect(screen.queryByLabelText("Start time")).toBeNull();
  });

  it("writes nothing on mount — the default is display-only", () => {
    const setScenario = mountFresh();
    expect(setScenario).not.toHaveBeenCalled();
  });

  it("choosing 'Single day' is the first write, and only then", async () => {
    const user = userEvent.setup();
    const setScenario = mountFresh();
    await user.click(screen.getByRole("button", { name: "Single day" }));
    expect(setScenario).toHaveBeenCalledTimes(1);
    const next = setScenario.mock.calls[0][0] as Scenario;
    expect(next.schedule).toMatchObject({ date_mode: "single" });
  });
});
