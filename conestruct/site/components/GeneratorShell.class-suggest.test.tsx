// @vitest-environment happy-dom
//
// #152 Surface C contract tests: the confirmed road's OSM tier can
// SUGGEST a street class, never set one.  Same contract shape as the
// jurisdiction suggest-never-set suite: payload-level assertions that
// street_class never reaches the wire until the user's Confirm click,
// the suggestion vanishes with a stale/absent road rather than
// guessing, and the classification-map caveat rides where a map is on
// record.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Scenario } from "@/lib/scenarios";
// #289 finding 1: no live check fires until a person confirms the kind,
// and this suite stubs the whole column — so no chip exists to confirm
// one.  It mounts as a saved plan does (`initialScenario` starts
// confirmed) with the same unpinned default the fresh mount used.  The
// kind's own contract is GeneratorShell.kind-confirm's.
import { DEFAULT_SCENARIO } from "@/lib/scenarios";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import { classifyFromOsmTags } from "@/lib/road-detection/classify";
import demo from "./__fixtures__/jurisdiction-demo.json";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

const PIN = { lat: 39.5186, lng: -104.7614 };

function confirmedRoad(highwayClass: string): ConfirmedRoad {
  const candidate = {
    way_id: "111001",
    highway_class: highwayClass,
    name: "Mainstreet",
    ref: null,
    bearing: 90,
    snap_distance_m: 5,
    snapped_lat: PIN.lat,
    snapped_lng: PIN.lng,
    tags: {
      oneway: null,
      maxspeed: "35 mph",
      lanes: "2",
      lanes_forward: null,
      lanes_backward: null, lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
  };
  return {
    candidate,
    classification: classifyFromOsmTags(
      {
        highwayClass,
        name: candidate.name,
        ref: candidate.ref,
        tags: candidate.tags,
      },
      true,
      "Parker",
    ),
    method: "auto_single",
    overrides: {},
    isUrban: true,
    placeName: "Parker",
    pinLat: PIN.lat,
    pinLng: PIN.lng,
  };
}

// The sidebar stub writes through the REAL setScenario — the same path
// the map picker's Save uses.  Surface B (#152): the class controls +
// suggestion row render via the ``jurisdictionControls`` slot, so the
// stub renders it.
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
      <button
        type="button"
        onClick={() =>
          setScenario({
            ...scenario,
            meta: {
              ...scenario.meta,
              lat: 39.5186,
              lng: -104.7614,
              confirmedRoad: (
                globalThis as { __road?: ConfirmedRoad }
              ).__road,
            },
          })
        }
      >
        stub-confirm-road
      </button>
      <button
        type="button"
        onClick={() =>
          setScenario({
            ...scenario,
            meta: { ...scenario.meta, lat: 40.0, lng: -105.0 },
          })
        }
      >
        stub-move-pin-only
      </button>
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

const parker = (demo as { jurisdictions: Record<string, unknown> })
  .jurisdictions.parker as JurisdictionBlock;

let breakdownBodies: unknown[] = [];
let jurisdictionInResponse: JurisdictionBlock | null = null;

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
        ...(jurisdictionInResponse
          ? { jurisdiction: jurisdictionInResponse }
          : {}),
      }),
    );
  }
  // Jurisdiction-suggest endpoint fails quietly — irrelevant here, and
  // the class row must not depend on it.
  return Promise.resolve(jsonResponse(500, {}));
});

beforeEach(() => {
  breakdownBodies = [];
  jurisdictionInResponse = null;
  (globalThis as { __road?: ConfirmedRoad }).__road = confirmedRoad("primary");
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (globalThis as { __road?: ConfirmedRoad }).__road;
});

function wireClasses(): (string | null | undefined)[] {
  return breakdownBodies.map(
    (b) =>
      (b as { scenario?: { street_class?: string | null } }).scenario
        ?.street_class,
  );
}

