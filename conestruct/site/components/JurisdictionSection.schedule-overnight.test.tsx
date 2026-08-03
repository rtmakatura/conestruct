// @vitest-environment happy-dom
//
// #188/#206 card rendering: the schedule band overlay assumed
// end > start (an overnight width went negative), and a violation
// against a multi-window scope group named ONE window of the pair
// instead of the alternative set.  Fixture jurisdictions with the
// hours_eval overridden to the new backend shapes (the verdict is
// backend-owned — rule 3 — so the override IS the seam).

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { JurisdictionSection } from "./JurisdictionSection";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";

const jur = (key: string): JurisdictionBlock =>
  (demo as { jurisdictions: Record<string, unknown> }).jurisdictions[
    key
  ] as JurisdictionBlock;

afterEach(cleanup);

describe("WorkHoursCard — overnight schedules (#188)", () => {
  it("overlays an overnight schedule as two band segments, both positive-width", async () => {
    const thornton = {
      ...jur("thornton"),
      hours_eval: { status: "inside" as const, violations: [] },
    };
    const { container } = render(
      <JurisdictionSection
        jurisdiction={thornton}
        loading={false}
        streetClass="arterial"
        schedule={{
          date_mode: "single",
          work_date: "2026-08-05",
          start_time: 20.0,
          end_time: 5.0,
        }}
      />,
    );
    // "inside" does not auto-expand; the band track renders on expand.
    await userEvent.click(screen.getByRole("button", { name: /work hours/i }));
    const overlays = Array.from(
      container.querySelectorAll<HTMLElement>(".border-x-2"),
    );
    expect(overlays).toHaveLength(2);
    const geom = overlays.map((o) => [o.style.left, o.style.width]);
    // 20:00→24:00 and 00:00→05:00 as fractions of the 24 h track.
    expect(geom).toContainEqual([`${(20 / 24) * 100}%`, `${(4 / 24) * 100}%`]);
    expect(geom).toContainEqual(["0%", `${(5 / 24) * 100}%`]);
  });
});

describe("WorkHoursCard — alternative-window violations (#206)", () => {
  it("names the whole scope group when the backend reports alternatives", () => {
    const denverish = {
      ...jur("thornton"),
      hours_eval: {
        status: "outside" as const,
        violations: [
          {
            kind: "outside_work_window" as const,
            window: { start: 8.5, end: 15.5, days: "weekday" },
            windows: [
              { start: 8.5, end: 15.5, days: "weekday" },
              { start: 20.0, end: 24.0, days: "weekday" },
              { start: 0.0, end: 5.0, days: "weekday" },
            ],
            outside_hours: 0.5,
            note: null,
            source: { doc: "Rule 22.3", status: "verified" as const },
          },
        ],
      },
    };
    render(
      <JurisdictionSection
        jurisdiction={denverish as JurisdictionBlock}
        loading={false}
        streetClass="arterial"
        schedule={{
          date_mode: "single",
          work_date: "2026-08-05",
          start_time: 10.0,
          end_time: 16.0,
        }}
      />,
    );
    expect(
      screen.getByText(
        /0\.5 h falls outside the permitted 8:30 AM–3:30 PM \/ 8:00 PM–12:00 AM \/ 12:00 AM–5:00 AM windows/i,
      ),
    ).toBeTruthy();
  });

  it("single-window violations keep the singular phrasing", () => {
    const thornton = {
      ...jur("thornton"),
      hours_eval: {
        status: "outside" as const,
        violations: [
          {
            kind: "outside_work_window" as const,
            window: { start: 8.5, end: 15.5, days: "weekday" },
            outside_hours: 0.5,
            note: null,
            source: { doc: "Stipulations", status: "verified" as const },
          },
        ],
      },
    };
    render(
      <JurisdictionSection
        jurisdiction={thornton as JurisdictionBlock}
        loading={false}
        streetClass="arterial"
        schedule={{
          date_mode: "single",
          work_date: "2026-08-05",
          start_time: 8.0,
          end_time: 15.5,
        }}
      />,
    );
    expect(
      screen.getByText(
        /0\.5 h falls outside the permitted 8:30 AM–3:30 PM window \(/i,
      ),
    ).toBeTruthy();
  });
});
