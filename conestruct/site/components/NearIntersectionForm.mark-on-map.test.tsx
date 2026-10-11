// @vitest-environment happy-dom
//
// #301 (R123 Q4) — the near-intersection form's dead-end line gets its
// action: "not marked. Mark the cross street on the map" now sits beside a
// "Mark on map" button that opens the picker with intersection mode armed.
// Authority: validation-artifacts/committed/issue-301-picker-pieces/rulings.md.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_NEAR_INTERSECTION } from "@/lib/scenarios";
import type { NearIntersectionScenario } from "@/lib/scenarios";
import { NearIntersectionForm } from "./NearIntersectionForm";

afterEach(cleanup);

function scenario(marked: boolean): NearIntersectionScenario {
  return {
    ...DEFAULT_NEAR_INTERSECTION,
    meta: {
      ...DEFAULT_NEAR_INTERSECTION.meta,
      lat: 39.7337,
      lng: -104.98753,
      pinModel: "work_start",
      intersection: marked ? { lat: 39.7351, lng: -104.98753, name: "E 12th Ave" } : null,
    },
  } as NearIntersectionScenario;
}

function mount(s: NearIntersectionScenario, onMarkIntersection = vi.fn()) {
  render(
    <NearIntersectionForm
      scenario={s}
      setScenario={() => {}}
      approachConfirm={{ pending: false, reason: null }}
      clearApproachConfirm={() => {}}
      onMarkIntersection={onMarkIntersection}
    />,
  );
  return onMarkIntersection;
}

describe("#301 (R123 Q4): Mark on map", () => {
  it("not marked: the line keeps its words and the button beside it opens the armed picker", () => {
    const onMark = mount(scenario(false));
    expect(screen.getByTestId("ni-placed-by-plan").textContent).toBe(
      "not marked. Mark the cross street on the map",
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark on map" }));
    expect(onMark).toHaveBeenCalledTimes(1);
  });

  it("marked: no button; the line names the crossing", () => {
    mount(scenario(true));
    expect(screen.queryByRole("button", { name: "Mark on map" })).toBeNull();
    expect(screen.getByTestId("ni-placed-by-plan").textContent).toContain("E 12th Ave");
  });
});
