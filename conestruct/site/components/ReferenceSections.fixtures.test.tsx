// @vitest-environment happy-dom
//
// s2-arc7 (Refs #219), redrawn by #443 — the mounted half of the ledger
// invariants.  Acceptance: the rows of "Checked and passed" and "Not checked
// yet" equal `ledger.checked` and `ledger.pending` on the recorded wire
// fixtures, and the headers print those numbers.  Rule 11: the counts a user
// reads; Rule 12: every count from the settled ledger.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
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
  sectionEl,
} from "./reference-test-utils";

afterEach(cleanup);

const FIXTURES = [
  "control-lakewood",
  "adv-ni-denver",
  "scanned-lakewood",
  "scanned-not-checked",
  "scanned-dismissed",
  "scanned-asserted",
];

describe("the rows and headers equal the shared expectation", () => {
  for (const name of FIXTURES) {
    it(name, async () => {
      const user = userEvent.setup();
      mountFixture(loadFixture(name));
      const l = expectations[name].ledger;
      expectHeaderCounts({ checked: l.checked, pending: l.pending });
      await openEverything(user);
      expect(rowsIn("checked")).toHaveLength(l.checked);
      expect(rowsIn("pending")).toHaveLength(l.pending);
    });
  }
});

describe("default open state and pending isolation (adv-ni-denver)", () => {
  it("X2: all three sections start closed, and nothing inside them is in the DOM", () => {
    mountFixture(loadFixture("adv-ni-denver"));
    for (const id of ["checked", "pending", "reference"] as const) {
      expect(sectionEl(id).querySelector("button.rs-head")?.getAttribute("aria-expanded")).toBe("false");
      expect(rowsIn(id)).toHaveLength(0);
    }
  });

  it("◌-never-elsewhere: pending labels render only inside the pending section", async () => {
    const user = userEvent.setup();
    const fx = loadFixture("adv-ni-denver");
    mountFixture(fx);
    const label = fx.audit.pending_verification.items![0].label;
    await openSection(user, "checked");
    await openSection(user, "reference");
    expect(document.body.textContent).not.toContain(label);
    await openSection(user, "pending");
    await openRow(user, rowsIn("pending")[0]);
    expect(sectionEl("pending").textContent).toContain(label);
    expect(sectionEl("checked").textContent).not.toContain(label);
  });

  it("#223 parity, mounted: the NI trace rows read inside ✓, with the case from the wire (X11)", async () => {
    const user = userEvent.setup();
    const fx = loadFixture("adv-ni-denver");
    mountFixture(fx);
    await openSection(user, "checked");
    for (const title of ["Taper length", "Buffer space", "Device spacing", "Warning signs", "Standard plan"]) {
      expect(rowOf("checked", title), title).not.toBeNull();
    }
    // Every Colorado check named at a glance (ruled).
    const checks = fx.audit.sections.colorado.checks as { label: string }[];
    for (const c of checks) {
      expect(screen.getAllByText(new RegExp(c.label.slice(0, 25))).length).toBeGreaterThan(0);
    }
  });

  it("the signalized approaches sit under ALONG THE ROAD with the ⚠ voice", async () => {
    const user = userEvent.setup();
    mountFixture(loadFixture("adv-ni-denver"));
    await openSection(user, "reference");
    const row = rowOf("reference", "Cross-street approaches")!;
    expect(row.querySelector(".rr-glyph")?.textContent).toBe("⚠");
    expect(row.textContent).toMatch(/2 legs · far-side work/);
  });
});
