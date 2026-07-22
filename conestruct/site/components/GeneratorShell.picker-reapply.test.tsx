// @vitest-environment happy-dom
//
// Picker re-apply must not revert manual form edits (the lanes-selection
// bug): onPickerSave used to re-run applyClassification on EVERY Apply,
// re-imposing the detected road values over edits made since the last
// apply.  With the 3-lane chip selected, re-opening the picker and
// hitting Apply without changing anything silently reverted lanes to the
// detected 2 — invisible on every other field only because the detection
// matched what was already in the form.  These tests assert at the
// SUBMITTED PAYLOAD level (the /api/render/bundle body), not display
// state — the gap that let the bug ship: the 64977d4 vitest cases all
// tested pure functions, never the mounted chip -> payload path.

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
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { ShoulderScenario } from "@/lib/scenarios/types";
import type { RoadClassification } from "@/lib/road-detection/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
// The restage moved the bundle POST from the Generate click to Zone 2's
// "All (.zip)"; the stub exposes that trigger so the payload capture
// stays at the submitted-bundle level.
vi.mock("./OutputCards", () => ({
  OutputCards: ({ onDownloadAll }: { onDownloadAll?: () => void }) => (
    <button type="button" onClick={onDownloadAll}>
      ALL_ZIP
    </button>
  ),
}));
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

// Cut the mapbox edge; the stub scripts the picker flow with two Apply
// buttons — pin A (a Lafayette-like rural-divided detection) and pin B
// (the same road re-detected with different content), exactly the
// LocationPickerResult a real pin-drop + Apply produces.
function detection(
  lanesPerDirection: number,
  speedLimitMph: number,
): RoadClassification {
  return {
    roadType: "rural_divided",
    divided: true,
    laneWidthFt: 12,
    speedLimitMph,
    lanesPerDirection,
    confidence: "high",
    source: "osm-tags",
    raw: {
      class: "trunk",
      oneway: false,
      roadName: "US 287",
      roadRef: "US 287",
      placeName: "Lafayette",
      osmLanesTag: String(lanesPerDirection * 2),
      osmMaxspeedTag: `${speedLimitMph} mph`,
    },
    fields: {
      speed: {
        value: speedLimitMph,
        confidence: "high",
        source: "OSM maxspeed tag",
        method: "measured",
      },
      lanes: {
        value: lanesPerDirection,
        confidence: "medium",
        source: "OSM lanes tag",
        method: "measured",
      },
      roadType: { value: "rural_divided", confidence: "high", source: "class", method: "measured" },
      divided: { value: true, confidence: "high", source: "oneway", method: "measured" },
    },
  } as RoadClassification;
}

function result(classification: RoadClassification) {
  return {
    address: "Lafayette, CO",
    lat: 39.9936,
    lng: -105.0897,
    bearingDeg: 90,
    workZoneFt: 1000,
    classification,
    overrides: {},
  };
}

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <>
      <button type="button" onClick={() => onSave(result(detection(2, 75)))}>
        APPLY_PIN_A
      </button>
      <button type="button" onClick={() => onSave(result(detection(1, 65)))}>
        APPLY_PIN_B
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
  // device-breakdown + audit + pdf preview fire on scenario changes;
  // keep them benign.
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

async function mountSandbox() {
  render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SHOULDER} />);
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

async function generate(user: ReturnType<typeof userEvent.setup>) {
  // Generate stages the page (restage lifecycle); the bundle POST that
  // carries the payload under test fires from Zone 2's "All (.zip)".
  await user.click(screen.getByText("Generate plan"));
  await user.click(screen.getByText("ALL_ZIP"));
  await waitFor(() => expect(bundleBody).not.toBeNull());
}

describe("picker re-apply preserves manual form edits (lanes bug)", () => {
  it("REGRESSION: a no-change re-apply keeps the user's lane selection in the payload", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    // Pin drop + apply, then the user picks 3 lanes in the form.
    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_A"));
    await user.click(lanesChip("3"));
    expect(lanesChip("3").className).toContain("on");

    // Re-open the picker (e.g. to double-check the corridor) and Apply
    // without changing anything: the unchanged detection must NOT
    // re-impose its lanes=2 over the user's 3.
    await user.click(screen.getByText(/Edit Location & Corridor/));
    await user.click(screen.getByText("APPLY_PIN_A"));
    expect(lanesChip("3").className).toContain("on");

    await generate(user);
    expect(bundleBody?.scenario.lanes).toBe(3);
    // The unchanged detection's other fields are also left alone.
    expect(bundleBody?.scenario.speed).toBe(75);
  });

  it("control: plain pin apply then chip selection reaches the payload", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_A"));
    await user.click(lanesChip("3"));

    await generate(user);
    expect(bundleBody?.scenario.lanes).toBe(3);
    expect(bundleBody?.scenario.speed).toBe(75);
  });

  it("control: chip selection reaches the payload with no pin at all", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(lanesChip("3"));
    await generate(user);
    expect(bundleBody?.scenario.lanes).toBe(3);
  });

  it("a CHANGED detection still applies over manual edits (new information wins)", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_A"));
    await user.click(lanesChip("3"));

    // Re-detection with different content (pin B: 1 lane/direction,
    // 65 mph) is new information and must apply — the skip is scoped to
    // UNCHANGED detections only.
    await user.click(screen.getByText(/Edit Location & Corridor/));
    await user.click(screen.getByText("APPLY_PIN_B"));

    await generate(user);
    expect(bundleBody?.scenario.lanes).toBe(1);
    expect(bundleBody?.scenario.speed).toBe(65);
  });
});
