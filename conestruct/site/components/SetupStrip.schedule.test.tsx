// @vitest-environment happy-dom
//
// #188 strip half: the Hours editor displayed 7:00/15:30 placeholder
// values it never wrote — the strip showed a schedule the payload didn't
// carry — and its end select carried the same wrap-blocking filter as
// the Setup panel.  Mounted-flow tests (rule 11).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { SetupStrip } from "./SetupStrip";

afterEach(cleanup);

function mountStrip(over: Partial<Scenario> = {}) {
  const scenario = { ...DEFAULT_SCENARIO, ...over } as Scenario;
  const setScenario = vi.fn();
  render(
    <SetupStrip scenario={scenario} setScenario={setScenario} onReopen={vi.fn()} />,
  );
  return setScenario;
}

const written = (setScenario: ReturnType<typeof vi.fn>) =>
  (setScenario.mock.calls.at(-1)?.[0] as Scenario).schedule;

describe("SetupStrip Hours editor — displays what it writes (#188)", () => {
  it("shows no phantom defaults: unset schedule opens with both selects empty", async () => {
    const user = userEvent.setup();
    mountStrip();
    await user.click(screen.getByLabelText("Edit Hours"));
    const start = screen.getByLabelText<HTMLSelectElement>("Hours");
    const end = screen.getByLabelText<HTMLSelectElement>("End time");
    // Pre-fix these displayed 7:00 AM / 3:30 PM while the payload held
    // nothing (a schedule the user never chose, rule 10's silent default).
    expect(start.value).toBe("");
    expect(end.value).toBe("");
  });

  it("writes exactly the chosen start, nothing else", async () => {
    const user = userEvent.setup();
    const setScenario = mountStrip();
    await user.click(screen.getByLabelText("Edit Hours"));
    await user.selectOptions(screen.getByLabelText("Hours"), "20");
    expect(written(setScenario)).toMatchObject({ start_time: 20.0 });
    expect(written(setScenario)?.end_time).toBeUndefined();
  });

  it("offers wrap end times labeled '(next day)' and writes the overnight pair", async () => {
    const user = userEvent.setup();
    const setScenario = mountStrip({
      schedule: { date_mode: "single", work_date: "2026-08-05", start_time: 20.0 },
    } as Partial<Scenario>);
    await user.click(screen.getByLabelText("Edit Hours"));
    const end = screen.getByLabelText<HTMLSelectElement>("End time");
    expect(Array.from(end.options).map((o) => o.text)).toContain(
      "5:00 AM (next day)",
    );
    await user.selectOptions(end, "5");
    expect(written(setScenario)).toMatchObject({
      start_time: 20.0,
      end_time: 5.0,
    });
  });

  it("labels an overnight schedule '(+1 day)' in the collapsed cell", () => {
    mountStrip({
      schedule: {
        date_mode: "single",
        work_date: "2026-08-05",
        start_time: 20.0,
        end_time: 5.0,
      },
    } as Partial<Scenario>);
    expect(screen.getByLabelText("Edit Hours").textContent).toContain(
      "8:00 PM–5:00 AM (+1 day)",
    );
  });
});
