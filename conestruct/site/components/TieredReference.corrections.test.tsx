// @vitest-environment happy-dom
//
// #224 phase 4 (s2-arc18, ruling c) — section 03 over the two recorded
// corrected fixtures: a dismissed condition keeps its ✓ row (tag
// OPERATOR, the backend sentence as its evidence); an asserted condition
// is a changed row whose evidence is the backend sentence; the pending
// tier carries the correction item; the rendered ledger equals the
// shared expectation (the pin).  Section 03 has no write affordance.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TieredReference } from "./TieredReference";
import { ledgerLine } from "@/lib/tiering";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { AuditResponse, SiteScanCorrection } from "../lib/render-types";
import type { Scenario } from "@/lib/scenarios";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");

interface Recorded {
  scenario: Scenario;
  audit: AuditResponse;
  jurisdiction: JurisdictionBlock;
}
const load = (name: string): Recorded =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf-8"));
const expectations: Record<string, { ledger: Record<string, number> }> = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "tiering-expectations.json"), "utf-8"),
);

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
const chipOf = (glyphLabel: string) =>
  screen.getByText(glyphLabel).closest(".refchip") as HTMLElement;
const correctionsOf = (fx: Recorded): SiteScanCorrection[] =>
  ((fx.audit.sections.site_scan as { corrections?: SiteScanCorrection[] }).corrections ?? []);

afterEach(cleanup);

describe("section 03 — scanned-dismissed (#224 phase 4)", () => {
  const fx = load("scanned-dismissed");
  const [c] = correctionsOf(fx);

  it("the dismissed sidewalk is a ✓ checked row tagged OPERATOR with the backend sentence; no changed row", async () => {
    const user = userEvent.setup();
    mount(fx);
    expect(c.status).toBe("applied");
    const changed = chipOf("Changed this plan");
    expect(within(changed).queryByText("Pedestrian sidewalks present")).toBeNull();
    await user.click(screen.getByText("Checked & passed"));
    const checked = chipOf("Checked & passed");
    const row = within(checked).getByText("Pedestrian sidewalks present").closest(
      ".check-list-item",
    ) as HTMLElement;
    expect(row.textContent).toContain("dismissed by operator");
    expect(within(row).getByText("OPERATOR")).toBeTruthy();
    expect(within(row).getByText(c.disclosure)).toBeTruthy();
    expect(within(row).queryByRole("button")).toBeNull(); // discloses, never writes
  });

  it("the correction rides the pending tier as the #177 item and the ledger equals the pin", async () => {
    const user = userEvent.setup();
    mount(fx);
    const l = expectations["scanned-dismissed"].ledger;
    expect(screen.getByTestId("tier-ledger").textContent).toContain(
      ledgerLine({ changed: l.changed, attention: l.attention, checked: l.checked, pending: l.pending }),
    );
    await user.click(screen.getByText("Pending / not verified"));
    const pending = chipOf("Pending / not verified");
    expect(pending.textContent).toContain(c.disclosure);
  });
});

describe("section 03 — scanned-asserted (#224 phase 4)", () => {
  const fx = load("scanned-asserted");
  const [c] = correctionsOf(fx);

  it("the asserted school zone is a changed row whose evidence is the backend sentence, tagged OPERATOR", () => {
    mount(fx);
    expect(c.status).toBe("applied");
    const changed = chipOf("Changed this plan");
    const row = within(changed).getByText("School zone nearby").closest(".check-list-item") as HTMLElement;
    expect(within(row).getByText(c.disclosure)).toBeTruthy();
    expect(within(row).getByText("OPERATOR")).toBeTruthy();
  });

  it("the scanned-absent pass for the asserted key is suppressed and the ledger equals the pin", async () => {
    const user = userEvent.setup();
    mount(fx);
    await user.click(screen.getByText("Checked & passed"));
    const checked = chipOf("Checked & passed");
    expect(within(checked).queryByText("School zone nearby")).toBeNull();
    const l = expectations["scanned-asserted"].ledger;
    expect(screen.getByTestId("tier-ledger").textContent).toContain(
      ledgerLine({ changed: l.changed, attention: l.attention, checked: l.checked, pending: l.pending }),
    );
  });
});

describe("section 03 — a moot correction (synthetic over scanned-lakewood)", () => {
  it("renders as an info reference row with the backend sentence, and the scan's own ✓ row stands", async () => {
    const user = userEvent.setup();
    const fx = load("scanned-lakewood");
    const moot: SiteScanCorrection = {
      flag: "school_zone",
      action: "dismiss",
      reason: "removed",
      status: "moot",
      scan_detected: false,
      disclosure:
        "Operator dismissal of school zone is moot — the scan found none along the corridor; nothing to dismiss.",
    };
    const audit = {
      ...fx.audit,
      sections: {
        ...fx.audit.sections,
        site_scan: { ...(fx.audit.sections.site_scan as object), corrections: [moot] },
      },
    } as AuditResponse;
    mount({ ...fx, audit });
    await user.click(screen.getByText("Reference"));
    const reference = chipOf("Reference");
    expect(within(reference).getByText(moot.disclosure)).toBeTruthy();
    await user.click(screen.getByText("Checked & passed"));
    const checked = chipOf("Checked & passed");
    const row = within(checked).getByText("School zone nearby").closest(".check-list-item") as HTMLElement;
    expect(row.textContent).toContain("none along the corridor");
  });
});
