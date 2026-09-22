// @vitest-environment happy-dom
//
// Endeavor B contract tests (spec §4): a pin can SUGGEST, never SET.
// Payload-level, mounted-flow assertions — the suggestion round-trip
// must never place a jurisdiction_key on the wire; the user's Confirm
// click is the single writer.  And the endpoint failing must leave the
// picker exactly as it works today (B is additive, never load-bearing).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Scenario } from "@/lib/scenarios";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
// The sidebar stub exposes pin-drop buttons wired to the REAL setScenario
// — the same write path the map picker uses.  Surface B (#152) moved the
// jurisdiction controls (dropdown + suggestion rows) into the sidebar's
// Location step via the ``jurisdictionControls`` slot, so the stub must
// render that slot for the suggestion UI to appear under test.
// #289 §8.21 — the sidebar's stub renders BOTH halves of what §8.21
// split: `jurisdictionControls` is the street-class field and its own
// suggestion slot, `jurisdictionSuggest` is the pin suggestion, which now
// rides the WHAT band's jurisdiction cell (#201 — a confirm sits beside
// the control it applies to).  The stub stands in for the column, so it
// renders both in one place; the contract these cases assert — suggest
// never sets, Confirm is the only writer — is unchanged by where they
// render.
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({
    scenario,
    setScenario,
    jurisdictionControls,
    jurisdictionSuggest,
  }: {
    scenario: Scenario;
    setScenario: (s: Scenario) => void;
    jurisdictionControls?: ReactNode;
    jurisdictionSuggest?: ReactNode;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          setScenario({
            ...scenario,
            meta: { ...scenario.meta, lat: 39.7392, lng: -104.9903 },
          })
        }
      >
        stub-drop-pin-denver
      </button>
      <button
        type="button"
        onClick={() =>
          setScenario({
            ...scenario,
            meta: { ...scenario.meta, lat: 39.5186, lng: -104.7614 },
          })
        }
      >
        stub-drop-pin-parker
      </button>
      {/* #289 §8.21 — the jurisdiction FIELD is a cell in the WHAT band
          now, and the band is not mounted here: this stub replaces the
          whole column.  So the field is stubbed too, exactly as the pin
          drops above are — same id, same single writer, so the cases
          below still exercise "what reaches the wire" and nothing about
          where the control sits.  The cell's own three states (ruling
          196) are asserted in WhatBand.jurisdiction.test.tsx, against
          the real one. */}
      <label htmlFor="what-jurisdiction">Jurisdiction</label>
      <select
        id="what-jurisdiction"
        value={scenario.jurisdiction_key ?? ""}
        onChange={(e) =>
          setScenario({
            ...scenario,
            jurisdiction_key: e.target.value || null,
          } as Scenario)
        }
      >
        <option value="">Not set — MUTCD + CDOT only</option>
        <option value="denver">Denver</option>
        <option value="parker">Parker</option>
        <option value="aurora">Aurora</option>
      </select>
      {jurisdictionControls}
      {jurisdictionSuggest}
    </div>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";

// #289 §8.21 — the jurisdiction FIELD is a cell in the WHAT band's grid
// now, with ruling 196's three states and no skeleton (rule 14).  Its id
// moved with it: `#jl-jurisdiction` -> `#what-jurisdiction`.  The pin
// SUGGESTION rides the same cell (#201: a confirm sits beside the control
// it applies to), and the street-class field keeps its own slot below the
// grid, so the suggest-never-set contract still has exactly one writer.

const SUGGEST_DENVER = {
  suggestion: "denver",
  reason:
    "Pin is inside Denver municipal limits (US Census TIGER/Line Place boundaries, 2025 vintage).",
  confidence: "inside",
  distance_to_boundary_ft: 17288.2,
  warnings: [],
  boundary_source: {
    source: "US Census TIGER/Line Place boundaries",
    vintage: "2025",
  },
};

let breakdownBodies: unknown[] = [];
let suggestCalls = 0;
let suggestResponse: () => Response;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/device-breakdown")) {
    breakdownBodies.push(JSON.parse(String(init?.body ?? "{}")));
    return Promise.resolve(
      jsonResponse(200, {
        devices: [],
        total_devices: 0,
        unique_types: 0,
        zone_geometry: {
          taper_l_ft: 1,
          buffer_b_ft: 1,
          device_spacing_ft: 1,
          work_len_ft: 1,
        },
      }),
    );
  }
  if (url.includes("/api/jurisdiction/suggest")) {
    suggestCalls += 1;
    return Promise.resolve(suggestResponse());
  }
  return Promise.resolve(jsonResponse(200, {}));
});

