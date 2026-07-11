import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  collectValidationWarnings,
  StatusBar,
} from "./StatusBar";
import type { AuditResponse, AuditState } from "@/lib/render-types";

// PR 7 (UX audit findings UX-21 + UX-22): the strip used to render
// hardcoded demo copy — green "GENERATED · 3 validation warnings · all
// CDOT supplement checks pass · READY FOR TCS REVIEW" from first paint,
// regardless of input validity or backend state.  These tests pin the
// derived behavior: real counts, color tracking verification state, and
// never a green READY alongside open warnings or invalid input.

function makeAudit(opts?: {
  geoViolations?: Array<{
    rule_id: string;
    severity: string;
    message: string;
    mutcd_section: string;
  }>;
  corridorChecked?: boolean;
  corridorWarnings?: Array<{ flag: string; level: string; message: string }>;
  // #60: extra plan_flags categories the strip's verdict now reflects.
  coloradoFails?: number;
  pendingItems?: number;
  // #60: simulate the brief deploy window where the backend hasn't
  // shipped the rollup yet — the response carries no plan_flags.
  omitPlanFlags?: boolean;
}): AuditResponse {
  const geoViolations = opts?.geoViolations ?? [];
  const corridorChecked = opts?.corridorChecked ?? false;
  const corridorWarnings = opts?.corridorWarnings ?? [];
  const validationWarnings =
    geoViolations.length + (corridorChecked ? corridorWarnings.length : 0);
  const complianceFails = opts?.coloradoFails ?? 0;
  const v1Limitations = opts?.pendingItems ?? 0;

  const audit: AuditResponse = {
    summary: {
      ta: "TA-10",
      cdot_sheet: "S-630-1",
      case_id: "Case 17",
      taper_length_ft: 100,
      taper_label: "one-lane two-way taper",
      buffer_space_ft: 360,
      device_spacing_taper_ft: 20,
      device_spacing_tangent_ft: 90,
      step_count: 8,
    },
    sections: {
      taper: {},
      buffer: {},
      spacing: {},
      advance: {},
      colorado: {},
      case: {},
      flagger: {},
      corridor_validation: {
        checked: corridorChecked,
        warnings: corridorWarnings,
      },
      geometry_validation: {
        violations: geoViolations,
        all_pass: true,
      },
    },
    pending_verification: { count: v1Limitations, note: "", tracking_issue: null },
  };

  // Mirror the backend rollup derivation (src/api/audit.py audit_projection),
  // unless the test is exercising the absent-rollup fallback.
  if (!opts?.omitPlanFlags) {
    audit.plan_flags = {
      validation_warnings: validationWarnings,
      compliance_fails: complianceFails,
      v1_limitations: v1Limitations,
      is_clean:
        validationWarnings === 0 && complianceFails === 0 && v1Limitations === 0,
    };
  }
  return audit;
}

const GEO_WARNING = {
  rule_id: "WORK_ZONE_SHORT_VS_BUFFER",
  severity: "warning",
  message:
    "Work zone (200 ft) is unusually short relative to the required " +
    "buffer space (645 ft) at 65 mph. Verify this matches the actual job.",
  mutcd_section: "6C.06",
};

const CORRIDOR_WARNING = {
  flag: "bearing_conflict",
  level: "warning",
  message:
    "Declared corridor bearing 90° diverges from the detected road " +
    "bearing 178°.",
};

const ready = (data: AuditResponse): AuditState => ({
  state: "ready",
  data,
});

describe("collectValidationWarnings", () => {
  it("returns empty when both streams are clean", () => {
    expect(collectValidationWarnings(makeAudit())).toEqual([]);
  });

  it("flattens geometry violations with MUTCD citations", () => {
    const out = collectValidationWarnings(
      makeAudit({ geoViolations: [GEO_WARNING] }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].ruleId).toBe("WORK_ZONE_SHORT_VS_BUFFER");
    expect(out[0].citation).toBe("MUTCD § 6C.06");
  });

  it("ignores corridor warnings when the OSM check did not run", () => {
    const out = collectValidationWarnings(
      makeAudit({ corridorChecked: false, corridorWarnings: [CORRIDOR_WARNING] }),
    );
    expect(out).toEqual([]);
  });

  it("aggregates both streams when the OSM check ran", () => {
    const out = collectValidationWarnings(
      makeAudit({
        geoViolations: [GEO_WARNING],
        corridorChecked: true,
        corridorWarnings: [CORRIDOR_WARNING],
      }),
    );
    expect(out).toHaveLength(2);
    expect(out[1].ruleId).toBe("bearing_conflict");
  });
});

