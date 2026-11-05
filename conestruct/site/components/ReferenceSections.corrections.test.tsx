// @vitest-environment happy-dom
//
// #224 phase 4 (s2-arc18, ruling c), redrawn by #443 — the sections over the
// two recorded corrected fixtures: a dismissed condition keeps its ✓ row
// (source OPERATOR, the backend sentence as its evidence); an asserted
// condition is a changed row whose evidence is the backend sentence; the
// pending section carries the correction item; the headers equal the shared
// expectation (the pin).  The rows have no write affordance.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  expectHeaderCounts,
  expectations,
  loadFixture,
  mountFixture,
  openEverything,
  openRow,
  openSection,
  rowOf,
  rowsIn,
} from "./reference-test-utils";
import type { AuditResponse, SiteScanCorrection } from "../lib/render-types";
import type { Recorded } from "./reference-test-utils";

const correctionsOf = (fx: Recorded): SiteScanCorrection[] =>
  (fx.audit.sections.site_scan as { corrections?: SiteScanCorrection[] }).corrections ?? [];

afterEach(cleanup);

describe("scanned-dismissed (#224 phase 4)", () => {
  const fx = loadFixture("scanned-dismissed");
  const [c] = correctionsOf(fx);

  it("the dismissed sidewalk is a ✓ checked row with source OPERATOR and the backend sentence; no changed row", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    expect(c.status).toBe("applied");
    await openSection(user, "reference");
    expect(rowOf("reference", "Pedestrian sidewalks present")).toBeNull();
    await openSection(user, "checked");
    const row = rowOf("checked", "Pedestrian sidewalks present")!;
    await openRow(user, row);
    expect(row.textContent).toContain("dismissed by operator");
    expect(row.textContent).toContain("Source: OPERATOR");
    expect(within(row).getByText(c.disclosure)).toBeTruthy();
    expect(row.querySelector(".rr-detail button")).toBeNull(); // discloses, never writes
  });

  it("the correction rides the pending section and the headers equal the pin", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    const l = expectations["scanned-dismissed"].ledger;
    expectHeaderCounts({ checked: l.checked, pending: l.pending });
    await openEverything(user);
    expect(rowsIn("pending").map((r) => r.textContent).join(" ")).toContain(c.disclosure);
  });
});

describe("scanned-asserted (#224 phase 4)", () => {
  const fx = loadFixture("scanned-asserted");
  const [c] = correctionsOf(fx);

  it("the asserted school zone is a changed row whose evidence is the backend sentence, source OPERATOR", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    expect(c.status).toBe("applied");
    await openSection(user, "reference");
    const row = rowOf("reference", "School zone nearby")!;
    await openRow(user, row);
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("▲");
    expect(within(row).getByText(c.disclosure)).toBeTruthy();
    expect(row.textContent).toContain("Source: OPERATOR");
  });

  it("the scanned-absent pass for the asserted key is suppressed and the headers equal the pin", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    await openSection(user, "checked");
    expect(rowOf("checked", "School zone nearby")).toBeNull();
    const l = expectations["scanned-asserted"].ledger;
    expectHeaderCounts({ checked: l.checked, pending: l.pending });
  });
});

describe("a moot correction (synthetic over scanned-lakewood)", () => {
  it("renders as an info reference row with the backend sentence, and the scan's own ✓ row stands", async () => {
    const user = userEvent.setup();
    const fx = loadFixture("scanned-lakewood");
    const moot: SiteScanCorrection = {
      flag: "school_zone",
      action: "dismiss",
      reason: "removed",
      status: "moot",
      scan_detected: false,
      disclosure:
        "Operator dismissal of school zone is moot: the scan found none along the corridor. There's nothing to dismiss.",
    };
    const audit = {
      ...fx.audit,
      sections: {
        ...fx.audit.sections,
        site_scan: { ...(fx.audit.sections.site_scan as object), corrections: [moot] },
      },
    } as AuditResponse;
    mountFixture({ ...fx, audit });
    await openSection(user, "reference");
    const mootRow = rowOf("reference", "School zone nearby")!;
    await openRow(user, mootRow);
    expect(mootRow.querySelector(".rr-glyph")?.textContent).toBe("i");
    expect(within(mootRow).getByText(moot.disclosure)).toBeTruthy();
    await openSection(user, "checked");
    const row = rowOf("checked", "School zone nearby")!;
    expect(row.textContent).toContain("none along the corridor");
  });
});
