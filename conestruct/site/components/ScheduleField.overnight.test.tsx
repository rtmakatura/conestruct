// @vitest-environment happy-dom
//
// #188 mounted-flow tests (rule 11: the bug lived in what the form let
// the user build).  The end-time select filtered out every option at or
// before the start, so 20:00–05:00 — the classic night shift — was
// unenterable; and a start moved past the chosen end left the select
// blank while the stale end kept POSTing.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { ScheduleField } from "./ScheduleField";

afterEach(cleanup);

function mount(schedule: Scenario["schedule"] | undefined) {
  const scenario = { ...DEFAULT_SCENARIO, schedule } as Scenario;
  const setScenario = vi.fn();
  render(<ScheduleField scenario={scenario} setScenario={setScenario} step={4} />);
  return setScenario;
}

const written = (setScenario: ReturnType<typeof vi.fn>) =>
  (setScenario.mock.calls.at(-1)?.[0] as Scenario).schedule;

describe("ScheduleField — overnight shifts (#188)", () => {
  it("offers every half hour as an end time, labeling wrap options '(next day)'", () => {
    mount({ date_mode: "single", work_date: "2026-08-05", start_time: 20.0 });
    const end = screen.getByLabelText<HTMLSelectElement>("End time");
    const labels = Array.from(end.options).map((o) => o.text);
    // Pre-fix: everything ≤ 20:00 was filtered out entirely.
    expect(labels).toContain("5:00 AM (next day)");
    expect(labels).toContain("11:00 PM");
    // end == start stays excluded (ambiguous, rejected at the wire).
    expect(labels).not.toContain("8:00 PM");
    expect(labels).not.toContain("8:00 PM (next day)");
  });

  it("selecting a wrap end writes it: 20:00 → 05:00 lands in the payload", async () => {
    const user = userEvent.setup();
    const setScenario = mount({
      date_mode: "single",
      work_date: "2026-08-05",
      start_time: 20.0,
    });
    await user.selectOptions(screen.getByLabelText("End time"), "5");
    expect(written(setScenario)).toMatchObject({
      start_time: 20.0,
      end_time: 5.0,
    });
  });

  it("moving the start onto the chosen end clears the end in the same patch", async () => {
    // The stranded-end regression: the select can no longer display
    // end == start, so the state may not keep POSTing it.
    const user = userEvent.setup();
    const setScenario = mount({
      date_mode: "single",
      work_date: "2026-08-05",
      start_time: 8.0,
      end_time: 10.0,
    });
    await user.selectOptions(screen.getByLabelText("Start time"), "10");
    const sched = written(setScenario);
    expect(sched?.start_time).toBe(10.0);
    expect(sched?.end_time).toBeUndefined();
  });

  it("moving the start past the end keeps it — that is now a legal overnight", async () => {
    const user = userEvent.setup();
    const setScenario = mount({
      date_mode: "single",
      work_date: "2026-08-05",
      start_time: 8.0,
      end_time: 10.0,
    });
    await user.selectOptions(screen.getByLabelText("Start time"), "11");
    expect(written(setScenario)).toMatchObject({
      start_time: 11.0,
      end_time: 10.0,
    });
    // And the re-mounted select displays it as a wrap, not a blank.
    cleanup();
    mount({ date_mode: "single", work_date: "2026-08-05", start_time: 11.0, end_time: 10.0 });
    const end = screen.getByLabelText<HTMLSelectElement>("End time");
    expect(end.selectedOptions[0]?.text).toBe("10:00 AM (next day)");
  });
});
