// @vitest-environment happy-dom
//
// #227 surface 6 — the schedule window reference block.  Real
// class-scoped rows from the jurisdiction's #206 window data (never the
// PDF's invented four), rendered unevaluated at final widths; when the
// schedule lands, ONLY glyph and value change — row count, order, and
// labels are asserted identical (no reflow).  Verdicts are the
// presentation of ONE backend hours_eval (GO ruling 6): no client-side
// time arithmetic.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import type { HoursEval, JurisdictionBlock } from "@/lib/jurisdiction";
import { ScheduleField } from "./ScheduleField";

afterEach(cleanup);

const SRC = { doc: "DPW Rules", section: "3", status: "verified" };

function block(hoursEval: HoursEval): JurisdictionBlock {
  return {
    name: "Denver",
    hours: {
      shape: "nested_envelope",
      windows: [
        {
          kind: "work",
          days: "weekday",
          classes: ["arterial"],
          start: 9,
          end: 17,
          source: SRC,
        },
        {
          kind: "ban",
          days: "all",
          classes: null,
          start: 22,
          end: 5,
          source: SRC,
        },
      ],
      holiday_rule: "none",
      conflict: null,
    },
    hours_eval: hoursEval,
  } as unknown as JurisdictionBlock;
}

const UNKNOWN: HoursEval = { status: "unknown", violations: [] };
const INSIDE: HoursEval = { status: "inside", violations: [] };
const OUTSIDE: HoursEval = {
  status: "outside",
  violations: [
    {
      kind: "ban_window_overlap",
      window: { start: 22, end: 5, days: "all" },
      overlap_hours: 2,
      source: SRC,
    } as unknown as HoursEval["violations"][number],
  ],
};

function scenarioWith(over: Partial<Scenario>): Scenario {
  return { ...DEFAULT_SCENARIO, ...over } as Scenario;
}

const CHECKED_SCHEDULE = {
  date_mode: "single" as const,
  work_date: "2026-09-01",
  start_time: 20,
  end_time: 2,
};

function rowShapes(): { label: string; glyph: string; value: string }[] {
  return Array.from(document.querySelectorAll(".sched-window-row")).map(
    (r) => {
      const cells = Array.from(r.children) as HTMLElement[];
      return {
        glyph: cells[0]?.textContent ?? "",
        label: cells[1]?.textContent ?? "",
        value: cells[2]?.textContent ?? "",
      };
    },
  );
}

describe("#227 schedule window reference block", () => {
  it("no jurisdiction: one honest row, never invented windows", () => {
    render(
      <ScheduleField
        scenario={scenarioWith({})}
        setScenario={() => {}}
        step={5}
        jurisdiction={null}
      />,
    );
    expect(
      screen.getByText("Select a jurisdiction to see its windows"),
    ).toBeTruthy();
    expect(document.querySelectorAll(".sched-window-row").length).toBe(1);
  });

  it("unevaluated: real rows, class-scoped first, all ◌ '— set dates to check'", () => {
    render(
      <ScheduleField
        scenario={scenarioWith({
          jurisdiction_key: "denver",
          street_class: "arterial",
        })}
        setScenario={() => {}}
        step={5}
        jurisdiction={block(UNKNOWN)}
      />,
    );
    const rows = rowShapes();
    expect(rows.length).toBe(2);
    expect(rows[0].label).toMatch(/Arterial/);
    expect(rows[1].label).toMatch(/All streets/);
    for (const r of rows) {
      expect(r.glyph.trim()).toBe("◌");
      expect(r.value).toBe("— set dates to check");
    }
  });

  it("evaluated: same rows, same order, same labels — only glyph and value change", () => {
    const { rerender } = render(
      <ScheduleField
        scenario={scenarioWith({
          jurisdiction_key: "denver",
          street_class: "arterial",
        })}
        setScenario={() => {}}
        step={5}
        jurisdiction={block(UNKNOWN)}
      />,
    );
    const before = rowShapes();

    rerender(
      <ScheduleField
        scenario={scenarioWith({
          jurisdiction_key: "denver",
          street_class: "arterial",
          schedule: CHECKED_SCHEDULE,
        })}
        setScenario={() => {}}
        step={5}
        jurisdiction={block(INSIDE)}
      />,
    );
    const after = rowShapes();
    expect(after.length).toBe(before.length);
    expect(after.map((r) => r.label)).toEqual(before.map((r) => r.label));
    // The active (arterial) row resolves ✓ clear; the all-streets
    // envelope stays reference — a scope fact, not a verdict.
    expect(after[0].glyph.trim()).toBe("✓");
    expect(after[0].value).toBe("clear");
    expect(after[1].glyph.trim()).toBe("◌");
    expect(after[1].value).toMatch(/reference \(other street class\)/);
  });

  it("outside: the active row carries the backend's own violation facts", () => {
    render(
      <ScheduleField
        scenario={scenarioWith({
          jurisdiction_key: "denver",
          street_class: "arterial",
          schedule: CHECKED_SCHEDULE,
        })}
        setScenario={() => {}}
        step={5}
        jurisdiction={block(OUTSIDE)}
      />,
    );
    const rows = rowShapes();
    expect(rows[0].glyph.trim()).toBe("⚠");
    expect(rows[0].value).toMatch(/2 h overlaps the .+ ban/);
  });
});
