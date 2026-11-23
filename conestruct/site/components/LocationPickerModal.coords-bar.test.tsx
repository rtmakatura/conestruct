// @vitest-environment happy-dom
//
// #541, Ryan's rulings of 2026-11-22 (docs/prompts/
// cc-prompt-ux-coords-in-search.md; validation-artifacts/committed/missions/
// ux-coords-in-search/issue-541/rulings.md).  They replace #537's bar:
//
//   1. Coordinates are typed in the address search box.  Search or Enter
//      places the pin there, flies as #538 does and runs the road lookup.
//      A string that reads as coordinates never goes to the geocoder.  Out
//      of range: one line in the search's floating list; a pair typed the
//      wrong way round is offered back as "Did you mean <lat>, <long>?".
//   2. The bar under the map only reads: "No pin yet", or "Pin at" and the
//      numbers.  No boxes, no Go, no Cancel, no button, no hint.
//
// Rule 11: the real modal is mounted and driven the way a person drives it
// (user-event keys and clicks).  Every request is recorded: "never goes to
// the geocoder" is asserted on the /api/geocode calls themselves, at both
// senders (the search form and the open-time lookup of a saved address),
// and "places the pin" on the road-lookup POST and the camera.  `mapbox-gl`
// is stubbed with an object that accepts any call (as
// LocationPickerModal.side-sentence.test.tsx does); one block runs without
// a token.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #538: the camera, as the map reports it.  `flyTo` moves it; `getZoom`
// reads it.
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

const PIN = { lat: 39.7401, lng: -104.9811 };

let detects: { lat: number; lng: number }[] = [];
let geocodes: { address: string }[] = [];
// What the geocoder answers, when it is asked.
let geocodeAnswer: { lat: number; lng: number; placeType: string } | null = null;
// null parks every road lookup (the answer doesn't matter); set, it answers.
let roadAnswer: RoadDetectResponse | null = null;

