// @vitest-environment happy-dom
//
// R108 / R110 — the confirmed road GUESSES the street class; nothing asks
// to confirm it.  Payload-level, mounted-flow assertions (Rule 11).
//
// Authority: validation-artifacts/committed/setup-what-redesign/rulings.md.
// R108: "Street class (from the road) ... prefilled like Road type already
// is, ... marked '⚠ from the road', and the operator changes them if
// they're wrong.  There are no confirm, dismiss or suggestion rows."
// R110 Q1: the wire carries the tag the class was guessed from, which the
// backend re-maps (src/rules/street_class.py); Q4: "Never overwrite a
// value the operator set."
//
// This replaces #152 C's "suggest never sets / Confirm is the only writer"
// contract, which R108 supersedes (checkpoint §3, row 4).  What carries
// over: a stale road never guesses (#149's failure class), and the
// classification-map caveat rides wherever a map is on record.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Scenario } from "@/lib/scenarios";
// #289 finding 1: this suite stubs the whole column, so it mounts as a
// saved plan does (`initialScenario` starts the kind confirmed), with the
// same unpinned default the fresh mount used.
import { DEFAULT_SCENARIO } from "@/lib/scenarios";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import { classifyFromOsmTags, suggestStreetClass } from "@/lib/road-detection/classify";
import { setJurisdictionByOperator } from "@/lib/scenarios/guesses";
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
    way_id: `way-${highwayClass}`,
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
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
  };
  return {
    candidate,
    classification: classifyFromOsmTags(
      { highwayClass, name: candidate.name, ref: candidate.ref, tags: candidate.tags },
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

// The sidebar stub stands in for the column: the road confirmation and
// the pin move write through the REAL setScenario (the picker's path);
// the street class is the REAL row of "The road" (PlanDetailCells), with
// its real control, marker and evidence.
vi.mock("./GeneratorSidebar", async () => {
  const { PlanDetailCells } = await import("./bands/PlanDetails");
  return {
    GeneratorSidebar: ({
      scenario,
      setScenario,
      jurisdictionBlock,
    }: {
      scenario: Scenario;
      setScenario: (s: Scenario) => void;
      jurisdictionBlock?: JurisdictionBlock | null;
    }) => (
      <div>
        <label htmlFor="what-jurisdiction">Jurisdiction</label>
        <select
          id="what-jurisdiction"
          value={scenario.jurisdiction_key ?? ""}
          onChange={(e) =>
            setScenario(setJurisdictionByOperator(scenario, e.target.value || null))
          }
        >
          <option value="">Not set: MUTCD + CDOT only</option>
          <option value="parker">Parker</option>
        </select>
        <div className="a-col">
          <PlanDetailCells
            group="road"
            scenario={scenario}
            setScenario={setScenario}
            jurisdictionBlock={jurisdictionBlock ?? null}
          />
        </div>
        <button
          type="button"
          onClick={() =>
            setScenario({
              ...scenario,
              meta: {
                ...scenario.meta,
                ...PIN,
                // #290: the side a located plan carries.
                work: { side: "right", heading: "N" },
                confirmedRoad: (globalThis as { __road?: ConfirmedRoad }).__road,
              },
            })
          }
        >
          stub-confirm-road
        </button>
        <button
          type="button"
          onClick={() =>
            setScenario({ ...scenario, meta: { ...scenario.meta, lat: 40.0, lng: -105.0 } })
          }
        >
          stub-move-pin-only
        </button>
      </div>
    ),
  };
});

import { GeneratorShell } from "./GeneratorShell";

const parker = (demo as { jurisdictions: Record<string, unknown> }).jurisdictions
  .parker as JurisdictionBlock;

type Wire = {
  street_class?: string | null;
  guesses?: { street_class?: { highwayClass: string } } | null;
};

let bodies: Wire[] = [];
let jurisdictionInResponse: JurisdictionBlock | null = null;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const breakdown = () => ({
  devices: [],
  total_devices: 0,
  unique_types: 0,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
  ...(jurisdictionInResponse ? { jurisdiction: jurisdictionInResponse } : {}),
});

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body?.scenario) bodies.push(body.scenario as Wire);
    if (url.includes("/api/render/audit") && body?.scenario?.include_breakdown)
      return Promise.resolve(jsonResponse(200, { breakdown: breakdown() }));
    if (url.includes("/api/render/device-breakdown"))
      return Promise.resolve(jsonResponse(200, breakdown()));
    return Promise.resolve(jsonResponse(200, {}));
  }
  // The pin lookup fails quietly — the class guess must not depend on it.
  return Promise.resolve(jsonResponse(500, {}));
});

