// @vitest-environment happy-dom
//
// #565, Ryan's rulings of 2026-11-24 (docs/prompts/
// cc-prompt-ux-search-feedback-panel.md; validation-artifacts/committed/
// missions/ux-search-feedback-panel/issue-565/rulings.md):
//
//   1. Nothing floats over the map.  Every message of the search's floating
//      list moves to the top of the right panel, under "Which road is the
//      work on?".
//   2. T1: a box, one line saying what happened, then one saying what to do
//      next.  "Did you mean ..." stays a real button inside the box.  The
//      road list follows below it (#567: "Tap the map to find the roads."
//      is gone; the box's own line is the only instruction).
//      The box goes away when a pin is placed or a new search starts.
//   3. Nothing moves; a live region stays.
//   4. The wording of each message is kept unless it's jargon.
//
// Rule 11: the real modal is mounted and driven as a person drives it.  The
// sizes (0 px moved, 44 px) are measured in a browser (the walk beside the
// rulings); here the mounted window is asked where each message is.
// `mapbox-gl` is stubbed as LocationPickerModal.coords-bar.test.tsx stubs
// it, and this stub also keeps the map's click handler, so a tap on the map
// can be made.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mapStub = vi.hoisted(() => ({
  built: 0,
  click: null as null | ((e: { lngLat: { lat: number; lng: number } }) => void),
}));

vi.mock("mapbox-gl", () => {
  const calls: Record<string, unknown> = {
    getZoom: () => 6,
    getBounds: () => ({ contains: () => true }),
    on: (name: string, fn: (e: { lngLat: { lat: number; lng: number } }) => void) => {
      if (name === "click") mapStub.click = fn;
      return any;
    },
  };
  const any: object = new Proxy(function () {}, {
    get: (_t, prop) =>
      prop === "then" || typeof prop === "symbol"
        ? undefined
        : typeof prop === "string" && prop in calls
          ? calls[prop]
          : any,
    apply: () => any,
    construct: () => {
      mapStub.built += 1;
      return any;
    },
  });
  return { default: any };
});

import { LocationPickerModal } from "./LocationPickerModal";
import type { RoadCandidate, RoadDetectResponse } from "@/lib/road-detection/types";

const PIN = { lat: 39.7401, lng: -104.9811 };
const QUESTION = "Which road is the work on?";
const TAP_LINE = "Tap the map to find the roads.";
const TOWN = "That search found a town or area, not a street.";
const TOWN_NEXT = "Tap the map on the road where the work starts. The roads near your tap show up here.";

type Geo =
  | { ok: { lat: number; lng: number; placeType: string; weak?: true; placeName?: string } }
  | { fail: [status: number, reason: string] }
  | { parked: true }
  | { down: true };

let geo: Geo = { fail: [404, ""] };
let geocodes = 0;
let detects: { lat: number; lng: number }[] = [];
let roadAnswer: RoadDetectResponse | null = null;

