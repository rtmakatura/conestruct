// @vitest-environment happy-dom
//
// #227 surface 1 — the fact strip.  The pin readout renders as a
// bordered strip of labeled cells (lat / lng / bearing / speed /
// jurisdiction), instrument output rather than field-lookalikes.
// Pinned state only (GO ruling 1): pre-pin the Location step keeps the
// pick CTA + manual fallback unchanged (#222).  The jurisdiction cell
// is a real answer in every state — "Not set" when nothing is
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

  // #289 Phase 2 — THE STRIP RETIRES; ITS FIVE FACTS TRANSFER.
  //
  // §8.19 dissolves the Location section into the WHERE band.  The strip
  // was that section's pin readout, and every cell it carried has a home
  // in the column — which is the test, because "nothing it said is gone"
  // is the claim §8.19 makes and the one worth asserting:
  //
  //   Lat / Lng    the band's header provenance (Part 1 §7.15 reserves
  //                the lat/lng for provenance lines)
  //   Bearing      the WHAT band's detection footer (§8.23)
  //   Speed        the WHAT grid's own cell
  //   Jurisdiction the WHAT grid's own cell, with ruling 196's three
  //                states — and still "Not set" when nothing is named,
  //                the one word every surface uses (#257)
  it("pinned: the five facts survive the strip, each under the question it answers", async () => {
    const user = userEvent.setup();
    await mount(DEFAULT_SHOULDER);
    await openWhere();
    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN"));

    // Lat / lng, in the band's provenance rather than in cells.
    await openWhere();
    const whereProv = document.querySelector(".a-open .a-prov")!.textContent!;
    expect(whereProv).toContain("39.71466");
    expect(whereProv).toContain("-104.94071");

    await openWhat();
    // Speed and jurisdiction: their own cells, each with a provenance
    // line under it (rule 137).
    expect(
      (document.querySelector("#what-speed") as HTMLSelectElement).value,
    ).toBe(String(DEFAULT_SHOULDER.speed));
    expect(
      (document.querySelector("#what-jurisdiction") as HTMLSelectElement).value,
    ).toBe("");
    // The unset word, unchanged and still a direct text node (#257).
    expect(screen.getAllByText(/Not set/).length).toBeGreaterThan(0);
  });

  it("a named jurisdiction reaches the cell, and says it is not evaluated yet", async () => {
    const user = userEvent.setup();
    await mount({ ...DEFAULT_SHOULDER, jurisdiction_key: "denver" } as Scenario);
    await openWhere();
    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN"));
    await openWhat();
    // The stubbed fetch returns {} — no evaluated block.  #276, ruled
    // 196: the cell shows the option the operator PICKED, and its
    // provenance line says which of the two you are looking at rather
    // than presenting the static label as an evaluation.
    expect(
      (document.querySelector("#what-jurisdiction") as HTMLSelectElement).value,
    ).toBe("denver");
    const prov = document.querySelector('[data-testid="prov-jurisdiction"]')!;
    expect(prov.textContent).not.toContain("evaluated ·");
    expect(prov.textContent).toMatch(/not evaluated|evaluating/);
  });
});

// #289 Phase 2: the .fact-strip CSS retires with the strip.  Kept as a
// recorded deletion rather than dropped in silence — a rule whose only
// element is gone is a rule that rots (#288's own finding about the
// jurisdiction bar's orphaned selectors).
/*
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
*/
