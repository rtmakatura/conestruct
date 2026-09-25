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
          // #290: no bearing, no length — see mountPinned.
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
import { answerSide, openWhere, openWhat } from "./__fixtures__/band-helpers";
import { corridorGeometryResponse } from "./test-fixtures";

// #289 Phase 2 — the column renders ONE band open (rule 65), so reaching a
// control in another band is a click on its fact line, exactly as a user
// does it.  `openWhere` / `openWhat` are that click, and they are no-ops
// when the band is already open (components/__fixtures__/band-helpers.ts).

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
  // #290: the WHERE band's geometry read — the side control's choices.
  if (url.includes("/api/render/corridor-geometry")) {
    return Promise.resolve(corridorGeometryResponse());
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
  await openWhere();
  await user.click(screen.getByText("Pick on map"));
  await user.click(screen.getByText("APPLY_PIN"));
  // #290 (RULE 5, stated): the corridor rows are the audit's, and no check
  // fires until the pin's side is answered (ruling 10) — so the side is
  // answered here, as a person does.  The work-zone length is the band's
  // Extent field now (the picker's length field is retired, one length
  // control — P2), so the operator's 400 ft is typed there, committed on
  // Enter.
  await answerSide();
  await openWhere();
  const extent = document.getElementById("band-worklen") as HTMLInputElement;
  await user.clear(extent);
  await user.type(extent, "400{Enter}");
  // #289: the bar is gone, so the settle signal is the rows themselves.
  await waitFor(() =>
    expect(document.querySelector('[data-testid="zone-work_zone"]')).not.toBeNull(),
  );
}

describe("#227 corridor bar — proportion of backend lengths only", () => {
  // #289 Phase 2 — THE BAR RETIRES; THE ROWS TRANSFER.
  //
  // §8.19 folds the location section into the WHERE band, and this phase
  // has no aerial to fold the corridor picture into (the deviation is
  // recorded at the top of components/bands/WhereBand.tsx).  So the two
  // halves part company on their own merits:
  //
  //   the BAR was a proportion — a picture OF these numbers, aria-hidden
  //     by its own design because "the table is the accessible record".
  //     A picture with no fact of its own and no aerial to sit in has
  //     nothing left to be, so it is deleted rather than re-homed.
  //   the ROWS are backend facts about the extent the operator just
  //     typed, so they move under the extent field, in the WHERE band,
  //     and keep rule 3's honest-unavailable note.
  //
  // The two cases below asserted the bar's geometry.  What survives of
  // them — the rows exist, in order, with the backend's lengths and no
  // verdict glyph — is asserted against the band.
  it("the rows transfer: five zones, traffic order, backend lengths, no verdict glyph", async () => {
    await mountPinned(DEFAULT_SHOULDER);
    await openWhere();
    const rows = Array.from(
      document.querySelectorAll('[data-testid^="zone-"]'),
    ) as HTMLElement[];
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual([
      "zone-advance_warning",
      "zone-transition",
      "zone-buffer",
      "zone-work_zone",
      "zone-downstream",
    ]);
    // 1500 / 183 / 495 / 400 / 100 — the four backend lengths and the
    // operator's own typed extent, unchanged by the move.
    expect(rows.map((r) => r.textContent)).toEqual([
      "Advance warning · 1,500 ft",
      "Taper · 183 ft",
      "Buffer · 495 ft",
      "Work zone · 400 ft",
      "Downstream · 100 ft",
    ]);
    // GO ruling 5: rows carry no verdict glyph.
    for (const r of rows) expect(r.textContent).not.toContain("✓");
  });

  it("the bar itself is gone — a proportion with no aerial to sit in", async () => {
    await mountPinned(DEFAULT_SHOULDER);
    await openWhere();
    expect(document.querySelector(".corridor-bar")).toBeNull();
  });
});

// #289 Phase 2: the bar's CSS floor retires with the bar.  The token
// --bar-seg-min stays declared (#227's CHOSEN sizing pair, mirrored by
// lib/design/tokens.ts, which tokens.test.ts pins) — deleting a token
// whose mirror is asserted elsewhere is its own commit.
/*
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
*/
