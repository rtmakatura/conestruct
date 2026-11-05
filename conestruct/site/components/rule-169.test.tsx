// Rule 169 (R144 Q4) and its fold-in: the zone geometry's second home in
// Reference, the hero's geometry cell dropped at the phone width, and the
// advance row's sign table stacked at the phone width with codes kept
// whole.  The fit itself is measured in a real browser by
// scripts/verify-phone-fit.cjs, which now opens each calculation row.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildShoulderItems } from "./AuditTrail";
import type { AuditState } from "../lib/render-types";
import type { ShoulderScenario } from "../lib/scenarios";
import { renderDetail } from "./detail-test-utils";

const read = (...p: string[]) => readFileSync(join(__dirname, ...p), "utf-8").replace(/\r\n/g, "\n");
const css = read("..", "app", "globals.css");
const spacing = read("..", "DESIGN-SPACING.md");


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

  it("#443: one line per sign, with the code and the wire's own column names (a value keeps its unit)", () => {
    const items = buildShoulderItems({ kind: "shoulder" } as unknown as ShoulderScenario, audit, true, String);
    const body = renderDetail(items[3]);
    expect(body).toContain("C (furthest)");
    expect(body).toContain("W20-1");
    expect(body).toContain("Station (ft): 1,540 · From taper (ft): 300 upstream");
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
