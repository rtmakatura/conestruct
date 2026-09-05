// @vitest-environment happy-dom
//
// #246 — section 03 condition rows carry a read-only signpost to the
// strip's correction block: "Correct in setup ↑" on a detected or
// corrected row, "Assert in setup ↑" on a scanned-absent row.  Never a
// write (arc 18 ruling a): the signpost only jumps.  Mounted on the
// recorded tiering fixtures (rule 11).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TieredReference } from "./TieredReference";
import { SCAN_BUCKET_TO_FLAG } from "@/lib/tiering";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { AuditResponse } from "../lib/render-types";
import type { Scenario } from "@/lib/scenarios";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");
interface Recorded {
  scenario: Scenario;
  audit: AuditResponse;
  jurisdiction: JurisdictionBlock;
}
const load = (name: string): Recorded =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf-8"));

function mount(fx: Recorded) {
  return render(
    <TieredReference
      jurisdiction={fx.jurisdiction}
      jurisdictionLoading={false}
      streetClass={null}
      schedule={fx.scenario.schedule ?? null}
      scenario={fx.scenario}
      audit={{ state: "ready", data: fx.audit }}
      onRetry={() => {}}
      generated={true}
      showAudit={true}
      breakdown={{ state: "loading" }}
    />,
  );
}
async function openAll(user: ReturnType<typeof userEvent.setup>) {
  for (const label of [
    "Changed this plan",
    "Needs attention",
    "Checked & passed",
    "Pending / not verified",
    "Reference",
  ]) {
    const sum = screen.queryByText(label)?.closest(".chip-sum") as HTMLElement | null;
    if (sum && sum.getAttribute("aria-expanded") !== "true") await user.click(sum);
  }
}
const scrolled: Element[] = [];
beforeEach(() => {
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});
afterEach(cleanup);

describe("#246 — section 03 signposts", () => {
  it("scanned-lakewood: every detected row says Correct in setup, every keyed absent row says Assert in setup", async () => {
    const fx = load("scanned-lakewood");
    const buckets = (
      fx.audit.sections.site_scan as unknown as { buckets: Record<string, { detected: boolean }> }
    ).buckets;
    const detected = SCAN_BUCKET_TO_FLAG.filter(([b]) => buckets[b]?.detected === true).length;
    const absent = SCAN_BUCKET_TO_FLAG.filter(([b]) => buckets[b] && buckets[b].detected !== true).length;
    expect(detected).toBeGreaterThan(0);
    expect(absent).toBeGreaterThan(0);
    const user = userEvent.setup();
    mount(fx);
    await openAll(user);
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
    const fx = load("scanned-dismissed");
    const user = userEvent.setup();
    mount(fx);
    await openAll(user);
    const dismissed = screen
      .getByText("dismissed by operator", { exact: false })
      .closest(".check-list-item")!;
    expect(dismissed.querySelector(".tr-signpost")?.textContent).toBe("Correct in setup ↑");
  });
});
