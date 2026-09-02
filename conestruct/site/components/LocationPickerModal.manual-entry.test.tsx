// @vitest-environment happy-dom
//
// #230 — the picker's manual coordinate boxes, driven the way a person
// drives them: keystroke by keystroke (user-event) and by paste.  The
// five sibling picker suites drive these boxes with a single
// fireEvent.change of a whole value, which never hits the per-keystroke
// rewrite that mangled typed entry (Rule 11: test where the bug lives).
//
//   typed      — lat then lng, and lng then lat, one key at a time: the
//                box ends holding exactly what was typed and the LAST
//                detect POST carries the full pair.
//   pasted     — an ASCII pair into an empty box splits (control, green
//                before the fix); the same pair with the Unicode minus
//                (U+2212, what docs and some map apps copy) splits too;
//                a pair pasted over prior text replaces both boxes.
//
// Detection timing is deliberately NOT asserted beyond "the last POST
// is the full pair": the pin still follows every valid prefix as before
// (ruling 4, s2-arc14) and the state-contract suite owns that window.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationPickerModal } from "./LocationPickerModal";

let detects: { lat: number; lng: number }[] = [];

beforeEach(() => {
  detects = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/road-bearing")) {
        detects.push(JSON.parse(String(init?.body)) as { lat: number; lng: number });
        return new Promise(() => {}); // parked: the response never matters here
      }
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
      initial={{ scenarioKind: "shoulder", speedMph: 65 }}
      onCancel={() => {}}
      onSave={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText(/enter coordinates manually/i));
}
const lat = () => screen.getByLabelText("Latitude") as HTMLInputElement;
const lng = () => screen.getByLabelText("Longitude") as HTMLInputElement;
const errors = () =>
  Array.from(
    document.querySelectorAll(".text-\\[color\\:var\\(--fail\\)\\]"),
  ).map((e) => e.textContent);
const last = () => detects[detects.length - 1];

describe("#230 typed entry, keystroke by keystroke", () => {
  it("lat then lng: the boxes hold what was typed; the last detect is the pair", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(lat(), "39.7113");
    await user.type(lng(), "-105.0815");
    expect(lat().value).toBe("39.7113");
    expect(lng().value).toBe("-105.0815");
    expect(errors()).toEqual([]);
    expect(last()).toEqual({ lat: 39.7113, lng: -105.0815 });
  });

  it("lng then lat: same contract in the other order", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(lng(), "-105.0815");
    await user.type(lat(), "39.7113");
    expect(lat().value).toBe("39.7113");
    expect(lng().value).toBe("-105.0815");
    expect(errors()).toEqual([]);
    expect(last()).toEqual({ lat: 39.7113, lng: -105.0815 });
  });

  it("a Unicode minus typed by hand is accepted", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(lat(), "39.7113");
    await user.type(lng(), "−105.0815");
    expect(errors()).toEqual([]);
    expect(last()).toEqual({ lat: 39.7113, lng: -105.0815 });
  });
});

describe("#230 pasted pair", () => {
  it("ASCII pair into an empty box splits (control — green before the fix)", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(lat());
    await user.paste("39.7113, -105.0815");
    expect(lat().value).toBe("39.7113");
    expect(lng().value).toBe("-105.0815");
    expect(detects).toHaveLength(1);
    expect(last()).toEqual({ lat: 39.7113, lng: -105.0815 });
  });

  it("the U+2212 pair splits and validates", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(lat());
    await user.paste("39.7113, −105.0815");
    expect(lat().value).toBe("39.7113");
    expect(lng().value).toBe("-105.0815");
    expect(errors()).toEqual([]);
    expect(last()).toEqual({ lat: 39.7113, lng: -105.0815 });
  });

  it("a pair pasted over prior text replaces both boxes", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(lat(), "39.7");
    await user.paste("39.7113, -105.0815");
    expect(lat().value).toBe("39.7113");
    expect(lng().value).toBe("-105.0815");
    expect(errors()).toEqual([]);
    expect(last()).toEqual({ lat: 39.7113, lng: -105.0815 });
  });
});
