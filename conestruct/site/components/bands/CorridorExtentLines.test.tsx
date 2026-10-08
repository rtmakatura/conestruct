// @vitest-environment happy-dom
//
// R117 Q2 -- the extent row's popover lines.  On a near-intersection plan
// the five lengths are the mainline's only (`corridor_spec`); the cross-
// street approaches lay out separately, and the popover says so rather
// than letting five rows read as the whole picture (Rule 10).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { CorridorExtentLines } from "./WhereBand";

afterEach(cleanup);

const LENGTHS = {
  advance_warning_ft: 300,
  taper_ft: 180,
  buffer_ft: 200,
  downstream_taper_ft: 50,
  road_category: "urban",
};

describe("CorridorExtentLines", () => {
  it("prints the five rows under 'Corridor at this length'", () => {
    const { container } = render(
      <CorridorExtentLines lengths={LENGTHS} workLen={500} kind="shoulder" note={null} />,
    );
    const rows = [...container.querySelectorAll('[data-testid^="zone-"]')].map((r) => r.textContent);
    expect(rows).toEqual([
      "Advance warning · 300 ft",
      "Taper · 180 ft",
      "Buffer · 200 ft",
      "Work zone · 500 ft",
      "Downstream · 50 ft",
    ]);
    expect(container.textContent).toContain("Corridor at this length");
    expect(container.textContent).not.toContain("cross-street");
  });

  it("on a near-intersection plan, says the approaches lay out separately", () => {
    const { container } = render(
      <CorridorExtentLines lengths={LENGTHS} workLen={500} kind="near_intersection" note={null} />,
    );
    expect(container.textContent).toContain("the cross-street approaches lay out separately");
  });

  it("without lengths, prints the one note it was given", () => {
    const { container } = render(
      <CorridorExtentLines
        lengths={null}
        workLen={500}
        kind="shoulder"
        note="corridor lengths wait on the kind of work"
      />,
    );
    expect(container.querySelector('[data-testid="corridor-extent-note"]')!.textContent).toBe(
      "corridor lengths wait on the kind of work",
    );
    expect(container.querySelectorAll('[data-testid^="zone-"]')).toHaveLength(0);
  });
});

describe("the band columns fit a 390 px band (R117 Q2 build, measured)", () => {
  it("a column track never exceeds the band: minmax(min(340px, 100%), 1fr)", () => {
    // Measured at 390 on the local build: the band's content box is 328 px,
    // and a bare minmax(340px, 1fr) track ran the row 12 px past it (the
    // marker clipped) -- in the WHAT band since R107 too.  min(340px, 100%)
    // lets the one track shrink to the band; 1440 still gets two 340+ px
    // columns.
    const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8");
    const i = css.indexOf(".workbench .a-cols {");
    const block = css.slice(i, css.indexOf("}", i));
    expect(block).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(340px,\s*100%\),\s*1fr\)\)/);
  });
});
