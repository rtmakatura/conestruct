// @vitest-environment happy-dom
//
// #215 — "Work-window timeline lacks labels at window boundaries — users
// infer end times from unlabeled gaps."  #289 absorbs it: "window
// boundaries labelled; test at column width and 380".
//
// What these prove, and what they cannot: happy-dom does no layout, so
// "at column width and 380" is proved on the MARKUP each width gets — the
// desk row keeps its 130 px scope column beside the bar, and at ≤md
// (max-md, which covers 380) the row is one column, the scope above the
// bar, so the labels get the column's full width; and on every width,
// adjacent boundaries sit on different lines.  Pixel collision at 380 is
// the post-ship hand-check's to see.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mountTiered } from "./tiered-test-utils";
import {
  deriveBandRows,
  hourTick,
  rowBoundaries,
  type BandRow,
  type JurisdictionBlock,
} from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";

const jur = (key: string): JurisdictionBlock =>
  (demo as { jurisdictions: Record<string, unknown> }).jurisdictions[
    key
  ] as JurisdictionBlock;

afterEach(cleanup);

describe("hourTick — the axis's own form", () => {
  it("whole hours read like the axis ticks; minutes when present", () => {
    expect(hourTick(0)).toBe("12a");
    expect(hourTick(7)).toBe("7a");
    expect(hourTick(12)).toBe("12p");
    expect(hourTick(15.5)).toBe("3:30p");
    expect(hourTick(24)).toBe("12a");
  });
});

describe("rowBoundaries — every interior boundary, once, in order", () => {
  it("reads the segment starts, dropping the axis ends", () => {
    const row: BandRow = {
      scope: "All streets",
      classes: null,
      days: "weekday",
      segments: [
        { t: "ok", startH: 0, endH: 7 },
        { t: "ban", startH: 7, endH: 9 },
        { t: "ok", startH: 9, endH: 16.5 },
        { t: "ban", startH: 16.5, endH: 18 },
        { t: "ok", startH: 18, endH: 24 },
      ],
    };
    expect(rowBoundaries(row)).toEqual([7, 9, 16.5, 18]);
  });

  it("a whole-day row has none", () => {
    expect(
      rowBoundaries({ scope: "x", classes: null, days: "all", segments: [{ t: "ok", startH: 0, endH: 24 }] }),
    ).toEqual([]);
  });
});

describe("#215 — the rendered card labels every boundary", () => {
  async function openCard() {
    const thornton = { ...jur("thornton"), hours_eval: { status: "inside" as const, violations: [] } };
    const { container } = mountTiered(thornton, {
      date_mode: "single",
      work_date: "2026-08-05",
      start_time: 8,
      end_time: 15,
    });
    await userEvent.click(screen.getByRole("button", { name: /reference/i }));
    await userEvent.click(screen.getByRole("button", { name: /work hours/i }));
    return { container, thornton };
  }

  it("each row's labels are its boundaries, in the axis's form, at their own positions", async () => {
    const { container, thornton } = await openCard();
    const rows = deriveBandRows(thornton.hours!);
    const rendered = Array.from(container.querySelectorAll('[data-testid="hours-row"]'));
    expect(rendered.length).toBe(rows.length);
    let labelled = 0;
    rows.forEach((row, i) => {
      const want = rowBoundaries(row);
      const spans = Array.from(
        rendered[i].querySelectorAll<HTMLElement>("[data-boundary-hour]"),
      );
      expect(spans.map((s) => Number(s.getAttribute("data-boundary-hour")))).toEqual(want);
      spans.forEach((s, j) => {
        expect(s.textContent).toBe(hourTick(want[j]));
        expect(s.style.left).toBe(`${(want[j] / 24) * 100}%`);
      });
      labelled += spans.length;
    });
    // The fixture has windows: an empty result here would be #237's
    // failure mode in miniature.
    expect(labelled).toBeGreaterThan(0);
  });

  it("adjacent boundaries never share a line (every width)", async () => {
    const { container } = await openCard();
    for (const strip of Array.from(container.querySelectorAll('[data-testid="hours-boundaries"]'))) {
      const lines = Array.from(strip.querySelectorAll("[data-boundary-line]")).map((s) =>
        s.getAttribute("data-boundary-line"),
      );
      for (let k = 1; k < lines.length; k += 1) expect(lines[k]).not.toBe(lines[k - 1]);
    }
  });

  it("column width: the scope column sits beside the bar; 380 (≤md): it stacks above, the bar takes the column", async () => {
    const { container } = await openCard();
    const row = container.querySelector('[data-testid="hours-row"]')!;
    expect(row.className).toContain("grid-cols-[130px_1fr]");
    expect(row.className).toContain("max-md:grid-cols-1");
    // The axis ticks follow the same switch, so they stay under the bar.
    const axis = Array.from(container.querySelectorAll("div")).find((d) =>
      /12a.*4a.*8a.*12p.*4p.*8p.*12a/.test(d.textContent ?? "") && d.className.includes("justify-between"),
    )!;
    expect(axis.parentElement!.className).toContain("max-md:grid-cols-1");
  });
});
