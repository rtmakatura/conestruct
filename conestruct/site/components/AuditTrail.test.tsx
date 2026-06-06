import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import { pendingVerificationItem } from "./AuditTrail";
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
