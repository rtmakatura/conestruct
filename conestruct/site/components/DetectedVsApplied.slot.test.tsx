// @vitest-environment happy-dom
//
// The prod hand-check on 7d3eef3 found three defects; these are the two
// that are testable without a layout engine.
//
// D1 (P1/P6) — the provenance token rendered on its own line only when it
// existed, so Road type and Divided stood 34.6 px tall while Bearing and
// Lanes stood 19.2 px: a row grew because of its content.  Ruled: the
// second line is RESERVED in every value cell, so a row's height never
// depends on whether it carries a token.  The reserved slot is the DOM
// contract asserted here; the equal-height measurement is the browser leg.
//
// D2 (P2) — the token sat on the detected value only, while the applied
// value inherited the same inference and read as measured.  Ruled: the
// applied cell states where ITS OWN value came from — it inherits the
// detected token while it still shows the detected value, and says
// `operator-set` once it differs.  The comparison is the signal; no new
// state, and `operator-set` is the picker's existing third token
// (LocationPickerModal.tsx:2547).
//
// D4 — #275's `overridden` / `withdrawn` notes move into the same slot:
// same mechanism, one treatment.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario, DetectionOverride } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { DetectedVsApplied } from "./DetectedVsApplied";

afterEach(cleanup);

type Method = "measured" | "inferred";

function road(rt: Method = "inferred", dv: Method = "inferred"): ConfirmedRoad {
  return {
    candidate: {
      way_id: "1042",
      highway_class: "secondary",
      name: "E Bayaud Ave",
      ref: null,
      bearing: 85,
      snap_distance_m: 4,
      snapped_lat: 39.71466,
      snapped_lng: -104.94071,
      tags: {
        oneway: null,
        maxspeed: "30 mph",
        lanes: "4",
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
        highway: "secondary",
        name: "E Bayaud Ave",
        ref: null,
      },
      geometry: [
        [-104.9409, 39.7146],
        [-104.9404, 39.7147],
      ],
    },
    classification: {
      roadType: "rural_undivided",
      divided: false,
      lanesPerDirection: 2,
      speedLimitMph: 30,
      laneWidthFt: 11,
      confidence: "low",
      rationale: "test",
      detectedLanesTotal: 4,
      detectedOneway: false,
      fields: {
        speed: { value: 30, confidence: "high", source: "maxspeed", method: "measured" },
        lanes: { value: 2, confidence: "medium", source: "lanes", method: "measured" },
        roadType: { value: "rural_undivided", confidence: "low", source: "highway", method: rt },
        divided: { value: false, confidence: "low", source: "highway", method: dv },
      },
    },
    method: "operator_pick",
    pinLat: 39.71466,
    pinLng: -104.94071,
  } as unknown as ConfirmedRoad;
}

/** Applied === detected on every row (the screenshot fixture's shape). */
function matched(over: Partial<Scenario> = {}): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    lanes: 2,
    roadType: "rural_undivided",
    divided: false,
    detectedLanesTotal: 4,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.71466,
      lng: -104.94071,
      bearingDeg: 85,
      confirmedRoad: road(),
    },
    ...over,
  } as Scenario;
}

function rowsOf() {
  return Array.from(document.querySelectorAll(".dva-grid > .contents")).filter(
    (e) => !e.classList.contains("dva-head"),
  );
}
function cellOf(label: string, which: 1 | 2): HTMLElement {
  const r = rowsOf().find((x) => x.children[0]?.textContent?.trim() === label);
  if (!r) throw new Error(`no row "${label}"`);
  return r.children[which] as HTMLElement;
}
const slotText = (label: string, which: 1 | 2) =>
  (cellOf(label, which).querySelector(".dva-slot")?.textContent ?? "").trim();

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");
function ruleBody(selector: string): string {
  const at = css.indexOf(selector);
  if (at === -1) return "";
  return css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
}

describe("D1 — the provenance slot is reserved in every value cell", () => {
  it("every value cell carries exactly one slot, token or not", () => {
    render(<DetectedVsApplied scenario={matched()} />);
    const rows = rowsOf();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      for (const which of [1, 2] as const) {
        const slots = (r.children[which] as HTMLElement).querySelectorAll(".dva-slot");
        expect(
          slots.length,
          `"${r.children[0].textContent}" cell ${which} must reserve exactly one slot`,
        ).toBe(1);
      }
    }
  });

  it("the unmarked rows reserve an EMPTY slot — the row does not shrink", () => {
    render(<DetectedVsApplied scenario={matched()} />);
    // Bearing and Lanes carry no method: measured by construction
    expect(cellOf("Bearing", 1).querySelector(".dva-slot")).not.toBeNull();
    expect(slotText("Bearing", 1)).toBe("");
    expect(cellOf("Lanes per direction", 1).querySelector(".dva-slot")).not.toBeNull();
    expect(slotText("Lanes per direction", 1)).toBe("");
  });

  it("the slot reserves its line in CSS and declares no size of its own", () => {
    const body = ruleBody(".workbench .dva .dva-slot");
    expect(body, "the slot rule exists").not.toBe("");
    expect(body).toMatch(/display:\s*block/);
    expect(body, "the line is reserved whether or not it speaks").toMatch(/min-height/);
    expect(body, "the slot rides the provenance role's size").not.toMatch(/font-size/);
  });
});