beforeEach(() => {
  geo = { fail: [404, ""] };
  geocodes = 0;
  detects = [];
  roadAnswer = null;
  mapStub.built = 0;
  mapStub.click = null;
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
        geocodes += 1;
        const g = geo;
        if ("parked" in g) return new Promise(() => {});
        if ("down" in g) return Promise.reject(new TypeError("Failed to fetch"));
        if ("fail" in g) {
          return Promise.resolve({ ok: false, status: g.fail[0], text: async () => g.fail[1] });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => g.ok });
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

const input = () =>
  screen.getByLabelText("Address, intersection or coordinates search") as HTMLInputElement;
const feedback = () => screen.getByTestId("search-feedback");
const section = () => screen.getByTestId("road-section");
const bar = () => screen.getByTestId("coords-bar");
const column = () => document.querySelector(".mw-map-col") as HTMLElement;
const rail = () => document.querySelector(".mw-rail") as HTMLElement;
/** The box's lines, as [class, text]. */
const lines = () => Array.from(feedback().children).map((e) => [e.className, e.textContent]);
/** The road section's own children, each named by its tag and first class. */
const order = () =>
  Array.from(section().children).map((e) => `${e.tagName.toLowerCase()}.${e.className.split(" ")[0]}`);
/** The rail's lines that tell the operator to tap the map, outside the box. */
const tapLines = () =>
  Array.from(rail().querySelectorAll("p"))
    .filter((p) => !feedback().contains(p) && /tap the map/i.test(p.textContent ?? ""))
    .map((p) => p.textContent);
const mapBuilt = () => waitFor(() => expect(mapStub.built).toBeGreaterThan(0));
const mapReady = () => waitFor(() => expect(mapStub.click).not.toBeNull());

type User = ReturnType<typeof userEvent.setup>;
async function searchFor(user: User, text: string) {
  await user.clear(input());
  await user.type(input(), text);
  await user.keyboard("{Enter}");
}

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

describe("#565 ruling 1: nothing of the search is in the map column", () => {
  it("before any search: the search box holds its input only, and the column has no live region", async () => {
    mount();
    await mapBuilt();
    const box = document.querySelector(".mw-search-box") as HTMLElement;
    expect(Array.from(box.children).map((e) => e.tagName)).toEqual(["INPUT"]);
    expect(screen.queryByTestId("search-list")).toBeNull();
    expect(column().querySelector('[role="status"]')).toBeNull();
  });

  it.each<[string, Geo, string]>([
    ["a town", { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } }, "Lafayette, CO"],
    [
      "a weak match",
      { ok: { lat: 38.05, lng: -102.12, placeType: "address", weak: true, placeName: "39 North Main Street, Holly, Colorado 81047" } },
      "39 N, 44.4",
    ],
    ["no match", { fail: [404, "check spelling"] }, "Lafayete"],
    ["outside Colorado", { fail: [422, "outside colorado"] }, "Cheyenne, WY"],
    ["out of range", { parked: true }, "139.7401, -104.9811"],
    ["did you mean", { parked: true }, "-104.9811, 39.7401"],
  ])("%s: the message is in the right panel's box, and the map column holds none of it", async (_name, answer, text) => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    const flow = Array.from(column().children).map((e) => e.className);
    const columnText = column().textContent;
    geo = answer;
    await searchFor(user, text);
    await waitFor(() => expect(feedback().textContent).not.toBe(""));
    expect(rail().contains(feedback())).toBe(true);
    expect(column().contains(feedback())).toBe(false);
    // The map column: the same children, and no word of the message.
    expect(Array.from(column().children).map((e) => e.className)).toEqual(flow);
    expect(column().textContent).toBe(columnText);
    expect(column().querySelector('[role="status"]')).toBeNull();
    expect(bar().textContent).toBe("No pin yet");
  });
});