beforeEach(() => {
  breakdownBodies = [];
  suggestCalls = 0;
  suggestResponse = () => jsonResponse(200, SUGGEST_DENVER);
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wireKeys(): (string | null | undefined)[] {
  return breakdownBodies.map(
    (b) => (b as { scenario?: { jurisdiction_key?: string | null } }).scenario
      ?.jurisdiction_key,
  );
}

describe("pin suggestion contract: suggest never sets", () => {
  it("a suggestion round-trip never places jurisdiction_key on the wire", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);

    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(
      () => expect(screen.getByText(/Pin suggests:/)).toBeTruthy(),
      { timeout: 3000 },
    );

    // The suggestion is rendered — and every payload the backend has
    // seen (initial mount + the pin-move refetch) is jurisdiction-free.
    expect(suggestCalls).toBe(1);
    expect(screen.getByText("Denver", { selector: "b" })).toBeTruthy();
    for (const key of wireKeys()) {
      expect(key ?? null).toBeNull();
    }
    // The honesty line rides the suggestion (spec §6).
    expect(screen.getByText(/Boundary data is approximate/)).toBeTruthy();
  });

  it("Confirm is the only writer — clicking it sets jurisdiction_key", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);

    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(
      () => expect(screen.getByText(/Confirm Denver/)).toBeTruthy(),
      { timeout: 3000 },
    );
    const before = breakdownBodies.length;
    await user.click(screen.getByText(/Confirm Denver/));

    await waitFor(() => expect(breakdownBodies.length).toBeGreaterThan(before));
    expect(wireKeys().slice(before)).toContain("denver");
    // The picker reflects the confirmed key; the slot demotes to a
    // passive agreement line.
    const select = document.querySelector(
      "#what-jurisdiction",
    ) as HTMLSelectElement;
    expect(select.value).toBe("denver");
    await waitFor(() =>
      expect(screen.getByText(/Pin agrees with your selection/)).toBeTruthy(),
    );
  });

  it("Dismiss leaves a ×-record with undo — never a cleared slot (#227)", async () => {
    // Reshaped for #227 (GO 2026-08-27): resolving a suggestion no
    // longer erases the decision.  Dismiss re-renders the same
    // container as a dismissed record (× + evidence + undo); undo
    // re-arms the live proposal; only a pin move clears everything.
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);

    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(
      () => expect(screen.getByText(/Pin suggests:/)).toBeTruthy(),
      { timeout: 3000 },
    );
    await user.click(screen.getByText("Dismiss"));
    // The proposal row is gone; the record stands in its place with
    // the evidence it carried.
    expect(screen.queryByText(/Pin suggests:/)).toBeNull();
    expect(
      // #260: the unset jurisdiction is "Not set" everywhere (the #257 fold).
      screen.getByText(/Dismissed the Denver suggestion — Not set stands\./),
    ).toBeTruthy();
    expect(screen.getByText(/Boundary data is approximate/)).toBeTruthy();
    // A dismiss writes nothing — every payload stays jurisdiction-free.
    for (const key of wireKeys()) {
      expect(key ?? null).toBeNull();
    }

    // Undo re-arms the live proposal (the suggestion data never left).
    await user.click(screen.getByText("Undo"));
    expect(screen.getByText(/Pin suggests:/)).toBeTruthy();
    expect(screen.queryByText(/Dismissed the Denver suggestion/)).toBeNull();

    // Dismiss again; a pin move clears the record and re-suggests fresh.
    await user.click(screen.getByText("Dismiss"));
    suggestResponse = () =>
      jsonResponse(200, { ...SUGGEST_DENVER, suggestion: "parker" });
    await user.click(screen.getByText("stub-drop-pin-parker"));
    await waitFor(
      () =>
        expect(screen.getByText("Parker", { selector: "b" })).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(screen.getByText(/Pin suggests:/)).toBeTruthy();
    expect(screen.queryByText(/Dismissed the/)).toBeNull();
  });

  it("a differing manual pick demotes the suggestion to a passive notice", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);

    const select = document.querySelector(
      "#what-jurisdiction",
    ) as HTMLSelectElement;
    await user.selectOptions(select, "parker");
    await user.click(screen.getByText("stub-drop-pin-denver"));

    await waitFor(
      () =>
        expect(
          screen.getByText(/Pin appears to be in Denver — you have Parker/),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
    // Never a prompt to switch: no Confirm button in this state.
    expect(screen.queryByText(/Confirm Denver/)).toBeNull();
    // And still nothing wrote over the manual pick.
    expect(select.value).toBe("parker");
  });

  it("endpoint failure: slot goes quiet, picker works exactly as today", async () => {
    suggestResponse = () => jsonResponse(500, { detail: "boom" });
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);

    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(() => expect(suggestCalls).toBe(1), { timeout: 3000 });
    await waitFor(() =>
      expect(screen.queryByText(/Checking boundary data/)).toBeNull(),
    );

    // Quiet slot, no error surface, no suggestion.
    expect(screen.queryByText(/Pin suggests:/)).toBeNull();
    expect(
      screen.getByText(/Drop a site pin for a jurisdiction suggestion/),
    ).toBeTruthy();

    // Manual picking is untouched.
    const select = document.querySelector(
      "#what-jurisdiction",
    ) as HTMLSelectElement;
    const before = breakdownBodies.length;
    await user.selectOptions(select, "parker");
    await waitFor(() => expect(breakdownBodies.length).toBeGreaterThan(before));
    expect(wireKeys().slice(before)).toContain("parker");
  });

  it("no pin (default 0/0): no suggest call ever fires", async () => {
    render(<GeneratorShell mode="sandbox" />);
    // Give the debounce window ample time to (not) fire.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    expect(suggestCalls).toBe(0);
    expect(
      screen.getByText(/Drop a site pin for a jurisdiction suggestion/),
    ).toBeTruthy();
  });
});
