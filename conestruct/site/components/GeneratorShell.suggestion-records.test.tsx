// @vitest-environment happy-dom
//
// #227 surface 4 — resolved-state records with undo (the confirm side;
// the dismiss side rides the reshaped cases in suggest-contract /
// class-suggest).  #179 semantics copied to this seam: the record
// carries the value in effect at click (null included), undo restores
// it exactly, and a confirm-then-undo payload is byte-identical to one
// that never confirmed.  Records are shell state only — never on the
// wire (GO ruling 3).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({
    scenario,
    setScenario,
    jurisdictionControls,
  }: {
    scenario: Scenario;
    setScenario: (s: Scenario) => void;
    jurisdictionControls?: ReactNode;
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
      {jurisdictionControls}
    </div>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";

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
    return Promise.resolve(jsonResponse(200, SUGGEST_DENVER));
  }
  return Promise.resolve(jsonResponse(200, {}));
});

beforeEach(() => {
  breakdownBodies = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function lastScenario(): Record<string, unknown> {
  const last = breakdownBodies[breakdownBodies.length - 1] as {
    scenario: Record<string, unknown>;
  };
  return last.scenario;
}

describe("#227 resolved-state records — confirm, then undo", () => {
  it("Confirm leaves a ✓-record with evidence and undo; undo restores the prior null exactly", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);

    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(
      () => expect(screen.getByText(/Confirm Denver/)).toBeTruthy(),
      { timeout: 3000 },
    );
    // The payload the backend saw before any confirm.
    await waitFor(() => expect(breakdownBodies.length).toBeGreaterThan(0));
    const preConfirm = JSON.stringify(lastScenario());

    await user.click(screen.getByText(/Confirm Denver/));

    // The record stands in the container's place: ✓ + sentence naming
    // old and new + evidence + undo (never a vanished row).
    expect(
      screen.getByText(/Confirmed/, { selector: "span" }),
    ).toBeTruthy();
    expect(screen.getByText(/was None — baseline\./)).toBeTruthy();
    expect(screen.getByText(/Pin agrees with your selection/)).toBeTruthy();
    expect(screen.getByText(/Boundary data is approximate/)).toBeTruthy();
    const select = document.querySelector(
      "#jl-jurisdiction",
    ) as HTMLSelectElement;
    expect(select.value).toBe("denver");
    await waitFor(() =>
      expect(lastScenario().jurisdiction_key).toBe("denver"),
    );

    // Undo restores the recorded prior (null) and re-arms the proposal.
    await user.click(screen.getByText("Undo"));
    expect(screen.getByText(/Pin suggests:/)).toBeTruthy();
    expect(select.value).toBe("");
    await waitFor(() => {
      const s = lastScenario();
      expect(s.jurisdiction_key ?? null).toBeNull();
    });
    // Byte-identity: a confirm-then-undo payload is indistinguishable
    // from one that never confirmed (the #179 acceptance, this seam).
    expect(JSON.stringify(lastScenario())).toBe(preConfirm);
  });

  it("records never reach the wire — no resolution fields in any payload", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" />);

    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(
      () => expect(screen.getByText(/Confirm Denver/)).toBeTruthy(),
      { timeout: 3000 },
    );
    await user.click(screen.getByText(/Confirm Denver/));
    await waitFor(() => expect(breakdownBodies.length).toBeGreaterThan(0));
    for (const b of breakdownBodies) {
      const raw = JSON.stringify(b);
      expect(raw).not.toMatch(/resolution/i);
      expect(raw).not.toMatch(/suggested/i);
    }
  });
});
