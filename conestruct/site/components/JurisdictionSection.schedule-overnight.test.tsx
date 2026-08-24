// @vitest-environment happy-dom
//
// #188/#206 card rendering (#219-migrated to the tiers): the schedule
// band overlay assumed end > start (an overnight width went negative),
// and a violation against a multi-window scope group named ONE window
// of the pair instead of the alternative set.  Fixture jurisdictions
// with the hours_eval overridden to the backend shapes (the verdict is
// backend-owned — rule 3 — so the override IS the seam).  The band
// chart lives in the Reference tier's WorkHoursCard; the OUTSIDE
// verdict renders in ⚠, auto-open, straight off the same hours_eval.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mountTiered } from "./tiered-test-utils";
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
    const { container } = mountTiered(thornton, {
      date_mode: "single",
      work_date: "2026-08-05",
      start_time: 20.0,
      end_time: 5.0,
    });
    // The band chart is Reference-tier content: expand the tier, then
    // the card ("inside" does not auto-expand the card either).
    await userEvent.click(screen.getByRole("button", { name: /reference/i }));
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

describe("hours violations — alternative windows (#206)", () => {
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
    mountTiered(denverish as JurisdictionBlock, {
      date_mode: "single",
      work_date: "2026-08-05",
      start_time: 10.0,
      end_time: 16.0,
    });
    // OUTSIDE → the ⚠ tier auto-opens; the violation reads with no click.
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
    mountTiered(thornton as JurisdictionBlock, {
      date_mode: "single",
      work_date: "2026-08-05",
      start_time: 8.0,
      end_time: 15.5,
    });
    expect(
      screen.getByText(
        /0\.5 h falls outside the permitted 8:30 AM–3:30 PM window \(/i,
      ),
    ).toBeTruthy();
  });
});
