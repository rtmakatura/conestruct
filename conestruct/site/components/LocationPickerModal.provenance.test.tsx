// @vitest-environment happy-dom
//
// #152 follow-up — road-property provenance lines.  The old caption
// rendered the full source sentence with `truncate`, so at every width
// it clipped ("OSM CLASS=UNCLASSIFIED + URBAN (INFER…") with no way to
// read the rest, and it borrowed the amber warning tone off the pip
// count.  The replacement (same pattern as the spec-chain breadcrumb):
//   - visible line is a short, non-truncating "OSM · MEASURED /
//     INFERRED" token — the full sentence moves to the title tooltip;
//   - amber follows the measured/inferred METHOD, not confidence, so a
//     measured value never wears the warning color.
// Mounted through the real modal + real classifyFromOsmTags: type
// coords, one candidate auto-classifies, assert the four field rows.
//
// The pixel-level "no truncation at 1100px" guarantee is structural
// here: the caption no longer carries the `truncate` class and its text
// is a fixed short token, so there is nothing to clip.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LocationPickerModal } from "./LocationPickerModal";
import type { RoadCandidate, RoadDetectResponse } from "@/lib/road-detection/types";

// A residential street WITH a posted speed and a lanes tag: speed +
// lanes come off real tags (measured), while road type + divided are
// class inferences (inferred) — one road exercises both tones.
const MIXED: RoadCandidate = {
  way_id: "900001",
  highway_class: "residential",
  name: "Elm Street",
  ref: null,
  bearing: 90,
  snap_distance_m: 6,
  snapped_lat: 39.7,
  snapped_lng: -104.9,
  tags: {
    oneway: null,
    maxspeed: "30 mph",
    lanes: "2",
    lanes_forward: null,
    lanes_backward: null,
    turn_lanes: null,
    turn_lanes_forward: null,
    turn_lanes_backward: null,
  },
  signal_distance_m: null,
};

function stubDetection(response: RoadDetectResponse) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/road-bearing")) {
        return { ok: true, status: 200, json: async () => response };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
}

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

function typeCoords() {
  fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "39.7000" } });
  fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-104.9000" } });
}

// The caption is the short mono line inside a field row, located by its
// row label so the assertion can't accidentally match another row.
function caption(label: string): HTMLElement {
  // "Divided" also names a control button, so match the row LABEL span
  // specifically (white, medium-weight) before walking to its caption.
  const labelEl = screen
    .getAllByText(label)
    .find(
      (el) =>
        el.tagName === "SPAN" && el.className.includes("font-medium"),
    ) as HTMLElement;
  const row = labelEl.closest("div.grid") as HTMLElement;
  return within(row).getByText(/^(OSM · |operator-set$)/);
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  stubDetection({ candidates: [MIXED], primary_index: 0, isUrban: true, placeName: "Denver" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("road-property provenance lines (#152 follow-up)", () => {
  it("measured fields read 'OSM · MEASURED' in the neutral tone", async () => {
    mountModal();
    typeCoords();
    await screen.findByText("Speed limit (mph)");

    for (const label of ["Speed limit (mph)", "Lanes per direction"]) {
      const cap = caption(label);
      expect(cap.textContent).toMatch(/^OSM · measured$/);
      expect(cap.className).toContain("--ink-on-dark-faint");
      expect(cap.className).not.toContain("--warn");
    }
  });

  it("inferred fields read 'OSM · INFERRED' in the amber warning tone", async () => {
    mountModal();
    typeCoords();
    await screen.findByText("Road type");

    for (const label of ["Road type", "Divided"]) {
      const cap = caption(label);
      expect(cap.textContent).toMatch(/^OSM · inferred$/);
      expect(cap.className).toContain("--warn");
    }
  });

  it("the full provenance sentence + confidence + raw evidence live in the tooltip", async () => {
    mountModal();
    typeCoords();
    await screen.findByText("Speed limit (mph)");

    const speed = caption("Speed limit (mph)");
    expect(speed.title).toContain("OSM maxspeed tag");
    expect(speed.title).toContain("high confidence");
    expect(speed.title).toContain("maxspeed=30 mph");

    const roadType = caption("Road type");
    expect(roadType.title).toContain("class=residential");
    expect(roadType.title).toContain("inferred");
  });

  it("once the operator edits a field it reads 'operator-set' in the neutral tone, never amber (Ryan ruling)", async () => {
    mountModal();
    typeCoords();
    await screen.findByText("Road type");

    // Road type detected as an inference → amber to start.
    expect(caption("Road type").textContent).toMatch(/^OSM · inferred$/);
    expect(caption("Road type").className).toContain("--warn");

    // Operator overrides it — the value is theirs now.
    fireEvent.change(screen.getByLabelText("Road type"), {
      target: { value: "freeway" },
    });

    const cap = caption("Road type");
    expect(cap.textContent).toMatch(/^operator-set$/);
    expect(cap.className).toContain("--ink-on-dark-faint");
    expect(cap.className).not.toContain("--warn");
    expect(cap.title).toMatch(/^Operator-set/);
  });

  it("the visible caption never carries the full sentence (nothing to truncate) or the truncate class", async () => {
    mountModal();
    typeCoords();
    await screen.findByText("Road type");

    // The full sentence appears ONLY in a title, never as visible text.
    expect(screen.queryByText(/class=residential \+ urban/)).toBeNull();
    for (const label of ["Speed limit (mph)", "Lanes per direction", "Road type", "Divided"]) {
      expect(caption(label).className).not.toContain("truncate");
    }
  });
});
