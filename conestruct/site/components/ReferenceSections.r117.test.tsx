// @vitest-environment happy-dom
//
// R118 (Ryan, 2026-10-08): "A jurisdiction rule that raised no count moves
// to ✓ Checked & passed, on screen and in the audit PDF's ledger."  R116:
// "No raw keys anywhere in the UI."  Mounted on the recorded near-
// intersection Denver plan (tests/fixtures/tiering/adv-ni-denver.json),
// whose arrow-board rule the layout's own arrow board already meets
// (re-recorded leaf `raised: false`, validation-artifacts/committed/
// r116-ni-polish/rerecord_r117.py).  Rule 11: the words a user reads.
// #443: the section is "Checked and passed"; the row reads the same fields.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { loadFixture, mountFixture, openEverything, openRow, openSection, rowOf } from "./reference-test-utils";

afterEach(cleanup);

describe("R118 — a met jurisdiction rule is a checked row", () => {
  const fx = loadFixture("adv-ni-denver");

  it("reads 'Arrow board required' under Checked and passed, citing its source", async () => {
    const user = userEvent.setup();
    const { container } = mountFixture(fx);
    await openSection(user, "checked");
    const row = rowOf("checked", "Arrow board required")!;
    await openRow(user, row);
    expect(row.textContent).toContain("required by Denver · the plan already places it");
    expect(row.textContent).toContain("DOTI PT-116.1");
    await openEverything(user);
    expect(container.textContent).not.toMatch(/add_device|arrow_board/);
  });

  it("is not a ▲ change", async () => {
    const user = userEvent.setup();
    mountFixture(fx);
    await openEverything(user);
    expect(screen.queryByText("Arrow board added")).toBeNull();
  });
});