beforeEach(() => {
  bodies = [];
  jurisdictionInResponse = null;
  (globalThis as { __road?: ConfirmedRoad }).__road = confirmedRoad("primary");
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  // THE INVARIANT, over every payload: a class guess on the wire is the
  // class its own tag maps to — never a stale record over a changed value.
  for (const b of bodies) {
    const g = b.guesses?.street_class;
    if (g) expect(b.street_class).toBe(suggestStreetClass(g.highwayClass));
  }
  cleanup();
  vi.unstubAllGlobals();
  delete (globalThis as { __road?: ConfirmedRoad }).__road;
});

const last = () => bodies[bodies.length - 1];
const marker = () => screen.getByTestId("info-toggle-street-class").textContent;

describe("the road guesses the street class (R108)", () => {
  it("a confirmed primary road fills Arterial, marked, and relays its tag", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Arterial" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
    expect(marker()).toBe("⚠ from the road");
    await waitFor(() => expect(last()?.street_class).toBe("arterial"));
    expect(last().guesses?.street_class).toEqual({ highwayClass: "primary" });
    // No confirm step anywhere.
    for (const name of [/^Confirm/, /^Dismiss$/, /^Undo$/]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("no confirmed road: nothing is guessed", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(marker()).toBe("◌ not set");
    for (const b of bodies) expect(b.street_class ?? null).toBeNull();
  });

  it("a pin moved off the confirmed road drops the guess in the same write", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() => expect(marker()).toBe("⚠ from the road"));
    await user.click(screen.getByText("stub-move-pin-only"));
    expect(marker()).toBe("◌ not set");
    await waitFor(() => expect(last()?.street_class ?? null).toBeNull());
    expect(last().guesses ?? null).toBeNull();
  });

  it("the operator's pick replaces the guess, and a new road never overwrites it (R110 Q4)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() => expect(marker()).toBe("⚠ from the road"));
    await user.click(screen.getByRole("button", { name: "Local" }));
    expect(marker()).toBe("✓ yours");
    await waitFor(() => expect(last()?.street_class).toBe("local"));
    expect(last().guesses ?? null).toBeNull();
    (globalThis as { __road?: ConfirmedRoad }).__road = confirmedRoad("tertiary");
    await user.click(screen.getByText("stub-confirm-road"));
    expect(marker()).toBe("✓ yours");
    expect(screen.getByRole("button", { name: "Local" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("a tertiary road guesses Collector", async () => {
    (globalThis as { __road?: ConfirmedRoad }).__road = confirmedRoad("tertiary");
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() => expect(last()?.street_class).toBe("collector"));
    expect(last().guesses?.street_class).toEqual({ highwayClass: "tertiary" });
  });

  it("the classification-map caveat rides the field's details when the jurisdiction publishes a map", async () => {
    jurisdictionInResponse = {
      ...parker,
      classification_map_url: "https://example.gov/classification-map",
    };
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.selectOptions(
      document.querySelector("#what-jurisdiction") as HTMLSelectElement,
      "parker",
    );
    await user.click(screen.getByText("stub-confirm-road"));
    await waitFor(() => expect(screen.getByText(/The road tier is a proxy/)).toBeTruthy());
    const link = screen.getByRole("link", {
      name: /Parker's functional-classification map/,
      hidden: true,
    }) as HTMLAnchorElement;
    expect(link.href).toContain("example.gov/classification-map");
    expect(screen.getByText(/detected road tier: OSM primary/)).toBeTruthy();
  });
});
