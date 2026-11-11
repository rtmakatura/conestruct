// @vitest-environment happy-dom
//
// #516: "Edit on map" from a confirmed road onto a pin where the road
// lookup fails, a direction picked and saved, must never put the old
// road's side (`work.travel`) on a corridor-geometry read that has no
// road (the backend's 400 pin_model_input).  Mounted, where the bug lived
// (Rule 11): the shell, the band stack and the sidebar's real picker Save,
// with the picker modal stubbed to a Save button that returns what the
// real picker returns after a failed lookup and a direction tile
// (`confirmedRoad: null`, `roadAxis`).  Rulings in
// validation-artifacts/committed/missions/ux-group7-what-section/issue-516/.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import type { Scenario } from "@/lib/scenarios";
import type { ConfirmedRoad, RoadCandidate, RoadDetectOk } from "@/lib/road-detection/types";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import { forgetAerials } from "@/lib/corridor-aerial";
import { forgetGeometries } from "@/lib/corridor-geometry";

vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../QuotePanel", () => ({ QuotePanel: () => null }));

// The issue's reproduction: E Colfax Ave, then a pin where the lookup fails.
const PIN = { lat: 39.73997, lng: -104.96632 };
const MOVED = { lat: 39.7501, lng: -104.9601 };
const MAINLINE: RoadCandidate = {
  way_id: "W1",
  highway_class: "primary",
  name: "East Colfax Avenue",
  ref: null,
  bearing: 90,
  snap_distance_m: 3,
  snapped_lat: PIN.lat,
  snapped_lng: PIN.lng,
  tags: {
    oneway: null,
    maxspeed: "30 mph",
    lanes: "4",
    lanes_forward: null,
    lanes_backward: null,
    lanes_both_ways: null,
    turn_lanes: null,
    turn_lanes_forward: null,
    turn_lanes_backward: null,
  },
  signal_distance_m: null,
  geometry: [
    [39.73997, -104.968],
    [39.73997, -104.962],
  ],
} as RoadCandidate;
const ROAD = {
  candidate: MAINLINE,
  classification: classifyFromCandidate(MAINLINE, true, null),
  method: "auto_single",
  isUrban: true,
  placeName: null,
  pinLat: PIN.lat,
  pinLng: PIN.lng,
} as ConfirmedRoad;
const DETECTION: RoadDetectOk = {
  scan_status: "ok",
  candidates: [MAINLINE],
  primary_index: 0,
  isUrban: true,
  placeName: null,
};
// The road's sides (travel along its geometry), and the direction's sides
// (a heading, no road) — the two shapes the backend offers.
const ROAD_SIDES = [
  { work: { side: "right", travel: "with_geometry" }, label: "South side · eastbound traffic", built: true },
  { work: { side: "right", travel: "against_geometry" }, label: "North side · westbound traffic", built: true },
];
const AXIS_SIDES = [
  { work: { side: "right", heading: "N" }, label: "East side · northbound traffic", built: true },
  { work: { side: "right", heading: "S" }, label: "West side · southbound traffic", built: true },
];

// First Save: the road.  Second Save (through Edit on map): the lookup
// failed at MOVED, and the operator picked "North–south".
let lookupFailed = false;
vi.mock("../LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave(
          lookupFailed
            ? {
                address: "",
                lat: MOVED.lat,
                lng: MOVED.lng,
                classification: null,
                crossStreet: null,
                intersection: null,
                confirmedRoad: null,
                roadAxis: "north_south",
              }
            : {
                address: "E Colfax Ave, Denver",
                lat: PIN.lat,
                lng: PIN.lng,
                classification: ROAD.classification,
                crossStreet: null,
                intersection: null,
                confirmedRoad: ROAD,
                roadAxis: null,
              },
        )
      }
    >
      SAVE_PIN
    </button>
  ),
}));