describe("#565 ruling 2: the box, under the question and over the road list", () => {
  it("a town: the question and the box's two lines, and no other 'tap the map' line (#567)", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    geo = { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } };
    await searchFor(user, "Lafayette, CO");
    await screen.findByText(TOWN);
    expect(lines()).toEqual([
      ["mw-line mw-feedback-what", TOWN],
      ["mw-line", TOWN_NEXT],
    ]);
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback"]);
    expect(section().children[0].textContent).toBe(QUESTION);
    expect(tapLines()).toEqual([]);
    // It is the right panel's first section.
    expect(document.querySelector(".mw-rail-body")!.children[0]).toBe(section());
    expect(detects).toEqual([]);
  });

  it("the open-time lookup of a saved town (the other sender) fills the same box", async () => {
    geo = { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } };
    mount({ address: "Lafayette, CO" });
    await screen.findByText(TOWN);
    expect(feedback().textContent).toBe(TOWN + TOWN_NEXT);
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback"]);
  });

  it("a weak match: the place on the first line, the next step on the second; a full stop in the name doesn't split it", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    geo = { ok: { lat: 40.16, lng: -105.1, placeType: "address", weak: true, placeName: "St. Vrain Rd, Longmont, Colorado 80503" } };
    await searchFor(user, "st vrain");
    await waitFor(() => expect(feedback().textContent).not.toBe(""));
    expect(lines()).toEqual([
      ["mw-line mw-feedback-what", "Closest match: St. Vrain Rd, Longmont, Colorado 80503."],
      ["mw-line", "Check the pin before you go on."],
    ]);
  });

  it.each<[string, Geo, [string, string | null]]>([
    ["no match for the city", { fail: [404, "check spelling"] }, ["No match in Colorado for that city.", "Check the spelling."]],
    ["no match for the address", { fail: [404, "check address"] }, ["No match in Colorado for that address.", "Check the spelling."]],
    ["outside Colorado", { fail: [422, "outside colorado"] }, ["Plans cover Colorado roads only.", null]],
    ["no match, no reason", { fail: [404, ""] }, ["No match for that address", null]],
    ["cross streets with no city", { fail: [422, ""] }, ["Add a city to search cross streets.", null]],
    ["the search isn't set up", { fail: [503, ""] }, ["Address search isn't set up here.", null]],
    ["the search failed", { fail: [502, ""] }, ["Address search failed (502).", "Try again."]],
    ["no answer at all", { down: true }, ["The address search didn't answer.", "Try again."]],
  ])("a failed search, %s: the box's lines", async (_name, answer, [happened, next]) => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    geo = answer;
    await searchFor(user, "somewhere");
    await waitFor(() => expect(feedback().textContent).not.toBe(""));
    expect(lines()).toEqual(
      next === null
        ? [["mw-line mw-feedback-what", happened]]
        : [
            ["mw-line mw-feedback-what", happened],
            ["mw-line", next],
          ],
    );
    expect(feedback().textContent).not.toMatch(/Geocod|Failed to fetch/);
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback"]);
  });

  it("out of range: the one line, no button, no request", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "139.7401, -104.9811");
    expect(lines()).toEqual([["mw-line mw-feedback-what", "Latitude must be between -90 and 90"]]);
    expect(within(feedback()).queryByRole("button")).toBeNull();
    expect(geocodes).toBe(0);
    expect(detects).toEqual([]);
  });

  it("'Did you mean' is a real button inside the box; taking it places the pin and the box goes", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "-104.9811, 39.7401");
    const choice = within(feedback()).getByRole("button", { name: "Did you mean 39.7401, -104.9811?" });
    expect(choice.tagName).toBe("BUTTON");
    expect(choice.className).toBe("mw-link mw-search-pick");
    expect(feedback().textContent).toBe("Did you mean 39.7401, -104.9811?");
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback"]);
    expect(bar().textContent).toBe("No pin yet");

    await user.click(choice);
    expect(detects).toEqual([PIN]);
    expect(geocodes).toBe(0);
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(feedback().textContent).toBe("");
    // #567 item 3: the pressed button is gone with its box; focus is in
    // the search box, which holds the pair.
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("39.7401, -104.9811");
  });

  // #570 (Ryan, 2026-11-25, amending #569): a search that finds nothing
  // leaves the pin and its roads, so its box sits over the list again.
  it("with a pin and its roads: the box of a search that found nothing sits between the question and the road list (#570)", async () => {
    const user = userEvent.setup();
    roadAnswer = TWO_ROADS;
    mount();
    await mapBuilt();
    await searchFor(user, "39.7401, -104.9811");
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(2));
    // No message: the question, the (empty) box, the list.
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback", "div.road-pick-panel"]);
    expect(feedback().textContent).toBe("");
    expect(screen.queryByText(TAP_LINE)).toBeNull();

    geo = { ok: { lat: 38.05, lng: -102.12, placeType: "address", weak: true, placeName: "39 North Main Street, Holly, Colorado 81047" } };
    await searchFor(user, "39 N, 44.4");
    await screen.findByText("Closest match: 39 North Main Street, Holly, Colorado 81047.");
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback", "div.road-pick-panel"]);
    expect(screen.getAllByText(QUESTION)).toHaveLength(1);
    expect(screen.getByRole("radiogroup", { name: QUESTION }).querySelectorAll('[role="radio"]')).toHaveLength(2);
    expect(screen.queryByText(TAP_LINE)).toBeNull();
    // The pin and its roads are as they were; no second lookup ran.
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(detects).toEqual([PIN]);
  });
});

