import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import {
  buildFlaggerItems,
  buildShoulderItems,
  finesDoubleItem,
  pendingVerificationItem,
  referenceItem,
  siteAdjustmentsItem,
  type ItemSpec,
} from "./AuditTrail";
import type {
  AuditResponse,
  AuditState,
  PendingItem,
} from "../lib/render-types";
import type {
  FlaggerLaneClosureScenario,
  ShoulderScenario,
  SiteConditions,
} from "../lib/scenarios";

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

// V1-Wide Item 3 — finesDoubleItem renderer. Three branches:
//   (a) applicable=true → envelope geometry + operational notes table
//       (flagger bodies carry the Case-42 per-direction geometry since
//       the Item 3 correction PR 2; extra *_opposing fields are
//       ignored by the renderer).
//   (b) applicable=false → reason text, dim styling. Legacy payload
//       shape — the corrected backend no longer emits it, but the
//       renderer keeps the branch for cached/old audit bodies.
//   (c) section undefined → renderer returns null (no card).
// Plus a defensive snapshot for the empty operational_notes edge case
// (per Phase B Q-PLAN-1) which shouldn't happen with current backend
// code but the renderer stays safe.  (PR 1's interim REQUIRED —
// MANUAL HANDLING branch was removed in PR 2.)

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

  // --- applicable=true with flagger per-direction geometry (PR 2) -------

  it("flagger envelope body renders geometry; extra opposing fields ignored", () => {
    const flaggerEnvelopeSection: Record<string, unknown> = {
      ...envelopeSection,
      gating:
        "S-630-1 Sheet 12 gates Fines Double signing on worker presence or hazards; LANE CLOSURE is a listed qualifying hazard.",
      envelope: {
        ...(envelopeSection.envelope as Record<string, unknown>),
        entrance_r2_1_station_ft: 250,
        entrance_r2_1_label: "SPEED LIMIT 30",
        mirrored_per_direction: true,
        r2_10_station_ft_opposing: -2360,
        r2_11_station_ft_opposing: 1460,
        downstream_r2_1_station_ft_opposing: 1960,
        geometry_note: "CDOT Case 42 chain-insertion geometry.",
      },
    };
    const spec = finesDoubleItem(flaggerEnvelopeSection);
    expect(spec).not.toBeNull();
    expect(spec!.result).toBe("1 assemblies · 4 ops notes");
    expect(spec!.dim).toBeUndefined();
    const html = renderBody(spec);
    expect(html).toContain("R2-10");
    expect(html).toContain("R2-11");
    expect(html).toContain("1,300");
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

// UX-19 — referenceItem surfaces the backend case-section narrative. The
// case section ships two strings the UI previously dropped on the floor:
// ``narrative`` (which CDOT case this matches and how closely — the
// stamping PE's first question) and ``narrative_2`` (layout-conformance +
// spacing note). These tests pin: both render as their own paragraph in
// the expanded body when present, the flagger closest-analog framing
// surfaces verbatim, and an absent case section degrades gracefully to
// the generic sentence without rendering "undefined" or throwing.

describe("referenceItem renderer (UX-19 case narrative)", () => {
  function readyAuditWithCase(
    caseFields: Record<string, unknown>,
  ): AuditResponse {
    return {
      summary: {
        ta: "TA-10",
        cdot_sheet: "S-630-1",
        case_id: "MUTCD TA-10: Flagger one-lane two-way",
        taper_length_ft: 100,
        taper_label: "one-lane two-way taper",
        buffer_space_ft: 360,
        device_spacing_taper_ft: 20,
        device_spacing_tangent_ft: 90,
        step_count: 16,
      },
      sections: {
        taper: {},
        buffer: {},
        spacing: {},
        advance: {},
        colorado: {},
        case: caseFields,
        flagger: {},
        corridor_validation: { checked: false, warnings: [] },
        geometry_validation: { violations: [], all_pass: true },
      },
      pending_verification: { count: 0, note: "", tracking_issue: null },
    };
  }

  const FLAGGER_NARRATIVE =
    "This scenario matches MUTCD 11th Ed. Part 6 TA-10 (the federal " +
    "standard for flagger-controlled alternating one-way traffic on a " +
    "2-lane undivided highway). CDOT S-630-1 does not include a general " +
    "flagger one-lane two-way case; Case 17 (lane closure at a curve) is " +
    "the closest CDOT analog but is curve-specialized.";
  const FLAGGER_NARRATIVE_2 =
    "The generated plan follows the same device layout as the reference " +
    "case with spacing computed for 55 mph.";

  it("renders both narrative paragraphs (flagger closest-analog + layout note)", () => {
    const data = readyAuditWithCase({
      url: "https://www.codot.gov/...PDF",
      narrative: FLAGGER_NARRATIVE,
      narrative_2: FLAGGER_NARRATIVE_2,
    });
    const spec = referenceItem(
      { state: "ready", data },
      "TA-10",
      "S-630-1",
      data.summary.case_id,
    );
    const html = renderToStaticMarkup(spec.body as ReactElement);
    // The closest-analog framing — the exact answer to "which case is
    // this based on, and how closely?"
    expect(html).toContain(
      "CDOT S-630-1 does not include a general flagger one-lane two-way case",
    );
    expect(html).toContain(
      "Case 17 (lane closure at a curve) is the closest CDOT analog but is curve-specialized",
    );
    // The layout/spacing note as its own paragraph.
    expect(html).toContain(
      "follows the same device layout as the reference case with spacing computed for 55 mph",
    );
    // The generic lead-in is still present (additive, not replaced).
    expect(html).toContain("Plan matched against MUTCD Typical Application");
  });

  it("renders narrative and narrative_2 as two distinct paragraphs", () => {
    const data = readyAuditWithCase({
      url: "https://www.codot.gov/...PDF",
      narrative: FLAGGER_NARRATIVE,
      narrative_2: FLAGGER_NARRATIVE_2,
    });
    const spec = referenceItem(
      { state: "ready", data },
      "TA-10",
      "S-630-1",
      data.summary.case_id,
    );
    const html = renderToStaticMarkup(spec.body as ReactElement);
    // Generic lead-in + narrative + narrative_2 = three <p> ahead of the
    // PDF link paragraph (no trigger here). Assert the two narrative
    // strings land in separate paragraphs, not concatenated into one.
    const pCount = (html.match(/<p[> ]/g) ?? []).length;
    expect(pCount).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain("curve-specialized.The generated plan");
  });

  it("renders the shoulder Case 11 narrative", () => {
    const data = readyAuditWithCase({
      url: "https://www.codot.gov/...PDF",
      narrative:
        "This scenario matches CDOT Standard Plan S-630-1, Case 11: " +
        "shoulder closure on a divided highway.",
      narrative_2:
        "The generated plan follows the same device layout as the " +
        "reference case with spacing computed for 65 mph.",
    });
    const spec = referenceItem(
      { state: "ready", data },
      "TA-2",
      "S-630-1",
      "Case 11: Shoulder closure on divided highway",
    );
    const html = renderToStaticMarkup(spec.body as ReactElement);
    expect(html).toContain(
      "matches CDOT Standard Plan S-630-1, Case 11: shoulder closure on a divided highway",
    );
    expect(html).toContain("spacing computed for 65 mph");
  });

  it("degrades gracefully when the case section omits narrative fields", () => {
    // The pre-UX-19 fixture shape: case carries only a url. The body must
    // render the generic sentence + link and NOT emit "undefined".
    const data = readyAuditWithCase({ url: "https://www.codot.gov/...PDF" });
    const spec = referenceItem(
      { state: "ready", data },
      "TA-2",
      "S-630-1",
      "Case 11: Shoulder closure on divided highway",
    );
    const html = renderToStaticMarkup(spec.body as ReactElement);
    expect(html).toContain("Plan matched against MUTCD Typical Application");
    expect(html).not.toContain("undefined");
    expect(html).toContain("Open S-630-1 PDF on CDOT.gov");
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

// #97 — citation-edition regression guard. The taper/buffer/spacing cite
// header + footer chip used to be HARDCODED in this component and had
// drifted to 2009-edition numbers (§6C.06 / §6C.08 / §6C.09 / Table 6C-3)
// while the backend prose ``source`` already said 6B/6K. The fix repoints
// them to the backend ``section.citation.{cite,footer}`` field (single
// source). This guard fails if any stale-edition string reappears in the
// rendered panel, for both deploy states (backend field present, and
// absent → corrected-constant fallback) across shoulder + flagger, and
// covers the driveways site-adjustment rule (§6C.09 → §6K.01).
//
// NOTE on coverage bounds (honest reporting): the guard asserts the
// SPECIFIC strings below, not a blanket "6C". Out of this PR's scope and
// deliberately NOT asserted: the flagger sight-distance cite "MUTCD §
// 6E.06" (Ch. 6E → 6D renumber — adjacent debt) and the Site-adjustments
// aggregate header "MUTCD § 6C / § 6D" (rides with the SITE_ADJUSTMENT_DETAIL
// → backend follow-up, #71).
describe("#97 audit-panel citation edition guard", () => {
  const STALE = ["§ 6C.06", "§ 6C.08", "§ 6C.09", "6C-3", "CHAPTER 6C"];
  const FRESH = ["6B.06", "6K.01", "6B.08", "6B-3"];

  function itemsHtml(items: ItemSpec[]): string {
    return items
      .map((it) => `${it.cite} ${renderToStaticMarkup(it.body as ReactElement)}`)
      .join("\n");
  }

  // Section payloads with the backend-fed values the item helpers read.
  // ``withCitation`` controls the deploy state under test.
  function readySections(
    withCitation: boolean,
    taperCitation = {
      cite: "MUTCD § 6B.08",
      footer: "MUTCD 2023 EDITION · CHAPTER 6B · TABLE 6B-3",
    },
  ): AuditResponse["sections"] {
    const taper: Record<string, unknown> = {
      closure_type: "shoulder",
      formula_choice: "L = W × S",
      L_calc_text: "L = 12 × 55 = 660 ft",
      L_third_calc_text: "L/3 = 660 / 3 = 220 ft",
    };
    const buffer: Record<string, unknown> = {
      lookup_text: "MUTCD Table 6B-2: 495 ft",
    };
    const spacing: Record<string, unknown> = {
      in_taper_text: "55 mph -> 55 ft spacing (MUTCD Sec 6K.01: speed in feet)",
      on_tangent_text: "55 mph -> 110 ft spacing (MUTCD Sec 6K.01: 2x speed)",
      taper_count_text: "L/3 = 220 ft / 55 ft max spacing -> 5 drums",
      tangent_count_text: "1000 ft / 110 ft max spacing -> 10 cones",
      n_taper_drums_required: 5,
      n_tangent_cones_required: 10,
    };
    if (withCitation) {
      taper.citation = taperCitation;
      buffer.citation = {
        cite: "MUTCD § 6B.06",
        footer: "MUTCD § 6B.06 · STOPPING SIGHT DISTANCE",
      };
      spacing.citation = {
        cite: "MUTCD § 6K.01",
        footer: "MUTCD § 6K.01 · CHANNELIZING DEVICE SPACING",
      };
    }
    return {
      taper,
      buffer,
      spacing,
      advance: {},
      colorado: {},
      case: { url: "https://www.codot.gov/...PDF" },
      flagger: {},
      corridor_validation: { checked: false, warnings: [] },
      geometry_validation: { violations: [], all_pass: true },
    };
  }

  function readyState(withCitation: boolean): AuditState {
    return {
      state: "ready",
      data: {
        summary: {
          ta: "TA-2",
          cdot_sheet: "S-630-1",
          case_id: "Case 11: Shoulder closure on divided highway",
          taper_length_ft: 220,
          taper_label: "L/3 (shoulder taper)",
          buffer_space_ft: 495,
          device_spacing_taper_ft: 55,
          device_spacing_tangent_ft: 110,
          step_count: 8,
        },
        sections: readySections(withCitation),
        pending_verification: { count: 0, note: "", tracking_issue: null },
      },
    };
  }

  const dummyShoulder = { kind: "shoulder" } as unknown as ShoulderScenario;
  const dummyFlagger = {
    kind: "flagger_lane_closure",
    speed: 55,
    afad: false,
    pilotCar: false,
  } as unknown as FlaggerLaneClosureScenario;
  const identityR = (n: number | string) => String(n);

  // Field-present (post-deploy) and field-absent (Vercel-leads-Modal window)
  // × shoulder + flagger. Both must render the 11th-edition strings and none
  // of the stale ones.
  for (const withCitation of [true, false]) {
    const label = withCitation ? "backend field present" : "fallback (field absent)";

    it(`shoulder panel — ${label} — no stale, all fresh`, () => {
      const html = itemsHtml(
        buildShoulderItems(dummyShoulder, readyState(withCitation), true, identityR),
      );
      for (const s of STALE) expect(html).not.toContain(s);
      for (const f of FRESH) expect(html).toContain(f);
    });

    it(`flagger panel — ${label} — no stale, all fresh`, () => {
      const html = itemsHtml(
        buildFlaggerItems(dummyFlagger, readyState(withCitation), true, identityR),
      );
      for (const s of STALE) expect(html).not.toContain(s);
      for (const f of FRESH) expect(html).toContain(f);
    });
  }

  it("loading fallback (no data yet) — cites are 11th-edition, never stale", () => {
    const loading: AuditState = { state: "loading", lastReady: null };
    const items = buildShoulderItems(dummyShoulder, loading, false, identityR);
    const cites = items.map((it) => it.cite).join(" ");
    for (const s of STALE) expect(cites).not.toContain(s);
    // Footers aren't rendered in the "Computing…" body, so only the cite
    // headers are asserted present here.
    expect(cites).toContain("6B.08");
    expect(cites).toContain("6B.06");
    expect(cites).toContain("6K.01");
  });

  it("reads the backend citation field, not a frontend hardcode", () => {
    // Feed a sentinel footer only the backend path can surface: if the
    // panel re-derived/hardcoded, this string could never appear.
    const sentinel = {
      cite: "MUTCD § 6B.08",
      footer: "MUTCD 2023 EDITION · SENTINEL-FROM-BACKEND",
    };
    const base = readyState(true) as Extract<AuditState, { state: "ready" }>;
    const state: AuditState = {
      state: "ready",
      data: { ...base.data, sections: readySections(true, sentinel) },
    };
    const html = itemsHtml(buildShoulderItems(dummyShoulder, state, true, identityR));
    expect(html).toContain("SENTINEL-FROM-BACKEND");
  });

  it("driveways site-adjustment rule cites §6K.01, not the stale §6C.09", () => {
    const spec = siteAdjustmentsItem({ driveways_present: true } as SiteConditions);
    expect(spec).not.toBeNull();
    const html = renderToStaticMarkup(spec!.body as ReactElement);
    expect(html).not.toContain("§ 6C.09");
    expect(html).toContain("§ 6K.01");
  });
});
