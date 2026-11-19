// @vitest-environment happy-dom
//
// #537, Ryan's ruling of 2026-11-12, board Ideas2 option S2
// (docs/prompts/cc-prompt-ux-map-corner-coords.md, ruling 2;
// validation-artifacts/committed/missions/ux-map-corner-coords/issue-537/rulings.md):
// the pin's coordinates sit in a bar under the map that is always there.
// No pin: "No pin yet. Search, tap the map, or enter coordinates." and an
// "Enter coordinates" button.  A pin: "Pin at" and the coordinates as the
// button.  The button opens, in the same bar, Latitude and Longitude with
// real labels, "Go" and "Cancel"; Enter applies, Esc cancels; a pasted
// "lat, long" fills both; bad input shows a short error in the bar.
//
// Rule 11: the real modal is mounted and driven the way a person drives it
// (user-event keys, clicks and paste); the lookup POSTs are counted, since
// "applies" means the pin moved and the road lookup ran.  The bar's ruled
// path is the one with a map, so most of this file sets a token and stubs
// `mapbox-gl` with an object that accepts any call (as
// LocationPickerModal.side-sentence.test.tsx does); the last block runs
// without one.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #538: the camera, as the map reports it.  `flyTo` moves it; `getZoom`
// and `getBounds` read it (the bounds of the opening state view hold all
// of Colorado, so a Colorado pin is "on screen" there).
const camera = vi.hoisted(() => ({
  zoom: 6, // DEFAULT_ZOOM, the state view
  center: [-105.5, 39.0] as [number, number],
  flies: [] as { center: [number, number]; zoom: number }[],
  built: 0, // `new` calls; the map is the first, once mapbox-gl has loaded
}));

vi.mock("mapbox-gl", () => {
  // Every property is this same callable, constructible object; never a
  // thenable.  The camera calls (#538) answer from `camera` above.
  const camCalls: Record<string, unknown> = {
    getZoom: () => camera.zoom,
    getBounds: () => ({ contains: () => true }),
    flyTo: (o: { center: [number, number]; zoom: number }) => {
      camera.flies.push(o);
      camera.center = o.center;
      camera.zoom = o.zoom;
      return any;
    },
  };
  const any: object = new Proxy(function () {}, {
    get: (_t, prop) =>
      prop === "then" || typeof prop === "symbol"
        ? undefined
        : typeof prop === "string" && prop in camCalls
          ? camCalls[prop]
          : any,
    apply: () => any,
    construct: () => {
      camera.built += 1;
      return any;
    },
  });
  return { default: any };
});

import { LocationPickerModal } from "./LocationPickerModal";
import type { RoadCandidate, RoadDetectResponse } from "@/lib/road-detection/types";

let detects: { lat: number; lng: number }[] = [];
let onCancel = vi.fn();

beforeEach(() => {
  detects = [];
  onCancel = vi.fn();
  camera.zoom = 6;
  camera.center = [-105.5, 39.0];
  camera.flies = [];
  camera.built = 0;
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test";
  vi.stubGlobal(
    "fetch",
    vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes("/api/road-bearing")) {
        detects.push(JSON.parse(String(init?.body)) as { lat: number; lng: number });
        return new Promise(() => {}); // parked: the answer doesn't matter here
      }
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
});

function mount(initial: { lat?: number; lng?: number } = {}) {
  render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", ...initial }}
      onCancel={onCancel}
      onSave={vi.fn()}
    />,
  );
}

const bar = () => screen.getByTestId("coords-bar");
const inBar = () => within(bar());
const lat = () => inBar().getByLabelText("Latitude") as HTMLInputElement;
const lng = () => inBar().getByLabelText("Longitude") as HTMLInputElement;
// Lookups anywhere but the opening pin (the window runs its own lookup at
// the pin it opens on; only a move matters here).
const detectsAway = () => detects.filter((d) => d.lat !== 39.7401 || d.lng !== -104.9811);
const coordsButton = () => inBar().getByRole("button", { name: /Enter coordinates|^-?\d/ });

describe("#537 the bar, before and after a pin", () => {
  it("no pin: the ruled line and an Enter coordinates button; no boxes, no old link", () => {
    mount();
    expect(bar().textContent).toContain("No pin yet. Search, tap the map, or enter coordinates.");
    expect(inBar().getByRole("button", { name: "Enter coordinates" })).toBeTruthy();
    expect(inBar().queryByLabelText("Latitude")).toBeNull();
    expect(screen.queryByText("Or enter coordinates manually")).toBeNull();
    expect(screen.queryByText("Hide coordinate entry")).toBeNull();
  });

  it("a pin: Pin at, then the coordinates as the button at today's precision", () => {
    mount({ lat: 39.74012, lng: -104.98113 });
    expect(bar().textContent).toContain("Pin at");
    expect(inBar().getByRole("button", { name: "39.7401, -104.9811" })).toBeTruthy();
    expect(bar().textContent).not.toContain("No pin yet");
  });
});

