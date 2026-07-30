// @vitest-environment happy-dom
//
// #181: switching scenario kind must not erase the safety relays — the
// order-dependent refusal bypass.  Detection on one kind, then a
// one-click switch to flagger, used to hand the backend a payload with
// no relays at all: the #86/#136/#158 gates never saw the facts they
// exist to refuse on, so the SAME road generated or refused depending
// on click order (proven against the live backend, 200 vs 400, in the
// Arc 1 investigation).  These tests assert at the SUBMITTED PAYLOAD
// level (the /api/render/bundle body), the level the gates consume —
// pure-function tests passed while this class of bug shipped (rule 11).
//
// Fixture is the standing multi-lane two-way test spot (E Colfax near
// Race St): raw lanes=5 decomposing 2+2+1, which the #86 gate refuses
// (total >= 4), plus a one-way tag to cover the #158 relay.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { RoadCandidate, RoadClassification } from "@/lib/road-detection/types";

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
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

// E Colfax near Race St (39.73997, -104.96632): OSM lanes=5 = 2+2+1.
// `detectedOneway: "yes"` rides along so the #158 relay's survival is
// asserted too (the shoulder branch never captured it — the switch to
// flagger is where it must appear).
const COLFAX: RoadClassification = {
  roadType: "urban_arterial",
  divided: false,
  laneWidthFt: 12,
  speedLimitMph: 35,
  lanesPerDirection: 2,
  detectedLanesTotal: 5,
  detectedLanesForward: 2,
  detectedLanesBackward: 2,
  detectedLanesBothWays: 1,
  detectedOneway: "yes",
  confidence: "high",
  source: "osm-tags",
  raw: {
    class: "primary",
    oneway: true,
    roadName: "East Colfax Avenue",
    roadRef: "US 40",
    placeName: "Denver",
    osmLanesTag: "5",
    osmMaxspeedTag: "35 mph",
    osmLanesForwardTag: "2",
    osmLanesBackwardTag: "2",
    osmLanesBothWaysTag: "1",
    osmOnewayTag: "yes",
  },
  fields: {
    speed: {
      value: 35,
      confidence: "high",
      source: "OSM maxspeed tag",
      method: "measured",
    },
    lanes: {
      value: 2,
      confidence: "medium",
      source: "OSM lanes tag",
      method: "measured",
    },
    roadType: {
      value: "urban_arterial",
      confidence: "high",
      source: "class",
      method: "measured",
    },
    divided: {
      value: false,
      confidence: "high",
      source: "oneway",
      method: "measured",
    },
  },
};

const COLFAX_CANDIDATE: RoadCandidate = {
  way_id: "334455",
  highway_class: "primary",
  name: "East Colfax Avenue",
  ref: "US 40",
  bearing: 90,
  snap_distance_m: 4.1,
  snapped_lat: 39.73997,
  snapped_lng: -104.96632,
  tags: {
    oneway: "yes",
    maxspeed: "35 mph",
    lanes: "5",
    lanes_forward: "2",
    lanes_backward: "2",
    lanes_both_ways: "1",
    turn_lanes: null,
    turn_lanes_forward: null,
    turn_lanes_backward: null,
  },
  signal_distance_m: null,
};

// The LocationPickerResult a real pin-drop + confirm + Save produces —
// confirmedRoad included, because the kind-switch re-derivation reads
// the recorded classification from scenario.meta.confirmedRoad.
const PICKER_RESULT = {
  address: "E Colfax Ave & Race St, Denver",
  lat: 39.73997,
  lng: -104.96632,
  bearingDeg: 90,
  workZoneFt: 800,
  classification: COLFAX,
  overrides: {},
  crossStreet: null,
  confirmedRoad: {
    candidate: COLFAX_CANDIDATE,
    classification: COLFAX,
    method: "auto_single" as const,
    overrides: {},
    isUrban: true,
    placeName: "Denver",
    pinLat: 39.73997,
    pinLng: -104.96632,
  },
};

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button type="button" onClick={() => onSave(PICKER_RESULT)}>
      APPLY_COLFAX
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";