describe("#565 ruling 2: the box goes away when a pin is placed or a new search starts", () => {
  it.each<[string, Geo, string]>([
    ["a town", { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } }, "Lafayette, CO"],
    ["a failed search", { fail: [404, "check spelling"] }, "Lafayete"],
    ["out of range", { parked: true }, "139.7401, -104.9811"],
    ["did you mean", { parked: true }, "-104.9811, 39.7401"],
  ])("%s, then a tap on the map: the pin is placed and the box is gone", async (_name, answer, text) => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    geo = answer;
    await searchFor(user, text);
    await waitFor(() => expect(feedback().textContent).not.toBe(""));
    act(() => mapStub.click!({ lngLat: PIN }));
    expect(feedback().textContent).toBe("");
    expect(screen.queryByText(TAP_LINE)).toBeNull();
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(detects).toEqual([PIN]);
  });

  it.each<[string, Geo, string]>([
    ["a town", { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } }, "Lafayette, CO"],
    ["a failed search", { fail: [404, "check spelling"] }, "Lafayete"],
    ["out of range", { parked: true }, "139.7401, -104.9811"],
  ])("%s, then a new search: the box is gone while it runs", async (_name, answer, text) => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    geo = answer;
    await searchFor(user, text);
    await waitFor(() => expect(feedback().textContent).not.toBe(""));
    geo = { parked: true };
    await searchFor(user, "1600 E Colfax Ave, Denver");
    await screen.findByRole("button", { name: "Searching…" });
    expect(feedback().textContent).toBe("");
    expect(section().getAttribute("data-empty")).toBe("true");
    expect(bar().textContent).toBe("No pin yet");
  });
});

describe("#565 ruling 3: a live region stays, and the panel with no message is as it was", () => {
  it("the box is one role=status element, mounted before any message and the same element after", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    const region = feedback();
    expect(region.getAttribute("role")).toBe("status");
    expect(region.textContent).toBe("");
    expect(region.children).toHaveLength(0);
    geo = { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } };
    await searchFor(user, "Lafayette, CO");
    await screen.findByText(TOWN);
    expect(feedback()).toBe(region);
    expect(region.textContent).toBe(TOWN + TOWN_NEXT);
  });

  it("no pin, no message: the road section is marked empty and shows no question and no tap line", async () => {
    mount();
    await mapBuilt();
    expect(section().getAttribute("data-empty")).toBe("true");
    expect(order()).toEqual(["div.mw-feedback"]);
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(screen.queryByText(TAP_LINE)).toBeNull();
  });

  it("a message marks the section not empty", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "139.7401, -104.9811");
    expect(section().getAttribute("data-empty")).toBe("false");
  });

  it("the lookup running: the question once, then the running line", async () => {
    mount(PIN);
    await screen.findByText("Looking up the roads at your pin…");
    expect(section().getAttribute("data-empty")).toBe("false");
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback", "div.mw-section"]);
    expect(screen.getAllByText(QUESTION)).toHaveLength(1);
  });
});

describe("#565: globals.css draws the box from existing tokens and nothing floats", () => {
  const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
  const rule = (selector: string) => {
    const at = css.indexOf(`\n${selector} {\n`);
    expect(at, selector).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("\n}\n", at));
  };

  it("the box is on --pri-off, in the flow, and not displayed while empty", () => {
    const box = rule(".map-window .mw-feedback");
    expect(box).toContain("background: var(--pri-off);");
    expect(box).not.toMatch(/position:|z-index:|font-size:|#[0-9a-fA-F]{3,8}\b/);
    expect(rule(".map-window .mw-feedback:empty")).toContain("display: none;");
    expect(rule('.map-window .mw-section[data-empty="true"]')).toContain("display: none;");
  });

  it("the first line is 600 --ink and sets no size of its own (it is a .mw-line, 13.5)", () => {
    const what = rule(".map-window .mw-feedback-what");
    expect(what).toContain("font-weight: 600;");
    expect(what).toContain("color: var(--ink);");
    expect(what).not.toContain("font-size");
    const line = rule(".map-window .mw-line");
    expect(line).toContain("font-size: var(--fs-body-value);");
    expect(line).toContain("color: var(--ink-on-dark);");
    // Later in the sheet than .mw-line, so its weight and colour win.
    expect(css.indexOf("\n.map-window .mw-feedback-what {")).toBeGreaterThan(css.indexOf("\n.map-window .mw-line {"));
  });

  it("the floating list's rules are gone, and the search box is not a positioning parent", () => {
    expect(css).not.toContain(".mw-search-list");
    expect(css).not.toContain(".mw-search-line");
    expect(rule(".map-window .mw-search-box")).not.toContain("position");
  });

  it("the 'Did you mean' button keeps its 44 px", () => {
    expect(rule(".map-window .mw-search-pick")).toContain("min-height: 44px;");
  });
});

