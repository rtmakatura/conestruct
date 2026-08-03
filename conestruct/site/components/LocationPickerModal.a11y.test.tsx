// @vitest-environment happy-dom
//
// fix-spec-02 P1·05·04 — focus containment on the real mounted modal
// (the dialog role, aria-modal and Esc shipped in engine-removal PR D;
// these tests cover the parts that did NOT exist: initial focus, the
// Tab/Shift+Tab wrap, and focus restore on close).  No Mapbox token in
// the test env, so the map pane renders its manual-entry fallback —
// the trap must contain focus regardless of the map's presence.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationPickerModal } from "./LocationPickerModal";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let opener: HTMLButtonElement;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({}) })),
  );
  opener = document.createElement("button");
  opener.textContent = "Pick Location on Map";
  document.body.appendChild(opener);
  opener.focus();
});

afterEach(() => {
  cleanup();
  opener.remove();
  vi.unstubAllGlobals();
});

function mountModal() {
  return render(
    <LocationPickerModal
      open
      initial={{ scenarioKind: "shoulder", speedMph: 65 }}
      onCancel={() => {}}
      onSave={() => {}}
    />,
  );
}

describe("LocationPickerModal focus containment", () => {
  it("moves focus into the dialog on open and restores the opener on close", () => {
    const { unmount } = mountModal();
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
    unmount();
    expect(document.activeElement).toBe(opener);
  });

  // #193 — the first successful save swaps UnsetLocation ("Pick
  // Location on Map") for the pin summary, so the captured opener is a
  // detached node by close time.
  it("restores to the fallback ref when the opener is detached", () => {
    const fallback = document.createElement("div");
    fallback.tabIndex = -1;
    document.body.appendChild(fallback);
    const fallbackRef = { current: fallback };
    const { unmount } = render(
      <LocationPickerModal
        open
        initial={{ scenarioKind: "shoulder", speedMph: 65 }}
        onCancel={() => {}}
        onSave={() => {}}
        restoreFallbackRef={fallbackRef}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    opener.remove();
    unmount();
    expect(document.activeElement).toBe(fallback);
    fallback.remove();
  });

  it("still prefers the opener when it remains connected", () => {
    const fallback = document.createElement("div");
    fallback.tabIndex = -1;
    document.body.appendChild(fallback);
    const fallbackRef = { current: fallback };
    const { unmount } = render(
      <LocationPickerModal
        open
        initial={{ scenarioKind: "shoulder", speedMph: 65 }}
        onCancel={() => {}}
        onSave={() => {}}
        restoreFallbackRef={fallbackRef}
      />,
    );
    unmount();
    expect(document.activeElement).toBe(opener);
    fallback.remove();
  });

  it("Tab on the last focusable wraps to the first", () => {
    mountModal();
    const dialog = screen.getByRole("dialog");
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    expect(focusables.length).toBeGreaterThan(1);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("Shift+Tab on the first focusable wraps to the last", () => {
    mountModal();
    const dialog = screen.getByRole("dialog");
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("Shift+Tab from the dialog container itself wraps to the last", () => {
    mountModal();
    const dialog = screen.getByRole("dialog");
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });
});
