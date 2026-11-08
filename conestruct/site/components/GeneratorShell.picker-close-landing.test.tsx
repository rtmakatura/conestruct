// @vitest-environment happy-dom
//
// #460 (Ryan, 2026-11-08): "after the map picker's Save & Close, scroll so
// the WHERE band's top ("Where is the work?" heading and the whole aerial)
// sits just under the site's top bar, at every width ... when the aerial
// isn't drawn yet, show the picture the picker already loaded instead of
// the empty box with the mono "Drawing the corridor…" label."
//
// Mounted through the shell (Rule 11): the picker stub saves as the real
// one does, with or without the canvas picture.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const armed: HTMLElement[] = [];
vi.mock("@/lib/landing", async () => {
  const real = await vi.importActual<typeof import("@/lib/landing")>("@/lib/landing");
  return {
    ...real,
    armLandingCheck: (el: HTMLElement, behavior: ScrollBehavior) => {
      armed.push(el);
      return real.armLandingCheck(el, behavior);
    },
  };
});

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./ReferenceSections", () => ({ ReferenceSections: () => null }));

const SNAPSHOT = "data:image/jpeg;base64,AAAA";
let saveWith: Record<string, unknown> = {};
vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave, onCancel }: { onSave: (r: unknown) => void; onCancel: () => void }) => (
    <>
      <button type="button" onClick={() => onSave(saveWith)}>
        SAVE_PIN
      </button>
      <button type="button" onClick={onCancel}>
        CANCEL_PIN
      </button>
    </>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { MIN_AUDIT, PINNED_SHOULDER, TEST_PIN, corridorGeometryResponse } from "./test-fixtures";
import { clickPicker, openBand } from "./__fixtures__/band-helpers";
import { AERIAL_STAND_IN_ALT, AERIAL_WAIT } from "./bands/BandAerial";

// The aerial's picture: held until the test lets it answer.
// Every pending request: the module remembers one on its way across tests.
const pendingMaps: Array<() => void> = [];
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/corridor-map")) {
    return new Promise<Response>((resolve) => {
      pendingMaps.push(() =>
        resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "image/png" }),
          blob: async () => new Blob(["png"], { type: "image/png" }),
          json: async () => ({}),
        } as unknown as Response));
    });
  }
  if (url.includes("/api/render/corridor-geometry")) return Promise.resolve(corridorGeometryResponse());
  const json = url.includes("/api/render/audit") ? MIN_AUDIT : {};
  return Promise.resolve({ ok: true, status: 200, json: async () => json } as unknown as Response);
});

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
    await Promise.resolve();
  });
}

async function saveFromPicker() {
  await clickPicker();
  await act(async () => {
    fireEvent.click(screen.getByText("SAVE_PIN"));
  });
  await settle();
}

beforeEach(() => {
  armed.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn() as never;
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:aerial", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
  saveWith = {
    address: "E Colfax Ave, Denver",
    ...TEST_PIN,
    classification: null,
    crossStreet: null,
    intersection: null,
    confirmedRoad: null,
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("#460 — Save & Close lands the WHERE band", () => {
  it("lands the open WHERE band once per save, at the band's own landing target", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await clickPicker();
    await settle();
    const before = armed.length;
    await act(async () => {
      fireEvent.click(screen.getByText("SAVE_PIN"));
    });
    await settle();
    expect(openBand()).toBe("where");
    expect(armed.length - before, "one landing for the save").toBe(1);
    const target = armed.at(-1)!;
    // The open band's wrapper: its scroll margin is the top bar plus 8.
    expect(target.style.scrollMarginTop).toBe("calc(var(--nav-h) + 8px)");
    expect(target.querySelector('[data-testid="band-aerial"]')).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "start" }),
    );

    // A second save at the same pin is a second request: it lands again.
    await saveFromPicker();
    expect(armed.length - before, "a second save lands again").toBe(2);

    // Cancel lands nothing (P1).
    await clickPicker();
    await act(async () => {
      fireEvent.click(screen.getByText("CANCEL_PIN"));
    });
    await settle();
    expect(screen.queryByText("CANCEL_PIN"), "the picker closed").toBeNull();
    expect(armed.length - before, "Cancel lands nothing").toBe(2);
  });
});

describe("#460 — the picker's picture stands in until the aerial is drawn", () => {
  it("shows the saved picture, not the empty box, then gives way to the aerial", async () => {
    saveWith = { ...saveWith, snapshot: SNAPSHOT };
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await saveFromPicker();

    const standIn = screen.getByTestId("band-aerial-standin") as HTMLImageElement;
    expect(standIn.getAttribute("src")).toBe(SNAPSHOT);
    expect(standIn.getAttribute("alt")).toBe(AERIAL_STAND_IN_ALT);
    // Rule 10: it says the aerial is still coming, in the corner line.
    expect(screen.getByTestId("band-aerial-held").textContent).toBe(AERIAL_WAIT);
    expect(screen.queryByTestId("band-aerial-note")).toBeNull();
    expect(screen.getByTestId("band-aerial-frame").getAttribute("aria-busy")).toBe("true");
    // Not the aerial: no zoom, no key on it.
    expect(screen.queryByTestId("band-aerial-zoom")).toBeNull();
    expect(screen.queryByTestId("band-aerial-img")).toBeNull();

    // Let every picture asked for answer (the module shares one request per
    // picture across tests, so an earlier test's may be the one on its way).
    for (let round = 0; round < 3 && pendingMaps.length > 0; round++) {
      await act(async () => {
        for (const release of pendingMaps.splice(0)) release();
      });
      await settle();
    }
    expect(screen.queryByTestId("band-aerial-standin")).toBeNull();
    expect(screen.getByTestId("band-aerial-img").getAttribute("src")).toBe("blob:aerial");
  });

  it("without a picture from the picker, the wait sentence is unchanged", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await saveFromPicker();
    expect(screen.queryByTestId("band-aerial-standin")).toBeNull();
    expect(screen.getByTestId("band-aerial-note").textContent).toBe(AERIAL_WAIT);
  });

  it("a picture taken at another pin never stands in (Rule 10)", async () => {
    saveWith = { ...saveWith, snapshot: SNAPSHOT, lat: 39.7113, lng: -105.0815 };
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
    await settle();
    await saveFromPicker();
    // Saved at Lakewood: the picture is Lakewood's and the pin is Lakewood.
    expect(screen.getByTestId("band-aerial-standin")).not.toBeNull();
    // A later save without a picture, back at E Colfax, drops it.
    saveWith = { ...saveWith, snapshot: undefined, ...TEST_PIN };
    await saveFromPicker();
    expect(screen.queryByTestId("band-aerial-standin")).toBeNull();
  });
});
