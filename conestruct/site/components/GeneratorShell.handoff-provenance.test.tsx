// @vitest-environment happy-dom
//
// #198: the four silent auto-apply mutation families each produce a
// visible handoff note at the picker -> form seam.  Mounted at the
// GeneratorShell level (Rule 11 — the bug lived at the seam, not in the
// pure functions): the stubbed picker emits real LocationPickerResult
// shapes, the assertions read the rendered LocationSummary notes and,
// for family 4, the SUBMITTED payload.
//
// Family 1 — a CHANGED detection re-applies and overwrites manual form
//            edits (lanes/divided/laneWidth); the change is named.
// Family 2 — picker lanes/divided overrides on a kind without those
//            fields are named as not applicable, not dropped silently.
// Family 3 — an out-of-domain lane count is named as clamped.
// Family 4 — a picker-lowered posted speed clears a standing work-zone
//            reduction (named) instead of shipping a payload the
//            backend validator rejects.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario, ShoulderScenario } from "@/lib/scenarios/types";
import type { RoadClassification } from "@/lib/road-detection/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({
  OutputCards: ({ onDownloadAll }: { onDownloadAll?: () => void }) => (
    <button type="button" onClick={onDownloadAll}>
      ALL_ZIP
    </button>
  ),
}));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

function detection(over: {
  lanesPerDirection?: number;
  speedLimitMph?: number;
  divided?: boolean;
  roadType?: string;
}): RoadClassification {
  const lanes = over.lanesPerDirection ?? 2;
  const speed = over.speedLimitMph ?? 65;
  const divided = over.divided ?? true;
  const roadType = over.roadType ?? "rural_divided";
  return {
    roadType,
    divided,
    laneWidthFt: 12,
    speedLimitMph: speed,
    lanesPerDirection: lanes,
    confidence: "high",
    source: "osm-tags",
    raw: {
      class: "trunk",
      oneway: false,
      roadName: "US 287",
      roadRef: "US 287",
      placeName: "Lafayette",
      osmLanesTag: String(lanes * 2),
      osmMaxspeedTag: `${speed} mph`,
    },
    fields: {
      speed: {
        value: speed,
        confidence: "high",
        source: "OSM maxspeed tag",
        method: "measured",
      },
      lanes: {
        value: lanes,
        confidence: "medium",
        source: "OSM lanes tag",
        method: "measured",
      },
      roadType: { value: roadType, confidence: "high", source: "class", method: "measured" },
      divided: { value: divided, confidence: "high", source: "oneway", method: "measured" },
    },
  } as RoadClassification;
}

function result(
  classification: RoadClassification | null,
  overrides: Record<string, unknown> = {},
) {
  return {
    address: "Lafayette, CO",
    lat: 39.9936,
    lng: -105.0897,
    bearingDeg: 90,
    workZoneFt: 1000,
    classification,
    overrides,
  };
}

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <>
      {/* F1: pin A, then pin B with DIFFERENT content (1 lane) — the
          changed-detection clobber path. */}
      <button type="button" onClick={() => onSave(result(detection({})))}>
        APPLY_PIN_A
      </button>
      <button
        type="button"
        onClick={() => onSave(result(detection({ lanesPerDirection: 1, speedLimitMph: 65 })))}
      >
        APPLY_PIN_B_ONE_LANE
      </button>
      {/* F2: no detection change, picker-set lanes/divided overrides —
          discarded on kinds without the fields. */}
      <button
        type="button"
        onClick={() =>
          onSave(result(detection({}), { lanesPerDirection: 2, divided: true }))
        }
      >
        APPLY_OVERRIDES_LANES_DIVIDED
      </button>
      {/* F3: detection carrying an out-of-domain lane count. */}
      <button
        type="button"
        onClick={() => onSave(result(detection({ lanesPerDirection: 5 })))}
      >
        APPLY_PIN_FIVE_LANES
      </button>
      {/* F4: a low detected posted speed under a standing reduction. */}
      <button
        type="button"
        onClick={() => onSave(result(detection({ speedLimitMph: 35 })))}
      >
        APPLY_PIN_SLOW
      </button>
    </>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";

type BundleBody = { scenario: ShoulderScenario };

let bundleBody: BundleBody | null = null;

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/bundle")) {
    bundleBody = JSON.parse(String(init?.body)) as BundleBody;
    return Promise.resolve({
      ok: true,
      status: 200,
      blob: async () => new Blob(["zip"]),
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

beforeEach(() => {
  bundleBody = null;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:mock",
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: () => {},
    configurable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(initial: Scenario) {
  render(<GeneratorShell mode="sandbox" initialScenario={initial} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function lanesChip(label: string): HTMLElement {
  const field = screen
    .getByText("Lanes per direction")
    .closest("div")?.parentElement;
  if (!field) throw new Error("lanes field not found");
  const chip = within(field as HTMLElement)
    .getAllByRole("button")
    .find((b) => b.textContent === label);
  if (!chip) throw new Error(`no ${label} chip`);
  return chip;
}

describe("#198 handoff provenance — the four families produce visible notes", () => {
  it("family 1: a changed detection overwriting a manual lane edit is named", async () => {
    const user = userEvent.setup();
    await mount(DEFAULT_SHOULDER);

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_A"));
    await user.click(lanesChip("3"));

    await user.click(screen.getByText(/Edit Location & Corridor/));
    await user.click(screen.getByText("APPLY_PIN_B_ONE_LANE"));

    expect(
      screen.getByText(/Lanes set to 1\/direction \(OSM detection — was 3\)\./),
    ).toBeTruthy();
  });

  it("family 2: picker lanes/divided overrides on a flagger plan are named as not applicable", async () => {
    const user = userEvent.setup();
    await mount(DEFAULT_FLAGGER);

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_OVERRIDES_LANES_DIVIDED"));

    expect(
      screen.getByText(/Lanes setting 2\/direction from the picker not applied — flagger plans don't take a lane count\./),
    ).toBeTruthy();
    expect(
      screen.getByText(/Divided setting from the picker not applied — flagger plans don't take a divided toggle\./),
    ).toBeTruthy();
  });

  it("family 3: an out-of-domain detected lane count is named as clamped", async () => {
    const user = userEvent.setup();
    await mount(DEFAULT_SHOULDER);

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_FIVE_LANES"));

    expect(
      screen.getByText(/Lanes 4\/direction \(clamped from 5 OSM detection — plans draw at most 4 lanes per direction\)\./),
    ).toBeTruthy();
  });

  it("family 4: the cleared reduction is named AND the payload ships valid", async () => {
    const user = userEvent.setup();
    await mount({ ...DEFAULT_SHOULDER, workZoneSpeed: 55 } as Scenario);

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_SLOW"));

    expect(
      screen.getByText(/Work-zone speed reduction removed \(was 55 mph — the posted speed is now 35 mph, at or below it\)\./),
    ).toBeTruthy();

    await user.click(screen.getByText("Generate plan"));
    await user.click(screen.getByText("ALL_ZIP"));
    await waitFor(() => expect(bundleBody).not.toBeNull());
    expect(bundleBody?.scenario.speed).toBe(35);
    expect(bundleBody?.scenario.workZoneSpeed).toBeUndefined();
  });
});
