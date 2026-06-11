import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import {
  buildShoulderItems,
  finesDoubleItem,
  pendingVerificationItem,
  referenceItem,
} from "./AuditTrail";
import type {
  AuditResponse,
  AuditState,
  PendingItem,
} from "../lib/render-types";
import type { ShoulderScenario } from "../lib/scenarios";

// V1-Wide Item 1, Q-PLAN-1 (Option B): the AuditTrail renderer iterates
// pending_verification.items[] so each pending entry surfaces with its
// own label and its own tracking-issue link. The Δ25 reduction case
// only emits one item in V1 (CDOT case # is already verified for the
// shoulder scenario), so the count=2 path isn't exercised at runtime
// today. This test hand-crafts a two-item payload to lock the renderer
// behavior in before another pending kind ever ships.

function renderBody(pending: AuditResponse["pending_verification"]): string {
  const spec = pendingVerificationItem(pending);
  if (!spec) throw new Error("pendingVerificationItem returned null");
  return renderToStaticMarkup(spec.body as ReactElement);
}

describe("pendingVerificationItem renderer (Option B items[] iteration)", () => {
  const twoItems: PendingItem[] = [
    {
      kind: "cdot_case_number",
      label:
        "CDOT S-630-1 case # is pending verification against the 19-page typical-application set.",
      tracking_issue: "https://github.com/rtmakatura/conestruct/issues/19",
    },
    {
      kind: "stepped_speed_reduction_signs",
      label:
        "Stepped speed-reduction sign placement (>15 mph reduction) is pending in the layout engine.",
      tracking_issue: "https://github.com/rtmakatura/conestruct/issues/36",
    },
  ];

  const twoItemPayload: AuditResponse["pending_verification"] = {
    count: 2,
    note: twoItems[0].label,
    tracking_issue: twoItems[0].tracking_issue,
    items: twoItems,
  };

  it("header text reads '2 references pending'", () => {
    const spec = pendingVerificationItem(twoItemPayload);
    expect(spec).not.toBeNull();
    expect(spec!.result).toBe("2 references pending");
  });

  it("renders both item labels", () => {
    const html = renderBody(twoItemPayload);
    // Substring matches — the full label contains '>' which gets
    // HTML-escaped to '&gt;' in the static markup.
    expect(html).toContain("CDOT S-630-1 case # is pending verification");
    expect(html).toContain("19-page typical-application set");
    expect(html).toContain("Stepped speed-reduction sign placement");
    expect(html).toContain("pending in the layout engine");
  });

  it("renders both items with their own clickable tracking-issue links", () => {
    const html = renderBody(twoItemPayload);
    // Each tracking_issue surfaces as an <a href=...> in the rendered markup.
    expect(html).toContain(`href="${twoItems[0].tracking_issue}"`);
    expect(html).toContain(`href="${twoItems[1].tracking_issue}"`);
  });

  it("the two tracking links go to distinct URLs", () => {
    const html = renderBody(twoItemPayload);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toContain("https://github.com/rtmakatura/conestruct/issues/19");
    expect(hrefs).toContain("https://github.com/rtmakatura/conestruct/issues/36");
    expect(hrefs[0]).not.toBe(hrefs[1]);
  });

  it("renders one <li> per item (the count of list items matches count)", () => {
    const html = renderBody(twoItemPayload);
    const liMatches = html.match(/<li/g) ?? [];
    expect(liMatches.length).toBe(2);
  });

  it("each link surfaces the item.kind in the visible label", () => {
    const html = renderBody(twoItemPayload);
    // Underscores are replaced with spaces in the visible label so the
    // estimator reads e.g. "(stepped speed reduction signs)" not "(stepped_speed_reduction_signs)".
    expect(html).toContain("(cdot case number)");
    expect(html).toContain("(stepped speed reduction signs)");
  });

  // --- Single-item path: the Δ25 case as it actually ships in V1 ----------

  it("single-item payload (Δ25 case) renders one <li> with one link", () => {
    const oneItemPayload: AuditResponse["pending_verification"] = {
      count: 1,
      note: twoItems[1].label,
      tracking_issue: twoItems[1].tracking_issue,
      items: [twoItems[1]],
    };
    const spec = pendingVerificationItem(oneItemPayload);
    expect(spec).not.toBeNull();
    expect(spec!.result).toBe("1 reference pending");
    const html = renderBody(oneItemPayload);
    const liMatches = html.match(/<li/g) ?? [];
    expect(liMatches.length).toBe(1);
    expect(html).toContain(twoItems[1].tracking_issue!);
  });

  // --- Empty path: count=0 returns null (no rollup card) ------------------

  it("count=0 returns null (suppresses the verification card entirely)", () => {
    const spec = pendingVerificationItem({
      count: 0,
      note: "",
      tracking_issue: null,
    });
    expect(spec).toBeNull();
  });
});