describe("street-class suggestion contract (#152 C): suggest never sets", () => {
  it("a confirmed primary road renders an Arterial suggestion; street_class never reaches the wire until Confirm", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);

    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() =>
      expect(
        screen.getByText(/Detected road suggests street class:/),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Arterial", { selector: "b" })).toBeTruthy();
    expect(screen.getByText(/OSM primary/)).toBeTruthy();

    // Every payload so far is class-free — the suggestion set nothing.
    for (const c of wireClasses()) {
      expect(c ?? null).toBeNull();
    }

    const before = breakdownBodies.length;
    await user.click(screen.getByText("Confirm Arterial"));
    await waitFor(() =>
      expect(breakdownBodies.length).toBeGreaterThan(before),
    );
    expect(wireClasses().slice(before)).toContain("arterial");
    // The classpick reflects it, and the row demotes to agreement.
    expect(
      screen.getByText(/Street class matches the detected road tier/),
    ).toBeTruthy();
  });

  it("absent when no road is confirmed", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    expect(
      screen.queryByText(/Detected road suggests street class:/),
    ).toBeNull();
  });

  it("a pin move away from the confirmed road's pin removes the suggestion (stale road never suggests)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);

    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() =>
      expect(
        screen.getByText(/Detected road suggests street class:/),
      ).toBeTruthy(),
    );
    await user.click(screen.getByText("stub-move-pin-only"));
    expect(
      screen.queryByText(/Detected road suggests street class:/),
    ).toBeNull();
  });

  it("a differing manual class demotes the suggestion to a passive notice — no Confirm offered", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);

    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() =>
      expect(
        screen.getByText(/Detected road suggests street class:/),
      ).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: "Local" }));
    expect(
      screen.getByText(/Detected road tier suggests Arterial — you have Local/),
    ).toBeTruthy();
    expect(screen.queryByText("Confirm Arterial")).toBeNull();
  });

  it("Dismiss leaves a ×-record with undo — never a cleared row (#227)", async () => {
    // Reshaped for #227 (GO 2026-08-27): the dismissal stays on the
    // record — same container, × + evidence + undo; undo re-arms the
    // live proposal.  Nothing writes to the wire either way.
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);

    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() =>
      expect(
        screen.getByText(/Detected road suggests street class:/),
      ).toBeTruthy(),
    );
    await user.click(screen.getByText("Dismiss"));
    expect(
      screen.queryByText(/Detected road suggests street class:/),
    ).toBeNull();
    expect(
      screen.getByText(/Dismissed the Arterial suggestion — Not set stands\./),
    ).toBeTruthy();
    for (const c of wireClasses()) {
      expect(c ?? null).toBeNull();
    }

    await user.click(screen.getByText("Undo"));
    expect(
      screen.getByText(/Detected road suggests street class:/),
    ).toBeTruthy();
    expect(screen.queryByText(/Dismissed the Arterial suggestion/)).toBeNull();
  });

  it("a tertiary road suggests Collector", async () => {
    (globalThis as { __road?: ConfirmedRoad }).__road =
      confirmedRoad("tertiary");
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);

    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() =>
      expect(screen.getByText("Confirm Collector")).toBeTruthy(),
    );
  });

  it("the classification-map caveat rides the row when the jurisdiction publishes a map", async () => {
    jurisdictionInResponse = {
      ...parker,
      classification_map_url: "https://example.gov/classification-map",
    };
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);

    const select = document.querySelector(
      "#what-jurisdiction",
    ) as HTMLSelectElement;
    await user.selectOptions(select, "parker");
    await user.click(screen.getByText("stub-confirm-road"));

    await waitFor(() =>
      expect(
        screen.getByText(/functional-classification map/),
      ).toBeTruthy(),
    );
    const link = screen.getByRole("link", {
      name: /Parker's functional-classification map/,
    }) as HTMLAnchorElement;
    expect(link.href).toContain("example.gov/classification-map");
  });
});
