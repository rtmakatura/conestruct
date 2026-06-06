import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import { finesDoubleItem, pendingVerificationItem } from "./AuditTrail";
import type {
  AuditResponse,
  PendingItem,
} from "../lib/render-types";

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
//   (a) applicable=true → envelope geometry + operational notes table.
//   (b) applicable=false → carve-out reason, dim styling.
//   (c) section undefined → renderer returns null (no card).
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

  // --- applicable=false (carve-out) -------------------------------------

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
