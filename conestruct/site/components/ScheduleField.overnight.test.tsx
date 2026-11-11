// @vitest-environment happy-dom
//
// #188 mounted-flow tests (rule 11: the bug lived in what the form let
// the user build).  The end-time select filtered out every option at or
// before the start, so 20:00–05:00 — the classic night shift — was
// unenterable; and a start moved past the chosen end left the select
// blank while the stale end kept POSTing.

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { ScheduleField } from "./ScheduleField";
import { listboxValue, pickOptionUser } from "./__fixtures__/listbox";

// #517 (ruling 6, S7): the times are the shared listbox now, so the
// options are read from its open list, not a native select.
const optionLabels = (id: string) => {
  act(() => {
    fireEvent.click(document.getElementById(id)!);
  });
  return Array.from(
    document.querySelectorAll(`#${id}-list [role="option"]`),
  ).map((o) => (o.textContent ?? "").replace("✓", "").trim());
};

afterEach(cleanup);

function mount(schedule: Scenario["schedule"] | undefined) {
  const scenario = { ...DEFAULT_SCENARIO, schedule } as Scenario;
  const setScenario = vi.fn();
  render(<ScheduleField scenario={scenario} setScenario={setScenario} />);
  return setScenario;
}

const written = (setScenario: ReturnType<typeof vi.fn>) =>
  (setScenario.mock.calls.at(-1)?.[0] as Scenario).schedule;

describe("ScheduleField — overnight shifts (#188)", () => {
  it("offers every half hour as an end time, labeling wrap options '(next day)'", () => {
    mount({ date_mode: "single", work_date: "2026-08-05", start_time: 20.0 });
    const labels = optionLabels("sched-end");
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
    await pickOptionUser(user, "sched-end", "5");
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
    await pickOptionUser(user, "sched-start", "10");
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
    await pickOptionUser(user, "sched-start", "11");
    expect(written(setScenario)).toMatchObject({
      start_time: 11.0,
      end_time: 10.0,
    });
    // And the re-mounted select displays it as a wrap, not a blank.
    cleanup();
    mount({
      date_mode: "single",
      work_date: "2026-08-05",
      start_time: 11.0,
      end_time: 10.0,
    });
    expect(listboxValue("sched-end")).toBe("10:00 AM (next day)");
  });
});

// #521 (ruling 5, S4): the time rows carry a source line like every row.
describe("ScheduleField — the times' source lines (#521)", () => {
  const word = (id: string) =>
    (
      document.querySelector(`[data-testid="prov-${id}"]`)?.textContent ?? ""
    ).trim();
  it("reads Not set yet until a time is picked, then Set by you", () => {
    mount({ date_mode: "single", work_date: "2026-08-05", start_time: 9.0 });
    expect(word("start-time")).toBe("Set by you");
    expect(word("end-time")).toBe("Not set yet");
  });
});