beforeEach(() => {
  detects = [];
  geocodes = [];
  geocodeAnswer = null;
  roadAnswer = null;
  camera.zoom = 6;
  camera.center = [-105.5, 39.0];
  camera.flies = [];
  camera.built = 0;
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test";
  vi.stubGlobal(
    "fetch",
    vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/road-bearing")) {
        detects.push(JSON.parse(String(init?.body)) as { lat: number; lng: number });
        if (roadAnswer === null) return new Promise(() => {});
        const answer = roadAnswer;
        return Promise.resolve({ ok: true, status: 200, json: async () => answer });
      }
      if (u.includes("/api/geocode")) {
        geocodes.push(JSON.parse(String(init?.body)) as { address: string });
        if (geocodeAnswer === null) {
          return Promise.resolve({ ok: false, status: 422, json: async () => ({}) });
        }
        const answer = geocodeAnswer;
        return Promise.resolve({ ok: true, status: 200, json: async () => answer });
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

function mount(initial: { lat?: number; lng?: number; address?: string } = {}) {
  render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", ...initial }}
      onCancel={vi.fn()}
      onSave={vi.fn()}
    />,
  );
}

const bar = () => screen.getByTestId("coords-bar");
const box = () =>
  screen.getByLabelText("Address, intersection or coordinates search") as HTMLInputElement;
const list = () => screen.getByTestId("search-list");
// The map is built once mapbox-gl's dynamic import resolves.
const mapBuilt = () => waitFor(() => expect(camera.built).toBeGreaterThan(0));

type User = ReturnType<typeof userEvent.setup>;
/** Replace the box's text and press Enter. */
async function searchFor(user: User, text: string) {
  await user.clear(box());
  await user.type(box(), text);
  await user.keyboard("{Enter}");
}

describe("#541 ruling 2: the bar only reads", () => {
  it("no pin: 'No pin yet' and nothing to press or type", () => {
    mount();
    expect(bar().textContent).toBe("No pin yet");
    expect(bar().querySelector("button, input, form, a, [role=button], [tabindex]")).toBeNull();
  });

  it("a pin: 'Pin at 39.7401, -104.9811' at the shown precision, still no control", () => {
    mount({ lat: 39.74012, lng: -104.98113 });
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(bar().querySelector("button, input, form, a, [role=button], [tabindex]")).toBeNull();
  });

  it("the numbers are their own element, so they select whole for copying", () => {
    mount(PIN);
    expect(bar().querySelector(".mw-cbar-coords")?.textContent).toBe("39.7401, -104.9811");
  });

  it("#537's controls and words are gone from the window", () => {
    mount(PIN);
    expect(screen.queryByLabelText("Latitude")).toBeNull();
    expect(screen.queryByLabelText("Longitude")).toBeNull();
    expect(screen.queryByRole("button", { name: "Go" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enter coordinates" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Cancel coordinate entry/ })).toBeNull();
    expect(screen.queryByText("Tap the numbers to change them")).toBeNull();
    cleanup();
    mount();
    expect(screen.queryByRole("button", { name: "Enter coordinates" })).toBeNull();
    expect(screen.queryByText(/enter coordinates\./)).toBeNull();
  });
});

describe("#541 ruling 1: the search box takes coordinates", () => {
  it("the placeholder is the ruled one", () => {
    mount();
    expect(box().placeholder).toBe("Address, intersection or coordinates");
  });

  // Each accepted format: the pin at 39.7401, -104.9811, #538's fly at the
  // search zoom, one road lookup there, and NO geocoder request.
  it.each([
    ["comma and space", "39.7401, -104.9811"],
    ["space alone", "39.7401 -104.9811"],
    ["comma alone", "39.7401,-104.9811"],
    ["degree sign and letters", "39.7401° N, 104.9811° W"],
    ["letters without the sign", "39.7401 N 104.9811 W"],
    ["letters in front", "N 39.7401, W 104.9811"],
    ["longitude first, named by its letter", "104.9811° W, 39.7401° N"],
    ["the Unicode minus", "39.7401, −104.9811"],
  ])("%s: Enter places the pin; nothing goes to /api/geocode", async (_name, text) => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, text);
    expect(geocodes).toEqual([]);
    expect(detects).toEqual([PIN]);
    expect(camera.flies).toEqual([expect.objectContaining({ center: [-104.9811, 39.7401], zoom: 16 })]);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(list().textContent).toBe("");
  });

  it("the Search button does what Enter does", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await user.type(box(), "39.7401, -104.9811");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(geocodes).toEqual([]);
    expect(detects).toEqual([PIN]);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
  });

  it("control: an address still goes to the geocoder, with the body it always had", async () => {
    geocodeAnswer = { lat: 39.74, lng: -104.966, placeType: "address" };
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "1600 E Colfax Ave, Denver");
    await waitFor(() => expect(detects).toEqual([{ lat: 39.74, lng: -104.966 }]));
    expect(geocodes).toEqual([{ address: "1600 E Colfax Ave, Denver", jurisdiction_key: null }]);
    expect(bar().textContent).toBe("Pin at 39.7400, -104.9660");
  });

  it("control: two bare whole numbers are an address, not coordinates", async () => {
    const user = userEvent.setup();
    mount();
    await searchFor(user, "1600 80202");
    await waitFor(() => expect(geocodes).toHaveLength(1));
    expect(geocodes[0].address).toBe("1600 80202");
    expect(detects).toEqual([]);
  });

  it("a failed address search says so in the floating list, not in the page's flow", async () => {
    const user = userEvent.setup();
    mount();
    await searchFor(user, "nowhere at all");
    await waitFor(() => expect(list().textContent).not.toBe(""));
    expect(list().closest(".mw-search-box")).not.toBeNull();
    expect(bar().textContent).toBe("No pin yet");
  });
});

describe("#541 ruling 1: out of range or swapped", () => {
  it("out of range: one plain line in the list, no pin, no lookup, no geocoder", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "139.7401, -104.9811");
    expect(list().textContent).toBe("Latitude must be between -90 and 90");
    expect(within(list()).queryByRole("button")).toBeNull();
    expect(geocodes).toEqual([]);
    expect(detects).toEqual([]);
    expect(camera.flies).toEqual([]);
    expect(bar().textContent).toBe("No pin yet");
  });

  it("longitude out of range names the longitude; a pin already placed stays", async () => {
    const user = userEvent.setup();
    mount(PIN);
    await mapBuilt();
    await searchFor(user, "39.7401, -204.9811");
    expect(list().textContent).toBe("Longitude must be between -180 and 180");
    expect(geocodes).toEqual([]);
    expect(detects.filter((d) => d.lat !== PIN.lat || d.lng !== PIN.lng)).toEqual([]);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
  });

  it("swapped: the line is the choice 'Did you mean 39.7401, -104.9811?'; nothing moves until it is taken", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "-104.9811, 39.7401");
    const choice = within(list()).getByRole("button", { name: "Did you mean 39.7401, -104.9811?" });
    expect(list().textContent).toBe("Did you mean 39.7401, -104.9811?");
    expect(geocodes).toEqual([]);
    expect(detects).toEqual([]);
    expect(bar().textContent).toBe("No pin yet");

    await user.click(choice);
    expect(detects).toEqual([PIN]);
    expect(geocodes).toEqual([]);
    expect(camera.flies.at(-1)).toMatchObject({ center: [-104.9811, 39.7401], zoom: 16 });
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(box().value).toBe("39.7401, -104.9811");
    expect(list().textContent).toBe("");
  });

  it("degrees and minutes are refused with a line, not geocoded", async () => {
    const user = userEvent.setup();
    mount();
    await searchFor(user, "39°44'24\"N 104°59'W");
    expect(list().textContent).toBe("Use decimal degrees, like 39.7401, -104.9811");
    expect(geocodes).toEqual([]);
    expect(detects).toEqual([]);
  });

  it("editing the box withdraws the line", async () => {
    const user = userEvent.setup();
    mount();
    await searchFor(user, "139.7401, -104.9811");
    expect(list().textContent).not.toBe("");
    await user.type(box(), "{Backspace}");
    expect(list().textContent).toBe("");
  });
});

