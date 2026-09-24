// @vitest-environment happy-dom
//
// #227 surface 2 — the jurisdiction & classification band.  The two
// decision cards leave the Location step's body and become their own
// full-width section directly below it (the single-column adoption of
// the PDF's row-one band).  Pre-pin the band renders pending exactly
// like the other downstream steps (#222 mechanics, GO standing): the
// suggestions it hosts are pin-derived.  The #201 placement contract
// (each strip inside its subject's .jctl-field) is internal to the
// cards and pinned by JurisdictionSection.placement.test.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          address: "E Bayaud Ave, Denver",
          lat: 39.71466,
          lng: -104.94071,
          bearingDeg: 85,
          workZoneFt: 400,
          classification: null,
          overrides: {},
        })
      }
    >
      APPLY_PIN
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { openWhere, openWhat } from "./__fixtures__/band-helpers";

// #289 Phase 2 — the column renders ONE band open (rule 65), so reaching a
// control in another band is a click on its fact line, exactly as a user
// does it.  `openWhere` / `openWhat` are that click, and they are no-ops
// when the band is already open (components/__fixtures__/band-helpers.ts).

const fetchMock = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(initial: Scenario) {
  render(<GeneratorShell mode="sandbox" initialScenario={initial} />);
  await act(async () => {
    await Promise.resolve();
  });
}

function bandSection(): HTMLElement {
  const header = screen.getByText("Jurisdiction & classification");
  // FieldGroup shape: <div> <div(header)><span/></div> [pending] <div(body)> </div>
  return header.closest("div")!.parentElement as HTMLElement;
}

describe("#227 jurisdiction band — a full-width sibling of Location", () => {
  // #289 Phase 2 — §8.21: "Jurisdiction & classification band — moved
  // into the WHAT band as two fields (jurisdiction, road type) with their
  // provenance lines."  The band-as-a-section is gone; both of its fields
  // are cells, and the suggestion slot rides the jurisdiction cell so a
  // confirm still sits beside the control it applies to (#201).
  //
  // What this suite asserted about PLACEMENT — the controls are outside
  // the Location step, in their own full-width band below the pin —
  // retires with the section it described.  What it asserted about
  // CAUSALITY survives and is what these cases now hold to: the
  // suggestion is downstream of the pin, and pre-pin there is nothing to
  // suggest.
  it("the fields are cells in the WHAT band, not a section of their own", async () => {
    const user = userEvent.setup();
    await mount(DEFAULT_SHOULDER);
    await openWhere();
    await user.click(screen.getByText("Pick on map"));
    await user.click(screen.getByText("APPLY_PIN"));
    await openWhat();
    // The two fields §8.21 names, each in the grid, each with a
    // provenance line under it (rule 137).
    expect(document.querySelector("#what-jurisdiction")).not.toBeNull();
    expect(document.querySelector("#what-road-type")).not.toBeNull();
    expect(document.querySelector('[data-testid="prov-jurisdiction"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="prov-road-type"]')).not.toBeNull();
    // #289 hand-check, 2026-09-23, fix 2: the street-class half carries
    // no boxed panel — `.jctl` is a 1 px rule on `--canvas` and
    // `.jctl-field` an inset, which is the setup panel's framing and has
    // no place in a grid cell.  #289 WHAT density (Ryan, 2026-09-24):
    // "Street classification becomes its own cell in the second group,
    // out of the road-type cell."  Present, not dropped: the chips are in
    // that cell, and in no other.
    expect(document.querySelector(".jctl")).toBeNull();
    const classCell = document.querySelector('[data-testid="cell-street-class"]')!;
    expect(classCell.querySelector(".classpick")).not.toBeNull();
    expect(document.querySelector('[data-testid="plan-details"]')!.contains(classCell)).toBe(true);
    expect(
      document.querySelector('[data-testid="cell-road-type"]')!.querySelector(".classpick"),
    ).toBeNull();
    expect(document.querySelectorAll(".classpick")).toHaveLength(1);
    // And the section that used to hold them is gone with the panel.
    expect(document.querySelector(".jctl-band")).toBeNull();
  });

  it("pre-pin: nothing to suggest, so nothing is mounted", async () => {
    await mount(DEFAULT_SHOULDER);
    // #222's pending treatment was how the old band said "set a location
    // first" while still rendering.  The column says it by being on the
    // step that sets one: WHERE is open, and the jurisdiction cell — with
    // its suggestion slot — is not on screen at all.
    expect(document.querySelector('[data-testid="band-stack"]')!
      .getAttribute("data-open-band")).toBe("where");
    expect(document.querySelector("#what-jurisdiction")).toBeNull();
    expect(document.querySelector(".jbar-suggest")).toBeNull();
  });

  it("pinned: the cell goes live and the select is usable", async () => {
    const user = userEvent.setup();
    await mount(DEFAULT_SHOULDER);
    await openWhere();
    await user.click(screen.getByText("Pick on map"));
    await user.click(screen.getByText("APPLY_PIN"));
    await openWhat();
    const select = screen.getByLabelText<HTMLSelectElement>(/^Jurisdiction/);
    expect(select.disabled).toBe(false);
    await user.selectOptions(select, "denver");
    expect(select.value).toBe("denver");
  });
});
