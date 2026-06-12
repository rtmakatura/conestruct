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
}): AuditResponse {
  return {
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
        checked: opts?.corridorChecked ?? false,
        warnings: opts?.corridorWarnings ?? [],
      },
      geometry_validation: {
        violations: opts?.geoViolations ?? [],
        all_pass: true,
      },
    },
    pending_verification: { count: 0, note: "", tracking_issue: null },
  };
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
    const html = renderToStaticMarkup(
      <StatusBar
        status="done"
        inputError="Work zone must be at least 100 ft — the required one-lane two-way taper at 45 mph (MUTCD § 6C.08)."
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

  it("refetch derives from lastReady (stale-while-revalidate)", () => {
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
    expect(html).toContain("status-bar caution");
    expect(html).toContain("1 validation warning");
    expect(html).not.toContain("VERIFYING");
  });
});
