// @vitest-environment happy-dom
//
// Spacing-scale fixtures (issue #200, DESIGN-SPACING.md).  Two halves,
// deliberately paired (arc12 vacuous-guard lesson): the static half pins
// the CSS rules in globals.css; the mounted half proves the junction
// selector still binds to real form DOM, so the static guard cannot rot
// into asserting a rule nothing matches.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useState } from "react";
import { DEFAULT_FLAGGER } from "@/lib/scenarios";
import type { FlaggerLaneClosureScenario } from "@/lib/scenarios/types";
import { FlaggerForm } from "./FlaggerForm";

afterEach(cleanup);

const css = readFileSync(
  join(__dirname, "..", "app", "globals.css"),
  "utf-8",
);

describe("check-row ↔ field junction (#200 named instance)", () => {
  it("globals.css carries the symmetric-junction rule at the row step (12px)", () => {
    const rule = css.match(
      /\.check-row \+ :not\(\.check-row\) \{[^}]*\}/,
    );
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("margin-top: 12px");
  });

  it("the junction selector binds to the Flagger Road section's seam", () => {
    function Harness() {
      const [s, setS] = useState<FlaggerLaneClosureScenario>({
        ...DEFAULT_FLAGGER,
        // Arms the single-lane confirm row (#136), producing the
        // check-row → Speed-limit Field seam the rule exists for.
        detectedLanesTotal: 1,
      });
      return <FlaggerForm scenario={s} setScenario={setS} />;
    }
    const { container } = render(<Harness />);
    const seam = container.querySelector(".check-row + :not(.check-row)");
    expect(seam).not.toBeNull();
    expect(seam!.textContent).toContain("Speed limit");
  });
});

describe("empty-state on the scale (#200 visible normalizations)", () => {
  it("uses the section step (24px) for inset and trailing margin", () => {
    const block = css.match(/\.empty-state \{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block![0]).toContain("padding: 24px");
    expect(block![0]).toContain("margin-bottom: 24px");
  });
});
