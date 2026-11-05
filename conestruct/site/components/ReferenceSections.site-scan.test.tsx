// @vitest-environment happy-dom
//
// #224 phase 2 (s2-arc16, commit 5, ruling 9), redrawn by #443 — the surface
// of the NOT-CHECKED disclosure.  Phase 3 (s2-arc17, rulings c/d) made it a
// COUNTED attention fact (``audit:scan:not_checked``, one per plan): the
// ledger on the recorded control fixture reads exactly ONE more "needs
// attention" with the disclosure than without it, and the two counted
// sections don't move.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  expectHeaderCounts,
  expectations,
  ledgerOf,
  loadFixture,
  mountFixture,
  openEverything,
  openRow,
  openSection,
  rowOf,
} from "./reference-test-utils";
import type { AuditResponse } from "../lib/render-types";

const control = loadFixture("control-lakewood");
const DISCLOSURE = "SITE CONDITIONS NOT CHECKED: service unavailable at generation.";

function withScan(audit: AuditResponse, scan: Record<string, unknown>): AuditResponse {
  return { ...audit, sections: { ...audit.sections, site_scan: scan } } as AuditResponse;
}

afterEach(cleanup);

describe("the NOT-CHECKED row (#224 phase 2)", () => {
  it("a proceed-anyway plan draws NOT CHECKED with the disclosure verbatim — counted once", async () => {
    const user = userEvent.setup();
    const audit = withScan(control.audit, {
      status: "unavailable",
      error: "scan budget exceeded (20 s)",
      measured_at: "2026-09-03T15:29:51+00:00",
      proceeded_anyway: true,
      disclosure: DISCLOSURE,
    });
    mountFixture({ ...control, audit });
    await openSection(user, "reference");
    const row = rowOf("reference", "Site conditions")!;
    expect(row.textContent).toContain("NOT CHECKED");
    await openRow(user, row);
    expect(screen.getByText(DISCLOSURE)).toBeTruthy();
    expect(document.body.textContent).toContain("scan budget exceeded (20 s)");
    // Phase 3: the count moves by exactly one, in attention, nowhere else.
    const l = expectations["control-lakewood"].ledger;
    expect(ledgerOf({ audit, jurisdiction: control.jurisdiction }).attention).toBe(l.attention + 1);
    expectHeaderCounts({ checked: l.checked, pending: l.pending });
  });

  it("an ok scan without buckets and a not_run scan draw no row; the counts are the same (a missing bucket is no fact, rule 10)", async () => {
    const l = expectations["control-lakewood"].ledger;
    for (const scan of [
      { status: "ok", flags: { school_zone: true } },
      { status: "not_run", reason: "not_requested" },
    ]) {
      cleanup();
      const user = userEvent.setup();
      mountFixture({ ...control, audit: withScan(control.audit, scan) });
      await openEverything(user);
      expect(document.body.textContent).not.toContain("NOT CHECKED");
      expect(document.body.textContent).not.toContain(DISCLOSURE);
      expectHeaderCounts({ checked: l.checked, pending: l.pending });
    }
  });
});
