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
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("mapbox-gl", () => {
  // Every property is this same callable, constructible object; never a thenable.
  const any: object = new Proxy(function () {}, {
    get: (_t, prop) => (prop === "then" || typeof prop === "symbol" ? undefined : any),
    apply: () => any,
    construct: () => any,
  });
  return { default: any };
});

import { LocationPickerModal } from "./LocationPickerModal";

let detects: { lat: number; lng: number }[] = [];
let onCancel = vi.fn();

beforeEach(() => {
  detects = [];
  onCancel = vi.fn();
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