describe("#537 editing in the bar", () => {
  it("the button opens two labelled boxes, Go and Cancel; Latitude has focus", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(coordsButton());
    expect(document.activeElement).toBe(lat());
    for (const box of [lat(), lng()]) {
      const label = box.labels?.[0];
      expect(label?.tagName).toBe("LABEL");
    }
    expect(lat().labels?.[0].textContent).toContain("Latitude");
    expect(lng().labels?.[0].textContent).toContain("Longitude");
    expect(inBar().getByRole("button", { name: "Go" })).toBeTruthy();
    expect(inBar().getByRole("button", { name: /^Cancel/ })).toBeTruthy();
  });

  it("Enter applies: one lookup at the typed pair, the bar then shows the pin", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(coordsButton());
    await user.type(lat(), "39.7401");
    await user.type(lng(), "-104.9811");
    expect(detects).toHaveLength(0); // typing alone moves nothing
    await user.keyboard("{Enter}");
    expect(detects).toEqual([{ lat: 39.7401, lng: -104.9811 }]);
    expect(inBar().queryByLabelText("Latitude")).toBeNull();
    expect(inBar().getByRole("button", { name: "39.7401, -104.9811" })).toBe(document.activeElement);
    expect(bar().textContent).toContain("Pin at");
  });

  it("Go applies the same way", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(coordsButton());
    await user.type(lat(), "39.7401");
    await user.type(lng(), "-104.9811");
    await user.click(inBar().getByRole("button", { name: "Go" }));
    expect(detects).toEqual([{ lat: 39.7401, lng: -104.9811 }]);
    expect(inBar().getByRole("button", { name: "39.7401, -104.9811" })).toBeTruthy();
  });

  it("Esc cancels: no lookup, the old pin stays, the window stays open", async () => {
    const user = userEvent.setup();
    mount({ lat: 39.7401, lng: -104.9811 });
    await user.click(coordsButton());
    await user.clear(lat());
    await user.type(lat(), "40.1");
    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
    expect(detectsAway()).toEqual([]);
    expect(inBar().queryByLabelText("Latitude")).toBeNull();
    expect(inBar().getByRole("button", { name: "39.7401, -104.9811" })).toBe(document.activeElement);
    // Reopening starts from the pin, not from the cancelled text.
    await user.click(coordsButton());
    expect(lat().value).toBe("39.7401");
  });

  it("Cancel does what Esc does", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(coordsButton());
    await user.type(lat(), "39.7401");
    await user.click(inBar().getByRole("button", { name: /^Cancel/ }));
    expect(detects).toHaveLength(0);
    expect(inBar().getByRole("button", { name: "Enter coordinates" })).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("a pasted 'lat, long' in the first box fills both; Enter then applies", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(coordsButton());
    await user.paste("39.7401, -104.9811");
    expect(lat().value).toBe("39.7401");
    expect(lng().value).toBe("-104.9811");
    expect(detects).toHaveLength(0);
    await user.keyboard("{Enter}");
    expect(detects).toEqual([{ lat: 39.7401, lng: -104.9811 }]);
  });
});