type LooseScenario = Record<string, unknown> & {
  meta: Record<string, unknown>;
};

let bundleBody: { scenario: LooseScenario } | null = null;

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/bundle")) {
    bundleBody = JSON.parse(String(init?.body)) as { scenario: LooseScenario };
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
  render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SHOULDER} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Generate plan"));
  await user.click(screen.getByText("ALL_ZIP"));
  await waitFor(() => expect(bundleBody).not.toBeNull());
}

describe("kind-switch preserves the safety relays (#181)", () => {
  it("REGRESSION: detect-then-switch payload carries every relay the flagger gates consume", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_COLFAX"));

    await user.click(screen.getByText("Flagger lane closure"));

    await generate(user);
    const s = bundleBody!.scenario;
    expect(s.kind).toBe("flagger_lane_closure");
    // The #86/#136 relay set — the exact fields whose absence produced
    // the live-backend 200 where the 400 belonged.
    expect(s.detectedLanesTotal).toBe(5);
    expect(s.detectedLanesForward).toBe(2);
    expect(s.detectedLanesBackward).toBe(2);
    expect(s.detectedLanesBothWays).toBe(1);
    // The #158 relay: flagger is the only kind that carries `oneway`,
    // so the switch is where it must materialize from the confirmed
    // detection (the shoulder branch never captured it).
    expect(s.oneway).toBe("yes");
    // Shared inputs survive too (the data-loss half of the issue).
    expect(s.speed).toBe(35);
    expect(s.workLen).toBe(800);
    expect(s.meta.confirmedRoad).toBeTruthy();
  });

  it("the recovery affordances render after the switch — refusal comes with its confirm row", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_COLFAX"));
    await user.click(screen.getByText("Flagger lane closure"));

    // Re-armed relays arm their affordances: the #86 multilane confirm
    // and the #158 two-way confirm both render (rule 10's other half —
    // the refusal is honest AND recoverable).
    expect(
      screen.getByText("Road has one through lane in each direction"),
    ).toBeTruthy();
    expect(screen.getByText("Road carries two-way traffic")).toBeTruthy();
  });

  it("switching kinds twice returns the shared inputs, not the defaults", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    await user.click(screen.getByText("Pick Location on Map"));
    await user.click(screen.getByText("APPLY_COLFAX"));
    await user.click(screen.getByText("Night operation"));

    await user.click(screen.getByText("Flagger lane closure"));
    await user.click(screen.getByText("Shoulder work"));

    await generate(user);
    const s = bundleBody!.scenario;
    expect(s.kind).toBe("shoulder");
    expect(s.speed).toBe(35); // detection speed, not DEFAULT_SHOULDER's 65
    expect(s.workLen).toBe(800); // picker work zone, not the default 1000
    expect(s.night).toBe(true); // the manual toggle survives the round trip
    // Shoulder's own relay shape is re-derived from the confirmed road.
    expect(s.detectedLanesTotal).toBe(5);
    expect(s.detectedLanesForward).toBe(2);
    expect(s.lanes).toBe(2); // lanesPerDirection re-applied
    expect(s.roadType).toBe("urban_arterial");
  });

  it("no confirmed detection → no relays: absence renders as absence (rule 10)", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    // No picker, no detection — just a kind switch on a fresh form.
    await user.click(screen.getByText("Flagger lane closure"));

    await generate(user);
    const s = bundleBody!.scenario;
    expect(s.kind).toBe("flagger_lane_closure");
    expect(s.detectedLanesTotal).toBeUndefined();
    expect(s.oneway).toBeUndefined();
    // Shared defaults still carry (65 snaps into the flagger domain).
    expect(s.speed).toBe(55);
  });
});
