// @vitest-environment happy-dom
// TEMPORARY s2-arc14 investigation repro for #230 — keystroke-level typing
// into the picker's manual boxes.  Not for commit in this form.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
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
        detects.push(JSON.parse(String(init?.body)));
        return new Promise(() => {}); // park forever
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

function dump(label: string) {
  const lat = screen.getByLabelText("Latitude") as HTMLInputElement;
  const lng = screen.getByLabelText("Longitude") as HTMLInputElement;
  const errs = Array.from(document.querySelectorAll(".text-\\[color\\:var\\(--fail\\)\\]")).map((e) => e.textContent);
  // eslint-disable-next-line no-console
  console.log(label, JSON.stringify({ lat: lat.value, lng: lng.value, errs, detects: detects.length, last: detects[detects.length - 1] }));
}

describe("#230 repro", () => {
  it("typed lat then lng, keystroke by keystroke", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("Latitude"), "39.7113");
    dump("after lat");
    await user.type(screen.getByLabelText("Longitude"), "-105.0815");
    dump("after lng");
  });
  it("typed lng then lat, keystroke by keystroke", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("Longitude"), "-105.0815");
    dump("after lng");
    await user.type(screen.getByLabelText("Latitude"), "39.7113");
    dump("after lat");
  });
  it("paste combined pair into lat box", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByLabelText("Latitude"));
    await user.paste("39.7113, -105.0815");
    dump("after paste");
  });
  it("paste combined pair with U+2212", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByLabelText("Latitude"));
    await user.paste("39.7113, −105.0815");
    dump("after paste u2212");
  });
  it("fireEvent.change whole value (how existing suites drive it)", () => {
    mount();
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "39.7113" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-105.0815" } });
    dump("after change");
    expect(detects.length).toBeGreaterThan(0);
  });
});