describe("#541 ruling 1: the open-time lookup of a saved address (the other geocode sender)", () => {
  it("a saved address that is coordinates places the pin and is not geocoded", async () => {
    mount({ address: "39.7401, -104.9811" });
    await waitFor(() => expect(detects).toEqual([PIN]));
    expect(geocodes).toEqual([]);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
  });

  it("a saved address that is out-of-range coordinates shows the line and is not geocoded", async () => {
    mount({ address: "139.7401, -104.9811" });
    await waitFor(() => expect(list().textContent).toBe("Latitude must be between -90 and 90"));
    expect(geocodes).toEqual([]);
    expect(detects).toEqual([]);
  });

  it("control: a saved address that is an address is geocoded on open, as before", async () => {
    geocodeAnswer = { lat: 39.74, lng: -104.966, placeType: "address" };
    mount({ address: "1600 E Colfax Ave, Denver" });
    await waitFor(() => expect(geocodes).toHaveLength(1));
    expect(geocodes[0].address).toBe("1600 E Colfax Ave, Denver");
  });
});

// #538 fixtures: a lookup that answers with two roads, so a road can be
// picked and Save opens.
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
const TWO_ROADS: RoadDetectResponse = {
  scan_status: "ok",
  candidates: [road("201", 0), road("202", 90)],
  primary_index: null,
  isUrban: true,
  placeName: "Denver",
};

const save = () => screen.getByRole("button", { name: "Save and close" }) as HTMLButtonElement;
const rows = () => screen.getAllByRole("radio");

describe("#541: coordinates in the search box load the road list", () => {
  it("the lookup's roads show as rows; picking one opens Save", async () => {
    roadAnswer = TWO_ROADS;
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "39.7401, -104.9811");
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(rows()[0]);
    expect(save().disabled).toBe(false);
    expect(geocodes).toEqual([]);
  });
});

describe("#538 kept: the search box's coordinates fly as typed coordinates did", () => {
  it("a view already closer than 16 keeps its zoom (a search's rule)", async () => {
    const user = userEvent.setup();
    mount(PIN);
    await mapBuilt();
    camera.zoom = 18;
    await searchFor(user, "39.7420, -104.9811");
    expect(camera.flies.at(-1)).toMatchObject({ center: [-104.9811, 39.742], zoom: 18 });
  });

  it("fold-in (a): the pin's own numbers keep the road pick: no new lookup, the map centres", async () => {
    roadAnswer = TWO_ROADS;
    const user = userEvent.setup();
    mount(PIN);
    await mapBuilt();
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(rows()[0]);
    expect(detects).toHaveLength(1); // the opening lookup
    await searchFor(user, "39.74010, -104.98110"); // the pin at the shown precision
    expect(detects).toHaveLength(1);
    expect(rows()[0].getAttribute("aria-checked")).toBe("true");
    expect(save().disabled).toBe(false);
    expect(camera.flies.at(-1)).toMatchObject({ center: [-104.9811, 39.7401], zoom: 16 });
  });

  it("text typed in the box and not searched holds nothing: Save follows the pin", async () => {
    roadAnswer = TWO_ROADS;
    const user = userEvent.setup();
    mount(PIN);
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(rows()[0]);
    expect(save().disabled).toBe(false);
    await user.type(box(), "39.75, -104.99");
    expect(save().disabled).toBe(false);
    expect(screen.queryByTestId("picker-save-blocked")).toBeNull();
  });
});

