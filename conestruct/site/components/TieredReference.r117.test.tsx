// @vitest-environment happy-dom
//
// R118 (Ryan, 2026-10-08): "A jurisdiction rule that raised no count moves
// to ✓ Checked & passed, on screen and in the audit PDF's ledger."  R116:
// "No raw keys anywhere in the UI."  Mounted on the recorded near-
// intersection Denver plan (tests/fixtures/tiering/adv-ni-denver.json),
// whose arrow-board rule the layout's own arrow board already meets
// (re-recorded leaf `raised: false`, validation-artifacts/committed/
// r116-ni-polish/rerecord_r117.py).  Rule 11: the words a user reads.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TieredReference } from "./TieredReference";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { AuditResponse } from "../lib/render-types";
import type { Scenario } from "@/lib/scenarios";

const FIXTURE = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering", "adv-ni-denver.json");

interface Recorded {
  scenario: Scenario;
  audit: AuditResponse;
  jurisdiction: JurisdictionBlock;
}

function mount(fx: Recorded) {
  return render(
    <TieredReference
      jurisdiction={fx.jurisdiction}
      jurisdictionLoading={false}
      streetClass={null}
      schedule={fx.scenario.schedule ?? null}
      scenario={fx.scenario}
      audit={{ state: "ready", data: fx.audit }}
      onRetry={() => {}}
      generated={true}
      showAudit={true}
      breakdown={{ state: "loading" }}
    />,
  );
}

afterEach(cleanup);

describe("R118 — a met jurisdiction rule is a checked row", () => {
  const fx: Recorded = JSON.parse(readFileSync(FIXTURE, "utf-8"));

  it("reads 'Arrow board required' under Checked & passed, citing its source", async () => {
    const { container } = mount(fx);
    await userEvent.click(screen.getByRole("button", { name: /Checked & passed/ }));
    const row = screen.getByText("Arrow board required").closest("div")!.parentElement!;
    expect(row.textContent).toContain("required by Denver · the plan already places it");
    expect(row.textContent).toContain("DOTI PT-116.1");
    expect(container.textContent).not.toMatch(/add_device|arrow_board/);
  });

  it("is not a ▲ change", () => {
    mount(fx);
    expect(screen.queryByText("Arrow board added")).toBeNull();
  });
});
