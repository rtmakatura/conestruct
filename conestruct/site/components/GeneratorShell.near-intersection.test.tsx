// @vitest-environment happy-dom
//
// near_intersection picker → form → payload flow (#117, Option C inc.
// 4).  The kind is GATED — absent from ENABLED_SCENARIO_KINDS on both
// sides — so these tests mount it via GeneratorShell's initialScenario
// prop, the same lever the kind's eventual enablement will exercise.
// Assertions are at the SUBMITTED PAYLOAD level (the /api/render/bundle
// body): the payload IS the scenario state, and a field that renders
// but doesn't submit is exactly the #112 failure class this suite
// exists to block for the approaches seam.

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
import { DEFAULT_NEAR_INTERSECTION } from "@/lib/scenarios";
import type { NearIntersectionScenario } from "@/lib/scenarios/types";
import type { CrossStreetCandidate } from "@/lib/road-detection/cross-street";

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

// The stub scripts the picker's Save exactly as the real modal would
// hand it back: no mainline classification (kept null for focus), one
// detected cross street.  PIN_A twice = the re-apply case; PIN_B is
// the same intersection re-detected with different content.
function crossStreet(over: Partial<CrossStreetCandidate>): CrossStreetCandidate {
  return {
    name: "Oak Street",
    alongStationFt: -250,
    legCount: 2,
    signalized: true,
    speedMph: 30,
    lanesPerDirection: 2,
    lanesSuspect: true,
    lanesSuspectReason:
      "The map data shows marked turn lanes here — its lane count " +
      "usually includes turn pockets, so the through-lane count is " +
      "often lower.",
    roadType: "urban_arterial",
    bearingDeg: 90,
    detectedLanesTotal: null,
    detectedLanesForward: null,
    detectedLanesBackward: null,
    detectedLanesBothWays: null,
    ...over,
  };
}

function result(cs: CrossStreetCandidate) {
  return {
    address: "Lafayette, CO",
    lat: 39.9936,
    lng: -105.0897,
    bearingDeg: 0,
    workZoneFt: 500,
    classification: null,
    overrides: {},
    crossStreet: cs,
  };
}

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <>
      <button
        type="button"
        onClick={() => onSave(result(crossStreet({})))}
      >
        APPLY_PIN_A
      </button>
      <button
        type="button"
        onClick={() =>
          onSave(result(crossStreet({ alongStationFt: -400, signalized: false })))
        }
      >
        APPLY_PIN_B
      </button>
    </>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";

type BundleBody = { scenario: NearIntersectionScenario };

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

async function mountSandbox() {
  render(
    <GeneratorShell
      mode="sandbox"
      initialScenario={DEFAULT_NEAR_INTERSECTION}
    />,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function chipIn(fieldLabel: string, chipLabel: string): HTMLElement {
  const field = screen.getByText(fieldLabel).closest("div")?.parentElement;
  if (!field) throw new Error(`${fieldLabel} field not found`);
  const chip = within(field as HTMLElement)
    .getAllByRole("button")
    .find((b) => b.textContent === chipLabel);
  if (!chip) throw new Error(`no ${chipLabel} chip in ${fieldLabel}`);
  return chip;
}

function generateButton(): HTMLElement {
  return screen.getByText("Generate plan").closest("button") as HTMLElement;
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  // Generate stages the page (restage lifecycle); the bundle POST that
  // carries the payload under test fires from Zone 2's "All (.zip)".
  await user.click(screen.getByText("Generate plan"));
  await user.click(screen.getByText("ALL_ZIP"));
  await waitFor(() => expect(bundleBody).not.toBeNull());
}

describe("near_intersection picker → form → payload", () => {
  it("ACCEPTANCE: prefill, edit, re-apply without losing the edit, submit the exact approaches array", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    // Detected cross street pre-fills the approaches.
    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_A"));

    // The detection-filled lane count needs confirmation; a manual
    // edit IS the confirmation (direction A → 1 through lane).
    await user.click(chipIn("Cross-street lanes — direction A", "1"));

    // Re-apply the same pin: the unchanged candidate must NOT clobber
    // the edit (#112's failure class at the approaches seam).
    await user.click(screen.getByText(/Edit Location & Corridor/));
    await user.click(screen.getByText("APPLY_PIN_A"));
    expect(chipIn("Cross-street lanes — direction A", "1").className).toContain(
      "on",
    );

    await generate(user);
    // The payload carries the exact array the backend schema accepts.
    expect(bundleBody?.scenario.approaches).toEqual([
      {
        id: "cross_a",
        speed: 30,
        roadType: "urban_arterial",
        lanesPerDirection: 1, // the user's edit, not the detected 2
        laneWidth: 12,
        signalized: true,
        bearingDeg: 90,
        alongStationFt: -250,
      },
      {
        id: "cross_b",
        speed: 30,
        roadType: "urban_arterial",
        lanesPerDirection: 2, // direction B untouched
        laneWidth: 12,
        signalized: true,
        bearingDeg: 270,
        alongStationFt: -250,
      },
    ]);
    // Mainline stays the default the user never touched.
    expect(bundleBody?.scenario.lanes).toBe(2);
    expect(bundleBody?.scenario.workLen).toBe(500);
    expect(bundleBody?.scenario.kind).toBe("near_intersection");
  });

  it("gates Generate on the unconfirmed detection-filled lane count", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_A"));

    // Needs-confirmation hold: the turn-lane-suspect copy shows and
    // the CTA is disabled until the user confirms.
    expect(screen.getByText(/turn pockets/i)).toBeTruthy();
    expect(generateButton().hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByText("Lane count is right"));
    expect(screen.queryByText("Lane count is right")).toBeNull();
    expect(generateButton().hasAttribute("disabled")).toBe(false);

    await generate(user);
    // Confirmed as detected: both legs keep the prefilled count.
    expect(
      bundleBody?.scenario.approaches.map((a) => a.lanesPerDirection),
    ).toEqual([2, 2]);
  });

  it("a CHANGED cross-street detection applies over manual edits (new information wins)", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_PIN_A"));
    await user.click(chipIn("Cross-street lanes — direction A", "1"));

    await user.click(screen.getByText(/Edit Location & Corridor/));
    await user.click(screen.getByText("APPLY_PIN_B"));

    // PIN_B's candidate is different content → it re-fills, and its
    // detection-filled lanes need confirming again.
    await user.click(screen.getByText("Lane count is right"));
    await generate(user);
    expect(bundleBody?.scenario.approaches[0].alongStationFt).toBe(-400);
    expect(bundleBody?.scenario.approaches[0].signalized).toBe(false);
    expect(bundleBody?.scenario.approaches[0].lanesPerDirection).toBe(2);
  });

  it("manual entry works with no detection at all", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    // No picker interaction: the default one-leg cross street is fully
    // form-editable.  Switch to both directions and set lanes.
    await user.click(chipIn("Cross-street directions", "Both"));
    await user.click(chipIn("Cross-street lanes — direction B", "2"));

    await generate(user);
    expect(bundleBody?.scenario.approaches).toHaveLength(2);
    expect(bundleBody?.scenario.approaches[0].id).toBe("cross_a");
    expect(bundleBody?.scenario.approaches[1].id).toBe("cross_b");
    expect(bundleBody?.scenario.approaches[1].lanesPerDirection).toBe(2);
    expect(bundleBody?.scenario.approaches[0].lanesPerDirection).toBe(1);
  });
});