// V1-Wide Item 3 — finesDoubleItem renderer. Four branches:
//   (a) applicable=true + envelope → geometry + operational notes table.
//   (b) applicable=true, NO envelope → REQUIRED — MANUAL HANDLING (V1)
//       card with gating + v1_limitation text (Item 3 retroactive
//       correction: flagger + reduction).
//   (c) applicable=false → reason text, dim styling. Legacy payload
//       shape — the corrected backend no longer emits it, but the
//       renderer keeps the branch for cached/old audit bodies.
//   (d) section undefined → renderer returns null (no card).
// Plus a defensive snapshot for the empty operational_notes edge case
// (per Phase B Q-PLAN-1) which shouldn't happen with current backend
// code but the renderer stays safe.

describe("finesDoubleItem renderer", () => {
  const envelopeSection: Record<string, unknown> = {
    applicable: true,
    citation:
      "CO Supplement Sec 2B.13 + S-630-1 Sheet 12 Fines Double Signing Notes",
    envelope: {
      r2_10_station_ft: 1300,
      r2_11_station_ft: -500,
      length_ft: 1800,
      n_assemblies: 1,
      downstream_r2_1_station_ft: -1000,
      downstream_r2_1_label: "SPEED LIMIT 55",
    },
    operational_notes: [
      {
        citation: "S-630-1 Sheet 12, Note 1",
        action: "Install no more than 4 hours before work start.",
      },
      {
        citation: "S-630-1 Sheet 12, Note 2",
        action: "Remove or cover when work concludes.",
      },
      {
        citation: "S-630-1 Sheet 12, Note 3",
        action: "Relocate envelope to follow the active work area.",
      },
      {
        citation: "S-630-1 Sheet 12, Note 4",
        action: "Maintain 250 ft minimum spacing.",
      },
    ],
    source: "CDOT S-630-1 Standard Plan, Sheet 12",
  };

  // Legacy applicable=false payload — pre-correction backends emitted
  // this shape; the renderer keeps the branch for old/cached bodies.
  const carveOutSection: Record<string, unknown> = {
    applicable: false,
    reason:
      "Fines Double signing per CO Supplement Sec 2B.13 and S-630-1 Sheet 12 is scoped to freeway/expressway work zones. Flagger-controlled alternating one-way traffic on 2-lane undivided roads is governed separately by MUTCD Part 6E; Fines Double envelope not applicable. Verify against project-specific engineering judgment.",
  };

  // Item 3 retroactive correction: current backend shape for flagger +
  // reduction — required per Sheet 12, not emitted by the V1 layout.
  const requiredManualSection: Record<string, unknown> = {
    applicable: true,
    citation:
      "CO Supplement Sec 2B.13 + S-630-1 Sheet 12 Fines Double Signing Notes",
    gating:
      "S-630-1 Sheet 12 gates Fines Double signing on worker presence in the roadway/clear zone or hazards in the travelway/shoulders/clear zone; LANE CLOSURE is a listed qualifying hazard and Sheet 12 carries no road-class scoping. A reduced-speed flagger lane closure on a 2-lane undivided road meets the gating.",
    v1_limitation:
      "V1's flagger layout does not emit the Fines Double envelope (R2-10/R2-11, G20-5P/R2-6P assemblies, W3-5 advisory-speed signs, entrance/restoration R2-1). Add Fines Double signage manually per Sheet 12 and CO Supplement Sec 2B.13 until generator support ships. See pending_verification.",
  };

  function renderBody(spec: ReturnType<typeof finesDoubleItem>): string {
    if (!spec) throw new Error("finesDoubleItem returned null");
    return renderToStaticMarkup(spec.body as ReactElement);
  }

  // --- applicable=true (envelope + notes) -------------------------------

  it("renders envelope geometry table with R2-10/R2-11/R2-1 rows", () => {
    const spec = finesDoubleItem(envelopeSection);
    expect(spec).not.toBeNull();
    expect(spec!.title).toBe("Fines Double envelope");
    expect(spec!.dim).toBeUndefined();
    const html = renderBody(spec);
    // Sign codes present
    expect(html).toContain("R2-10");
    expect(html).toContain("R2-11");
    expect(html).toContain("G20-5P / R2-6P");
    expect(html).toContain("R2-1");
    // Station numbers (commas)
    expect(html).toContain("1,300");
    expect(html).toContain("SPEED LIMIT 55");
  });

  it("renders all four operational notes with their Sheet 12 citations", () => {
    const html = renderBody(finesDoubleItem(envelopeSection));
    expect(html).toContain("Install no more than 4 hours");
    expect(html).toContain("Remove or cover when work concludes");
    expect(html).toContain("Relocate envelope");
    expect(html).toContain("Maintain 250 ft minimum spacing");
    expect(html).toContain("S-630-1 Sheet 12, Note 1");
    expect(html).toContain("S-630-1 Sheet 12, Note 4");
  });

  it("result string summarizes assembly count and ops-note count", () => {
    const spec = finesDoubleItem(envelopeSection);
    expect(spec!.result).toBe("1 assemblies · 4 ops notes");
  });

  it("ops-note singular grammar when exactly one note", () => {
    const singleNote = {
      ...envelopeSection,
      operational_notes: [
        {
          citation: "S-630-1 Sheet 12, Note 1",
          action: "Sole operational rule.",
        },
      ],
    };
    const spec = finesDoubleItem(singleNote);
    expect(spec!.result).toBe("1 assemblies · 1 ops note");
  });

  // --- applicable=true with empty operational_notes (defensive snapshot) -

  it("empty operational_notes array still renders envelope (defensive)", () => {
    const noNotes = { ...envelopeSection, operational_notes: [] };
    const spec = finesDoubleItem(noNotes);
    expect(spec).not.toBeNull();
    expect(spec!.result).toBe("1 assemblies");
    const html = renderBody(spec);
    expect(html).toContain("R2-10");
    expect(html).not.toContain("Sheet 12 operational rules");
  });

  // --- applicable=true, no envelope (required — manual handling) --------

  it("required-manual-handling renders gating and limitation, not dimmed", () => {
    const spec = finesDoubleItem(requiredManualSection);
    expect(spec).not.toBeNull();
    expect(spec!.title).toBe("Fines Double envelope");
    expect(spec!.result).toBe("REQUIRED — MANUAL HANDLING (V1)");
    expect(spec!.dim).toBeUndefined();
    const html = renderBody(spec);
    expect(html).toContain("LANE CLOSURE is a listed qualifying hazard");
    expect(html).toContain("no road-class scoping");
    expect(html).toContain("does not emit the Fines Double envelope");
    expect(html).toContain("Add Fines Double signage manually");
    // No envelope table rows — the plan ships no R2-10/R2-11 stations.
    expect(html).not.toContain("BEGIN DOUBLE FINES ZONE (upstream)");
  });

  // --- applicable=false (legacy carve-out payload, back-compat) ---------

  it("carve-out renders reason text with dim styling", () => {
    const spec = finesDoubleItem(carveOutSection);
    expect(spec).not.toBeNull();
    expect(spec!.result).toBe("NOT APPLICABLE");
    expect(spec!.dim).toBe(true);
    const html = renderBody(spec);
    expect(html).toContain("freeway/expressway work zones");
    expect(html).toContain("MUTCD Part 6E");
    expect(html).toContain("Verify against project-specific");
  });

  // --- section absent (no reduction) ------------------------------------

  it("undefined section returns null (no audit card)", () => {
    expect(finesDoubleItem(undefined)).toBeNull();
  });
});

