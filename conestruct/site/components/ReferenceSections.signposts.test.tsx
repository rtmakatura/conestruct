// @vitest-environment happy-dom
//
// #246, redrawn by #443 — the condition rows carry a read-only signpost to
// the strip's correction block: "Correct in setup ↑" on a detected or
// corrected row, "Assert in setup ↑" on a scanned-absent row.  Never a write
// (arc 18 ruling a): the signpost only jumps, and X17 keeps it inside the
// detail.  Mounted on the recorded tiering fixtures (rule 11).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { loadFixture, mountFixture, openEverything, openRow, openSection, rowOf } from "./reference-test-utils";
import { SCAN_BUCKET_TO_FLAG } from "@/lib/tiering";

const scrolled: Element[] = [];
beforeEach(() => {
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});
afterEach(cleanup);

describe("#246 — signposts", () => {
  it("scanned-lakewood: every detected row says Correct in setup, every keyed absent row says Assert in setup", async () => {
    const fx = loadFixture("scanned-lakewood");
    const buckets = (
      fx.audit.sections.site_scan as unknown as { buckets: Record<string, { detected: boolean }> }
    ).buckets;
    const detected = SCAN_BUCKET_TO_FLAG.filter(([b]) => buckets[b]?.detected === true).length;
    const absent = SCAN_BUCKET_TO_FLAG.filter(([b]) => buckets[b] && buckets[b].detected !== true).length;
    expect(detected).toBeGreaterThan(0);
    expect(absent).toBeGreaterThan(0);
    const user = userEvent.setup();
    mountFixture(fx);
    await openEverything(user);
    expect(screen.getAllByRole("link", { name: "Correct in setup ↑" })).toHaveLength(detected);
    expect(screen.getAllByRole("link", { name: "Assert in setup ↑" })).toHaveLength(absent);
    // A signpost is a link to the anchor (never a button: the rows' write
    // sentinel) and jumps to the block when it exists.
    const target = document.createElement("div");
    target.id = "site-corrections";
    target.tabIndex = -1;
    document.body.appendChild(target);
    await user.click(screen.getAllByRole("link", { name: "Correct in setup ↑" })[0]);
    expect(scrolled).toEqual([target]);
    target.remove();
  });

  it("scanned-dismissed: the dismissed row (OPERATOR) signposts Correct in setup — its Undo lives in the block", async () => {
    const user = userEvent.setup();
    mountFixture(loadFixture("scanned-dismissed"));
    await openSection(user, "checked");
    const dismissed = rowOf("checked", "Pedestrian sidewalks present")!;
    await openRow(user, dismissed);
    expect(dismissed.querySelector(".tr-signpost")?.textContent).toBe("Correct in setup ↑");
  });
});
