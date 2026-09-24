// @vitest-environment happy-dom
//
// #277 — "Detected vs applied block never renders for four of seven
// scenario kinds".  #289 absorbs it: "WHAT grid mounts for every kind;
// gated kinds name it in their enablement bar."  The ruling on this stack:
// "#277 the grid mounts for every live kind."
//
// Iterated off ENABLED_SCENARIO_KINDS itself, so a kind enabled later is
// covered the moment it is enabled — the #277 failure class was a surface
// that existed for some kinds and silently not for others.  Each live kind
// mounts through the real shell, pinned, from its own default; the WHAT
// band opens and its grid renders with the cells every kind carries.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";
import { pinned } from "./test-fixtures";
import {
  DEFAULT_FLAGGER,
  DEFAULT_LANE_CLOSURE,
  DEFAULT_MOBILE_OP_2LANE,
  DEFAULT_MOBILE_OP_MULTILANE,
  DEFAULT_NEAR_INTERSECTION,
  DEFAULT_SHOULDER,
  DEFAULT_WORK_BEYOND_SHOULDER,
  ENABLED_SCENARIO_KINDS,
} from "@/lib/scenarios";
import type { Scenario, ScenarioKind } from "@/lib/scenarios/types";
import { WHAT_CELLS } from "@/lib/scenarios/what-cells";
import { openWhat } from "./__fixtures__/band-helpers";
import auditFull from "./__fixtures__/audit-shoulder-full.json";

const DEFAULT_OF: Record<ScenarioKind, Scenario> = {
  shoulder: DEFAULT_SHOULDER,
  flagger_lane_closure: DEFAULT_FLAGGER,
  lane_closure_divided: DEFAULT_LANE_CLOSURE,
  work_beyond_shoulder: DEFAULT_WORK_BEYOND_SHOULDER,
  mobile_op_2lane: DEFAULT_MOBILE_OP_2LANE,
  mobile_op_multilane: DEFAULT_MOBILE_OP_MULTILANE,
  near_intersection: DEFAULT_NEAR_INTERSECTION,
} as Record<ScenarioKind, Scenario>;

const BREAKDOWN = {
  devices: [],
  total_devices: 42,
  unique_types: 6,
  zone_geometry: { taper_l_ft: 183, buffer_b_ft: 495, device_spacing_ft: 55, work_len_ft: 500 },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = url.includes("/api/render/audit")
        ? auditFull
        : url.includes("/api/render/device-breakdown")
          ? BREAKDOWN
          : {};
      return { ok: true, status: 200, json: async () => json } as unknown as Response;
    }),
  );
  Element.prototype.scrollIntoView = vi.fn() as never;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("#277 — the WHAT grid mounts for every live kind", () => {
  it("the list is the live list (three today), and each has a WHAT_CELLS entry", () => {
    expect(ENABLED_SCENARIO_KINDS.length).toBeGreaterThan(0);
    for (const kind of ENABLED_SCENARIO_KINDS) {
      expect(WHAT_CELLS[kind], kind).toBeDefined();
      expect(DEFAULT_OF[kind]?.kind, kind).toBe(kind);
    }
  });

  for (const kind of ENABLED_SCENARIO_KINDS) {
    it(`${kind}: the WHAT band opens on its grid, with the cells every kind carries`, async () => {
      render(<GeneratorShell mode="sandbox" initialScenario={pinned(DEFAULT_OF[kind]) as Scenario} />);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
      });
      await openWhat();
      const band = document.querySelector('[data-testid="band-stack"]')!;
      expect(band.getAttribute("data-open-band"), kind).toBe("what");
      expect(band.querySelector(".a-grid"), `${kind}: WHAT grid`).not.toBeNull();
      // Rule 116's 3 × 2 — the six standard cells every live kind renders
      // — each with its field and its provenance line (rule 137).
      for (const cell of ["speed", "lanes", "lane-width", "road-type", "jurisdiction", "work-dates"]) {
        const c = band.querySelector(`.a-grid [data-testid="cell-${cell}"]`);
        expect(c, `${kind}: cell-${cell}`).not.toBeNull();
        expect(c!.querySelector(".a-fld"), `${kind}: cell-${cell} field`).not.toBeNull();
        expect(c!.querySelector(".tr-prov")?.textContent?.trim(), `${kind}: cell-${cell} provenance`).toBeTruthy();
      }
    });
  }
});
