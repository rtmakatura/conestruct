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
  it("the controls no longer render inside the Location step's body", async () => {
    await mount(DEFAULT_SHOULDER);
    const locationHeader = document.getElementById("rail-step-location")!;
    const locationSection = locationHeader.parentElement!;
    expect(locationSection.querySelector(".jctl")).toBeNull();
    // The band exists, holds the cards, outside the Location section.
    const band = bandSection();
    expect(band.querySelector(".jctl-band .jctl")).not.toBeNull();
    expect(locationSection.contains(band)).toBe(false);
  });

  it("pre-pin: the band is pending — inert body, focusable gate summary", async () => {
    await mount(DEFAULT_SHOULDER);
    const band = bandSection();
    const gate = Array.from(band.querySelectorAll("button")).find((b) =>
      /Pending — set a location first/.test(b.textContent ?? ""),
    );
    expect(gate).toBeTruthy();
    const body = band.querySelector(".step-pending-body");
    expect(body).not.toBeNull();
    expect(body!.getAttribute("aria-hidden")).toBe("true");
  });

  it("pinned: the band goes live and the jurisdiction select is usable", async () => {
    const user = userEvent.setup();
    await mount(DEFAULT_SHOULDER);
    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN"));
    const band = bandSection();
    expect(band.querySelector(".step-pending-body")).toBeNull();
    expect(
      screen.getByLabelText<HTMLSelectElement>(/jurisdiction/i),
    ).toBeTruthy();
  });
});
