// @vitest-environment happy-dom
//
// #199 card half (#219-migrated to the tiers): with Setup presenting
// "Not set" for an untouched scenario, the hours verdict — now a ◌
// PENDING fact — must speak the same words for a null schedule as for
// an explicit tbd — and the permit lead table (Reference tier) may not
// compute deadlines from a work date the user un-set.

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

const unknownEval = {
  status: "unknown" as const,
  violations: [],
  note: "schedule marked Not set — hours not evaluated",
};

describe("hours verdict — null schedule reads as 'Not set' (#199)", () => {
  it("a null schedule gets the 'Not set' arm, not the mid-entry prompt", async () => {
    const thornton = { ...jur("thornton"), hours_eval: unknownEval };
    mountTiered(thornton, null);
    await userEvent.click(
      screen.getByRole("button", { name: /pending \/ not verified/i }),
    );
    expect(
      screen.getByText(/Schedule marked .Not set. — the windows above are/i),
    ).toBeTruthy();
    expect(screen.queryByText(/enter the\s+work date and start\/end times/i)).toBeNull();
  });

  it("an explicit tbd with residual times shows the same arm — no verdict", async () => {
    const thornton = { ...jur("thornton"), hours_eval: unknownEval };
    mountTiered(thornton, { date_mode: "tbd", start_time: 4.0, end_time: 6.0 });
    await userEvent.click(
      screen.getByRole("button", { name: /pending \/ not verified/i }),
    );
    expect(
      screen.getByText(/Schedule marked .Not set. — the windows above are/i),
    ).toBeTruthy();
    expect(screen.queryByText(/outside window/i)).toBeNull();
  });
});

describe("PermitFYI — residual work date under 'Not set' (#199)", () => {
  it("lead deadlines render '—', not dates computed from a disavowed work date", async () => {
    mountTiered(jur("el_paso"), { date_mode: "tbd", work_date: "2026-07-22" });
    await userEvent.click(screen.getByRole("button", { name: /reference/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /permit — el paso/i }),
    );
    // The sibling test in JurisdictionSection.test.tsx pins the positive
    // arm ("≈ Wed, Jul 8" for date_mode single, same work date).
    expect(screen.getByText(/full closures and detours/i)).toBeTruthy();
    expect(screen.queryByText(/≈/)).toBeNull();
  });
});