// V1-Wide S1 — referenceItem surfaces the backend case_id and the
// optional Sheet 14 trigger_condition. Before S1, the shoulder builder
// hard-coded "Case 1A"/"Case 1B" and ignored summary.case_id entirely
// — meaning the UI said "Case 1A" while the audit body said "Case 11".
// These tests pin the post-S1 behavior: the renderer reads from the
// backend summary and surfaces trigger_condition verbatim with quoted
// source attribution when present.

describe("referenceItem renderer (V1-Wide S1)", () => {
  function readyAudit(
    overrides: Partial<AuditResponse["summary"]>,
  ): AuditResponse {
    return {
      summary: {
        ta: "TA-2",
        cdot_sheet: "S-630-1",
        case_id: "Case 11: Shoulder closure on divided highway",
        taper_length_ft: 183,
        taper_label: "L/3 (shoulder taper)",
        buffer_space_ft: 495,
        device_spacing_taper_ft: 55,
        device_spacing_tangent_ft: 110,
        step_count: 8,
        ...overrides,
      },
      sections: {
        taper: {},
        buffer: {},
        spacing: {},
        advance: {},
        colorado: {},
        case: {
          url: "https://www.codot.gov/...PDF",
        },
        flagger: {},
        corridor_validation: { checked: false, warnings: [] },
        geometry_validation: { violations: [], all_pass: true },
      },
      pending_verification: { count: 0, note: "", tracking_issue: null },
    };
  }

  it("no_reduction routing → Case 11 label, no Trigger caption", () => {
    const data = readyAudit({
      case_routing: "shoulder_no_reduction",
      case_id: "Case 11: Shoulder closure on divided highway",
    });
    const spec = referenceItem(
      { state: "ready", data },
      "TA-2",
      "S-630-1",
      data.summary.case_id,
      data.summary.trigger_condition,
    );
    expect(spec.result).toBe("Case 11: Shoulder closure on divided highway");
    const html = renderToStaticMarkup(spec.body as ReactElement);
    expect(html).not.toContain("Trigger:");
  });

  it("65 mph reduction → Case 26 label + verbatim Trigger caption in quotes", () => {
    const data = readyAudit({
      case_routing: "shoulder_reduced_speed",
      case_id: "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed",
      trigger_condition:
        "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 8 FT OF TRAVEL WAY",
    });
    const spec = referenceItem(
      { state: "ready", data },
      "TA-2",
      "S-630-1",
      data.summary.case_id,
      data.summary.trigger_condition,
    );
    expect(spec.result).toBe(
      "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed",
    );
    const html = renderToStaticMarkup(spec.body as ReactElement);
    expect(html).toContain("Trigger:");
    // Quoted source attribution — verbatim Sheet 14 text inside &ldquo;&rdquo;.
    expect(html).toContain(
      "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 8 FT OF TRAVEL WAY",
    );
  });

  it("75 mph reduction → Case 27 label + 10 ft Trigger caption", () => {
    const data = readyAudit({
      case_routing: "shoulder_reduced_speed",
      case_id: "Case 27 at 75 mph: Shoulder closure with reduced work-zone speed",
      trigger_condition:
        "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 10 FT OF TRAVEL WAY",
    });
    const spec = referenceItem(
      { state: "ready", data },
      "TA-2",
      "S-630-1",
      data.summary.case_id,
      data.summary.trigger_condition,
    );
    const html = renderToStaticMarkup(spec.body as ReactElement);
    expect(html).toContain("WITHIN 10 FT OF TRAVEL WAY");
  });

  it("55 mph reduction (Case 11 variant) → routing-aware label, no Trigger (no fixture)", () => {
    const data = readyAudit({
      case_routing: "shoulder_reduced_speed",
      case_id:
        "Case 11 (reduced work-zone speed): Shoulder closure on divided highway",
      // trigger_condition deliberately absent — Sheet 14 has no fixture
      // text at 55 mph; verbatim-or-nothing.
    });
    const spec = referenceItem(
      { state: "ready", data },
      "TA-2",
      "S-630-1",
      data.summary.case_id,
      data.summary.trigger_condition,
    );
    expect(spec.result).toContain("Case 11 (reduced work-zone speed)");
    const html = renderToStaticMarkup(spec.body as ReactElement);
    expect(html).not.toContain("Trigger:");
  });
});

