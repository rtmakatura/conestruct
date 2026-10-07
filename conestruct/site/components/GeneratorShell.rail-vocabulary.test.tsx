// @vitest-environment happy-dom
//
// #228 — the enriched vocabulary, MOUNTED (rule 11: the claims are
// about the rendered rail agreeing with real shell state, so both
// live suites' subjects mount for real).  Two cases the unit suite
// can't carry alone:
//   * R108 (which retired #228's "N to confirm" with the confirm step):
//     a saved plan opens as it was saved — its pin's lookup lands as
//     evidence and writes nothing, with no Confirm or Dismiss to press;
//   * stale, end to end: a confirmed road whose staleness key no
//     longer matches the pin renders ▲ + "detection stale" on the
//     Road entry, from scenario state alone.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConfirmedRoad } from "@/lib/road-detection/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";
import { openWhere, openWhat } from "./__fixtures__/band-helpers";

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

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const CLEAN_AUDIT = {
  summary: {},
  sections: {},
  plan_flags: {
    validation_warnings: 0,
    compliance_fails: 0,
    v1_limitations: 0,
    is_clean: true,
  },
};

let suggestBody: unknown;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/jurisdiction/suggest"))
    return Promise.resolve(jsonResponse(200, suggestBody));
  if (url.includes("/api/render/audit"))
    return Promise.resolve(jsonResponse(200, CLEAN_AUDIT));
  return Promise.resolve(jsonResponse(200, {}));
});

beforeEach(() => {
  suggestBody = SUGGEST_DENVER;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function locationEntry(): HTMLElement {
  const btn = Array.from(
    document.querySelectorAll(".progress-rail .rail-entry"),
  ).find((b) => b.getAttribute("aria-label")?.startsWith("Location: "));
  if (!btn) throw new Error("no Location rail entry on screen");
  return btn as HTMLElement;
}

describe("R108 mounted — a saved plan's pin is evidence, never a write", () => {
  it("the lookup lands, the key stays unset, and nothing asks to be confirmed", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await openWhat();
    await waitFor(
      () => {
        expect(screen.getByText(/The pin is in Denver/)).toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(
      (document.querySelector("#what-jurisdiction") as HTMLSelectElement).value,
    ).toBe("");
    for (const name of [/^Confirm/, /^Dismiss$/]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });
});

describe("#228 mounted — stale end to end", () => {
  it("a confirmed road at a moved pin renders ▲ + 'detection stale' on Road", async () => {
    // The E Bayaud confirmed road, keyed to a pin the scenario no
    // longer sits at (the DetectedVsApplied staleness key).
    const staleRoad = {
      candidate: {
        way_id: "1042",
        highway_class: "secondary",
        name: "E Bayaud Ave",
        ref: null,
        bearing: 85,
        snap_distance_m: 4,
        snapped_lat: 39.71466,
        snapped_lng: -104.94071,
        tags: {
          oneway: null,
          maxspeed: "30 mph",
          lanes: "2",
          lanes_forward: null,
          lanes_backward: null,
          lanes_both_ways: null,
          turn_lanes: null,
          turn_lanes_forward: null,
          turn_lanes_backward: null,
        },
        signal_distance_m: null,
        geometry: [
          [39.714, -104.941],
          [39.715, -104.94],
        ],
      },
      classification: {
        roadType: "urban_arterial",
        divided: false,
        laneWidthFt: 12,
      },
      method: "auto_single",
      overrides: {},
      isUrban: true,
      placeName: "Denver",
      pinLat: 39.71466,
      pinLng: -104.94071,
    } as unknown as ConfirmedRoad;
    const scenario = {
      ...PINNED_SHOULDER,
      meta: {
        ...PINNED_SHOULDER.meta,
        lat: 39.9,
        lng: -105.1,
        confirmedRoad: staleRoad,
      },
    };
    suggestBody = { ...SUGGEST_DENVER, suggestion: null };
    render(<GeneratorShell mode="sandbox" initialScenario={scenario} />);
    // #289 Phase 2 — the rail's Road entry is gone with the rail, and the
    // fact it carried moves to the WHERE band, which is where a stale
    // road is a fact ABOUT: the confirmed road was picked at a different
    // pin, so the band says so in words beside the glyph (rule 13 — never
    // hue alone).  `deriveRail()` still owns the predicate and still
    // reports `stale`; band-facts.roadIsStale reads the same comparison
    // and rail.test.ts covers the derivation.
    await openWhere();
    expect(screen.getByText(/detection stale/)).toBeTruthy();
    expect(screen.getByText(/picked at a different\s+pin/)).toBeTruthy();
    // And the WHAT band says nothing at all about the stale road's
    // values — a stale road never speaks (the #149 failure class).
    await openWhat();
    expect(document.querySelector('[data-testid="what-detection"]')).toBeNull();
  });
});
