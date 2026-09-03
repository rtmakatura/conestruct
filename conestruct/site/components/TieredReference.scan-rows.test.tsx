// @vitest-environment happy-dom
//
// #224 phase 3 (s2-arc17, commit 4) — section 03 renders the scan's
// facts as rows: a detected condition's adjustment row carries the
// s2-arc4 margin evidence (count · nearest ft · first detail), a
// scanned-and-absent condition is a named ✓ pass, the keyless buckets
// sit in the reference tier, and NOT-CHECKED is a counted ⚠ item.
// Rule 11 — mounted on the RECORDED scanned fixtures (the same two the
// expectation JSON pins), reading the rows a user reads.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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

afterEach(cleanup);

describe("section 03 scan rows (#224 phase 3) — scanned-lakewood", () => {
  const fx = load("scanned-lakewood");
  const scan = fx.audit.sections.site_scan as unknown as {
    measured_at: string;
    buckets: Record<string, { count: number; nearest_distance_ft: number; details: string[] }>;
  };

  it("a detected condition's row carries the wire's evidence, printed as sent", async () => {
    const user = userEvent.setup();
    mount(fx);
    // Sidewalks fired the pedestrian adjustment (▲, devices added).
    const changed = chipOf("Changed this plan");
    const pedRow = within(changed).getByText("Pedestrian sidewalks present").closest(
      ".check-list-item",
    ) as HTMLElement;
    const b = scan.buckets.sidewalks;
    expect(within(pedRow).getByText(
      `${b.count} found · nearest ${b.nearest_distance_ft} ft from anchor · ${b.details[0]}`,
    )).toBeTruthy();
    // Intersections fired the advisory adjustment (✓, no devices) — the
    // evidence rides that row too.
    await user.click(screen.getByText("Checked & passed"));
    const checked = chipOf("Checked & passed");
    const ixRow = within(checked).getByText("Intersection within work zone").closest(
      ".check-list-item",
    ) as HTMLElement;
    const ix = scan.buckets.intersections;
    expect(within(ixRow).getByText(
      `${ix.count} found · nearest ${ix.nearest_distance_ft} ft from anchor · ${ix.details[0]}`,
    )).toBeTruthy();
  });

  it("scanned-and-absent conditions are named ✓ passes with the scan time", async () => {
    const user = userEvent.setup();
    mount(fx);
    await user.click(screen.getByText("Checked & passed"));
    const checked = chipOf("Checked & passed");
    for (const label of ["Adjacent interchange (highway ramps)", "School zone nearby"]) {
      const row = within(checked).getByText(label).closest(".check-list-item") as HTMLElement;
      expect(within(row).getByText(/none along the corridor/)).toBeTruthy();
      expect(within(row).getByText(`scanned ${scan.measured_at}`)).toBeTruthy();
      expect(within(row).getByText("OPENSTREETMAP")).toBeTruthy();
      // Rule 13: glyph + words, never hue alone.
      expect(row.querySelector(".ck")?.textContent).toBe("✓");
    }
  });

  it("keyless buckets sit in the reference tier, uncounted", async () => {
    const user = userEvent.setup();
    mount(fx);
    await user.click(screen.getByText("Reference"));
    const ref = chipOf("Reference");
    expect(within(ref).getByText("Site scan — measured, no rule applies")).toBeTruthy();
    for (const label of ["Railroad crossings", "Hospitals", "Road curvature"]) {
      const row = within(ref).getByText(label).closest(".check-list-item") as HTMLElement;
      expect(within(row).getByText("REFERENCE")).toBeTruthy();
      expect(row.querySelector(".ck")?.textContent).toBe("ℹ");
    }
    // Never in a counted tier.
    expect(within(chipOf("Checked & passed")).queryByText("Hospitals")).toBeNull();
    expect(within(chipOf("Changed this plan")).queryByText("Hospitals")).toBeNull();
  });

  it("the rendered ledger equals the shared expectation", () => {
    mount(fx);
    const l = expectations["scanned-lakewood"].ledger;
    expect(screen.getByTestId("tier-ledger").textContent).toContain(
      ledgerLine({ changed: l.changed, attention: l.attention, checked: l.checked, pending: l.pending }),
    );
  });
});

describe("section 03 scan rows (#224 phase 3) — scanned-not-checked", () => {
  const fx = load("scanned-not-checked");

  it("NOT-CHECKED is one counted ⚠ item; the tier opens on its count alone; no scan rows elsewhere", async () => {
    const user = userEvent.setup();
    mount(fx);
    const l = expectations["scanned-not-checked"].ledger;
    expect(screen.getByTestId("tier-ledger").textContent).toContain(
      ledgerLine({ changed: l.changed, attention: l.attention, checked: l.checked, pending: l.pending }),
    );
    const warn = chipOf("Needs attention");
    expect(warn.classList.contains("open")).toBe(true);
    expect(within(warn).getByText("▲ NOT CHECKED")).toBeTruthy();
    await user.click(within(warn).getByText("Site conditions"));
    expect(
      within(warn).getByText("SITE CONDITIONS NOT CHECKED — service unavailable at generation."),
    ).toBeTruthy();
    // The five scanned keys collapse into that one item (ruling d): no
    // absent-rows, no evidence lines anywhere.
    expect(screen.queryByText(/none along the corridor/)).toBeNull();
    expect(screen.queryByText(/ft from anchor/)).toBeNull();
    // The operator-set manual key renders exactly as on any plan.
    expect(
      within(chipOf("Changed this plan")).getByText("Pedestrian sidewalks present"),
    ).toBeTruthy();
  });
});
