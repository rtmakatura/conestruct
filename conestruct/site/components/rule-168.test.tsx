// @vitest-environment happy-dom
// Rule 168 (R137 Q1, R145 self-ruled): at the phone width the four download
// cards sit closed behind a "4 files" line under the zip, a disclosure that
// opens onto them (the zip lacks the crew and audit PDFs, so the cards
// stay reachable).  Only where the zip renders; a saved plan keeps its
// cards.  The widths are CSS, pinned below; the fit itself is measured in a
// real browser by scripts/verify-phone-fit.cjs.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { OutputCards } from "./OutputCards";
import { BUNDLE_PART_KINDS, type AuditSummary } from "@/lib/render-types";
import type { Scenario } from "@/lib/scenarios";
import type { DeviceBreakdownState } from "./DeviceBreakdown";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

const SUMMARY: AuditSummary = {
  ta: "TA-3",
  cdot_sheet: "S-630-1",
  case_id: "Case 11",
  taper_length_ft: 183,
  taper_label: "L/3 (shoulder taper)",
  buffer_space_ft: 495,
  device_spacing_taper_ft: 55,
  device_spacing_tangent_ft: 110,
  step_count: 8,
};
const READY: DeviceBreakdownState = {
  state: "ready",
  data: { devices: [], total_devices: 42, unique_types: 6 },
};
const SCENARIO = { meta: { project: "Test Job" } } as unknown as Scenario;
const LABEL = `${BUNDLE_PART_KINDS.length} files`;

afterEach(cleanup);

describe("rule 168: the '4 files' line under the zip", () => {
  it("in the sandbox, closes the cards behind a disclosure that opens onto all four", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: SCENARIO }}
        breakdown={READY}
        auditChecked={13}
        onDownloadAll={() => {}}
      />,
    );
    const line = container.querySelector<HTMLButtonElement>("button.dl-files")!;
    const row = container.querySelector<HTMLElement>("#dl-cards")!;
    expect(line.textContent).toContain(LABEL);
    expect(line.getAttribute("aria-expanded")).toBe("false");
    expect(line.getAttribute("aria-controls")).toBe("dl-cards");
    expect(row.classList.contains("dl-phone-closed")).toBe(true);
    // The cards are in the markup either way: the desk shows them.
    expect(row.querySelectorAll(".dl-card")).toHaveLength(4);

    fireEvent.click(line);
    expect(line.getAttribute("aria-expanded")).toBe("true");
    expect(row.classList.contains("dl-phone-closed")).toBe(false);
    // Every download the cards offer, the two the zip lacks included.
    const buttons = [...row.querySelectorAll(".dl-btn")].map((b) => b.textContent ?? "");
    expect(buttons).toHaveLength(5);
  });

  it("a saved plan (no zip) has no line and its cards are never closed", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: "p1", dirty: false }}
        breakdown={READY}
        auditChecked={13}
      />,
    );
    expect(container.querySelector(".dl-files")).toBeNull();
    expect(container.querySelector("#dl-cards")!.classList.contains("dl-phone-closed")).toBe(false);
  });

  it("the sandbox without a zip handler has no line either", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: SCENARIO }}
        breakdown={READY}
        auditChecked={13}
      />,
    );
    expect(container.querySelector(".dl-files")).toBeNull();
    expect(container.querySelector("#dl-cards")!.classList.contains("dl-phone-closed")).toBe(false);
  });
});

describe("rule 168: the CSS, one count on screen per width", () => {
  const at = css.indexOf("/* Rule 168 (R137 Q1, R145 self-ruled)");
  const desk = css.slice(at, css.indexOf("@media", at));
  const phoneAt = css.indexOf("@media (max-width: 480px) {", at);
  const phone = css.slice(phoneAt, css.indexOf("\n}\n", phoneAt));

  it("hides the line at the desk", () => {
    expect(at).toBeGreaterThan(0);
    expect(desk).toContain(".workbench .dl-files {\n  display: none;\n}");
  });

  it("at the phone: shows the line at 44 px, hides the count beside the zip, closes the cards", () => {
    expect(phone).toContain(".workbench .dl-files {\n    display: flex;");
    expect(phone).toContain("min-height: 44px;");
    expect(phone).toContain(".workbench .dl-all .dl-all-count {\n    display: none;\n  }");
    expect(phone).toContain(".workbench .dls.dl-phone-closed {\n    display: none;\n  }");
  });

  it("nothing outside the phone block closes the cards", () => {
    expect(css.split("dl-phone-closed").length - 1).toBe(1);
  });
});
