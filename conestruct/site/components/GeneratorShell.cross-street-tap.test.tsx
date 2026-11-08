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
import { REVEAL_WAIT_MS } from "@/lib/cross-street-reveal";

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

type Mode = "ok" | "none" | "fail" | "hold" | "holdFail";
let roadBearing: Mode = "ok";
let release: (() => void) | null = null;
let readHangs = false;
let tappedPoint = POINT;
let aerialPoint: "ok" | "refused" | "garbled" | "down" = "ok";
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
  if (url.includes("/api/aerial-point")) {
    if (aerialPoint === "refused") return json({ error: "down" }, 502);
    if (aerialPoint === "garbled") return json({ lat: null });
    if (aerialPoint === "down") throw new Error("network");
    return json(tappedPoint);
  }
  if (url.includes("/api/road-bearing")) {
    if (roadBearing === "fail") return json({ error: "down" }, 502);
    if (roadBearing === "none") return json({ ...DETECTION, candidates: [MAINLINE] });
    if (roadBearing === "hold") await new Promise<void>((r) => (release = r));
    if (roadBearing === "holdFail") {
      await new Promise<void>((r) => (release = r));
      return json({ error: "down" }, 502);
    }
    return json(DETECTION);
  }
  if (url.includes("/api/render/nearest-intersection")) {
    if (readHangs) await new Promise<void>(() => {});
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
  readHangs = false;
  tappedPoint = POINT;
  aerialPoint = "ok";
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
    // #446 ruling 1: the bar says so too; no second tap while it runs.
    expect(q("band-aerial-bar")?.textContent).toBe("Finding the street name…");
    expect(q("band-aerial-frame")?.className).not.toContain("is-armed");
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
    expect(q("band-aerial-bar")?.textContent).toBe("✓ Near Race Street"); // #446 ruling 2
    expect((byText("Next question") as HTMLButtonElement).disabled).toBe(false);

    // The scenario: the picker Save's own record and approaches (X4).
    const after = await held();
    expect(after.meta.intersection).toEqual(intersectionRecord(POINT, CS));
    expect(after.kind === "near_intersection" && after.approaches).toEqual(approachesFromCrossStreet(CS));

    // X11: Move re-arms; it reads Cancel and disarms again.
    await click(q("cross-move"), "Move");
    expect(q("cross-move")!.textContent).toBe("Cancel");
    expect(q("band-aerial-bar")?.textContent).toBe("Tap the intersection nearest the work");
    await click(q("cross-move"), "Cancel");
    expect(q("cross-move")!.textContent).toBe("Move");
    expect(q("band-aerial-bar")?.textContent).toBe("✓ Near Race Street"); // #446 ruling 2

    // #457 rulings 1, 3: the row's Undo is the shared link.
    expect(q("cross-undo")?.className).toBe("undo-link");
    expect(q("cross-undo")?.tagName).toBe("BUTTON");
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

// #446 (validation-artifacts/committed/ux-tap-feedback/rulings.md, rulings
// 1-6, T1-T12): the tap answers on the map, then the card comes into view.
// A DOM without layout, so the row's and the button's rects are set here
// and window.scrollBy is what the page asked for.
describe("#446: the tap answers on the aerial, then the card comes into view", () => {
  const scrollBy = vi.fn();
  let wordsTop = 500;
  let rowTop = 900;
  let nextBottom = 1100;
  let frameTop = 0;
  let barTop = 0;
  let reduced = false;

  beforeEach(() => {
    scrollBy.mockClear();
    wordsTop = 500;
    rowTop = 900;
    nextBottom = 1100;
    frameTop = 0;
    barTop = 0;
    reduced = false;
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    vi.spyOn(window, "matchMedia").mockImplementation(
      (m: string) => ({ matches: reduced && m.includes("reduce"), media: m }) as MediaQueryList,
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const at = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top }) as DOMRect;
      if (this.getAttribute("data-testid") === "cross-row") return at(rowTop, rowTop + 68);
      if (this.getAttribute("data-testid") === "band-aerial-frame") return at(frameTop, frameTop + 300);
      if (this.getAttribute("data-testid") === "band-aerial-bar") return at(barTop, barTop + 65);
      if (this.classList.contains("a-aerial-bar-text")) return at(wordsTop, wordsTop + 19);
      if (this.classList.contains("wq-next")) return at(nextBottom - 44, nextBottom);
      return at(0, 0);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const barKind = () => q("band-aerial-frame")?.getAttribute("data-bar");
  const heldLookup = async () => {
    roadBearing = "hold";
    await tapCrossing();
    await until(() => release !== null, "the lookup to be asked");
  };

  it("ruling 1: the ring and the finding bar show before the lookup answers; the bar is the band's one live region", async () => {
    await toTheCrossStreetQuestion();
    expect(q("band-aerial-bar")?.getAttribute("role")).toBe("status");
    const liveBar = q("band-aerial-bar");
    expect(q("band-aerial-ring")).toBeNull();

    // No wait: read straight after the tap's own click, nothing settled.
    roadBearing = "hold";
    await tapCrossing();
    expect(barKind()).toBe("finding");
    expect(q("band-aerial-bar")?.textContent).toBe("Finding the street name…");
    expect(q("band-aerial-bar")?.querySelector("svg")).not.toBeNull();
    const ring = q("band-aerial-ring")!;
    expect(ring.getAttribute("data-look")).toBe("solid");
    expect(ring.style.left).toBe("336px"); // 352 - 16
    expect(ring.style.top).toBe("124px"); // 140 - 16
    // The same element all along, so a screen reader hears the change.
    expect(q("band-aerial-bar")).toBe(liveBar);
    expect(document.querySelectorAll('[data-testid="band-where"] [role="status"]')).toHaveLength(1);
    expect(scrollBy).not.toHaveBeenCalled();
    await until(() => release !== null, "the lookup to be asked");
    await act(async () => {
      release?.();
    });
    await until(() => q("cross-row") !== null, "the ✓ row");
  });

  it("rulings 2-3: found turns the bar ready, keeps #440's box and label, scrolls the row and the button in, and focuses the row's heading", async () => {
    await toTheCrossStreetQuestion();
    await heldLookup();
    expect(scrollBy).not.toHaveBeenCalled();
    await act(async () => {
      release?.();
    });
    await until(() => q("cross-row") !== null, "the ✓ row");

    expect(barKind()).toBe("found");
    expect(q("band-aerial-bar")?.textContent).toBe("✓ Near Race Street");
    expect(q("band-aerial-ring")).toBeNull();
    expect(q("band-aerial-mark")).not.toBeNull();
    expect(q("band-aerial-mark-label")?.textContent).toBe("Race Street");
    const heading = q("cross-row-name")!;
    expect(heading.tagName).toBe("H4");
    expect(document.activeElement).toBe(heading);
    // T15: once the read that lengthens the lines above it has answered.
    await until(() => q("cross-row-line")?.textContent?.includes("east") ?? false, "the read's distance");
    await until(() => scrollBy.mock.calls.length > 0, "the scroll");
    // 1100 + 16 - 800: the least that shows the button.
    expect(scrollBy).toHaveBeenCalledWith({ top: 316, behavior: "smooth" });
    // Nothing later scrolls again.
    await settle();
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("T19 B: when the aerial, the row and the button can't all fit, the row and the button win and the bar's words go", async () => {
    wordsTop = 120;
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => scrollBy.mock.calls.length > 0, "the scroll");
    expect(scrollBy).toHaveBeenCalledWith({ top: 316, behavior: "smooth" });
  });

  it("T19 B: with the bar's words already off the top, the scroll runs the same", async () => {
    wordsTop = -30;
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => scrollBy.mock.calls.length > 0, "the scroll");
    expect(scrollBy).toHaveBeenCalledWith({ top: 316, behavior: "smooth" });
  });

  // Every door onto the picker, the same guard (the sidebar's openPicker).
  const DOORS: [string, () => Promise<void>][] = [
    ["Edit on map", () => click(q("where-open-picker"), "Edit on map")],
    ["the bar's big-map button", () => click(q("band-aerial-big-map"), "the big-map button")],
    [
      "Enter in the address field",
      async () => {
        const field = document.querySelector('[aria-label="Address or cross streets"]');
        if (!field) throw new Error("no address field on screen");
        await act(async () => {
          fireEvent.keyDown(field, { key: "Enter" });
        });
      },
    ],
    [
      "the ledger's action",
      () => click(document.querySelector('[data-testid^="move-action-"]'), "the ledger's action"),
    ],
  ];

  it.each(DOORS)("T21: %s during a lookup drops it: no write, no focus, no scroll", async (_what, door) => {
    await toTheCrossStreetQuestion();
    await heldLookup();
    await door();
    expect(q("picker")).not.toBeNull();
    await act(async () => {
      release?.();
    });
    await settle();
    expect(q("cross-row")).toBeNull();
    expect(q("band-aerial-ring")).toBeNull();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it.each(DOORS)("T21: %s during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back", async (_what, door) => {
    readHangs = true;
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    await door();
    expect(q("picker")).not.toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, REVEAL_WAIT_MS + 100));
    });
    expect(scrollBy).not.toHaveBeenCalled();
    await click(byText("CANCEL"), "CANCEL");
    await settle();
    expect(scrollBy).not.toHaveBeenCalled();
    readHangs = false;
  }, 8000);

  it("T21: a picker opened during a Move's lookup keeps the Move armed when it's cancelled", async () => {
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    await click(q("cross-move"), "Move");
    await heldLookup();
    expect(barKind()).toBe("finding");
    await click(q("where-open-picker"), "Edit on map");
    await act(async () => {
      release?.();
    });
    await settle();
    await click(byText("CANCEL"), "CANCEL");
    expect(barKind()).toBe("armed");
    expect(q("cross-move")?.textContent).toBe("Cancel");
    expect(q("band-aerial-frame")?.className).toContain("is-armed");
  });

  it("T24: Move brings the aerial back; nothing else does, and a picture already there stays put", async () => {
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    await until(() => scrollBy.mock.calls.length > 0, "the found tap's scroll");
    scrollBy.mockClear();

    // Already all there: no scroll.
    await click(q("cross-move"), "Move");
    expect(scrollBy).not.toHaveBeenCalled();
    await click(q("cross-move"), "Cancel");

    // Above the view: back up, once.
    frameTop = -200;
    (q("cross-move") as HTMLElement).focus();
    await click(q("cross-move"), "Move");
    expect(barKind()).toBe("armed");
    // #457 U8 (#446's known limit): focus goes to the bar's big-map button,
    // which the scroll brings into view, not to Cancel.
    expect(document.activeElement).toBe(q("band-aerial-big-map"));
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ top: -200, behavior: "smooth" });
    scrollBy.mockClear();

    // Move's Cancel and Undo stay still, with the picture off screen (ruling 5).
    await click(q("cross-move"), "Cancel");
    await click(q("cross-undo"), "Undo");
    await until(() => barKind() === "armed", "the re-armed bar");
    await settle();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("T24: with reduced motion Move's scroll is a jump", async () => {
    reduced = true;
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    await until(() => scrollBy.mock.calls.length > 0, "the found tap's scroll");
    scrollBy.mockClear();
    frameTop = -200;
    await click(q("cross-move"), "Move");
    expect(scrollBy).toHaveBeenCalledWith({ top: -200, behavior: "instant" });
  });

  it("T25: a failed tap with its bar under the nav scrolls just enough, once; a bar in view stays put", async () => {
    barTop = -40;
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: "smooth" });
    await settle();
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("T25: a failed tap with its bar all in view doesn't scroll", async () => {
    barTop = 1;
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    await settle();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("T25: with reduced motion the failed tap's scroll is a jump", async () => {
    barTop = -40;
    reduced = true;
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: "instant" });
  });

  it("T25: no street there with its bar under the nav scrolls just enough, once", async () => {
    barTop = -40;
    await toTheCrossStreetQuestion();
    roadBearing = "none";
    await tapCrossing();
    await until(() => barKind() === "none", "the no-street bar");
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: "smooth" });
    await settle();
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("T25: no street there with its bar all in view doesn't scroll", async () => {
    barTop = 1;
    await toTheCrossStreetQuestion();
    roadBearing = "none";
    await tapCrossing();
    await until(() => barKind() === "none", "the no-street bar");
    await settle();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("T25: with reduced motion no street's scroll is a jump", async () => {
    barTop = -40;
    reduced = true;
    await toTheCrossStreetQuestion();
    roadBearing = "none";
    await tapCrossing();
    await until(() => barKind() === "none", "the no-street bar");
    expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: "instant" });
  });

  it("T25, T26: the card's Try again failing again doesn't scroll and keeps focus; no street puts focus on that answer's line", async () => {
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    barTop = -40;
    const retry = q("cross-retry") as HTMLButtonElement;
    retry.focus();
    await click(retry, "the card's Try again");
    await until(() => q("cross-retry") !== null && q("cross-retry") !== retry, "the failed line again");
    await settle();
    expect(document.activeElement).toBe(q("cross-retry"));
    expect(scrollBy).not.toHaveBeenCalled();

    roadBearing = "none";
    q("cross-retry")?.focus();
    await click(q("cross-retry"), "the card's Try again");
    await until(() => barKind() === "none", "the no-street bar");
    expect(document.activeElement).toBe(q("cross-none"));
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("T25: the bar's Try again failing with its bar under the nav scrolls, once", async () => {
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    expect(scrollBy).not.toHaveBeenCalled();
    barTop = -40;
    await click(q("band-aerial-retry"), "the bar's Try again");
    await until(() => scrollBy.mock.calls.length > 0, "the scroll");
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: "smooth" });
  });

  it("T25, T22: the bar's Try again answering no street with its bar under the nav scrolls, once, and focus lands", async () => {
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    expect(scrollBy).not.toHaveBeenCalled();
    barTop = -40;
    const retry = q("band-aerial-retry") as HTMLButtonElement;
    retry.focus();
    roadBearing = "none";
    await click(retry, "the bar's Try again");
    await until(() => barKind() === "none", "the no-street bar");
    expect(document.activeElement).toBe(q("band-aerial-big-map"));
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: "smooth" });
  });

  it.each(["refused", "garbled", "down"] as const)(
    "T25: the tap's own coordinate read %s: the failed bar, its scroll, and Try again asks from the tap",
    async (how) => {
      barTop = -40;
      await toTheCrossStreetQuestion();
      aerialPoint = how;
      await tapCrossing();
      await until(() => barKind() === "failed", "the failed bar");
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: "smooth" });

      aerialPoint = "ok";
      await click(q("band-aerial-retry"), "the bar's Try again");
      await until(() => q("cross-row") !== null, "the ✓ row");
      expect(calls.filter((c) => c.url.includes("/api/aerial-point"))).toHaveLength(2);
    },
  );

  it("T27: a different crossing saved on the big map ends the Move", async () => {
    await toTheCrossStreetQuestion();
    tappedPoint = { lat: POINT.lat + 0.0001, lng: POINT.lng };
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    await click(q("cross-move"), "Move");
    expect(q("cross-move")!.textContent).toBe("Cancel");

    await click(q("band-aerial-big-map"), "Use the big map instead");
    await click(byText("SAVE_CROSS"), "SAVE_CROSS");
    await until(() => q("cross-move")?.textContent === "Move", "the Move to end");
    expect(barKind()).toBe("found");
  });

  it("T27: Move on a crossing the big map made re-arms, scrolls, cancels, and a tap there undoes back to it", async () => {
    await toTheCrossStreetQuestion();
    await click(q("band-aerial-big-map"), "Use the big map instead");
    await click(byText("SAVE_CROSS"), "SAVE_CROSS");
    await until(() => q("cross-row") !== null, "the ✓ row after the picker");
    const saved = await held();
    expect(barKind()).toBe("found");
    expect(scrollBy).not.toHaveBeenCalled();

    frameTop = -200;
    await click(q("cross-move"), "Move");
    expect(barKind()).toBe("armed");
    expect(q("cross-move")!.textContent).toBe("Cancel");
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ top: -200, behavior: "smooth" });

    await click(q("cross-move"), "Cancel");
    expect(barKind()).toBe("found");
    expect(q("cross-move")!.textContent).toBe("Move");

    frameTop = 1;
    await click(q("cross-move"), "Move");
    tappedPoint = { lat: POINT.lat + 0.0001, lng: POINT.lng };
    await tapCrossing();
    await until(() => q("cross-move")?.textContent === "Move", "the Move to end with the new mark");
    const moved = await held();
    expect(moved.meta.intersection).not.toEqual(saved.meta.intersection);
    await click(q("cross-undo"), "Undo");
    await until(() => barKind() === "found", "the found bar back");
    expect((await held()).meta.intersection).toEqual(saved.meta.intersection);
  });

  it.each([
    ["band-aerial-retry", "the bar's"],
    ["cross-retry", "the card's"],
  ])("T26: a place the person moved focus to during %s Try again stays", async (id, what) => {
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    const retry = q(id) as HTMLButtonElement;
    retry.focus();
    roadBearing = "holdFail";
    release = null;
    await click(retry, `${what} Try again`);
    await until(() => release !== null, "the lookup to be asked");
    const elsewhere = q("where-open-picker") as HTMLButtonElement;
    elsewhere.focus();
    await act(async () => {
      release?.();
    });
    await until(() => barKind() === "failed", "the failed bar again");
    await settle();
    expect(document.activeElement).toBe(elsewhere);
  });

  it("T22: Try again answering no street puts focus on the bar's big-map button", async () => {
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    const retry = q("band-aerial-retry") as HTMLButtonElement;
    retry.focus();
    roadBearing = "none";
    await click(retry, "the bar's Try again");
    await until(() => barKind() === "none", "the no-street bar");
    expect(document.activeElement).toBe(q("band-aerial-big-map"));
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("T23: re-tapping the same street waits for the new read, not the old one", async () => {
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => scrollBy.mock.calls.length > 0, "the first scroll");
    scrollBy.mockClear();
    await click(q("cross-move"), "Move");
    readHangs = true;
    // The same street at another pixel, so another coordinate and a new read.
    tappedPoint = { lat: POINT.lat + 0.0001, lng: POINT.lng };
    await tapCrossing();
    await until(() => q("cross-move")?.textContent === "Move", "the new mark");
    await settle();
    expect(scrollBy).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, REVEAL_WAIT_MS + 100));
    });
    expect(scrollBy).toHaveBeenCalledTimes(1);
    readHangs = false;
  }, 8000);

  it("T6: a tap found with the row off the card isn't owed anything when a later big-map save marks the crossing", async () => {
    await toTheCrossStreetQuestion();
    await heldLookup();
    // The kind's Undo takes the question off the card while the lookup is out.
    await click(byText("Undo"), "the kind's Undo");
    await act(async () => {
      release?.();
    });
    await settle();
    expect(q("cross-row-name")).toBeNull();
    await until(() => q("kind-chip-near_intersection") !== null, "the kind question");
    await click(q("kind-chip-near_intersection"), "the near-intersection kind");
    await click(byText("Next question"), "Next question");
    // The tap's crossing stands, answered, with the card on the side question.
    await until(() => q("where-questions")?.textContent?.includes("Race Street") ?? false, "the tap's crossing");
    const undos = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "Undo");
    await click(undos[undos.length - 1], "the crossing's Undo");
    await until(() => barKind() === "armed", "the re-armed bar");
    await click(q("band-aerial-big-map"), "Use the big map instead");
    await click(byText("SAVE_CROSS"), "SAVE_CROSS");
    await until(() => q("cross-row") !== null, "the ✓ row after the picker");
    await settle();
    expect(document.activeElement).not.toBe(q("cross-row-name"));
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it.each([
    ["failed", "fail" as Mode],
    ["none", "none" as Mode],
  ])("T20: from a %s tap, a crossing saved on the big map shows the found bar, no ring, no Try again, and nothing re-runs the old point", async (kind, mode) => {
    await toTheCrossStreetQuestion();
    roadBearing = mode;
    await tapCrossing();
    await until(() => barKind() === kind, "the warn bar");
    await click(q("band-aerial-big-map"), "Use the big map instead");
    await click(byText("SAVE_CROSS"), "SAVE_CROSS");
    await until(() => q("cross-row") !== null, "the ✓ row after the picker");
    await settle();
    expect(barKind()).toBe("found");
    expect(q("band-aerial-bar")?.textContent).toBe("✓ Near Race Street");
    expect(q("band-aerial-ring")).toBeNull();
    expect(q("band-aerial-retry")).toBeNull();
    expect(q("cross-failed")).toBeNull();
    expect(q("cross-none")).toBeNull();
    // Undo goes back to the plain question: the old answer doesn't return.
    await click(q("cross-undo"), "Undo");
    await until(() => barKind() === "armed", "the re-armed bar");
    expect(q("band-aerial-ring")).toBeNull();
    expect(q("cross-failed")).toBeNull();
  });

  it("T20: a picker save that changes nothing also clears a failed tap; cancelling the picker doesn't", async () => {
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    await click(q("band-aerial-big-map"), "Use the big map instead");
    await click(byText("CANCEL"), "CANCEL");
    expect(barKind()).toBe("failed");
    await click(q("band-aerial-big-map"), "Use the big map instead");
    await click(byText("SAVE_PIN"), "SAVE_PIN");
    await until(() => barKind() === "armed", "the armed bar");
    expect(q("band-aerial-ring")).toBeNull();
    expect(q("band-aerial-retry")).toBeNull();
  });

  it("ruling 3: both already in view, no scroll; focus still lands", async () => {
    rowTop = 400;
    nextBottom = 700;
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row-line")?.textContent?.includes("east") ?? false, "the read's distance");
    await settle();
    expect(scrollBy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(q("cross-row-name"));
  });

  it("ruling 3: with reduced motion the scroll is a jump", async () => {
    reduced = true;
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => scrollBy.mock.calls.length > 0, "the scroll");
    expect(scrollBy).toHaveBeenCalledWith({ top: 316, behavior: "instant" });
  });

  it("ruling 4: failed turns the bar warn with Try again in it and a dashed ring, no scroll; Try again asks the same point, and found then scrolls", async () => {
    await toTheCrossStreetQuestion();
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    const retry = q("band-aerial-retry")!;
    expect(q("band-aerial-bar")?.textContent).toBe(
      "⚠ The street lookup didn't answer. Tap again, or try once more.Try again",
    );
    expect(retry.textContent).toBe("Try again");
    expect(q("band-aerial-ring")?.getAttribute("data-look")).toBe("dashed");
    expect(q("band-aerial-frame")?.className).toContain("is-armed"); // tap again
    expect(scrollBy).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(q("cross-row-name"));

    // A retry that fails again hands focus back to the button.
    (retry as HTMLButtonElement).focus();
    await click(retry, "the bar's Try again");
    await until(() => q("band-aerial-retry") !== null, "the failed bar again");
    expect(document.activeElement).toBe(q("band-aerial-retry"));
    expect(calls.filter((c) => c.url.includes("/api/aerial-point"))).toHaveLength(1);

    roadBearing = "ok";
    await click(q("band-aerial-retry"), "the bar's Try again");
    await until(() => q("cross-row") !== null, "the ✓ row");
    expect(calls.filter((c) => c.url.includes("/api/aerial-point"))).toHaveLength(1);
    expect(barKind()).toBe("found");
    await until(() => scrollBy.mock.calls.length > 0, "the scroll");
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("T15: with no read answering, the scroll goes at the wait's end; Move or Undo before then calls it off", async () => {
    readHangs = true;
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    expect(scrollBy).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, REVEAL_WAIT_MS + 100));
    });
    expect(scrollBy).toHaveBeenCalledTimes(1);

    scrollBy.mockClear();
    await click(q("cross-move"), "Move");
    await click(q("cross-move"), "Cancel");
    await click(q("cross-undo"), "Undo");
    await until(() => barKind() === "armed", "the re-armed bar");
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    await click(q("cross-move"), "Move");
    await act(async () => {
      await new Promise((r) => setTimeout(r, REVEAL_WAIT_MS + 100));
    });
    expect(scrollBy).not.toHaveBeenCalled();
    readHangs = false;
  }, 12000);

  it("ruling 4: no street there has the same look with X8's copy, and no Try again", async () => {
    await toTheCrossStreetQuestion();
    roadBearing = "none";
    await tapCrossing();
    await until(() => barKind() === "none", "the no-street bar");
    expect(q("band-aerial-bar")?.textContent).toBe(
      "⚠ No cross street found there. Tap closer to where the two streets cross.",
    );
    expect(q("band-aerial-retry")).toBeNull();
    expect(q("band-aerial-ring")?.getAttribute("data-look")).toBe("dashed");
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("ruling 5: Move re-arms the bar and Undo clears the box; with the picture in view, neither scrolls", async () => {
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    scrollBy.mockClear();
    await click(q("cross-move"), "Move");
    expect(barKind()).toBe("armed");
    expect(q("band-aerial-bar")?.textContent).toBe("Tap the intersection nearest the work");
    expect(q("band-aerial-mark")).not.toBeNull();
    await click(q("cross-undo"), "Undo");
    await until(() => barKind() === "armed", "the re-armed bar");
    expect(q("band-aerial-mark")).toBeNull();
    expect(q("band-aerial-ring")).toBeNull();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("T7: Undo after a failed tap clears the dashed ring; Move's new tap scrolls again when it is found", async () => {
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    scrollBy.mockClear();
    await click(q("cross-move"), "Move");
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    // The standing mark stays until a new one replaces it.
    expect(q("band-aerial-mark")).not.toBeNull();
    expect(q("band-aerial-ring")).not.toBeNull();
    roadBearing = "ok";
    await tapCrossing();
    await until(() => barKind() === "found", "the found bar");
    await until(() => scrollBy.mock.calls.length > 0, "the scroll");
    expect(scrollBy).toHaveBeenCalledTimes(1);
    await click(q("cross-move"), "Move");
    roadBearing = "fail";
    await tapCrossing();
    await until(() => barKind() === "failed", "the failed bar");
    await click(q("cross-undo"), "Undo");
    await until(() => barKind() === "armed", "the re-armed bar");
    expect(q("band-aerial-ring")).toBeNull();
    expect(q("band-aerial-mark")).toBeNull();
  });

  it("T6: a crossing marked on the big map shows the found bar without a box, a scroll or a focus move", async () => {
    await toTheCrossStreetQuestion();
    await click(q("band-aerial-big-map"), "Use the big map instead");
    await click(byText("SAVE_CROSS"), "SAVE_CROSS");
    await until(() => q("cross-row") !== null, "the ✓ row after the picker");
    expect(barKind()).toBe("found");
    expect(q("band-aerial-bar")?.textContent).toBe("✓ Near Race Street");
    expect(q("band-aerial-mark")).toBeNull();
    expect(scrollBy).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(q("cross-row-name"));
  });

  it("T5: the big-map button stays on in every state, and while a lookup runs it drops that lookup", async () => {
    await toTheCrossStreetQuestion();
    await heldLookup();
    expect(q("band-aerial-big-map")).not.toBeNull();
    await click(q("band-aerial-big-map"), "Use the big map instead");
    expect(q("picker")?.getAttribute("data-arm")).toBe("true");
    await click(byText("CANCEL"), "CANCEL");
    await act(async () => {
      release?.();
    });
    await settle();
    expect(barKind()).toBe("armed");
    expect(q("band-aerial-ring")).toBeNull();
    expect(q("cross-row")).toBeNull();
    expect(scrollBy).not.toHaveBeenCalled();
    await tapCrossing();
  });

  it("the bar leaves with the question: after Next, the side's picture has no bar", async () => {
    await toTheCrossStreetQuestion();
    await tapCrossing();
    await until(() => q("cross-row") !== null, "the ✓ row");
    await click(byText("Next question"), "Next question");
    await until(() => q("side-option") !== null, "the side question");
    expect(q("band-aerial-bar")).toBeNull();
    expect(q("band-aerial-frame")?.getAttribute("data-bar")).toBeNull();
  });
});