// V1-Wide S1 follow-up (#49) — integration-style coverage of the
// buildShoulderItems wiring itself. The 4 referenceItem tests above
// pin the renderer surface, but the upstream call site
// (buildShoulderItems threading summary.case_id + trigger_condition
// into referenceItem) is unverified. If a regression reintroduced the
// pre-S1 hardcoded "Case 1A"/"Case 1B" inside buildShoulderItems, the
// referenceItem tests would still pass because referenceItem is fed
// a literal string and has no view of where it came from.

describe("buildShoulderItems wiring (V1-Wide S1 follow-up)", () => {
  function readyShoulderState(
    overrides: Partial<AuditResponse["summary"]>,
  ): AuditState {
    return {
      state: "ready",
      data: {
        summary: {
          ta: "TA-2",
          cdot_sheet: "S-630-1",
          case_id: "Case 11: Shoulder closure on divided highway",
          taper_length_ft: 183,
          taper_label: "L/3 (shoulder taper)",
          buffer_space_ft: 495,
          device_spacing_taper_ft: 55,
          device_spacing_tangent_ft: 110,
          step_count: 8,
          ...overrides,
        },
        sections: {
          taper: {},
          buffer: {},
          spacing: {},
          advance: {},
          colorado: {},
          case: { url: "https://www.codot.gov/...PDF" },
          flagger: {},
          corridor_validation: { checked: false, warnings: [] },
          geometry_validation: { violations: [], all_pass: true },
        },
        pending_verification: { count: 0, note: "", tracking_issue: null },
      },
    };
  }

  // _scenario is unused by buildShoulderItems (underscore prefix is
  // the contract); a minimal cast is sufficient.
  const dummyShoulder = { kind: "shoulder" } as unknown as ShoulderScenario;
  const identityR = (n: number | string) => String(n);

  it("no_reduction routing surfaces backend case_id (Case 1A/1B regression sentinel)", () => {
    const state = readyShoulderState({
      case_routing: "shoulder_no_reduction",
      case_id: "Case 11: Shoulder closure on divided highway",
    });
    const items = buildShoulderItems(dummyShoulder, state, true, identityR);
    expect(items[5].result).toBe("Case 11: Shoulder closure on divided highway");
    // Strict sentinel — the bug class is a hardcoded string anywhere
    // in the returned spec array, not just the reference row's result.
    const serialized = JSON.stringify(items);
    expect(serialized).not.toContain("Case 1A");
    expect(serialized).not.toContain("Case 1B");
  });

  it("shoulder_reduced_speed routing surfaces Case 26 case_id (Case 1A/1B regression sentinel)", () => {
    const state = readyShoulderState({
      case_routing: "shoulder_reduced_speed",
      case_id: "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed",
      trigger_condition:
        "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 8 FT OF TRAVEL WAY",
    });
    const items = buildShoulderItems(dummyShoulder, state, true, identityR);
    expect(items[5].result).toBe(
      "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed",
    );
    const serialized = JSON.stringify(items);
    expect(serialized).not.toContain("Case 1A");
    expect(serialized).not.toContain("Case 1B");
  });

  it("row count is stable across routings (trigger_condition stays inline, not a separate row)", () => {
    const noReduction = buildShoulderItems(
      dummyShoulder,
      readyShoulderState({
        case_routing: "shoulder_no_reduction",
        case_id: "Case 11: Shoulder closure on divided highway",
      }),
      true,
      identityR,
    );
    const reducedSpeed = buildShoulderItems(
      dummyShoulder,
      readyShoulderState({
        case_routing: "shoulder_reduced_speed",
        case_id: "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed",
        trigger_condition:
          "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 8 FT OF TRAVEL WAY",
      }),
      true,
      identityR,
    );
    expect(noReduction.length).toBe(6);
    expect(reducedSpeed.length).toBe(6);
    expect(noReduction.length).toBe(reducedSpeed.length);
  });

  it("reference row is wired to TA-2 / S-630-1 and is positioned last", () => {
    const items = buildShoulderItems(
      dummyShoulder,
      readyShoulderState({
        case_routing: "shoulder_no_reduction",
        case_id: "Case 11: Shoulder closure on divided highway",
      }),
      true,
      identityR,
    );
    expect(items[5].title).toBe("TA-2 · S-630-1 reference");
    expect(items[5].cite).toBe("CDOT S-630-1");
  });
});