import { GeneratorShell } from "../GeneratorShell";
import { openWhere } from "../__fixtures__/band-helpers";
import { MIN_AUDIT } from "../test-fixtures";
import { EDIT_REASKED } from "./WhereQuestions";

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}
/** Every scenario meta the geometry read was asked for, in order: the wire. */
let geometryAsked: Scenario["meta"][] = [];
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  if (url.includes("/api/corridor-map")) {
    return new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
  }
  if (url.includes("/api/render/corridor-geometry")) {
    const meta = (body as { scenario: Scenario }).scenario.meta;
    geometryAsked.push(meta);
    // The backend's pin_model_input refusal (the issue's body, verbatim).
    if (!meta.confirmedRoad && meta.work && "travel" in meta.work) {
      return json(
        {
          detail: {
            error: "pin_model_input",
            message:
              "with no confirmed road the direction is meta.work.heading (N / E / S / W); meta.work.travel needs meta.centerline.",
          },
        },
        400,
      );
    }
    return json({
      status: "side_not_confirmed",
      pin_model: "work_start",
      pin: null,
      travel_bearing_deg: null,
      work: null,
      approaches: [],
      coverage_ft: null,
      message: null,
      side_options: meta.confirmedRoad ? ROAD_SIDES : AXIS_SIDES,
    });
  }
  if (url.includes("/api/road-bearing")) {
    return lookupFailed ? json({ detail: "upstream timeout" }, 504) : json(DETECTION);
  }
  if (url.includes("/api/render/nearest-intersection")) return json({ status: "none", text: null, radius_m: 1700 });
  if (url.includes("/api/render/audit")) return json(MIN_AUDIT);
  return json({});
});

beforeEach(() => {
  forgetAerials();
  forgetGeometries();
  lookupFailed = false;
  geometryAsked = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:aerial-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
async function settle(ms = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
async function until(test: () => boolean, what: string) {
  const deadline = Date.now() + 4000;
  while (!test()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await settle(50);
  }
}
async function click(el: Element | null, what: string) {
  if (!el) throw new Error(`no ${what} on screen`);
  await act(async () => {
    fireEvent.click(el);
  });
}
const byText = (text: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text) ?? null;
const editOnMap = () => {
  const b = document.querySelector<HTMLElement>('[data-testid="band-aerial"] [data-testid="where-open-picker"]')
    ?? q("where-open-picker");
  return b?.textContent === "Edit on map" ? b : null;
};
const sideLabels = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-testid="side-option"]')).map(
    (el) => el.closest("label")?.textContent ?? "",
  );

describe("#516: Edit on map from a road to a direction sends no stale travel", () => {
  it("road → Edit on map → lookup fails → North–south → Save: no geometry read has a road-less work.travel", async () => {
    render(<GeneratorShell mode="sandbox" />);
    await click(q("where-open-picker"), "Pick on map");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await openWhere();
    await until(() => q("kind-chip-shoulder") !== null && q("band-aerial-frame") !== null, "the kind question");
    await click(q("kind-chip-shoulder"), "the shoulder kind");
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    await click(q("side-option"), "a side");
    await settle();
    await until(() => geometryAsked.some((m) => m.work !== undefined), "the side on the wire");

    lookupFailed = true;
    await click(editOnMap(), "Edit on map");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await until(
      () => geometryAsked.some((m) => m.lat === MOVED.lat && m.roadAxis === "north_south"),
      "the direction on the wire",
    );
    await until(() => sideLabels().some((l) => l.includes("East side")), "the direction's sides");
    await settle(400);

    // The wire: every read with a direction and no road carries no travel.
    const roadless = geometryAsked.filter((m) => m.roadAxis && !m.confirmedRoad);
    expect(roadless.length).toBeGreaterThan(0);
    const stale = roadless.filter((m) => m.work && "travel" in m.work);
    expect(stale.map((m) => JSON.stringify(m.work))).toEqual([]);
    // The load ahead still runs, from the direction's own sides.
    expect(roadless.some((m) => m.work?.heading === "N")).toBe(true);
    // #488's line, unchanged: the side is asked again and says why.
    expect(document.querySelectorAll('[data-testid="edit-reasked-note"]')).toHaveLength(1);
    expect(q("edit-reasked-note")?.textContent).toBe(EDIT_REASKED);
    expect((q("side-option") as HTMLInputElement).checked).toBe(false);
  });
});