describe("StatusBar (UX-21/22 derived states)", () => {
  it("generating state keeps the COMPUTING line", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="generating"
        inputError={null}
        audit={ready(makeAudit())}
      />,
    );
    expect(html).toContain("COMPUTING");
    expect(html).toContain("status-bar warn");
    expect(html).not.toContain("READY FOR TCS REVIEW");
  });

  it("invalid input is red and blocks — never READY", () => {
    // The literal is the BACKEND's floor message (validators.py phrasing)
    // — since engine-removal PR D the frontend no longer words a floor
    // message of its own; this prop carries the audit fetch's 400 detail.
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError="Work zone length (50 ft) is shorter than the required shoulder taper (L/3) of 184 ft at 55 mph. Increase the work zone to at least 184 ft, or reduce the speed limit."
        audit={ready(makeAudit())}
      />,
    );
    expect(html).toContain("status-bar fail");
    expect(html).toContain("INVALID INPUT");
    expect(html).toContain("GENERATION BLOCKED");
    expect(html).not.toContain("READY FOR TCS REVIEW");
    expect(html).not.toContain("VERIFIED");
  });

  it("first load shows VERIFYING, not a verdict", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={{ state: "loading", lastReady: null }}
      />,
    );
    expect(html).toContain("VERIFYING");
    expect(html).not.toContain("READY FOR TCS REVIEW");
    expect(html).not.toContain("VERIFIED ·");
  });

  it("audit fetch failure shows VERIFICATION UNAVAILABLE, not green", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={{ state: "error", message: "Network error", lastReady: null }}
      />,
    );
    expect(html).toContain("VERIFICATION UNAVAILABLE");
    expect(html).not.toContain("READY FOR TCS REVIEW");
  });

  it("zero warnings is green READY — with a real zero, not demo copy", () => {
    const html = renderToStaticMarkup(
      <StatusBar status="done" inputError={null} audit={ready(makeAudit())} />,
    );
    expect(html).toContain("status-bar pass");
    expect(html).toContain("VERIFIED · 0 validation warnings");
    expect(html).toContain("READY FOR TCS REVIEW");
    // The retired fiction must stay retired.
    expect(html).not.toContain("GENERATED");
    expect(html).not.toContain("3 validation warnings");
    expect(html).not.toContain("all CDOT supplement checks pass");
  });

  it("warnings present is amber with an expandable list — never green READY", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={ready(
          makeAudit({
            geoViolations: [GEO_WARNING],
            corridorChecked: true,
            corridorWarnings: [CORRIDOR_WARNING],
          }),
        )}
      />,
    );
    expect(html).toContain("status-bar caution");
    expect(html).toContain("VERIFIED · 2 validation warnings");
    expect(html).toContain("REVIEW WARNINGS");
    expect(html).not.toContain("READY FOR TCS REVIEW");
    expect(html).not.toContain("status-bar pass");
    // UX-22: each warning enumerated with rule ID + citation.
    expect(html).toContain("WORK ZONE SHORT VS BUFFER");
    expect(html).toContain("unusually short relative to the required");
    expect(html).toContain("MUTCD § 6C.06");
    expect(html).toContain("BEARING CONFLICT");
    expect(html).toContain("OSM GROUND-TRUTH (SOFT CHECK)");
    // Disclosure semantics: summary inside details.
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  });

  it("singular count reads '1 validation warning'", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={ready(makeAudit({ geoViolations: [GEO_WARNING] }))}
      />,
    );
    expect(html).toContain("1 validation warning");
    expect(html).not.toContain("1 validation warnings");
  });

  it("refetch shows VERIFYING — never the previous verdict as current (Decision 2)", () => {
    // Frontend-engine-removal Decision 2 inverted the old
    // stale-while-revalidate behavior for this strip: while the backend
    // hasn't answered for the input on screen, the strip is explicitly
    // indeterminate.  A lastReady verdict (here: amber with a warning)
    // must NOT leak through — and a green lastReady must not either.
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={{
          state: "loading",
          lastReady: makeAudit({ geoViolations: [GEO_WARNING] }),
        }}
      />,
    );
    expect(html).toContain("VERIFYING");
    expect(html).not.toContain("status-bar caution");
    expect(html).not.toContain("1 validation warning");

    const greenStale = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={{ state: "loading", lastReady: makeAudit() }}
      />,
    );
    expect(greenStale).toContain("VERIFYING");
    expect(greenStale).not.toContain("status-bar pass");
    expect(greenStale).not.toContain("READY FOR TCS REVIEW");
  });
});

