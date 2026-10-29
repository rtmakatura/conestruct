// @vitest-environment happy-dom
//
// #428: the manual-entry panel's "Work zone (ft)" box, the second door
// onto `workLen` (WhereBand's field is the first).  It writes per
// keystroke, and it showed a 0 as empty (`value={scenario.workLen || ""}`),
// so a typed 0 vanished as it was typed and the line under it read
// "required".  Mounted with the scenario held in state, as WhereBand
// holds it (Rule 11): type 0, read the box and its error line; empty the
// box, read "required".
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO, type Scenario } from "@/lib/scenarios";
import { ManualFallback } from "./ManualFallback";

afterEach(() => cleanup());

function Harness() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  return (
    <ManualFallback
      scenario={scenario}
      setMeta={(meta) => setScenario({ ...scenario, meta })}
      setScenario={setScenario}
    />
  );
}

const box = () => screen.getByPlaceholderText("e.g., 200") as HTMLInputElement;
const alertText = () => screen.queryByRole("alert")?.textContent ?? null;

describe("#428: the manual panel keeps a typed 0", () => {
  it("a typed 0 stays in the box and reads 'more than 0 ft'; an emptied box reads 'required'", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.clear(box());
    await user.type(box(), "0");
    await user.tab();
    expect(box().value).toBe("0");
    expect(alertText()).toBe("⚠ Work zone length must be more than 0 ft.");

    await user.clear(box());
    await user.tab();
    expect(box().value).toBe("");
    expect(alertText()).toBe("⚠ Work zone length is required.");

    await user.type(box(), "250");
    await user.tab();
    expect(box().value).toBe("250");
    expect(alertText()).toBeNull();
  });
});

// #429: the manual panel draws no provenance marker, so an over-cap length
// there carries no ✓; it reads the cap message from the same validator the
// WHERE band's marker reads (workLenIsRefused derives from it).
describe("#429: the manual panel refuses an over-cap length without a ✓", () => {
  it("99999 reads the cap message and no ✓ in the panel", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.clear(box());
    await user.type(box(), "99999");
    await user.tab();
    expect(box().value).toBe("99999");
    expect(alertText()).toMatch(/^⚠ Work zone can't exceed 20,000 ft/);
    expect(container.textContent).not.toContain("✓");
  });
});

// #432 (Ryan, 2026-10-29): "#432: refuse decimals with "Use whole feet"
// instead of truncating."  The panel's box writes per keystroke; the
// decimal stays and the line under it refuses it.
describe("#432: the manual panel keeps a typed decimal and says 'Use whole feet'", () => {
  it("512.5 stays 512.5 and reads 'Use whole feet'; 512 clears the line", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.clear(box());
    await user.type(box(), "512.5");
    await user.tab();
    expect(box().value).toBe("512.5");
    expect(alertText()).toBe("⚠ Use whole feet for the work zone length.");

    await user.clear(box());
    await user.type(box(), "512");
    await user.tab();
    expect(box().value).toBe("512");
    expect(alertText()).toBeNull();
  });
});

