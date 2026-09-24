// @vitest-environment happy-dom
//
// #227 surface 3a — the disclosure container promotion.  The #198
// handoff notes are "a value the user didn't set" records, which the
// adopted design makes a SYSTEM EVENT: a bordered container with the
// amber rule, a full-size glyph, the full sentence, and provenance on a
// second line (PDF p.2's "heavier container, not a lighter one").
//
// Two contracts pinned here:
//   - the sentence stays ONE unbroken text node (getByText's default
//     matcher reads direct text-node children only), so the #198
//     byte-identity suite (GeneratorShell.handoff-provenance.test.tsx)
//     passes unmodified — no inline bolding (GO ruling 2, 2026-08-27);
//   - the glyph is ⚠, the reconciled vocabulary's "changed" mark
//     (issue #227: the PDF's ! maps to ⚠), never hue-alone (rule 13).
//
// The mounted half drives the real picker -> form seam via the stubbed
// modal (the handoff-provenance harness idiom); the CSS half mirrors
// the .sys-event block the same way quiet-band-contrast pins its band.

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { RoadClassification } from "@/lib/road-detection/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));

// A detection whose off-grid speed forces the UX-01 snap note — the
// smallest fixture that makes a handoff event render.
function snapDetection(): RoadClassification {
  return {
    roadType: "rural_divided",
    divided: true,
    laneWidthFt: 12,
    speedLimitMph: 62,
    lanesPerDirection: 2,
    confidence: "high",
    source: "osm-tags",
    raw: {
      class: "trunk",
      oneway: false,
      roadName: "US 287",
      roadRef: "US 287",
      placeName: "Lafayette",
      osmLanesTag: "4",
      osmMaxspeedTag: "62 mph",
    },
    fields: {
      speed: { value: 62, confidence: "high", source: "OSM maxspeed tag", method: "measured" },
      lanes: { value: 2, confidence: "medium", source: "OSM lanes tag", method: "measured" },
      roadType: { value: "rural_divided", confidence: "high", source: "class", method: "measured" },
      divided: { value: true, confidence: "high", source: "oneway", method: "measured" },
    },
  } as RoadClassification;
}

vi.mock("./LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          address: "Lafayette, CO",
          lat: 39.9936,
          lng: -105.0897,
          bearingDeg: 90,
          workZoneFt: 1000,
          classification: snapDetection(),
          overrides: {},
        })
      }
    >
      APPLY_SNAP
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { openWhere, openWhat } from "./__fixtures__/band-helpers";

// #289 Phase 2 — the column renders ONE band open (rule 65), so reaching a
// control in another band is a click on its fact line, exactly as a user
// does it.  `openWhere` / `openWhat` are that click, and they are no-ops
// when the band is already open (components/__fixtures__/band-helpers.ts).

const fetchMock = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mountWithNote(initial: Scenario) {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={initial} />);
  await act(async () => {
    await Promise.resolve();
  });
  await openWhere();
  await user.click(screen.getByText("Pick on map"));
  await user.click(screen.getByText("APPLY_SNAP"));
}

describe("#227 → #289 correction 3 — the #198 notes' new clothes", () => {
  // The notes used to live in a `.sys-event.warn` box titled "Applied
  // from picker", in the WHERE band.  #289 hand-check, 2026-09-23,
  // correction 3: "'Applied from picker' is not a box — its two ⚠ lines
  // become provenance under the fields they describe in WHAT."
  //
  // What has to remain true, and is what these cases still check:
  //   · the SENTENCE is one text node (#198 byte-identity — `getByText`
  //     proves it by construction, since the default matcher reads only
  //     direct text-node children of one element);
  //   · the ⚠ mark is #227's reconciled vocabulary, aria-hidden, and its
  //     own node, so it never joins the sentence;
  //   · the note sits under the FIELD it is about — a speed clamp under
  //     the speed cell — which is the whole point of the move.
  it("the note sentence renders as one text node, under the field it describes", async () => {
    await mountWithNote(DEFAULT_SHOULDER);
    await openWhat();
    const note = screen.getByText(
      /Speed 60 mph \(snapped from 62 mph OSM detection to the 5-mph grid\)\./,
    );
    // The speed cell, not a box of its own.
    expect(note.closest('[data-testid="cell-speed"]')).not.toBeNull();
    expect(note.closest(".sys-event")).toBeNull();
    expect(document.body.textContent).not.toContain("Applied from picker");
  });

  it("the line carries the ⚠ mark (aria-hidden) and no bare '!' glyph", async () => {
    await mountWithNote(DEFAULT_SHOULDER);
    await openWhat();
    const note = screen.getByText(/snapped from 62 mph OSM detection/);
    const glyph = note.querySelector("[aria-hidden]");
    expect(glyph).not.toBeNull();
    expect(glyph!.textContent).toBe("⚠ ");
    const bare = Array.from(note.querySelectorAll("span")).filter(
      (x) => x.textContent === "!",
    );
    expect(bare.length).toBe(0);
  });

  it("the note takes the provenance role, below the field's own provenance line", async () => {
    await mountWithNote(DEFAULT_SHOULDER);
    await openWhat();
    const note = screen.getByText(/snapped from 62 mph OSM detection/);
    expect(note.classList.contains("tr-prov")).toBe(true);
    expect(note.classList.contains("is-amber")).toBe(true);
    // Rule 137's own line is still there and still first: the field says
    // where its value came from, then the handoff says what happened to
    // it on the way in.
    const cell = note.closest('[data-testid="cell-speed"]')!;
    const lines = Array.from(cell.querySelectorAll(".tr-prov"));
    expect(lines[0]).toBe(cell.querySelector('[data-testid="prov-speed"]'));
    expect(lines).toContain(note);
  });
});

describe("the .sys-event CSS block mirrors the adopted container", () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, "../app/globals.css"),
    "utf-8",
  );

  it(".workbench .sys-event carries the border and the amber rule", () => {
    const block = css.match(/\.workbench \.sys-event \{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/border:/);
    expect(block![0]).toMatch(/var\(--warn\)/);
  });

  it("the glyph cell sizes from the CHOSEN --glyph-cell token", () => {
    const block = css.match(/\.workbench \.sys-event \.sys-glyph \{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/var\(--glyph-cell\)/);
    // The token itself is defined on the workbench (GO ruling 4).
    expect(css).toMatch(/--glyph-cell:\s*16px/);
  });
});