// #60: the strip used to flip green on zero validation warnings ALONE,
// hiding failing compliance checks and V1 limitations the audit panel
// surfaced.  The verdict now comes from the backend plan_flags rollup;
// any non-empty category goes amber with a per-category breakdown.
describe("StatusBar (#60 plan-flags rollup)", () => {
  it("a failing compliance check with zero validation warnings is now amber, not green", () => {
    // The bug-fix flip: pre-#60 this plan showed green READY because it
    // had no validation warnings; the failing colorado check was invisible.
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={ready(makeAudit({ coloradoFails: 1 }))}
      />,
    );
    expect(html).toContain("status-bar caution");
    expect(html).toContain("1 plan flag");
    expect(html).toContain("REVIEW FLAGS");
    expect(html).toContain("1 compliance check failed");
    expect(html).not.toContain("READY FOR TCS REVIEW");
    expect(html).not.toContain("status-bar pass");
  });

  it("a V1 limitation with zero validation warnings is amber, not green", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={ready(makeAudit({ pendingItems: 1 }))}
      />,
    );
    expect(html).toContain("status-bar caution");
    expect(html).toContain("1 plan flag");
    expect(html).toContain("1 V1 limitation");
    expect(html).not.toContain("READY FOR TCS REVIEW");
    expect(html).not.toContain("status-bar pass");
  });

  it("breaks a mixed flag set down by category — input vs compliance vs V1", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={ready(
          makeAudit({
            geoViolations: [GEO_WARNING],
            coloradoFails: 1,
            pendingItems: 1,
          }),
        )}
      />,
    );
    // 1 validation warning + 1 compliance fail + 1 V1 limitation = 3.
    expect(html).toContain("3 plan flags");
    expect(html).toContain("REVIEW FLAGS");
    // Each category surfaced distinctly (no conflated single number).
    expect(html).toContain("1 validation warning");
    expect(html).toContain("1 compliance check failed");
    expect(html).toContain("1 V1 limitation");
    // The validation-warning detail row still carries its rule + citation.
    expect(html).toContain("WORK ZONE SHORT VS BUFFER");
    expect(html).toContain("MUTCD § 6C.06");
    expect(html).not.toContain("READY FOR TCS REVIEW");
  });

  it("clean rollup (all categories zero) is green READY", () => {
    const html = renderToStaticMarkup(
      <StatusBar status="done" inputError={null} audit={ready(makeAudit())} />,
    );
    expect(html).toContain("status-bar pass");
    expect(html).toContain("READY FOR TCS REVIEW");
  });

  it("validation-warnings-only behavior is unchanged (no 'plan flags' framing)", () => {
    // Acceptance: a plan with only an input warning still surfaces it as a
    // validation warning, exactly as pre-#60 — not the generalized breakdown.
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        audit={ready(makeAudit({ geoViolations: [GEO_WARNING] }))}
      />,
    );
    expect(html).toContain("1 validation warning");
    expect(html).toContain("REVIEW WARNINGS");
    expect(html).not.toContain("plan flag");
    expect(html).not.toContain("REVIEW FLAGS");
  });

  describe("absent rollup (deploy window) is honest unavailability, not a derived verdict", () => {
    // Frontend-engine-removal PR A: the old fallback re-derived the
    // clean/not-clean verdict from warning counts when plan_flags was
    // absent — a frontend-computed compliance verdict (rule 3/10).  A
    // response with no verdict now gets no verdict: the strip shows
    // VERIFICATION UNAVAILABLE and is never green.
    it("no plan_flags + clean warnings → UNAVAILABLE, never green, never crashes", () => {
      const html = renderToStaticMarkup(
        <StatusBar
          status="done"
          inputError={null}
          audit={ready(makeAudit({ omitPlanFlags: true }))}
        />,
      );
      expect(html).toContain("VERIFICATION UNAVAILABLE");
      expect(html).not.toContain("status-bar pass");
      expect(html).not.toContain("READY FOR TCS REVIEW");
    });

    it("no plan_flags + a validation warning → UNAVAILABLE, no derived amber verdict", () => {
      const html = renderToStaticMarkup(
        <StatusBar
          status="done"
          inputError={null}
          audit={ready(
            makeAudit({ geoViolations: [GEO_WARNING], omitPlanFlags: true }),
          )}
        />,
      );
      expect(html).toContain("VERIFICATION UNAVAILABLE");
      expect(html).not.toContain("status-bar caution");
      expect(html).not.toContain("REVIEW WARNINGS");
      expect(html).not.toContain("READY FOR TCS REVIEW");
    });
  });
});
