// @vitest-environment happy-dom
//
// #227 surface 1 — the fact strip.  The pin readout renders as a
// bordered strip of labeled cells (lat / lng / bearing / speed /
// jurisdiction), instrument output rather than field-lookalikes.
// Pinned state only (GO ruling 1): pre-pin the Location step keeps the
// pick CTA + manual fallback unchanged (#222).  The jurisdiction cell
// is a real answer in every state — "None — baseline" when nothing is
// named (guess-correction on record), never an empty.

import fs from "node:fs";
import path from "node:path";
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

function cellValue(label: string): string {
  const cells = Array.from(document.querySelectorAll(".fact-strip .fact-cell"));
  const cell = cells.find(
    (c) => c.querySelector(".tr-step")?.textContent === label,
  );
  if (!cell) throw new Error(`no ${label} cell`);
  return cell.querySelectorAll("span")[1]!.textContent ?? "";
}

describe("#227 fact strip — pin readout as labeled cells", () => {
  it("pre-pin: no strip; the pick CTA is unchanged (GO ruling 1)", async () => {
    await mount(DEFAULT_SHOULDER);
    expect(document.querySelector(".fact-strip")).toBeNull();
    expect(screen.getByText("Pick Location on Map")).toBeTruthy();
  });

  it("pinned: five cells carry lat / lng / bearing / speed / jurisdiction", async () => {
    const user = userEvent.setup();
    await mount(DEFAULT_SHOULDER);
    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN"));

    expect(cellValue("Lat")).toBe("39.714660");
    expect(cellValue("Lng")).toBe("-104.940710");
    expect(cellValue("Bearing")).toBe("85°");
    expect(cellValue("Speed")).toBe(`${DEFAULT_SHOULDER.speed} mph`);
    // No jurisdiction named: the cell answers, it never blanks.
    expect(cellValue("Jurisdiction")).toBe("None — baseline");
  });

  it("a named jurisdiction reaches the cell (option label before the block loads)", async () => {
    const user = userEvent.setup();
    await mount({ ...DEFAULT_SHOULDER, jurisdiction_key: "denver" } as Scenario);
    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN"));
    // The stubbed fetch returns {} — no evaluated block, so the strip
    // falls back to the option label rather than flashing "None".
    expect(cellValue("Jurisdiction")).toMatch(/Denver/);
  });
});

describe("the .fact-strip CSS block exists on the workbench", () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, "../app/globals.css"),
    "utf-8",
  );

  it("strip and cell blocks are defined with the bordered treatment", () => {
    expect(css).toMatch(/\.workbench \.fact-strip \{[^}]*border:/);
    expect(css).toMatch(/\.workbench \.fact-strip \.fact-cell \{[^}]*\}/);
  });
});
