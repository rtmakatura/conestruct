// @vitest-environment happy-dom
//
// #224 phase 2 (s2-arc16, commit 5, ruling 9) — section 03's surface of
// the NOT-CHECKED disclosure.  Phase 3 (s2-arc17, rulings c/d) made it a
// COUNTED attention fact (``audit:scan:not_checked``, one per plan): the
// rendered ledger on the recorded control fixture now reads exactly ONE
// more "needs attention" with the disclosure than without it — the pin
// that flipped when the expectation JSON grew (declared churn).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TieredReference } from "./TieredReference";
import { ledgerLine } from "@/lib/tiering";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { AuditResponse } from "../lib/render-types";
import type { Scenario } from "@/lib/scenarios";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");
interface Recorded {
  scenario: Scenario;
  audit: AuditResponse;
  jurisdiction: JurisdictionBlock;
}
const control: Recorded = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "control-lakewood.json"), "utf-8"),
);
const expectations: Record<string, { ledger: Record<string, number> }> = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "tiering-expectations.json"), "utf-8"),
);
const DISCLOSURE = "SITE CONDITIONS NOT CHECKED — service unavailable at generation.";

function withScan(audit: AuditResponse, scan: Record<string, unknown>): AuditResponse {
  return { ...audit, sections: { ...audit.sections, site_scan: scan } } as AuditResponse;
}

function mount(audit: AuditResponse) {
  return render(
    <TieredReference
      jurisdiction={control.jurisdiction}
      jurisdictionLoading={false}
      streetClass={null}
      schedule={control.scenario.schedule ?? null}
      scenario={control.scenario}
      audit={{ state: "ready", data: audit }}
      onRetry={() => {}}
      generated={true}
      showAudit={true}
      breakdown={{ state: "loading" }}
    />,
  );
}

afterEach(cleanup);

describe("section 03 NOT-CHECKED item (#224 phase 2)", () => {
  it("a proceed-anyway plan renders ▲ NOT CHECKED with the disclosure verbatim — counted once", async () => {
    const user = userEvent.setup();
    mount(
      withScan(control.audit, {
        status: "unavailable",
        error: "scan budget exceeded (20 s)",
        measured_at: "2026-09-03T15:29:51+00:00",
        proceeded_anyway: true,
        disclosure: DISCLOSURE,
      }),
    );
    expect(screen.getByText("▲ NOT CHECKED")).toBeTruthy();
    // Rule 10: the tier holding it auto-expands — never a footnote
    // inside a collapsed chip.
    const chip = screen.getByText("▲ NOT CHECKED").closest(".refchip");
    expect(chip?.classList.contains("open")).toBe(true);
    expect(chip?.querySelector(".chip-sum")?.getAttribute("aria-expanded")).toBe("true");
    // The item is an accordion row: open it to read the body.
    await user.click(screen.getByText("Site conditions"));
    expect(screen.getByText(DISCLOSURE)).toBeTruthy();
    expect(document.body.textContent).toContain("scan budget exceeded (20 s)");
    // Phase 3: the count moves by exactly one, in attention, nowhere else.
    const l = expectations["control-lakewood"].ledger;
    expect(screen.getByTestId("tier-ledger").textContent).toContain(
      ledgerLine({
        changed: l.changed,
        attention: l.attention + 1,
        checked: l.checked,
        pending: l.pending,
      }),
    );
  });

  it("an ok scan without buckets and a not_run scan render no item; the ledger is the same line (a missing bucket is no fact — rule 10)", () => {
    const l = expectations["control-lakewood"].ledger;
    const expected = ledgerLine({
      changed: l.changed,
      attention: l.attention,
      checked: l.checked,
      pending: l.pending,
    });
    for (const scan of [
      { status: "ok", flags: { school_zone: true } },
      { status: "not_run", reason: "not_requested" },
    ]) {
      cleanup();
      mount(withScan(control.audit, scan));
      expect(screen.queryByText("▲ NOT CHECKED")).toBeNull();
      expect(document.body.textContent).not.toContain(DISCLOSURE);
      expect(screen.getByTestId("tier-ledger").textContent).toContain(expected);
    }
  });
});
