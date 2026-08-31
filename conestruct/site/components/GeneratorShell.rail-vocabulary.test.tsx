// @vitest-environment happy-dom
//
// #228 — the enriched vocabulary, MOUNTED (rule 11: the claims are
// about the rendered rail agreeing with real shell state, so both
// live suites' subjects mount for real).  Two cases the unit suite
// can't carry alone:
//   * dismiss-honesty (PDF p.4 corollary): dismissing a live
//     suggestion without choosing removes the "N to confirm" line and
//     flips no rail state — the count derives from the resolution
//     record, not from whether the row is gone;
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
  ).find((b) => b.getAttribute("aria-label")?.startsWith("Location — "));
  if (!btn) throw new Error("no Location rail entry on screen");
  return btn as HTMLElement;
}

describe("#228 mounted — dismiss-honesty on the live count", () => {
  it("a live proposal reads '1 to confirm'; Dismiss removes the line and flips no state", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    // The debounced suggest round-trip lands the ⌁ proposal…
    await waitFor(
      () => {
        expect(locationEntry().getAttribute("aria-label")).toBe(
          "Location — done · 1 to confirm",
        );
      },
      { timeout: 3000 },
    );
    expect(locationEntry().querySelector(".rail-info")?.textContent).toBe(
      "1 to confirm",
    );
    const statesBefore = Array.from(
      document.querySelectorAll(".progress-rail .rail-entry"),
    ).map((b) => b.className);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    // …and dismissing without choosing removes ONLY the count line:
    // aria byte-identical to the no-suggestion state, every entry's
    // state class unchanged, no ✓ manufactured anywhere (p.4: never a
    // false ✓ — jurisdiction_key is still unset).
    await waitFor(() => {
      expect(locationEntry().getAttribute("aria-label")).toBe(
        "Location — done",
      );
    });
    expect(locationEntry().querySelector(".rail-info")).toBeNull();
    expect(
      Array.from(document.querySelectorAll(".progress-rail .rail-entry")).map(
        (b) => b.className,
      ),
    ).toEqual(statesBefore);
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
    const road = screen.getByRole("button", {
      name: "Road — detection stale",
    });
    expect(road.className).toContain("st-stale");
    expect(road.querySelector(".rail-glyph")?.textContent).toBe("▲");
    expect(road.querySelector(".rail-note")?.textContent).toBe(
      "detection stale",
    );
  });
});
