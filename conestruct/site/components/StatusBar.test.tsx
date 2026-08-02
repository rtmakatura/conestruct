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

  it("invalid input (client schema-bounds) is red and blocks — never READY", () => {
    // #180: this prop now carries ONLY the client schema-bounds message
    // (required / ceiling).  A backend 400 arrives via ``refusal`` and
    // renders with the declined vocabulary instead — see below.
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError="Work zone length is required."
        audit={ready(makeAudit())}
      />,
    );
    expect(html).toContain("status-bar fail");
    expect(html).toContain("INVALID INPUT");
    expect(html).toContain("GENERATION BLOCKED");
    expect(html).not.toContain("READY FOR TCS REVIEW");
    expect(html).not.toContain("VERIFIED");
  });

  // #180 — one refusal, one voice: a backend 400 is DECLINED, not broken
  // and not invalid input.
  const FLOOR_400 =
    "Work zone length (50 ft) is shorter than the required shoulder taper " +
    "(L/3) of 184 ft at 55 mph. Increase the work zone to at least 184 ft, " +
    "or reduce the speed limit.";

  it("refusal without an affordance renders the full 400 with declined vocabulary", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        refusal={{ message: FLOOR_400, pointer: null }}
        audit={{ state: "error", message: FLOOR_400, httpStatus: 400, lastReady: null }}
      />,
    );
    expect(html).toContain("status-bar fail");
    expect(html).toContain("PLAN DECLINED");
    expect(html).toContain("at least 184 ft");
    expect(html).toContain("NEEDS INPUT");
    // The error-framing vocabulary is retired on this surface.
    expect(html).not.toContain("INVALID INPUT");
    expect(html).not.toContain("GENERATION BLOCKED");
    expect(html).not.toContain("VERIFICATION UNAVAILABLE");
  });

  it("refusal with an affordance renders the short pointer, never the 400 text", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        refusal={{
          message:
            "This road appears to carry more lanes than a flagger operation covers…",
          pointer:
            "Detection saw a multi-lane road — confirm the lane count in the Road section to proceed.",
        }}
        audit={{ state: "error", message: "…", httpStatus: 400, lastReady: null }}
      />,
    );
    expect(html).toContain("PLAN DECLINED");
    expect(html).toContain("confirm the lane count in the Road section");
    expect(html).toContain("NEEDS REVIEW");
    // The verbatim 400 must not render here — the row note is the voice.
    expect(html).not.toContain("more lanes than a flagger operation covers");
    expect(html).not.toContain("NEEDS INPUT");
  });

  it("client bounds win over a refusal (matches the shell's precedence)", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError="Work zone length is required."
        refusal={{ message: FLOOR_400, pointer: null }}
        audit={ready(makeAudit())}
      />,
    );
    expect(html).toContain("INVALID INPUT");
    expect(html).not.toContain("PLAN DECLINED");
  });

  // #186 — no site chosen: never a verdict for a location nobody set.
  it("locationUnset renders AWAITING LOCATION — chromeless, no verdict, even over a clean audit", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        locationUnset
        audit={ready(makeAudit())}
      />,
    );
    expect(html).toContain("AWAITING LOCATION");
    // Chromeless neutral (rule 13 no-verdict), not an error voice.
    expect(html).toContain("status-bar idle unavail");
    expect(html).not.toContain("READY FOR TCS REVIEW");
    expect(html).not.toContain("VERIFIED");
    expect(html).not.toContain("status-bar fail");
    expect(html).not.toContain("INVALID INPUT");
  });

  it("locationUnset outranks COMPUTING — the spinner never masks the missing pin", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="generating"
        inputError={null}
        locationUnset
        audit={ready(makeAudit())}
      />,
    );
    expect(html).toContain("AWAITING LOCATION");
    expect(html).not.toContain("COMPUTING");
  });

  it("a genuine input error outranks the missing pin", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError="Work zone length is required."
        locationUnset
        audit={ready(makeAudit())}
      />,
    );
    expect(html).toContain("INVALID INPUT");
    expect(html).not.toContain("AWAITING LOCATION");
  });

  it("a refusal outranks the missing pin", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError={null}
        refusal={{ message: FLOOR_400, pointer: null }}
        locationUnset
        audit={ready(makeAudit())}
      />,
    );
    expect(html).toContain("PLAN DECLINED");
    expect(html).not.toContain("AWAITING LOCATION");
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
