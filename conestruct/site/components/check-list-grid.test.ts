// @vitest-environment happy-dom
//
// #225 (P6/P4) — the shared audit-row grid.  Two halves, paired (the
// spacing-scale idiom): the static half pins the globals.css rules; the
// markup half proves BOTH renderers that wear the class — the strip's
// hand-rolled plan-flags rows (StatusBar) and section 03's CheckRow
// (AuditTrail) — still emit the three-cell row the rule lays out, so
// the static guard cannot rot into pinning a rule nothing matches.
//
// Root cause of #225: `.check-list { max-width: 600px }` sized the row
// by something other than its container (P6), and the annotation
// column was `auto` — per row, so the annotations floated mid-panel
// instead of sharing one right edge (P4).  The fix: the message track is
// `minmax(0, 1fr)` (P6's technical form), the annotation track a fixed
// gutter, right-aligned; at phone width the annotation wraps under the
// label.  The gutter width is CHOSEN (200 px from the longest annotation,
// "OSM GROUND-TRUTH (SOFT CHECK)", 29 ch) and corrected to the measured
// scrollWidth in the browser leg (s2-arc26-cards-rows).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CheckRow } from "./AuditTrail";
import { StatusBar } from "./StatusBar";
import type { AuditResponse, AuditState } from "@/lib/render-types";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");

// The @layer components block holds the audit-row rules; the phone
// query for the wrap lives right after them, inside the same layer.
const block = (selector: string): string => {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{[^}]*\\}");
  const m = css.match(re);
  expect(m, `no rule for ${selector}`).not.toBeNull();
  return m![0].replace(/\s+/g, " ");
};

describe("#225 — the audit-row grid (static half)", () => {
  it("the list no longer caps itself: content fits the container (P6)", () => {
    expect(block(".check-list")).toContain("max-width: none");
    expect(block(".check-list")).not.toContain("600px");
  });

  it("three tracks: 24px symbol · minmax(0, 1fr) message · a fixed 200px annotation gutter", () => {
    expect(block(".check-list-item")).toContain(
      "grid-template-columns: 24px minmax(0, 1fr) 200px",
    );
  });

  it("the annotation sits on the gutter's right edge — one `right` for every row (P4)", () => {
    const src = block(".check-list-item .check-list-src");
    expect(src).toContain("justify-self: end");
    expect(src).toContain("text-align: right");
  });

  it("at ≤ 480px the annotation wraps under the label, left-aligned, in the message track", () => {
    const i = css.indexOf(".check-list-item .check-list-src {");
    expect(i).toBeGreaterThan(0);
    const after = css.slice(i);
    const q = after.indexOf("@media (max-width: 480px)");
    expect(q).toBeGreaterThan(0);
    const query = after.slice(q, after.indexOf("}\n  }", q) + 5).replace(/\s+/g, " ");
    expect(query).toContain(".check-list-item { grid-template-columns: 24px minmax(0, 1fr); }");
    expect(query).toContain(".check-list-item .check-list-src { grid-column: 2; justify-self: start; text-align: left; }");
  });
});

// ── markup half ──

function auditWithWarning(): AuditResponse {
  return {
    summary: {
      ta: "TA-3",
      cdot_sheet: "S-630-1",
      case_id: "Case 11",
      taper_length_ft: 183,
      taper_label: "L/3",
      buffer_space_ft: 495,
      device_spacing_taper_ft: 55,
      device_spacing_tangent_ft: 110,
      step_count: 8,
    },
    sections: {
      geometry_validation: {
        all_pass: false,
        violations: [
          {
            rule_id: "work_zone_short_vs_buffer",
            message: "Work zone is shorter than the buffer.",
            mutcd_section: "6C.06",
            severity: "warning",
          },
        ],
      },
      corridor_validation: {
        checked: true,
        warnings: [
          {
            flag: "no_road_at_anchor",
            level: "soft",
            message: "No classified road within 50 m of the anchor.",
          },
        ],
      },
    },
    pending_verification: { count: 0, note: "", tracking_issue: null },
    plan_flags: {
      validation_warnings: 2,
      compliance_fails: 0,
      v1_limitations: 0,
      is_clean: false,
    },
  } as unknown as AuditResponse;
}

const ready = (data: AuditResponse): AuditState => ({
  state: "ready",
  data,
  forScenario: undefined,
  lastSettledFor: undefined,
});

function rows(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll(".check-list-item")).map((row) => {
    const kids = Array.from(row.children);
    expect(kids).toHaveLength(3);
    expect(kids[0].classList.contains("ck")).toBe(true);
    expect(kids[1].classList.contains("check-list-lbl")).toBe(true);
    expect(kids[2].classList.contains("check-list-src")).toBe(true);
    return kids[2].textContent ?? "";
  });
}

describe("#225 — both renderers emit the three-cell row the grid lays out (markup half)", () => {
  it("the strip's plan-flags dropdown: symbol · label · annotation, the soft-check annotation among them", () => {
    const html = renderToStaticMarkup(
      createElement(StatusBar, { inputError: null, audit: ready(auditWithWarning()) }),
    );
    const src = rows(html);
    expect(src.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("MUTCD § 6C.06");
    expect(src).toContain("OSM GROUND-TRUTH (SOFT CHECK)"); // the longest annotation — the gutter's sizing case
  });

  it("section 03's CheckRow: the same three cells, the tag in the annotation cell", () => {
    const html = renderToStaticMarkup(
      createElement(CheckRow, { label: "Taper length", detail: "183 ft", tag: "MUTCD 6C-3" }),
    );
    expect(rows(html)).toEqual(["MUTCD 6C-3"]);
  });
});