describe("#537 typed but not applied: Save waits (Rule 10)", () => {
  it("new numbers in the boxes hold Save and say so; Esc lets go", async () => {
    // The opening lookup fails, so Save is shut and its line shows (a
    // parked lookup shows the "Looking up" line instead).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );
    const user = userEvent.setup();
    mount({ lat: 39.7401, lng: -104.9811 });
    await user.click(coordsButton());
    expect(await screen.findByTestId("picker-save-blocked")).toBeTruthy();
    expect(screen.queryByText("Press Go to use the coordinates you typed.")).toBeNull();
    await user.clear(lat());
    await user.type(lat(), "39.75");
    expect(screen.getByTestId("picker-save-blocked").textContent).toBe(
      "Press Go to use the coordinates you typed.",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Press Go to use the coordinates you typed.")).toBeNull();
  });

  it("with a road picked and Save open, typed numbers alone shut Save; Esc opens it again", async () => {
    stubRoads();
    const user = userEvent.setup();
    mount({ lat: 39.7401, lng: -104.9811 });
    await pickFirstRoad(user);
    expect(save().disabled).toBe(false);
    expect(screen.queryByTestId("picker-save-blocked")).toBeNull();
    await user.click(coordsButton());
    expect(save().disabled).toBe(false); // the pin's own numbers hold nothing
    await user.clear(lat());
    await user.type(lat(), "39.75");
    expect(save().disabled).toBe(true);
    expect(screen.getByTestId("picker-save-blocked").textContent).toBe(
      "Press Go to use the coordinates you typed.",
    );
    await user.keyboard("{Escape}");
    expect(save().disabled).toBe(false);
    expect(screen.queryByTestId("picker-save-blocked")).toBeNull();
  });
});

// #538 fixtures: an opening lookup that answers with two roads, so a road
// can be picked and Save opens.
function road(way_id: string, bearing: number): RoadCandidate {
  return {
    way_id,
    highway_class: "primary",
    name: "Broadway",
    ref: null,
    bearing,
    snap_distance_m: 6,
    snapped_lat: 39.7401,
    snapped_lng: -104.9811,
    tags: {
      oneway: "no",
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
    travel: { travel: "both_ways", carriageway: "undivided" },
  };
}

function stubRoads() {
  const answer: RoadDetectResponse = {
    scan_status: "ok",
    candidates: [road("201", 0), road("202", 90)],
    primary_index: null,
    isUrban: true,
    placeName: "Denver",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes("/api/road-bearing")) {
        detects.push(JSON.parse(String(init?.body)) as { lat: number; lng: number });
        return { ok: true, status: 200, json: async () => answer };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
}

const save = () => screen.getByRole("button", { name: "Save and close" }) as HTMLButtonElement;
const rows = () => screen.getAllByRole("radio");

async function pickFirstRoad(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(rows()).toHaveLength(2));
  await user.click(rows()[0]);
  expect(rows()[0].getAttribute("aria-checked")).toBe("true");
}

// The map is built once mapbox-gl's dynamic import resolves.
const mapBuilt = () => waitFor(() => expect(camera.built).toBeGreaterThan(0));

describe("#538 applying coordinates centres the map on the pin at the search zoom", () => {
  it("from the state view, Enter flies to the typed pin at PIN_ZOOM (16)", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await user.click(coordsButton());
    await user.type(lat(), "39.7401");
    await user.type(lng(), "-104.9811");
    await user.keyboard("{Enter}");
    expect(camera.flies.at(-1)).toMatchObject({ center: [-104.9811, 39.7401], zoom: 16 });
    expect(camera.zoom).toBe(16);
  });

  it("a view already closer than 16 keeps its zoom (a search's rule)", async () => {
    const user = userEvent.setup();
    mount({ lat: 39.7401, lng: -104.9811 });
    await mapBuilt();
    camera.zoom = 18;
    await user.click(coordsButton());
    await user.clear(lat());
    await user.type(lat(), "39.7420");
    await user.keyboard("{Enter}");
    expect(camera.flies.at(-1)).toMatchObject({ center: [-104.9811, 39.742], zoom: 18 });
  });
});

describe("#538 fold-in (a): Go with the pin's own numbers keeps the road pick", () => {
  it("no new lookup, the pick and Save stay; the bar closes and the map centres on the pin", async () => {
    stubRoads();
    const user = userEvent.setup();
    mount({ lat: 39.7401, lng: -104.9811 });
    await mapBuilt();
    await pickFirstRoad(user);
    expect(detects).toHaveLength(1); // the opening lookup
    await user.click(coordsButton());
    await user.clear(lat());
    await user.type(lat(), "39.74010"); // the same latitude at the shown precision
    await user.keyboard("{Enter}");
    expect(detects).toHaveLength(1);
    expect(rows()[0].getAttribute("aria-checked")).toBe("true");
    expect(save().disabled).toBe(false);
    expect(inBar().queryByLabelText("Latitude")).toBeNull();
    expect(inBar().getByRole("button", { name: "39.7401, -104.9811" })).toBe(document.activeElement);
    expect(camera.flies.at(-1)).toMatchObject({ center: [-104.9811, 39.7401], zoom: 16 });
    // Reopening starts from the pin's text, not the typed "39.74010".
    await user.click(coordsButton());
    expect(lat().value).toBe("39.7401");
  });
});

describe("#537 bad input: a short error in the bar, the pin untouched", () => {
  it("not numbers", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(coordsButton());
    await user.type(lat(), "abc");
    await user.type(lng(), "-104.9811");
    await user.keyboard("{Enter}");
    expect(detects).toHaveLength(0);
    expect(bar().textContent).toContain("Use numbers in decimal degrees, like 39.7401");
    expect(bar().textContent).not.toContain("No pin yet");
    // The typed text is kept: the button reopens it.
    await user.click(coordsButton());
    expect(lat().value).toBe("abc");
    expect(bar().textContent).not.toContain("Use numbers");
  });

  it("latitude out of range", async () => {
    const user = userEvent.setup();
    mount({ lat: 39.7401, lng: -104.9811 });
    await user.click(coordsButton());
    await user.clear(lat());
    await user.type(lat(), "95");
    await user.keyboard("{Enter}");
    expect(detectsAway()).toEqual([]);
    expect(bar().textContent).toContain("Latitude must be between -90 and 90");
    expect(inBar().getByRole("button", { name: "39.7401, -104.9811" })).toBeTruthy();
  });

  it("longitude out of range", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(coordsButton());
    await user.type(lat(), "39.7401");
    await user.type(lng(), "200");
    await user.keyboard("{Enter}");
    expect(detects).toHaveLength(0);
    expect(bar().textContent).toContain("Longitude must be between -180 and 180");
  });
});

describe("#537 without a map (no Mapbox token)", () => {
  it("the bar opens on the boxes, and its no-pin line drops the map", async () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const user = userEvent.setup();
    mount();
    expect(lat()).toBeTruthy();
    expect(screen.getByText("Enter the coordinates below instead.")).toBeTruthy();
    await user.click(inBar().getByRole("button", { name: /^Cancel/ }));
    expect(bar().textContent).toContain("No pin yet. Search or enter coordinates.");
    expect(bar().textContent).not.toContain("tap the map");
  });
});