describe("#541 without a map (no Mapbox token)", () => {
  it("the map-off line points at the search box, and coordinates there place the pin", async () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const user = userEvent.setup();
    mount();
    expect(screen.getByText("Type the coordinates in the search box instead.")).toBeTruthy();
    expect(screen.queryByText("Enter the coordinates below instead.")).toBeNull();
    expect(bar().textContent).toBe("No pin yet");
    await searchFor(user, "39.7401, -104.9811");
    expect(detects).toEqual([PIN]);
    expect(geocodes).toEqual([]);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
  });
});

// #543 (mission ux-map-window-tidy, ruling 2): the coarse-match notice is a
// line in the search's floating list, not a paragraph in the map column's
// flow, so it can't resize the map or move the right panel.  (#547 deleted
// the bearing note, the ruling's other line: nothing had set it since
// #507.)  The sizes are measured in a browser (the walk in
// validation-artifacts/committed/missions/ux-map-window-tidy/issue-543/);
// here the mounted window is asked where the line is.
describe("#543: the notices float in the search's list", () => {
  const COARSE = "That search found a town or area. Tap the map on the road where the work starts.";
  const column = () => document.querySelector(".mw-map-col") as HTMLElement;
  /** Every element in the map column's flow: its own children. */
  const inFlow = () => Array.from(column().children).map((e) => e.className.split(" ")[0]);
  const FLOW = ["mw-search", "picker-map", "mw-cbar"];

  it("a search that finds a town: the notice is a line in the list, and the column's flow is unchanged", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    expect(inFlow()).toEqual(FLOW);
    geocodeAnswer = { lat: 39.9936, lng: -105.0897, placeType: "place" };
    await searchFor(user, "Lafayette, CO");
    const line = await screen.findByText(COARSE);
    expect(list().contains(line)).toBe(true);
    expect(line.className).toBe("mw-note mw-search-line");
    expect(list().textContent).toBe(COARSE);
    expect(inFlow()).toEqual(FLOW);
    // What the notice goes with is as before: no pin, no road lookup.
    expect(bar().textContent).toBe("No pin yet");
    expect(detects).toEqual([]);
  });

  it("the open-time lookup of a saved town (the other sender): the same line, the same flow", async () => {
    geocodeAnswer = { lat: 39.9936, lng: -105.0897, placeType: "place" };
    mount({ address: "Lafayette, CO" });
    const line = await screen.findByText(COARSE);
    expect(list().contains(line)).toBe(true);
    expect(inFlow()).toEqual(FLOW);
  });

  it("a pin placed after the notice takes the line away; the flow is still the same", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    geocodeAnswer = { lat: 39.9936, lng: -105.0897, placeType: "place" };
    await searchFor(user, "Lafayette, CO");
    await screen.findByText(COARSE);
    await searchFor(user, "39.7401, -104.9811");
    expect(screen.queryByText(COARSE)).toBeNull();
    expect(list().textContent).toBe("");
    expect(inFlow()).toEqual(FLOW);
  });

  it("no token: the notice floats the same way over the map-off panel", async () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const user = userEvent.setup();
    mount();
    geocodeAnswer = { lat: 39.9936, lng: -105.0897, placeType: "place" };
    await searchFor(user, "Lafayette, CO");
    const line = await screen.findByText(COARSE);
    expect(list().contains(line)).toBe(true);
    expect(inFlow()).toEqual(["mw-search", "mw-map-off", "mw-cbar"]);
  });
});

