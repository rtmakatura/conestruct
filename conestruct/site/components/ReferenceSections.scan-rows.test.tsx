// @vitest-environment happy-dom
//
// #224 phase 3 (s2-arc17, commit 4), redrawn by #443 — the scan's facts as
// rows: a detected condition's row carries the s2-arc4 evidence (count ·
// nearest ft · first detail), a scanned-and-absent condition is a named ✓
// pass, the keyless buckets read as one uncounted row under ALONG THE ROAD
// (X14), and NOT-CHECKED is a ⚠ row there.  Rule 11 — mounted on the RECORDED
// scanned fixtures, reading the rows a user reads.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
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
} from "./reference-test-utils";

afterEach(cleanup);

describe("scan rows (#224 phase 3) — scanned-lakewood", () => {
  const fx = loadFixture("scanned-lakewood");
  const scan = fx.audit.sections.site_scan as unknown as {
    measured_at: string;
    buckets: Record<string, { count: number; nearest_distance_ft: number; details: string[] }>;
  };

  it("a detected condition's row carries the wire's evidence, printed as sent", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    // Sidewalks fired the pedestrian adjustment (▲, devices added).
    await openSection(user, "reference");
    const pedRow = rowOf("reference", "Pedestrian sidewalks present")!;
    await openRow(user, pedRow);
    const b = scan.buckets.sidewalks;
    expect(
      within(pedRow).getByText(`${b.count} found · nearest ${b.nearest_distance_ft} ft from anchor · ${b.details[0]}`),
    ).toBeTruthy();
    // Intersections fired the advisory adjustment (✓, no devices) — the
    // evidence rides that row too.
    await openSection(user, "checked");
    const ixRow = rowOf("checked", "Intersection within work zone")!;
    await openRow(user, ixRow);
    const ix = scan.buckets.intersections;
    expect(
      within(ixRow).getByText(`${ix.count} found · nearest ${ix.nearest_distance_ft} ft from anchor · ${ix.details[0]}`),
    ).toBeTruthy();
  });

  it("scanned-and-absent conditions are named ✓ passes with the scan time", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    await openSection(user, "checked");
    for (const label of ["Adjacent interchange (highway ramps)", "School zone nearby"]) {
      const row = rowOf("checked", label)!;
      await openRow(user, row);
      expect(row.textContent).toContain("none along the corridor");
      // #453 X14: the fixture's stamp (2026-09-03T23:14:50+00:00), readable.
      expect(scan.measured_at).toBe("2026-09-03T23:14:50+00:00");
      expect(within(row).getByText("Scanned 2026-09-03 at 23:14 UTC")).toBeTruthy();
      expect(row.textContent).toContain("Source: OpenStreetMap");
      // Rule 13: glyph + words, never hue alone.
      expect(row.querySelector(".rr-glyph")?.textContent).toBe("✓");
    }
  });

  it("X14: the absent keyless buckets read as one row, in section 3, uncounted", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    await openSection(user, "checked");
    await openSection(user, "reference");
    const row = rowOf("reference", "No hospitals, railroad crossings or road curvature")!;
    expect(row).not.toBeNull();
    await openRow(user, row);
    expect(row.textContent).toContain("Source: OpenStreetMap");
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("✓");
    // Never in a counted section.
    expect(rowOf("checked", "No hospitals, railroad crossings or road curvature")).toBeNull();
  });

  it("the headers equal the shared expectation", () => {
    mountFixture(fx);
    const l = expectations["scanned-lakewood"].ledger;
    expectHeaderCounts({ checked: l.checked, pending: l.pending });
  });
});

describe("scan rows (#224 phase 3) — scanned-not-checked", () => {
  const fx = loadFixture("scanned-not-checked");

  it("NOT-CHECKED is one ⚠ row with the disclosure; no scan rows elsewhere", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    const l = expectations["scanned-not-checked"].ledger;
    expectHeaderCounts({ checked: l.checked, pending: l.pending });
    await openSection(user, "reference");
    const row = rowOf("reference", "Site conditions")!;
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("⚠");
    expect(row.textContent).toContain("NOT CHECKED");
    await openRow(user, row);
    expect(within(row).getByText("SITE CONDITIONS NOT CHECKED: service unavailable at generation.")).toBeTruthy();
    // The five scanned keys collapse into that one item (ruling d): no
    // absent-rows, no evidence lines anywhere.
    await openEverything(user);
    expect(screen.queryByText(/none along the corridor/)).toBeNull();
    expect(screen.queryByText(/ft from anchor/)).toBeNull();
    // The operator-set manual key renders exactly as on any plan.
    expect(rowOf("reference", "Pedestrian sidewalks present")).not.toBeNull();
  });
});
