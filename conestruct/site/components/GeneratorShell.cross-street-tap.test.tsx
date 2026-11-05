// @vitest-environment happy-dom
//
// #440 — the cross street on the WHERE band, mounted end to end (Rule 11:
// the flow a person runs, asserted on the scenario the shell holds — the
// payload — and on what the band shows).
//
// Authority: validation-artifacts/committed/ux-group4-cross-street/
// rulings.md, rulings 1-7 and X2-X12.  The scenario is read through the
// picker stub's `initial.scenario` (the sidebar hands the picker the
// scenario it holds), opened with Edit on map and cancelled.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import type { Scenario } from "@/lib/scenarios";
import type { ConfirmedRoad, RoadCandidate, RoadDetectOk } from "@/lib/road-detection/types";
import { approachesFromCrossStreet, deriveCrossStreet } from "@/lib/road-detection/cross-street";
import { intersectionRecord } from "@/lib/road-detection/cross-street-lookup";
import { classifyFromCandidate } from "@/lib/road-detection/classify";
import { forgetAerials } from "@/lib/corridor-aerial";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));

// E Colfax Ave at Race St, Denver (memory.md's NI reference pin).
const PIN = { lat: 39.73997, lng: -104.96632 };
const POINT = { lat: 39.7400123, lng: -104.9659876 };

function candidate(over: Partial<RoadCandidate>): RoadCandidate {
  return {
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
    ...over,
  };
}

const MAINLINE = candidate({
  geometry: [
    [39.73997, -104.968],
    [39.73997, -104.962],
  ],
} as Partial<RoadCandidate>);
const ROAD: ConfirmedRoad = {
  candidate: MAINLINE,
  classification: classifyFromCandidate(MAINLINE, true, null),
  method: "auto_single",
  isUrban: true,
  placeName: null,
  pinLat: PIN.lat,
  pinLng: PIN.lng,
} as ConfirmedRoad;

const RACE = candidate({
  way_id: "R1",
  name: "Race Street",
  highway_class: "residential",
  bearing: 0,
  snap_distance_m: 4,
  tags: { ...MAINLINE.tags, maxspeed: "25 mph", lanes: "2" },
});
const DETECTION: RoadDetectOk = {
  scan_status: "ok",
  candidates: [MAINLINE, RACE],
  primary_index: 0,
  isUrban: true,
  placeName: null,
};
// What the picker derives at the same point (its own lookup, X4).
const CS = deriveCrossStreet({
  detection: DETECTION,
  mainlineWayId: "W1",
  mainlineName: "East Colfax Avenue",
  mainlineBearingDeg: 90,
})!;

const SIDE = { work: { side: "right", travel: "with_geometry" }, label: "South side · eastbound traffic", built: true };

let lastInitial: { scenario?: Scenario; armIntersection?: boolean } | null = null;
const pinResult = () => ({
  address: "E Colfax Ave & Race St, Denver",
  lat: PIN.lat,
  lng: PIN.lng,
  classification: ROAD.classification,
  crossStreet: null,
  intersection: null,
  confirmedRoad: ROAD,
});
vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({
    onSave,
    onCancel,
    initial,
  }: {
    onSave: (r: unknown) => void;
    onCancel: () => void;
    initial?: { scenario?: Scenario; armIntersection?: boolean };
  }) => {
    lastInitial = initial ?? null;
    return (
      <div data-testid="picker" data-arm={String(Boolean(initial?.armIntersection))}>
        <button type="button" onClick={() => onSave(pinResult())}>
          SAVE_PIN
        </button>
        {/* The picker's Save after its own cross-street click at POINT. */}
        <button
          type="button"
          onClick={() =>
            onSave({ ...pinResult(), crossStreet: CS, intersection: intersectionRecord(POINT, CS) })
          }
        >
          SAVE_CROSS
        </button>
        <button type="button" onClick={onCancel}>
          CANCEL
        </button>
      </div>
    );
  },
}));

import { GeneratorShell } from "./GeneratorShell";
import { openWhere } from "./__fixtures__/band-helpers";
import { MIN_AUDIT } from "./test-fixtures";

