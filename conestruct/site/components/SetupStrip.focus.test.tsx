// @vitest-environment happy-dom
//
// #193 — strip inline editors: autoFocus handled the way in, nothing
// handled the way out (the editor unmounts on done() and focus fell to
// <body> after every inline edit).  Policy: closing an editor returns
// focus to the cell button that opened it.  Mounted (rule 11): every
// assertion reads document.activeElement through the real open → edit
// → close sequence.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { SetupStrip } from "./SetupStrip";
import { PINNED_SHOULDER } from "./test-fixtures";
import type { Scenario } from "@/lib/scenarios";

afterEach(cleanup);

// The strip re-renders on every scenario write (the shell owns the
// state); the harness mirrors that so done()-restore runs against a
// freshly remounted cell button, as in production.
function Harness() {
  const [scenario, setScenario] = useState<Scenario>(PINNED_SHOULDER);
  return (
    <SetupStrip
      scenario={scenario}
      setScenario={setScenario}
      onReopen={() => {}}
      setJurisdictionKey={() => {}}
      setStreetClass={() => {}}
    />
  );
}

describe("SetupStrip editor focus restore (#193)", () => {
  it("opening an editor focuses its control (existing autoFocus)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    expect(document.activeElement).toBe(screen.getByLabelText("Speed"));
  });

  it("closing the speed editor via selection restores the Speed cell", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Edit Speed/i }),
    );
  });

  it("closing the jurisdiction editor restores the Jurisdiction cell", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: /Edit Jurisdiction/i }),
    );
    await user.selectOptions(screen.getByLabelText("Jurisdiction"), "");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Edit Jurisdiction/i }),
    );
  });

  it("blurring the work-zone input to nowhere restores the Work zone cell", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Edit Work zone/i }));
    // Multi-keystroke typing doubles as the cell-stability regression:
    // module-level Simple keeps the input mounted across scenario
    // writes (the old per-render definition remounted it every key).
    const input = screen.getByLabelText("Work zone (ft)");
    await user.clear(input);
    await user.type(input, "600");
    expect(document.activeElement).toBe(input);
    fireEvent.blur(input);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Edit Work zone/i }),
    );
  });

  it("a deliberate focus move away is never overridden by the restore", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Edit Work zone/i }));
    // Focus lands elsewhere first (a tab/click away), THEN the editor
    // closes: restore must not yank focus back.
    const elsewhere = screen.getByRole("button", { name: /Edit Date/i });
    elsewhere.focus();
    fireEvent.blur(screen.getByLabelText("Work zone (ft)"));
    expect(document.activeElement).toBe(elsewhere);
  });

  it("closing the hours editor via the end select restores the Hours cell", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Edit Hours/i }));
    await user.selectOptions(screen.getByLabelText("Hours"), "8");
    await user.selectOptions(screen.getByLabelText("End time"), "15.5");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Edit Hours/i }),
    );
  });
});
