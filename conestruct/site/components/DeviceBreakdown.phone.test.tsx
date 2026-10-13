// @vitest-environment happy-dom
//
// R141 (Phase 4 branch 3) — the device schedule at the phone width.  The
// layout itself is measured in a real browser (page scroll width 360 at
// 360x800, every disclosure open: validation-artifacts/committed/
// phase4-380-arc/device-table/); this guards what the browser can't be
// asked about here:
//   - the table keeps explicit table roles (the phone CSS changes the
//     rows' display, which drops implicit roles in some browsers);
//   - the phone's "MUTCD"/"Qty" labels are aria-hidden, so a screen reader
//     hears the header row once and never the labels as well;
//   - the CSS: codes never wrap, the stacked layout and the frame fix are
//     phone-only, and the frame fix stays inside the results disclosures.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { DeviceBreakdown } from "./DeviceBreakdown";

afterEach(cleanup);

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

function renderReady() {
  render(
    <DeviceBreakdown
      state={{
        state: "ready",
        data: {
          devices: [
            { device: "ROAD WORK AHEAD", code: "W20-1", function: "Advance warning", qty: 1 },
            { device: "Traffic Cone (28-inch)", code: "—", function: "Channelizing", qty: 20 },
          ],
          total_devices: 21,
          unique_types: 2,
        },
      }}
      onRetry={() => {}}
    />,
  );
  // The schedule sits in a collapsed reference chip; open it.
  fireEvent.click(screen.getByRole("button", { expanded: false }));
  return screen.getByRole("table");
}

describe("R141: the device schedule's semantics survive the phone layout", () => {
  it("keeps explicit table roles and one header row", () => {
    const table = renderReady();
    expect(table.getAttribute("role")).toBe("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Device type",
      "MUTCD code",
      "Function",
      "Qty",
    ]);
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getAllByRole("cell")).toHaveLength(4);
  });

  it("the phone labels are aria-hidden; the code and quantity read alone", () => {
    const table = renderReady();
    const cells = within(within(table).getAllByRole("row")[1]).getAllByRole("cell");
    const labels = table.querySelectorAll(".dt-label");
    expect(labels).toHaveLength(4); // MUTCD + Qty on each of 2 rows
    labels.forEach((l) => expect(l.getAttribute("aria-hidden")).toBe("true"));
    expect(cells[1].className).toBe("dt-code");
    expect(cells[1].lastChild?.textContent).toBe("W20-1");
    expect(cells[3].lastChild?.textContent).toBe("1");
  });
});

describe("R141: the CSS", () => {
  const phoneAt = css.indexOf("@media (max-width: 480px) {\n  /* Each device is one block");
  const phone = css.slice(phoneAt, css.indexOf("\n}\n", phoneAt));

  it("codes never break, at every width (outside the media query)", () => {
    expect(css.slice(0, phoneAt)).toMatch(/\.workbench \.device-table \.dt-code \{\n {2}white-space: nowrap;\n\}/);
    expect(css.slice(0, phoneAt)).toMatch(/\.workbench \.device-table \.dt-label \{\n {2}display: none;\n\}/);
  });

  it("the stacked layout is phone-only", () => {
    expect(phoneAt).toBeGreaterThan(0);
    expect(phone).toContain(".workbench .device-table tbody tr {\n    display: grid;");
    expect(phone).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(phone).toMatch(/\.workbench \.device-table thead \{\n {4}position: absolute;/);
    // No desk rule changes the table's display.
    expect(css.slice(0, phoneAt)).not.toMatch(/\.device-table tbody tr \{\n\s+display: grid/);
  });

  it("the frame fix is phone-only and scoped to chips inside the results disclosures", () => {
    expect(phone).toContain(".workbench .disc-panel .refchip {\n    border-left: 0;\n    border-right: 0;");
    expect(phone).toContain(".workbench .disc-panel .refchip .chip-sum,\n  .workbench .disc-panel .refchip .chip-body {\n    padding-left: 0;\n    padding-right: 0;");
    // The panel's own padding (shared with the pricing card) is untouched.
    expect(phone).not.toMatch(/\.disc-panel \{/);
  });
});
