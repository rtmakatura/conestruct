// @vitest-environment happy-dom
//
// #230: coordinates entered by hand, driven the way a person drives them:
// keystroke by keystroke (user-event) and by paste.  The sibling picker
// suites enter a pair with a single fireEvent.change of a whole value,
// which never hits per-keystroke handling (Rule 11: test where the bug
// lives).
//
// #541 (RULE 5, stated): the Latitude and Longitude boxes are gone;
// coordinates go in the search box (Ryan, 2026-11-22, docs/prompts/
// cc-prompt-ux-coords-in-search.md, ruling 1).  #230's contract carries
// over to that box: what was typed or pasted stays in the box as it was
// entered, nothing moves the pin until Enter, and the pair that reaches the
// road lookup is the full pair, with the Unicode minus (U+2212, what docs
// and some map apps copy) and stray whitespace incl. NBSP read correctly.
// The split of a pasted pair across two boxes has no counterpart: there is
// one box.  No Mapbox token here: the search box needs no map, and
// coordinates need no geocoder.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LocationPickerModal } from "./LocationPickerModal";

let detects: { lat: number; lng: number }[] = [];
let geocodes = 0;

beforeEach(() => {
  detects = [];
  geocodes = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/road-bearing")) {
        detects.push(JSON.parse(String(init?.body)) as { lat: number; lng: number });
        return new Promise(() => {}); // parked: the response never matters here
      }
      if (u.includes("/api/geocode")) geocodes += 1;
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount() {
  render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder" }}
      onCancel={() => {}}
      onSave={vi.fn()}
    />,
  );
}
const box = () =>
  screen.getByLabelText("Address, intersection or coordinates search") as HTMLInputElement;
// #565: the search's messages are the lines of the right panel's box.
const errors = () =>
  Array.from(document.querySelectorAll('[data-testid="search-feedback"] > *')).map((e) => e.textContent);
const PAIR = { lat: 39.7113, lng: -105.0815 };

describe("#230 typed entry, keystroke by keystroke", () => {
  it("the box holds what was typed; nothing moves until Enter; the lookup gets the pair", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(box(), "39.7113, -105.0815");
    expect(box().value).toBe("39.7113, -105.0815");
    expect(detects).toHaveLength(0);
    await user.keyboard("{Enter}");
    expect(errors()).toEqual([]);
    expect(detects).toEqual([PAIR]);
    expect(geocodes).toBe(0);
  });

  it("a Unicode minus typed by hand is accepted", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(box(), "39.7113, −105.0815");
    await user.keyboard("{Enter}");
    expect(errors()).toEqual([]);
    expect(detects).toEqual([PAIR]);
    expect(geocodes).toBe(0);
  });
});

describe("#230 pasted pair", () => {
  it("an ASCII pair pasted into the empty box waits for Enter, then places the pin", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(box());
    await user.paste("39.7113, -105.0815");
    expect(box().value).toBe("39.7113, -105.0815");
    expect(detects).toHaveLength(0);
    await user.keyboard("{Enter}");
    expect(detects).toEqual([PAIR]);
    expect(geocodes).toBe(0);
  });

  it("the U+2212 pair is read", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(box());
    await user.paste("39.7113, −105.0815");
    await user.keyboard("{Enter}");
    expect(errors()).toEqual([]);
    expect(detects).toEqual([PAIR]);
    expect(geocodes).toBe(0);
  });

  it("stray whitespace incl. NBSP around a pasted pair is read through", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(box());
    await user.paste(" 39.7113 , -105.0815 ");
    await user.keyboard("{Enter}");
    expect(errors()).toEqual([]);
    expect(detects).toEqual([PAIR]);
    expect(geocodes).toBe(0);
  });
});