describe("D2 — the applied cell states where its own value came from", () => {
  it("applied inherits the detected token while it shows the detected value", () => {
    render(<DetectedVsApplied scenario={matched()} />);
    expect(slotText("Road type", 1)).toBe("OSM · inferred");
    expect(slotText("Road type", 2)).toBe("OSM · inferred");
    expect(slotText("Divided", 1)).toBe("OSM · inferred");
    expect(slotText("Divided", 2)).toBe("OSM · inferred");
  });

  it("a measured detection is inherited as measured, not as a blank", () => {
    const s = matched();
    (s.meta.confirmedRoad as ConfirmedRoad) = road("measured", "measured");
    render(<DetectedVsApplied scenario={s} />);
    expect(slotText("Road type", 1)).toBe("OSM · measured");
    expect(slotText("Road type", 2)).toBe("OSM · measured");
  });

  it("applied says operator-set once it differs from the detected value", () => {
    render(<DetectedVsApplied scenario={matched({ roadType: "freeway" })} />);
    expect(slotText("Road type", 1)).toBe("OSM · inferred");
    expect(slotText("Road type", 2)).toBe("operator-set");
  });

  it("the two columns are independent — one row overridden, another inherited", () => {
    render(<DetectedVsApplied scenario={matched({ roadType: "freeway" })} />);
    expect(slotText("Road type", 2)).toBe("operator-set");
    expect(slotText("Divided", 2)).toBe("OSM · inferred");
  });

  it("a row with no detected method inherits nothing, and still says operator-set when changed", () => {
    render(<DetectedVsApplied scenario={matched({ speed: 45 })} />);
    expect(slotText("Speed limit", 1)).toBe("");
    expect(slotText("Speed limit", 2)).toBe("operator-set");
  });

  it("the inferred tone follows the token onto the applied cell", () => {
    render(<DetectedVsApplied scenario={matched()} />);
    for (const which of [1, 2] as const) {
      const slot = cellOf("Road type", which).querySelector(".dva-slot")!;
      expect(slot.className).toMatch(/is-inferred/);
    }
  });

  it("operator-set never wears the inferred tone", () => {
    render(<DetectedVsApplied scenario={matched({ roadType: "freeway" })} />);
    const slot = cellOf("Road type", 2).querySelector(".dva-slot")!;
    expect(slot.className).not.toMatch(/is-inferred/);
  });
});

describe("D4 — #275's notes share the slot, and no cell carries two", () => {
  const DISPUTED: DetectionOverride = {
    via: "shoulder_lane_edit",
    detectedLanesTotal: 1,
    asserted: "3 lanes per direction",
  };

  it("a disputed lanes edit puts `overridden` in the detected slot", () => {
    render(
      <DetectedVsApplied
        scenario={matched({
          lanes: 3,
          detectedLanesTotal: undefined,
          detectionOverrides: [DISPUTED],
        })}
      />,
    );
    expect(slotText("Lanes per direction", 1)).toBe("overridden");
    expect(slotText("Lanes per direction", 2)).toBe("operator-set");
  });

  it("an undisputed lanes edit withdraws the value, and applied says operator-set", () => {
    render(
      <DetectedVsApplied
        scenario={matched({ lanes: 3, detectedLanesTotal: undefined })}
      />,
    );
    const own = Array.from(cellOf("Lanes per direction", 1).childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent!.trim())
      .join("");
    expect(own).toMatch(/withdrawn/i);
    expect(slotText("Lanes per direction", 2)).toBe("operator-set");
  });

  it("no cell ever carries two tokens", () => {
    // the method token is detected-only and exists only where a method
    // exists; #275's notes are lanes-only, where there is no method; and
    // operator-set is applied-only.  So one slot, one token, always.
    for (const s of [
      matched(),
      matched({ roadType: "freeway" }),
      matched({ lanes: 3, detectedLanesTotal: undefined }),
      matched({ lanes: 3, detectedLanesTotal: undefined, detectionOverrides: [DISPUTED] }),
    ]) {
      cleanup();
      render(<DetectedVsApplied scenario={s} />);
      for (const r of rowsOf()) {
        for (const which of [1, 2] as const) {
          const slot = (r.children[which] as HTMLElement).querySelector(".dva-slot")!;
          // a slot's text is one token or empty — never two joined
          expect(slot.querySelectorAll(".dva-slot").length).toBe(0);
          const t = (slot.textContent ?? "").trim();
          expect(
            t === "" || /^(OSM · (measured|inferred)|operator-set|overridden)$/.test(t),
            `unexpected slot text "${t}"`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("D3 — the header declares its column's extent", () => {
  it("each header cell carries a hairline spanning it, on the shared rule token", () => {
    const body = ruleBody(".workbench .dva .dva-head .tr-step");
    expect(body, "a rule under the header cells must exist").not.toBe("");
    expect(body).toMatch(/border-bottom:\s*1px solid var\(--rule\)/);
  });
});
