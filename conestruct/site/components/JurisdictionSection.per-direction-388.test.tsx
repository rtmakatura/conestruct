// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { DeltaRowView } from "./JurisdictionSection";
import type { AppliedDelta } from "@/lib/jurisdiction";

// #388 R5: the delta panel shows the count the backend worked out for this
// plan (Thornton stipulation 6: two signs per direction of travel affected),
// never the record's missing qty read as 1 (Rule 3).  Rendered output, Rule 11.

afterEach(cleanup);

const stipulation6 = (qty?: number): AppliedDelta => ({
  severity: "count",
  rule: "CONSTRUCTION AHEAD and MEN WORKING signs required for each direction of travel affected (stipulation #6).",
  effect: {
    op: "add_device",
    device: "advance_warning_signs",
    qty_per_direction: 2,
    note: "per affected direction",
  },
  status: "fires",
  source: {
    doc: "Thornton Construction & TC Permit handout",
    section: "stipulation 6",
    status: "verified",
  },
  ...(qty === undefined ? {} : { qty }),
});

describe("delta panel count (#388)", () => {
  it("shows the backend's per-plan count", () => {
    render(<DeltaRowView d={stipulation6(4)} />);
    expect(screen.getByText("+4")).toBeTruthy();
    expect(screen.getByText("devices")).toBeTruthy();
  });

  it("shows no number when the plan's count is absent (Rule 10)", () => {
    const { container } = render(<DeltaRowView d={stipulation6()} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("per direction")).toBeTruthy();
    expect(container.textContent).not.toMatch(/\+\d/);
  });

  it("keeps a plain qty rule's count", () => {
    const d = stipulation6();
    render(
      <DeltaRowView
        d={{ ...d, effect: { op: "add_device", device: "drum", qty: 3 } }}
      />,
    );
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("devices")).toBeTruthy();
  });
});
