// @vitest-environment happy-dom
//
// #213 V5 — the corridor-validation panel item renders the unavailable
// case instead of silence.  `checked:false` used to be one silent
// bucket for three different causes; the backend now splits it with a
// `reason` (`not_run_no_coords` vs `check_unavailable`), and the panel
// must voice the unavailable one: an Overpass outage at generation is
// an absence of verdict, not an absence of problems.
//
// Rendered-output level (rule 11): the ItemSpec body is mounted, not
// just shape-asserted.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { corridorValidationItem } from "./AuditTrail";

afterEach(cleanup);

describe("corridorValidationItem reason split (#213 V5)", () => {
  it("check_unavailable renders a stated no-verdict item — never null", () => {
    const item = corridorValidationItem({
      checked: false,
      warnings: [],
      reason: "check_unavailable",
      error: "https://overpass-api.de/api/interpreter: ConnectError",
    });
    expect(item).not.toBeNull();
    // Word + glyph (rule 13): ▲ marks degraded detection in the
    // reconciled set; the words carry the verdict.
    expect(item?.result).toBe("▲ CHECK UNAVAILABLE");
    render(<>{item?.body}</>);
    screen.getByText(/road-network warnings were not evaluated/i);
    screen.getByText(/NOT CHECKED/);
  });

  it("not_run_no_coords stays unrendered — there was nothing to check", () => {
    expect(
      corridorValidationItem({
        checked: false,
        warnings: [],
        reason: "not_run_no_coords",
      }),
    ).toBeNull();
  });

  it("a legacy reasonless not-checked dict stays unrendered (pin)", () => {
    expect(corridorValidationItem({ checked: false, warnings: [] })).toBeNull();
  });

  it("checked with warnings renders the warning item unchanged (pin)", () => {
    const item = corridorValidationItem({
      checked: true,
      warnings: [
        {
          flag: "bearing_conflict",
          level: "warning",
          message: "Corridor bearing 10.0° conflicts with detected 95.0°.",
        },
      ],
    });
    expect(item?.result).toBe("⚠ 1 warning");
  });

  it("checked and clean stays unrendered (pin)", () => {
    expect(corridorValidationItem({ checked: true, warnings: [] })).toBeNull();
  });
});
