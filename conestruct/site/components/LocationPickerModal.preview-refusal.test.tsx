// @vitest-environment happy-dom
//
// #430 mounted-flow tests: the corridor-extent panel of the REAL modal when
// the pin moves while the jurisdiction is still a guess, and when the
// backend refuses the preview.  Driven the coverage suite's way (typed
// coords fire the real detectAt fetch; no Mapbox token).
//
// Rule 11: the bug lived in the request the modal sent (a jurisdiction
// guess for the old pin) and in the line the panel printed for the
// backend's 400 ("Couldn't reach the layout service").  The fetch stub
// applies the backend's own pin check (src/api/render_api.py `input_guesses`:
// a jurisdiction guess whose pin isn't meta.lat/lng is a 400 guess_stale),
// so the assertions read the payload and the rendered panel.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocationPickerModal } from "./LocationPickerModal";
import type { RoadCandidate, RoadDetectResponse } from "@/lib/road-detection/types";
import { asSentence, type CorridorGeometry } from "@/lib/corridor-geometry";
import { DEFAULT_SHOULDER, type Scenario } from "@/lib/scenarios";

const PIN: [number, number] = [39.7402, -104.9636];
// About 27 ft east of PIN (the issue's move).
const MOVED: [number, number] = [39.7402, -104.9635];

const UNREACHABLE = /Couldn.t reach the layout\s+service/;
const GUESS_STALE_MESSAGE =
  "Jurisdiction is marked as guessed, but it was guessed at a pin this plan no longer has. Set jurisdiction in Step 2, then generate again.";

const ROAD: RoadCandidate = {
  way_id: "111001",
  highway_class: "primary",
  name: "East Colfax Avenue",
  ref: "US 40",
  bearing: 90,
  snap_distance_m: 1.0,
  snapped_lat: PIN[0],
  snapped_lng: PIN[1],
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
    [PIN[0], PIN[1] - 0.01],
    [PIN[0], PIN[1] + 0.01],
  ],
};

// The band's scenario: pinned at PIN, the road confirmed there, and the
// jurisdiction an untouched guess from PIN (R108).
const GUESSED: Scenario = {
  ...DEFAULT_SHOULDER,
  workLen: 400,
  jurisdiction_key: "denver",
  guesses: { jurisdiction_key: { lat: PIN[0], lng: PIN[1] } },
  meta: {
    ...DEFAULT_SHOULDER.meta,
    lat: PIN[0],
    lng: PIN[1],
    work: { side: "right", travel: "with_geometry" },
    confirmedRoad: {
      candidate: ROAD,
      pinLat: PIN[0],
      pinLng: PIN[1],
    } as unknown as NonNullable<Scenario["meta"]["confirmedRoad"]>,
  },
} as Scenario;

// The operator set the jurisdiction: no guess entry.
const OPERATOR_SET: Scenario = (() => {
  const s = { ...GUESSED } as Record<string, unknown>;
  delete s.guesses;
  return s as unknown as Scenario;
})();

function laidOut(pin: [number, number]): CorridorGeometry {
  const path: Array<[number, number]> = [pin, [pin[0], pin[1] + 0.001]];
  const parts = [{ points: path, extended: false }];
  return {
    status: "laid_out",
    pin_model: "work_start",
    pin,
    travel_bearing_deg: 90,
    work: { length_ft: 400, points: path, parts },
    approaches: [],
    coverage_ft: 5000,
    message: null,
    side_options: [],
  };
}

type GeometryAnswer = (scenario: Scenario) => {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

// The backend's check, as render_api.py runs it before laying anything out.
const backendPinCheck: GeometryAnswer = (scenario) => {
  const jk = scenario.guesses?.jurisdiction_key;
  if (jk && (jk.lat !== scenario.meta.lat || jk.lng !== scenario.meta.lng)) {
    return {
      ok: false,
      status: 400,
      json: async () => ({ detail: { error: "guess_stale", message: GUESS_STALE_MESSAGE } }),
    };
  }
  return {
    ok: true,
    status: 200,
    json: async () => laidOut([scenario.meta.lat, scenario.meta.lng] as [number, number]),
  };
};

function stubFetches(answer: GeometryAnswer | "throw") {
  const detect: RoadDetectResponse = {
    scan_status: "ok",
    candidates: [ROAD],
    primary_index: 0,
    isUrban: true,
    placeName: "Denver",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/road-bearing")) {
        return { ok: true, status: 200, json: async () => detect };
      }
      if (String(url).includes("/api/render/corridor-geometry")) {
        if (answer === "throw") throw new TypeError("Failed to fetch");
        const scenario = JSON.parse(String(init?.body)).scenario as Scenario;
        return answer(scenario);
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
}

function mountModal(scenario: Scenario = GUESSED) {
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", scenario, kindConfirmed: true }}
      onCancel={() => {}}
      onSave={vi.fn()}
    />,
  );
}

function typeCoords([lat, lng]: [number, number]) {
  fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: String(lat) } });
  fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: String(lng) } });
}

