// @vitest-environment happy-dom
//
// #234 — "Intersection marker not restored when the picker is reopened".
// #289 absorbs it: "picker rehydration; add: fact line and modal agree
// both directions" — and the ruling names the intersection: "the #234
// rehydration contract holds both directions (fact line <-> modal agree
// on the intersection)".
//
// Both directions, through the real shell (the picker stubbed at its
// props, which are the contract):
//   picker -> column : a Save carrying an intersection is what the WHERE
//                      fact line names ("at W 38th Ave", crossStreetLabel);
//   column -> picker : the reopened picker is handed that same
//                      intersection (lat, lng, name) to restore its marker
//                      from — including on a reload-equivalent mount.
// A cleared pin clears both.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_NEAR_INTERSECTION } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import { crossStreetLabel } from "@/lib/road-detection/labels";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

const PIN = { lat: 39.9936, lng: -105.0897 };
const X = { lat: 39.9941, lng: -105.0897, name: "W 38th Ave" };

const captured: Array<Record<string, unknown>> = [];
let saveIntersection: typeof X | null = X;

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({
    initial,
    onSave,
  }: {
    initial: Record<string, unknown>;
    onSave: (r: unknown) => void;
  }) => {
    captured.push(initial);
    return (
      <button
        type="button"
        onClick={() =>
          onSave({
            address: "Lafayette, CO",
            lat: PIN.lat,
            lng: PIN.lng,
            bearingDeg: 0,
            workZoneFt: 500,
            classification: null,
            overrides: {},
            crossStreet: null,
            intersection: saveIntersection,
            confirmedRoad: null,
          })
        }
      >
        SAVE_PICKER
      </button>
    );
  },
}));

import { GeneratorShell } from "./GeneratorShell";
import { openWhat, openWhere } from "./__fixtures__/band-helpers";

const PINNED: Scenario = {
  ...DEFAULT_NEAR_INTERSECTION,
  workLen: 500,
  meta: { ...DEFAULT_NEAR_INTERSECTION.meta, address: "Lafayette, CO", ...PIN },
} as Scenario;

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 200));
    await Promise.resolve();
  });
}

beforeEach(() => {
  captured.length = 0;
  saveIntersection = X;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response),
  );
  Element.prototype.scrollIntoView = vi.fn() as never;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The WHERE fact line's text — WHAT open collapses WHERE to its line. */
async function whereLine(): Promise<string> {
  await openWhat();
  await settle();
  return screen.getByTestId("fact-where").textContent ?? "";
}

async function reopenPicker(user: ReturnType<typeof userEvent.setup>) {
  await openWhere();
  await settle();
  await user.click(screen.getByText("Edit on map"));
}

describe("#234 — fact line and picker agree on the intersection, both directions", () => {
  it("picker -> column -> picker: a saved intersection is what the fact line names, and what the reopened picker is handed", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED} />);
    await settle();

    await reopenPicker(user);
    expect(captured.at(-1)!.intersection ?? null).toBeNull();
    await user.click(screen.getByText("SAVE_PICKER"));
    await settle();

    // Column: the one producer's words.
    expect(await whereLine()).toContain(`at ${crossStreetLabel(X.name)}`);

    // Back to the picker: the same crossing, to restore its marker from.
    await reopenPicker(user);
    expect(captured.at(-1)!.intersection).toEqual(X);
  });

  it("reload-equivalent: a plan restored with meta.intersection shows it on the fact line and hands it to the picker on first open", async () => {
    const user = userEvent.setup();
    const restored = { ...PINNED, meta: { ...PINNED.meta, intersection: X } } as Scenario;
    render(<GeneratorShell mode="sandbox" initialScenario={restored} />);
    await settle();
    expect(await whereLine()).toContain("at W 38th Ave");
    await reopenPicker(user);
    expect(captured.at(-1)!.intersection).toEqual(X);
  });

  it("an unnamed crossing reads the picker's own fallback on the fact line", async () => {
    saveIntersection = { ...X, name: null } as never;
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={PINNED} />);
    await settle();
    await reopenPicker(user);
    await user.click(screen.getByText("SAVE_PICKER"));
    await settle();
    expect(await whereLine()).toContain(`at ${crossStreetLabel(null)}`);
  });

  it("a cleared pin clears both: no 'at' clause, nothing handed back", async () => {
    const user = userEvent.setup();
    const restored = { ...PINNED, meta: { ...PINNED.meta, intersection: X } } as Scenario;
    render(<GeneratorShell mode="sandbox" initialScenario={restored} />);
    await settle();
    saveIntersection = null;
    await reopenPicker(user);
    await user.click(screen.getByText("SAVE_PICKER"));
    await settle();
    expect(await whereLine()).not.toContain(" at ");
    await reopenPicker(user);
    expect(captured.at(-1)!.intersection ?? null).toBeNull();
  });
});
