// Rule 169 (R144 Q4) and its fold-in: the zone geometry's second home in
// Reference, the hero's geometry cell dropped at the phone width, and the
// advance row's sign table stacked at the phone width with codes kept
// whole.  The fit itself is measured in a real browser by
// scripts/verify-phone-fit.cjs, which now opens each calculation row.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import { ResultsHero, zoneGeometryRows } from "./ResultsHero";
import { ZoneGeometryGroup } from "./ZoneGeometryGroup";
import { buildShoulderItems } from "./AuditTrail";
import type { DeviceBreakdownData, DeviceBreakdownState } from "./DeviceBreakdown";
import type { AuditState } from "../lib/render-types";
import type { ShoulderScenario } from "../lib/scenarios";

const read = (...p: string[]) => readFileSync(join(__dirname, ...p), "utf-8").replace(/\r\n/g, "\n");
const css = read("..", "app", "globals.css");
const spacing = read("..", "DESIGN-SPACING.md");

const DATA: DeviceBreakdownData = {
  devices: [],
  total_devices: 22,
  unique_types: 6,
  zone_geometry: { taper_l_ft: 40, buffer_b_ft: 200, device_spacing_ft: 30, work_len_ft: 1000 },
};
const ready: DeviceBreakdownState = { state: "ready", data: DATA };
const html = (el: ReactElement | null) => (el ? renderToStaticMarkup(el) : "");
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("rule 169: Reference's Zone geometry group", () => {
  it("shows the hero's four rows, as the hero shows them", () => {
    const group = text(html(<ZoneGeometryGroup breakdown={ready} />));
    const hero = text(html(<ResultsHero breakdown={ready} jurisdiction={null} />));
    expect(group.startsWith("Zone geometry")).toBe(true);
    for (const row of zoneGeometryRows(DATA.zone_geometry!)) {
      expect(group).toContain(`${row.label} ${row.value}`);
      expect(hero).toContain(`${row.label} ${row.value}`);
    }
    expect(group).toContain("Taper L 40 ft Buffer B 200 ft Device spacing 30 ft o.c. Work zone 1,000 ft");
  });

  it("rule 83: no zone_geometry renders one unavailable row, nothing computed", () => {
    const { zone_geometry: _omit, ...bare } = DATA;
    void _omit;
    const group = text(html(<ZoneGeometryGroup breakdown={{ state: "ready", data: bare }} />));
    expect(group).toBe("Zone geometry Zone geometry unavailable");
  });

  it("holds the previous answer through a refetch, and says nothing without one", () => {
    expect(text(html(<ZoneGeometryGroup breakdown={{ state: "loading", lastReady: DATA }} />))).toContain(
      "Taper L 40 ft",
    );
    expect(html(<ZoneGeometryGroup breakdown={{ state: "loading", lastReady: null }} />)).toBe("");
    expect(html(<ZoneGeometryGroup breakdown={{ state: "error", message: "boom" }} />)).toBe("");
  });

  it("sits in the Reference tier's body, ahead of the device schedule", () => {
    const tr = read("TieredReference.tsx");
    const zone = tr.indexOf('<div key="zone-geo"');
    const devices = tr.indexOf('<div key="devices"');
    expect(zone).toBeGreaterThan(0);
    expect(zone).toBeLessThan(devices);
    expect(tr).toContain("<ZoneGeometryGroup breakdown={breakdown} />");
    expect(tr).toContain("zone geometry · </>}device schedule");
  });
});

describe("rule 169: the hero's geometry cell at the phone width", () => {
  it("is not rendered at ≤480; the ≤980 stacking stays", () => {
    const at = css.indexOf("/* Rule 169 (R144 Q4): at the phone width the geometry cell");
    const block = css.slice(at, css.indexOf("\n}\n", at) + 3);
    expect(at).toBeGreaterThan(0);
    expect(block).toContain("@media (max-width: 480px) {\n  .workbench .hero-meta {\n    display: none;\n  }\n}");
    expect(css).toContain("@media (max-width: 980px) {\n  .workbench .hero {\n    grid-template-columns: 1fr 1fr;");
  });
});

describe("the fold-in: the advance row's sign table", () => {
  const audit: AuditState = {
    state: "ready",
    data: {
      summary: {
        ta: "TA-3",
        cdot_sheet: "S-630-1",
        case_id: "Case 11",
        taper_length_ft: 40,
        taper_label: "L/3 (shoulder taper)",
        buffer_space_ft: 200,
        device_spacing_taper_ft: 30,
        device_spacing_tangent_ft: 60,
        step_count: 8,
      },
      sections: {
        taper: {},
        buffer: {},
        spacing: {},
        advance: {
          result_text: "1 signs",
          sign_table: [
            { Position: "C (furthest)", Code: "W20-1", "Station (ft)": "1,540", "Distance from Taper (ft)": "300 upstream" },
          ],
        },
        colorado: {},
        case: {},
        flagger: {},
        corridor_validation: { checked: false, warnings: [] },
        geometry_validation: { violations: [], all_pass: true },
      },
      pending_verification: { count: 0, note: "", tracking_issue: null },
    },
  };

  it("marks each cell, labels the stacked lines for sight only, keeps the header for screen readers", () => {
    const items = buildShoulderItems({ kind: "shoulder" } as unknown as ShoulderScenario, audit, true, String);
    const body = html(items[3].body as ReactElement);
    expect(body).toContain('<table class="sign-table" role="table">');
    expect(body).toContain('<th role="columnheader">Code</th>');
    expect(body).toContain('<td role="cell" class="st-code">W20-1</td>');
    expect(body).toContain('<td role="cell" class="st-pos">C (furthest)</td>');
    expect(body).toContain('<span class="st-label" aria-hidden="true">Station (ft)</span>1,540');
    expect(body).toContain('<span class="st-label" aria-hidden="true">From taper (ft)</span>300 upstream');
  });

  it("codes never break, at any width; the labels show only on the phone", () => {
    expect(css).toContain(".workbench .sign-table .st-code {\n  white-space: nowrap;\n}");
    expect(css).toContain(".workbench .sign-table .st-label {\n  display: none;\n}");
  });

  it("stacks one block per sign at ≤480 only", () => {
    const at = css.indexOf("/* R141 (Phase 4 branch 3)");
    const phone = css.indexOf("@media (max-width: 480px) {", at);
    const end = css.indexOf("\n}\n", phone);
    const block = css.slice(phone, end);
    expect(phone).toBeGreaterThan(at);
    for (const sel of [
      ".workbench .sign-table tbody tr {",
      ".workbench .sign-table .st-pos {",
      ".workbench .sign-table .st-code {",
      ".workbench .sign-table .st-label {",
      ".workbench .sign-table thead {",
    ]) {
      expect(block).toContain(sel);
    }
    // Outside the phone block, the sign table carries only the nowrap and
    // the hidden labels: the desk table is otherwise unchanged.
    const outside = css.slice(0, phone) + css.slice(end);
    expect(outside.match(/\.sign-table[^{]*\{/g)?.length).toBe(2);
  });

  it("the device schedule's own phone layout is untouched", () => {
    expect(css).toContain(
      "  .workbench .device-table .dt-code,\n  .workbench .device-table .dt-fn {\n    grid-column: 1;",
    );
    expect(css).toContain(".workbench .device-table td.num {\n    grid-column: 2;\n    grid-row: 1 / span 3;");
  });
});

describe("the fit check opens the calculation rows", () => {
  it("DESIGN-SPACING says so", () => {
    expect(spacing).toContain("then each of the audit's calculation rows opened in turn");
  });
});