// #544 (mission ux-map-window-tidy, ruling 3): "Coordinates in brackets,
// e.g. "(39.7401, -104.9811)" or "[39.7401, -104.9811]", parse as
// coordinates and never reach the geocoder."  And: "At 390, "Did you mean
// 39.7401, -104.9811?" keeps the numbers together on one line."
describe("#544: bracketed coordinates, and the choice's numbers", () => {
  it.each([
    ["round brackets", "(39.7401, -104.9811)"],
    ["square brackets", "[39.7401, -104.9811]"],
  ])("%s in the search box: Enter places the pin; nothing goes to /api/geocode", async (_name, text) => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await user.clear(box());
    // user-event reads "[" as the start of a key name; "[[" types one "[".
    await user.type(box(), text.replace("[", "[["));
    expect(box().value).toBe(text);
    await user.keyboard("{Enter}");
    expect(geocodes).toEqual([]);
    expect(detects).toEqual([PIN]);
    expect(camera.flies).toEqual([expect.objectContaining({ center: [-104.9811, 39.7401], zoom: 16 })]);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(list().textContent).toBe("");
  });

  it.each([
    ["round brackets", "(39.7401, -104.9811)"],
    ["square brackets", "[39.7401, -104.9811]"],
  ])("%s in a saved address (the open-time sender): the pin is placed and nothing is geocoded", async (_name, address) => {
    mount({ address });
    await waitFor(() => expect(detects).toEqual([PIN]));
    expect(geocodes).toEqual([]);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
  });

  it("a bracketed pair typed the wrong way round gets the choice, and is not geocoded", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "(-104.9811, 39.7401)");
    expect(within(list()).getByRole("button", { name: "Did you mean 39.7401, -104.9811?" })).toBeTruthy();
    expect(geocodes).toEqual([]);
    expect(detects).toEqual([]);
  });

  // happy-dom lays nothing out, so this can't measure a line.  It checks
  // the two things the one line rests on; the line itself is measured in a
  // browser (the walk in validation-artifacts/committed/missions/
  // ux-map-window-tidy/issue-544/).
  it("the choice's two numbers and its question mark are one .mw-search-pair element, and globals.css gives .mw-search-pair white-space: nowrap", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "-104.9811, 39.7401");
    const choice = within(list()).getByRole("button", { name: "Did you mean 39.7401, -104.9811?" });
    expect(choice.textContent).toBe("Did you mean 39.7401, -104.9811?");
    const pairs = choice.querySelectorAll(".mw-search-pair");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].textContent).toBe("39.7401, -104.9811?");

    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    expect(css).toContain("\n.map-window .mw-search-pair {\n  white-space: nowrap;\n}\n");
  });
});

// #545, Ryan's ruling 1 of 2026-11-22 (docs/prompts/
// cc-prompt-ux-map-window-tidy.md has the exact text; its three bullets,
// reworded here): with no pin the mark beside "No pin yet" is a hollow
// ring, an --ink-faint outline with no fill; it turns into today's orange
// (--dim) dot only once a pin exists; the bar keeps its height and
// position.  The mounted modal says which state the mark is in
// (data-pin); globals.css draws the two states.  happy-dom doesn't load
// globals.css, so the rules are read as text here and the drawn mark is
// measured in a browser (the walk in validation-artifacts/committed/
// missions/ux-map-window-tidy/issue-545/).
describe("#545 ruling 1: the bar's mark is a ring until a pin exists", () => {
  const marks = () => bar().querySelectorAll(".mw-cbar-dot");

  it('no pin: the bar has one mark, aria-hidden, with data-pin="false"', () => {
    mount();
    expect(bar().textContent).toBe("No pin yet");
    expect(marks()).toHaveLength(1);
    expect(marks()[0].getAttribute("data-pin")).toBe("false");
    expect(marks()[0].getAttribute("aria-hidden")).toBe("true");
  });

  it('a saved pin: the one mark has data-pin="true"', () => {
    mount(PIN);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(marks()).toHaveLength(1);
    expect(marks()[0].getAttribute("data-pin")).toBe("true");
    expect(marks()[0].getAttribute("aria-hidden")).toBe("true");
  });

  it('coordinates searched in the box turn the mark from data-pin="false" to "true"', async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    expect(marks()[0].getAttribute("data-pin")).toBe("false");
    await searchFor(user, "39.7401, -104.9811");
    await waitFor(() => expect(bar().textContent).toBe("Pin at 39.7401, -104.9811"));
    expect(marks()).toHaveLength(1);
    expect(marks()[0].getAttribute("data-pin")).toBe("true");
  });

  it('out-of-range coordinates place no pin, and the mark keeps data-pin="false"', async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "139.7401, -104.9811");
    await waitFor(() => expect(list().textContent).not.toBe(""));
    expect(bar().textContent).toBe("No pin yet");
    expect(marks()[0].getAttribute("data-pin")).toBe("false");
  });

  it('globals.css: the mark\'s own rule is a 10 x 10 box with a 2px --ink-faint border and no background, and the data-pin="true" rule swaps the border for a --dim background', async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    expect(css).toContain(
      "\n.map-window .mw-cbar-dot {\n  flex: none;\n  box-sizing: border-box;\n  width: 10px;\n  height: 10px;\n  border: 2px solid var(--ink-faint);\n  border-radius: 50%;\n}\n",
    );
    expect(css).toContain(
      '\n.map-window .mw-cbar-dot[data-pin="true"] {\n  border: 0;\n  background: var(--dim);\n}\n',
    );
    // No other rule styles the mark.
    expect(css.match(/\.mw-cbar-dot[^{]*\{/g)).toHaveLength(2);
  });
});