describe("#567: while the box shows, its line is the only 'tap the map' instruction", () => {
  const MOVE = "Tap the map to move it.";
  const HEADING = "Where the work starts";

  // #570 (Ryan, 2026-11-25): "Hide the whole 'Where the work starts'
  // section, heading included, until a pin exists, so no empty heading
  // shows (e.g. after a town search)."  Before, the heading always showed,
  // with two lines under it in a fresh window and none after a town search.
  it("no message, no pin: the work-start section is not in the window, heading included (#570)", async () => {
    mount();
    await mapBuilt();
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(document.getElementById("mw-start-h")).toBeNull();
    expect(tapLines()).toEqual([]);
  });

  it("a town, no pin: no work-start heading under the notice, nor when a new search starts (#570)", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    geo = { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } };
    await searchFor(user, "Lafayette, CO");
    await screen.findByText(TOWN);
    expect(tapLines()).toEqual([]);
    expect(screen.queryByText(HEADING)).toBeNull();

    geo = { parked: true };
    await searchFor(user, "1600 E Colfax Ave, Denver");
    await screen.findByRole("button", { name: "Searching…" });
    expect(tapLines()).toEqual([]);
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it("a pin: the section shows, its heading over 'At your pin.'; a town search after it takes the section away (#570)", async () => {
    const user = userEvent.setup();
    roadAnswer = TWO_ROADS;
    mount();
    await mapReady();
    act(() => mapStub.click!({ lngLat: PIN }));
    await screen.findByTestId("road-pick-panel");
    const heading = screen.getByText(HEADING);
    expect(heading.id).toBe("mw-start-h");
    expect(Array.from(heading.parentElement!.children).slice(0, 3).map((e) => e.textContent)).toEqual([
      HEADING,
      "At your pin.",
      MOVE,
    ]);

    geo = { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } };
    await searchFor(user, "Lafayette, CO");
    await screen.findByText(TOWN);
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it("the 'Did you mean' button and a refused pair hide them too", async () => {
    const user = userEvent.setup();
    mount();
    await mapBuilt();
    await searchFor(user, "-104.9811, 39.7401");
    within(feedback()).getByRole("button");
    expect(tapLines()).toEqual([]);
    await searchFor(user, "139.7401, -104.9811");
    expect(feedback().textContent).not.toBe("");
    expect(tapLines()).toEqual([]);
  });

  // #570: a search that found nothing leaves the pin, so "At your pin."
  // stays under its message (#567) and only the move line goes.
  it("a failed search's message over a pin: 'At your pin.' stays and 'Tap the map to move it.' goes (#570)", async () => {
    const user = userEvent.setup();
    roadAnswer = TWO_ROADS;
    mount(PIN);
    await screen.findByTestId("road-pick-panel");
    expect(tapLines()).toEqual([MOVE]);
    geo = { fail: [404, "check spelling"] };
    await searchFor(user, "Lafayete");
    await waitFor(() => expect(feedback().textContent).not.toBe(""));
    expect(tapLines()).toEqual([]);
    expect(screen.getByText("At your pin.")).toBeTruthy();
    expect(screen.getByText(HEADING)).toBeTruthy();
  });

  // #569 (Ryan, 2026-11-25): a town is a new place, so the search clears
  // the pin and "At your pin." goes with it.
  it("a town's message after a pin: the pin is cleared, so 'At your pin.' and 'Tap the map to move it.' both go (#569)", async () => {
    const user = userEvent.setup();
    roadAnswer = TWO_ROADS;
    mount(PIN);
    await screen.findByTestId("road-pick-panel");
    expect(tapLines()).toEqual([MOVE]);
    geo = { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } };
    await searchFor(user, "Lafayette, CO");
    await screen.findByText(TOWN);
    expect(tapLines()).toEqual([]);
    expect(screen.queryByText("At your pin.")).toBeNull();
  });
});

