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
  await user.click(screen.getByText("Pick Location on Map"));
  await user.click(screen.getByText("APPLY_SNAP"));
}

describe("#227 disclosure container — the #198 notes' new clothes", () => {
  it("the note sentence renders as one text node inside .sys-event.warn", async () => {
    await mountWithNote(DEFAULT_SHOULDER);
    // getByText proves single-text-node by construction: the default
    // matcher reads only direct text-node children of one element.
    const note = screen.getByText(
      /Speed 60 mph \(snapped from 62 mph OSM detection to the 5-mph grid\)\./,
    );
    const container = note.closest(".sys-event");
    expect(container).not.toBeNull();
    expect(container!.classList.contains("warn")).toBe(true);
  });

  it("the container carries the ⚠ glyph (aria-hidden) and no bare '!' glyph", async () => {
    await mountWithNote(DEFAULT_SHOULDER);
    const note = screen.getByText(/snapped from 62 mph OSM detection/);
    const container = note.closest(".sys-event")!;
    const glyph = container.querySelector(".sys-glyph");
    expect(glyph).not.toBeNull();
    expect(glyph!.textContent).toBe("⚠");
    expect(glyph!.getAttribute("aria-hidden")).not.toBeNull();
    // The pre-#227 "!" mark is retired from this surface (the
    // reconciled vocabulary maps "changed" to ⚠).
    const bare = Array.from(container.querySelectorAll("span")).filter(
      (s) => s.textContent === "!",
    );
    expect(bare.length).toBe(0);
  });

  it("provenance rides a second line in the provenance role", async () => {
    await mountWithNote(DEFAULT_SHOULDER);
    const note = screen.getByText(/snapped from 62 mph OSM detection/);
    const container = note.closest(".sys-event")!;
    const prov = container.querySelector(".tr-prov");
    expect(prov).not.toBeNull();
    expect(prov!.textContent).toMatch(/picker → form handoff/);
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
