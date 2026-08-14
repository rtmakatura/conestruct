// @vitest-environment happy-dom
//
// Suggestion-strip placement (#201).  Proximity is how a user knows
// which control a confirm applies to: each strip must render inside the
// same .jctl-field as its subject — the jurisdiction suggestion under
// the select, the street-class suggestion under the chips — and after
// its control in DOM order.  Before this fixture both strips pooled at
// the bottom of the section, visually orphaned from their subjects.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { JurisdictionControls } from "./JurisdictionSection";
import type { JurisdictionSuggestion } from "@/lib/jurisdiction";

afterEach(cleanup);

const noop = () => {};

const SUGGEST: JurisdictionSuggestion = {
  suggestion: "denver",
  reason: "pin falls inside the Denver boundary",
  confidence: "inside",
  distance_to_boundary_ft: 1200,
  warnings: [],
  boundary_source: { source: "TIGER", vintage: "2025" },
};

function mountBoth() {
  return render(
    <JurisdictionControls
      jurisdiction={null}
      jurisdictionKey={null}
      setJurisdictionKey={noop}
      streetClass={null}
      setStreetClass={noop}
      suggest={SUGGEST}
      suggestLoading={false}
      onConfirmSuggestion={noop}
      onDismissSuggestion={noop}
      classSuggest="arterial"
      classSuggestTier="secondary"
      onConfirmClassSuggestion={noop}
      onDismissClassSuggestion={noop}
    />,
  );
}

describe("suggestion strips sit under their subject controls (#201)", () => {
  it("the jurisdiction strip shares a field with the select, after it", () => {
    mountBoth();
    const select = screen.getByLabelText<HTMLSelectElement>(/jurisdiction/i);
    const strip = screen.getByText(/pin suggests/i).closest(".jbar-suggest");
    expect(strip).not.toBeNull();
    const field = strip!.closest(".jctl-field");
    expect(field).not.toBeNull();
    expect(field).toBe(select.closest(".jctl-field"));
    expect(
      select.compareDocumentPosition(strip!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("the street-class strip shares a field with the chips, after them", () => {
    mountBoth();
    const chips = screen.getByRole("group", {
      name: /street classification/i,
    });
    const strip = screen
      .getByText(/detected road suggests street class/i)
      .closest(".jbar-suggest");
    expect(strip).not.toBeNull();
    const field = strip!.closest(".jctl-field");
    expect(field).not.toBeNull();
    expect(field).toBe(chips.closest(".jctl-field"));
    expect(
      chips.compareDocumentPosition(strip!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("the two strips no longer share a parent (the pooled arrangement)", () => {
    mountBoth();
    const jur = screen.getByText(/pin suggests/i).closest(".jbar-suggest");
    const cls = screen
      .getByText(/detected road suggests street class/i)
      .closest(".jbar-suggest");
    expect(jur!.parentElement).not.toBe(cls!.parentElement);
  });
});