describe("#568: an address search's pin says so to the road lookup", () => {
  const ADDRESS = { lat: 39.739247, lng: -104.99097 };
  const far = (way_id: string, name: string, m: number): RoadCandidate => ({
    ...road(way_id, 0),
    name,
    snap_distance_m: m,
  });
  const NEAREST_TITLE = "No mapped road runs within 30 m of this address.";
  const NEAREST_LINE =
    "These are the nearest. Pick one, or tap the map on the road where the work starts.";

  it("the search sends reach: address; a tap after it does not", async () => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    geo = { ok: { ...ADDRESS, placeType: "address" } };
    await searchFor(user, "1437 Bannock St, Denver");
    await waitFor(() => expect(detects).toHaveLength(1));
    expect(detects[0]).toEqual({ ...ADDRESS, reach: "address" });

    mapStub.click!({ lngLat: { lat: PIN.lat, lng: PIN.lng } });
    await waitFor(() => expect(detects).toHaveLength(2));
    expect(detects[1]).toEqual(PIN);
  });

  it("the open-time lookup of a saved address (the other sender) sends it too", async () => {
    geo = { ok: { ...ADDRESS, placeType: "address" } };
    mount({ address: "1437 Bannock St, Denver" });
    await waitFor(() => expect(detects).toHaveLength(1));
    expect(detects[0]).toEqual({ ...ADDRESS, reach: "address" });
  });

  it("typed coordinates and a saved pin send no reach", async () => {
    const user = userEvent.setup();
    mount(PIN);
    await waitFor(() => expect(detects).toHaveLength(1));
    expect(detects[0]).toEqual(PIN);
    await searchFor(user, "39.7392, -104.9910");
    await waitFor(() => expect(detects).toHaveLength(2));
    expect(detects[1]).toEqual({ lat: 39.7392, lng: -104.991 });
  });

  it("nearest-only roads: the two lines over the list, each row's distance, and nothing picked", async () => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    geo = { ok: { ...ADDRESS, placeType: "address" } };
    roadAnswer = {
      scan_status: "ok",
      candidates: [far("130911277", "Cherokee Street", 57.8)],
      primary_index: 0,
      isUrban: true,
      placeName: "Denver",
      nearest_only: true,
    };
    await searchFor(user, "1437 Bannock St, Denver");
    const panel = await screen.findByTestId("road-pick-panel");
    const note = within(panel).getByTestId("road-nearest-only");
    expect(Array.from(note.children).map((e) => e.textContent)).toEqual([NEAREST_TITLE, NEAREST_LINE]);
    // #569 (Ryan, 2026-11-25): the town notice's box, not the lookup-failed
    // one (--vd-flag-ground with a --warn border), and while it shows
    // "Tap the map to move it." is not rendered.
    expect(note.className).toBe("mw-feedback");
    expect(Array.from(note.children).map((e) => e.className)).toEqual(["mw-line mw-feedback-what", "mw-line"]);
    expect(screen.queryByText("Tap the map to move it.")).toBeNull();
    expect(panel.children[0]).toBe(note);
    const row = within(panel).getByRole("radio");
    expect(row.textContent).toContain("Cherokee Street");
    expect(row.textContent).toContain("58 m from your pin");
    // One road, but only the nearest: it is not picked for the operator.
    expect(row.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText("We didn't find a road at your pin.")).toBeNull();

    await user.click(row);
    expect(within(panel).getByRole("radio").getAttribute("aria-checked")).toBe("true");
  });

  it("one road at the pin (no flag) is still picked, with no nearest-only lines", async () => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    geo = { ok: { ...ADDRESS, placeType: "address" } };
    roadAnswer = { ...TWO_ROADS, candidates: [road("201", 0)] };
    await searchFor(user, "1600 Broadway, Denver");
    const panel = await screen.findByTestId("road-pick-panel");
    expect(within(panel).getByRole("radio").getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByTestId("road-nearest-only")).toBeNull();
  });

  it("a tap after a nearest-only answer clears the lines", async () => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    geo = { ok: { ...ADDRESS, placeType: "address" } };
    roadAnswer = {
      scan_status: "ok",
      candidates: [far("130911277", "Cherokee Street", 57.8), far("628677817", "West Colfax Avenue", 84.1)],
      primary_index: 0,
      isUrban: true,
      placeName: "Denver",
      nearest_only: true,
    };
    await searchFor(user, "1437 Bannock St, Denver");
    await screen.findByTestId("road-nearest-only");
    roadAnswer = TWO_ROADS;
    mapStub.click!({ lngLat: { lat: PIN.lat, lng: PIN.lng } });
    await waitFor(() => expect(detects).toHaveLength(2));
    await waitFor(() => expect(screen.queryByTestId("road-nearest-only")).toBeNull());
    await screen.findByTestId("road-pick-panel");
  });
});