const geometryBodies = () =>
  (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .filter((c) => String(c[0]).includes("/api/render/corridor-geometry"))
    .map((c) => JSON.parse(String((c[1] as RequestInit).body)).scenario as Scenario);

const lastBodyAt = ([lat, lng]: [number, number]) =>
  geometryBodies()
    .filter((s) => s.meta.lat === lat && s.meta.lng === lng)
    .at(-1);

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("#430: moving the pin while the jurisdiction is a guess", () => {
  it("the preview at the moved pin drops the old pin's guess, and the corridor lays out", async () => {
    stubFetches(backendPinCheck);
    mountModal();
    typeCoords(MOVED);
    expect(
      await screen.findByText(/OSM, full corridor/i, undefined, { timeout: 3000 }),
    ).toBeTruthy();
    const body = lastBodyAt(MOVED);
    expect(body).toBeDefined();
    // The shell's rule (guesses.ts reconcileJurisdiction): the guess goes
    // with the pin, field and record both.
    expect(body?.guesses?.jurisdiction_key).toBeUndefined();
    expect(body?.jurisdiction_key).toBeUndefined();
    expect(screen.queryByText(UNREACHABLE)).toBeNull();
    expect(screen.queryByTestId("picker-corridor-declined")).toBeNull();
  });

  it("an unmoved pin still sends the guess as it is (byte-identical payload)", async () => {
    stubFetches(backendPinCheck);
    mountModal();
    typeCoords(PIN);
    await screen.findByText(/OSM, full corridor/i, undefined, { timeout: 3000 });
    const body = lastBodyAt(PIN);
    expect(body?.jurisdiction_key).toBe("denver");
    expect(body?.guesses?.jurisdiction_key).toEqual({ lat: PIN[0], lng: PIN[1] });
  });

  it("an operator-set jurisdiction is kept at a moved pin", async () => {
    stubFetches(backendPinCheck);
    mountModal(OPERATOR_SET);
    typeCoords(MOVED);
    await screen.findByText(/OSM, full corridor/i, undefined, { timeout: 3000 });
    const body = lastBodyAt(MOVED);
    expect(body?.jurisdiction_key).toBe("denver");
    expect(body?.guesses).toBeUndefined();
  });
});

describe("#430: a refusal reads as a refusal, an outage as an outage", () => {
  it("a 400 shows the backend's message, not 'Couldn't reach the layout service'", async () => {
    stubFetches(() => ({
      ok: false,
      status: 400,
      json: async () => ({
        detail: { error: "guess_stale", message: GUESS_STALE_MESSAGE },
      }),
    }));
    mountModal();
    typeCoords(PIN);
    const line = await screen.findByTestId("picker-corridor-declined", undefined, {
      timeout: 3000,
    });
    expect(line.textContent?.replace(/\s+/g, " ").trim()).toBe(
      `Corridor preview declined: ${GUESS_STALE_MESSAGE} You can still save; the plan is validated when generated.`,
    );
    expect(screen.queryByText(UNREACHABLE)).toBeNull();
  });

  it("a 400 with a string detail shows that string", async () => {
    stubFetches(() => ({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Unknown jurisdiction key: 'nowhere'" }),
    }));
    mountModal();
    typeCoords(PIN);
    const line = await screen.findByTestId("picker-corridor-declined", undefined, {
      timeout: 3000,
    });
    // No closing punctuation in the backend's words: the line adds the
    // period, so "You can still save" starts its own sentence.
    expect(line.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Corridor preview declined: Unknown jurisdiction key: 'nowhere'. You can still save; the plan is validated when generated.",
    );
    expect(screen.queryByText(UNREACHABLE)).toBeNull();
  });

  it("a 400 with no readable message says the preview was declined, naming no answerer", async () => {
    stubFetches(() => ({
      ok: false,
      status: 400,
      json: async () => {
        throw new SyntaxError("Unexpected token I");
      },
    }));
    mountModal();
    typeCoords(PIN);
    const line = await screen.findByTestId("picker-corridor-declined", undefined, {
      timeout: 3000,
    });
    expect(line.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Corridor preview declined. You can still save; the plan is validated when generated.",
    );
  });

  it("a network failure still says 'Couldn't reach the layout service'", async () => {
    stubFetches("throw");
    mountModal();
    typeCoords(PIN);
    expect(await screen.findByText(UNREACHABLE, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByTestId("picker-corridor-declined")).toBeNull();
  });

  it("a 502 from the proxy still says 'Couldn't reach the layout service'", async () => {
    stubFetches(() => ({ ok: false, status: 502, json: async () => ({}) }));
    mountModal();
    typeCoords(PIN);
    await waitFor(() => expect(screen.queryByText(UNREACHABLE)).not.toBeNull(), {
      timeout: 3000,
    });
    expect(screen.queryByTestId("picker-corridor-declined")).toBeNull();
  });
});

describe("#430: asSentence", () => {
  it("adds a period to a message with no closing punctuation", () => {
    expect(asSentence("Unknown jurisdiction key: 'nowhere'")).toBe(
      "Unknown jurisdiction key: 'nowhere'.",
    );
    expect(asSentence("workLen: Input should be greater than 0  ")).toBe(
      "workLen: Input should be greater than 0.",
    );
  });

  it("leaves a message that already ends a sentence as it is", () => {
    expect(asSentence(GUESS_STALE_MESSAGE)).toBe(GUESS_STALE_MESSAGE);
    expect(asSentence("Stop!")).toBe("Stop!");
    expect(asSentence("Really?")).toBe("Really?");
  });
});