type Mode = "ok" | "none" | "fail" | "hold";
let roadBearing: Mode = "ok";
let release: (() => void) | null = null;
const calls: { url: string; body: unknown }[] = [];

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, body });
  if (url.includes("/api/corridor-map")) {
    return new Response(new Blob(["png"], { type: "image/png" }), { status: 200 });
  }
  if (url.includes("/api/render/corridor-geometry")) {
    const s = (body as { scenario: Scenario }).scenario;
    const notMarked = s.kind === "near_intersection" && !s.meta.intersection;
    return json({
      status: notMarked ? "intersection_not_marked" : "side_not_confirmed",
      pin_model: "work_start",
      pin: null,
      travel_bearing_deg: null,
      work: null,
      approaches: [],
      coverage_ft: null,
      message: notMarked ? "Mark the cross street on the map to lay out the sides." : null,
      side_options: [SIDE],
    });
  }
  if (url.includes("/api/aerial-point")) return json(POINT);
  if (url.includes("/api/road-bearing")) {
    if (roadBearing === "fail") return json({ error: "down" }, 502);
    if (roadBearing === "none") return json({ ...DETECTION, candidates: [MAINLINE] });
    if (roadBearing === "hold") await new Promise<void>((r) => (release = r));
    return json(DETECTION);
  }
  if (url.includes("/api/render/nearest-intersection")) {
    const s = (body as { scenario: Scenario }).scenario;
    const x = s.kind === "near_intersection" ? s.meta.intersection : null;
    return json(
      x?.name
        ? {
            status: "found",
            text: `80 ft W of ${x.name}`,
            cross_street: x.name,
            offset_ft: 80,
            direction: "W",
            source: "marked_cross_pin",
            provenance_text: "cross street from your marked intersection",
            osm_node_id: null,
            reason: null,
            radius_m: 1700,
            cross_direction: "east",
          }
        : { status: "none", text: null, radius_m: 1700 },
    );
  }
  if (url.includes("/api/render/audit")) return json(MIN_AUDIT);
  return json({});
});

beforeEach(() => {
  forgetAerials();
  calls.length = 0;
  roadBearing = "ok";
  release = null;
  lastInitial = null;
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

/** The scenario the sidebar holds, as it hands it to the picker. */
async function held(): Promise<Scenario> {
  await click(q("where-open-picker"), "Edit on map");
  const s = lastInitial?.scenario;
  await click(byText("CANCEL"), "CANCEL");
  if (!s) throw new Error("the picker was not handed a scenario");
  return s;
}

async function tapCrossing() {
  const img = q("band-aerial-img")!;
  img.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, x: 0, y: 0 }) as DOMRect;
  await act(async () => {
    img.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 352, clientY: 140 }));
  });
}

/** A fresh session, as a person goes (#440 ruling 2): the pin from the
 *  picker, the kind first, Next — the cross street, with the side after it. */
async function toTheCrossStreetQuestion() {
  render(<GeneratorShell mode="sandbox" />);
  await click(q("where-open-picker"), "Pick on map");
  await click(byText("SAVE_PIN"), "SAVE_PIN");
  await openWhere();
  await until(() => q("kind-chip-near_intersection") !== null, "the kind question");
  await click(q("kind-chip-near_intersection"), "the near-intersection kind");
  await click(byText("Next question"), "Next question");
  await until(() => q("band-aerial-bar") !== null, "the armed aerial");
}