// #569 (Ryan, 2026-11-25): "starting a new search clears the previous pin,
// road list, saved choice and every message before the new result shows,
// exactly like a fresh window".  Found in the browser: "1437 Bannock St,
// Denver" then "Lafayette, CO" left the 30 m notice, the three Denver roads
// and "Pin at 39.7392, -104.9910" under the town notice, and a pick would
// have saved the plan in Denver.
describe("#569: a new search starts from a window with no pin", () => {
  const ADDRESS = { lat: 39.739247, lng: -104.99097 };
  const near = (way_id: string, name: string, m: number): RoadCandidate => ({
    ...road(way_id, 0),
    name,
    snap_distance_m: m,
  });
  const BANNOCK: RoadDetectResponse = {
    scan_status: "ok",
    candidates: [
      near("130911277", "Cherokee Street", 57.8),
      near("628677817", "West Colfax Avenue", 84.1),
      near("6234567", "West 14th Avenue", 87.3),
    ],
    primary_index: 0,
    isUrban: true,
    placeName: "Denver",
    nearest_only: true,
  };
  const save = () => screen.getByRole("button", { name: "Save and close" }) as HTMLButtonElement;

  async function bannock(user: User) {
    geo = { ok: { ...ADDRESS, placeType: "address" } };
    roadAnswer = BANNOCK;
    await searchFor(user, "1437 Bannock St, Denver");
    await screen.findByTestId("road-nearest-only");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(bar().textContent).toBe("Pin at 39.7392, -104.9910");
  }
  /** The window as a fresh one shows it, under whatever the box says. */
  function expectNoPinLeft() {
    expect(bar().textContent).toBe("No pin yet");
    expect(screen.queryByTestId("road-nearest-only")).toBeNull();
    expect(screen.queryByTestId("road-pick-panel")).toBeNull();
    expect(screen.queryAllByRole("radio")).toEqual([]);
    expect(screen.queryByText("At your pin.")).toBeNull();
    expect(save().disabled).toBe(true);
  }

  it("Bannock, then Lafayette: the town notice is all that shows; no Denver pin, roads or 30 m notice", async () => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    await bannock(user);
    geo = { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } };
    await searchFor(user, "Lafayette, CO");
    await screen.findByText(TOWN);
    expectNoPinLeft();
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback"]);
    expect(lines()).toEqual([
      ["mw-line mw-feedback-what", TOWN],
      ["mw-line", TOWN_NEXT],
    ]);
    // One lookup, the Bannock pin's: nothing was looked up for the town.
    expect(detects).toHaveLength(1);
  });

  it("a road picked for the old pin is not kept: Save is shut after the next search", async () => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    await bannock(user);
    await user.click(screen.getAllByRole("radio")[0]);
    await waitFor(() => expect(save().disabled).toBe(false));
    geo = { ok: { lat: 39.9936, lng: -105.0897, placeType: "place" } };
    await searchFor(user, "Lafayette, CO");
    await screen.findByText(TOWN);
    expectNoPinLeft();
  });

  // #570 (Ryan, 2026-11-25, amending #569's ruling 1): "A search that finds
  // nothing or is refused (typo, out-of-range pair, outside Colorado, no
  // match) leaves the existing pin, road list and pick exactly as they
  // were; only a search that returns a new place clears them."
  /** The Bannock pin, its three roads, the pick and an open Save. */
  function expectBannockKept() {
    expect(bar().textContent).toBe("Pin at 39.7392, -104.9910");
    expect(screen.getByTestId("road-nearest-only")).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(screen.getAllByRole("radio")[0].textContent).toContain("Cherokee Street");
    expect(screen.getByText("At your pin.")).toBeTruthy();
    expect(save().disabled).toBe(false);
  }

  it("while the search is still out, the old pin, its roads and the pick stay; the town's answer clears them (#570)", async () => {
    const user = userEvent.setup();
    let answer: (r: unknown) => void = () => {};
    mount();
    await mapReady();
    await bannock(user);
    await user.click(screen.getAllByRole("radio")[0]);
    await waitFor(() => expect(save().disabled).toBe(false));
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((url, init) =>
      String(url).includes("/api/geocode")
        ? new Promise<Response>((resolve) => (answer = resolve as (r: unknown) => void))
        : base(url, init),
    );
    await searchFor(user, "Lafayette, CO");
    await screen.findByRole("button", { name: "Searching…" });
    expectBannockKept();
    expect(feedback().textContent).toBe("");

    await act(async () =>
      answer({ ok: true, status: 200, json: async () => ({ lat: 39.9936, lng: -105.0897, placeType: "place" }) }),
    );
    await screen.findByText(TOWN);
    expectNoPinLeft();
  });

  it.each<[string, Geo, string]>([
    [
      "a weak match",
      { ok: { lat: 38.05, lng: -102.12, placeType: "address", weak: true, placeName: "39 North Main Street, Holly, Colorado 81047" } },
      "39 N, 44.4",
    ],
    ["a typo (no match)", { fail: [404, "check spelling"] }, "Lafayete"],
    ["outside Colorado", { fail: [422, "outside colorado"] }, "Cheyenne, WY"],
    ["a failed search", { fail: [502, ""] }, "Lafayette, CO"],
    ["no answer", { down: true }, "Lafayette, CO"],
    ["an out-of-range pair", { parked: true }, "139.7401, -104.9811"],
    ["did you mean", { parked: true }, "-104.9811, 39.7401"],
  ])("%s after a pin leaves the pin, the road list and the pick as they were (#570)", async (_name, answer, text) => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    await bannock(user);
    await user.click(screen.getAllByRole("radio")[0]);
    await waitFor(() => expect(save().disabled).toBe(false));
    geo = answer;
    await searchFor(user, text);
    await waitFor(() => expect(feedback().textContent).not.toBe(""));
    expectBannockKept();
    // The message is the search's own box, over the list; no new lookup ran.
    expect(order()).toEqual(["h3.mw-sub", "div.mw-feedback", "div.road-pick-panel"]);
    expect(detects).toHaveLength(1);
  });

  it("the saved address stays the old pin's after a failed search (#570)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <LocationPickerModal open initial={{ scenarioKind: "shoulder" }} onCancel={vi.fn()} onSave={onSave} />,
    );
    await mapReady();
    await bannock(user);
    await user.click(screen.getAllByRole("radio")[0]);
    await waitFor(() => expect(save().disabled).toBe(false));
    geo = { fail: [404, "check spelling"] };
    await searchFor(user, "Lafayete");
    await waitFor(() => expect(feedback().textContent).not.toBe(""));
    await user.click(save());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ address: "1437 Bannock St, Denver" });
  });

  it("in-range coordinates are a new place: the old pin's roads go at once (#570)", async () => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    await bannock(user);
    roadAnswer = null;
    await searchFor(user, "39.7401, -104.9811");
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(screen.queryByTestId("road-nearest-only")).toBeNull();
    expect(screen.queryAllByRole("radio")).toEqual([]);
    expect(save().disabled).toBe(true);
  });

  it("a search that places a pin shows its own roads only", async () => {
    const user = userEvent.setup();
    mount();
    await mapReady();
    await bannock(user);
    geo = { ok: { lat: PIN.lat, lng: PIN.lng, placeType: "address" } };
    roadAnswer = TWO_ROADS;
    await searchFor(user, "1600 Broadway, Denver");
    await waitFor(() => expect(bar().textContent).toBe("Pin at 39.7401, -104.9811"));
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(2));
    expect(screen.queryByTestId("road-nearest-only")).toBeNull();
    expect(screen.queryByText(/Cherokee Street/)).toBeNull();
  });

  it("the pin's own numbers are not a new search (#538): the pin and the pick stay", async () => {
    const user = userEvent.setup();
    roadAnswer = TWO_ROADS;
    mount();
    await mapReady();
    await searchFor(user, "39.7401, -104.9811");
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(2));
    await user.click(screen.getAllByRole("radio")[1]);
    await searchFor(user, "39.7401, -104.9811");
    expect(bar().textContent).toBe("Pin at 39.7401, -104.9811");
    expect(screen.getAllByRole("radio")[1].getAttribute("aria-checked")).toBe("true");
    expect(detects).toHaveLength(1);
  });

  it("the lookup's own message box hides 'Tap the map to move it.' too", async () => {
    const user = userEvent.setup();
    roadAnswer = { scan_status: "ok", candidates: [], primary_index: null, isUrban: true, placeName: "Denver" };
    mount();
    await mapReady();
    await searchFor(user, "39.7401, -104.9811");
    await screen.findByTestId("road-lookup-status");
    expect(tapLines()).toEqual([]);
    expect(screen.getByText("At your pin.")).toBeTruthy();
  });
});
