// @vitest-environment happy-dom
//
// #227 surface 5 — corridor table + proportional bar.  The bar is a
// display-only proportion of the BACKEND zone lengths (rule 3: the
// audit's sections.corridor_spec + the typed work-zone length; the only
// client arithmetic is lengthFt/total for pixels).  Min segment width
// asserted via the CSS floor; segment order matches the table order;
// the bar is aria-hidden (the table is the accessible record).  The
// rows' hard-prefixed ✓ is dropped (GO ruling 5): no verdict, no ✓.

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          address: "E Bayaud Ave, Denver",
          lat: 39.71466,
          lng: -104.94071,
          bearingDeg: 85,
          workZoneFt: 400,
          classification: null,
          overrides: {},
        })
      }
    >
      APPLY_PIN
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";

// The backend's own numbers (the input-gating fixture's corridor_spec).
const AUDIT = {
  summary: { pass: 0, warning: 0, fail: 0, items: [] },
  sections: {
    taper: {},
    buffer: {},
    spacing: {},
    advance: {},
    colorado: {},
    case: {},
    flagger: {},
    corridor_validation: { checked: false, warnings: [] },
    geometry_validation: { violations: [], all_pass: true },
    corridor_spec: {
      taper_ft: 183,
      buffer_ft: 495,
      advance_warning_ft: 1500,
      downstream_taper_ft: 100,
      road_category: "rural",
    },
  },
  pending_verification: { count: 0, note: "", tracking_issue: null },
};

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => AUDIT,
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mountPinned(initial: Scenario) {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={initial} />);
  await act(async () => {
    await Promise.resolve();
  });
  await user.click(screen.getByText("Pick Location on Map"));
  await user.click(screen.getByText("APPLY_PIN"));
  await waitFor(() =>
    expect(document.querySelector(".corridor-bar")).not.toBeNull(),
  );
}

describe("#227 corridor bar — proportion of backend lengths only", () => {
  it("five segments, order matching the rows, widths = backend length / total", async () => {
    await mountPinned(DEFAULT_SHOULDER);
    const segs = Array.from(
      document.querySelectorAll(".corridor-bar .corridor-bar-seg"),
    ) as HTMLElement[];
    expect(segs.length).toBe(5);
    // 1500 / 183 / 495 / 400 / 100, total 2678 — upstream → downstream.
    const total = 1500 + 183 + 495 + 400 + 100;
    const expected = [1500, 183, 495, 400, 100].map(
      (l) => `${(l / total) * 100}%`,
    );
    expect(segs.map((s) => s.style.width)).toEqual(expected);
  });

  it("the bar is aria-hidden; the table rows are the record — with no ✓ prefix", async () => {
    await mountPinned(DEFAULT_SHOULDER);
    const bar = document.querySelector(".corridor-bar")!;
    expect(bar.getAttribute("aria-hidden")).not.toBeNull();
    // GO ruling 5: rows carry no verdict glyph.
    const rowText = screen.getByText("Advance warning").textContent ?? "";
    expect(rowText).not.toContain("✓");
    // The values still read down the column with the unit demoted.
    expect(screen.getByText("1,500")).toBeTruthy();
  });
});

describe("the bar's CSS floor", () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, "../app/globals.css"),
    "utf-8",
  );

  it("segments are floored by the CHOSEN --bar-seg-min token", () => {
    const block = css.match(
      /\.workbench \.corridor-bar \.corridor-bar-seg \{[^}]*\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/min-width:\s*var\(--bar-seg-min\)/);
    expect(css).toMatch(/--bar-seg-min:\s*6px/);
  });
});