describe("#440: the cross-street question on the WHERE band", () => {
  it("rulings 1-3: the second question, the armed pin picture, the bar and the big-map button", async () => {
    await toTheCrossStreetQuestion();
    const card = q("where-questions")!;
    expect(card.textContent).toContain("Question 2 of 3");
    expect(card.textContent).toContain("Which intersection is the work near?");
    expect(card.textContent).toContain(
      "Tap where the two streets cross on the map above. The plan counts signs for the cross street. The sheet points to CDOT's standard drawing for where they go.",
    );
    // Ruling 2 / X20: the side comes after the cross street, so this
    // question's button is Next, and Confirm waits for the side.
    expect(q("where-confirm")).toBeNull();
    expect((byText("Next question") as HTMLButtonElement).disabled).toBe(true);
    expect(q("step-next-side")).not.toBeNull();
    expect(q("band-aerial")?.getAttribute("data-stage")).toBe("pin");
    expect(q("band-aerial-frame")?.className).toContain("is-armed");
    expect(q("band-aerial-bar")?.textContent).toBe("Tap the intersection nearest the work");
    expect(q("band-aerial-big-map")?.textContent).toBe("Use the big map instead");
    // Ruling 7: neither removed line is on the band.
    expect(q("where-questions")!.textContent).not.toContain("Mark the cross street");
    expect(q("band-aerial")!.textContent).not.toContain("Mark the cross street");
  });

  it("the tap: aerial-point, then the picker's own lookup, then the picker Save's own apply; Move / Cancel; Undo restores the scenario byte for byte", async () => {
    await toTheCrossStreetQuestion();
    const before = await held();
    expect(before.kind).toBe("near_intersection");
    const beforeJson = JSON.stringify(before);

    // X8: a failed lookup writes nothing and says so, with Try again.
    roadBearing = "fail";
    await tapCrossing();
    await until(() => q("cross-failed") !== null, "the failure line");
    expect(q("cross-failed")!.textContent).toContain("The street lookup didn't answer.");
    expect(q("cross-retry")?.textContent).toBe("Try again");
    expect(q("cross-big-map")?.textContent).toBe("Use the big map instead");
    expect(JSON.stringify(await held())).toBe(beforeJson);
    // X3: the tap's pixel went to the backend, with the pin and the frame.
    const point = calls.filter((c) => c.url.includes("/api/aerial-point"));
    expect(point).toEqual([
      { url: "/api/aerial-point", body: { lat: PIN.lat, lng: PIN.lng, width: 600, height: 300, x: 352, y: 140 } },
    ]);
    // X4: the lookup asked at the backend's coordinate, as the picker does.
    expect(calls.filter((c) => c.url.includes("/api/road-bearing")).map((c) => c.body)).toEqual([POINT]);

    // Try again: the same point (no second aerial-point), and ruling 6's
    // in-place line while it runs.
    roadBearing = "hold";
    await click(q("cross-retry"), "Try again");
    await until(() => q("cross-finding") !== null, "Finding the street name…");
    expect(q("cross-finding")!.textContent).toBe("Finding the street name…");
    expect(q("band-aerial-bar")).toBeNull(); // no second tap while it runs
    expect(calls.filter((c) => c.url.includes("/api/aerial-point"))).toHaveLength(1);
    await act(async () => {
      release?.();
    });
    await until(() => q("cross-row") !== null, "the ✓ row");

    // Ruling 5: the ✓ row, every value off the wire.
    expect(q("cross-row-name")!.textContent).toBe("Near Race Street");
    await until(() => q("cross-row-line")?.textContent?.includes("east") ?? false, "the read's distance");
    expect(q("cross-row-line")!.textContent).toBe("Two-way street · 80 ft east of where the work starts");
    expect(q("band-aerial-mark-label")?.textContent).toBe("Race Street");
    expect(q("band-aerial-mark")?.style.left).toBe("338px");
    expect(q("band-aerial-bar")).toBeNull();
    expect((byText("Next question") as HTMLButtonElement).disabled).toBe(false);

    // The scenario: the picker Save's own record and approaches (X4).
    const after = await held();
    expect(after.meta.intersection).toEqual(intersectionRecord(POINT, CS));
    expect(after.kind === "near_intersection" && after.approaches).toEqual(approachesFromCrossStreet(CS));

    // X11: Move re-arms; it reads Cancel and disarms again.
    await click(q("cross-move"), "Move");
    expect(q("cross-move")!.textContent).toBe("Cancel");
    expect(q("band-aerial-bar")).not.toBeNull();
    await click(q("cross-move"), "Cancel");
    expect(q("cross-move")!.textContent).toBe("Move");
    expect(q("band-aerial-bar")).toBeNull();

    // X7: Undo restores the pre-mark scenario, byte for byte, and re-arms.
    await click(q("cross-undo"), "Undo");
    expect(JSON.stringify(await held())).toBe(beforeJson);
    expect(q("cross-row")).toBeNull();
    expect(q("band-aerial-mark")).toBeNull();
    await until(() => q("band-aerial-bar") !== null, "the re-armed aerial");
  });

  it("ruling 2 / X20: after the tap, Next asks the side last, and its button is Confirm", async () => {
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    const card = q("where-questions")!;
    expect(card.textContent).toContain("Question 3 of 3");
    expect(card.textContent).toContain("Which side of the road is the work on?");
    expect(q("band-aerial-bar")).toBeNull(); // only the cross-street question arms the aerial
    expect(q("where-confirm")?.textContent).toBe("Confirm and lay out the plan");
    expect((q("where-confirm") as HTMLButtonElement).disabled).toBe(true);
    await click(q("side-option"), "a side");
    expect((q("where-confirm") as HTMLButtonElement).disabled).toBe(false);
  });

  it("X8: no street at the tap says so and keeps the tap armed, writing nothing", async () => {
    await toTheCrossStreetQuestion();
    const before = JSON.stringify(await held());
    roadBearing = "none";
    await tapCrossing();
    await until(() => q("cross-none") !== null, "the no-street line");
    expect(q("cross-none")!.textContent).toBe(
      "No cross street found there. Tap closer to where the two streets cross.",
    );
    expect(q("band-aerial-bar")).not.toBeNull();
    expect(JSON.stringify(await held())).toBe(before);
  });

  it("ruling 4 / X4: Use the big map instead opens the picker armed, and its Save writes what the tap writes", async () => {
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    const tapped = await held();
    await click(q("cross-undo"), "Undo");
    await until(() => q("band-aerial-big-map") !== null, "the big-map button");

    await click(q("band-aerial-big-map"), "Use the big map instead");
    expect(q("picker")?.getAttribute("data-arm")).toBe("true");
    await click(byText("SAVE_CROSS"), "SAVE_CROSS");
    const saved = await held();
    for (const s of [tapped, saved]) expect(s.kind).toBe("near_intersection");
    const fields = (s: Scenario) =>
      JSON.stringify({
        intersection: s.meta.intersection,
        operatorSet: s.meta.operatorSet ?? null,
        approaches: s.kind === "near_intersection" ? s.approaches : null,
        detectionOverrides: s.kind === "near_intersection" ? (s.detectionOverrides ?? null) : null,
      });
    expect(fields(saved)).toBe(fields(tapped));
    // The picker's mark answers the same question (ruling 4).
    await until(() => q("cross-row") !== null, "the ✓ row after the picker");
    expect(q("cross-row-name")!.textContent).toBe("Near Race Street");
  });
});
