// @vitest-environment happy-dom
//
// #274 — a classification the tool INFERRED must not render identically to
// one it MEASURED.
//
// Exactly two of the five rows can present a guess as a fact, and that is
// structural rather than a scoping choice: `classify.ts` returns plain
// applied scalars at the top level and a parallel `fields.*` bag carrying
// `method: "measured" | "inferred"`.  Top-level `speedLimitMph` and
// `lanesPerDirection` are measured BY CONSTRUCTION — the class fallback
// lives only in `fields.speed.value` / `fields.lanes.value` and never
// reaches the top level, so when those rows render at all they rendered
// from a real OSM tag.  Top-level `roadType` and `divided` always have a
// value and may be pure inference (the terminal fallback at
// classify.ts:166-171 answers for any unlisted class, `residential`
// included).  Bearing comes off the candidate geometry, not the
// classifier, and carries no method at all.
//
// The marker reuses the picker's producer and vocabulary verbatim —
// `OSM · measured` / `OSM · inferred` (LocationPickerModal.tsx:2543-2546)
// — so one string and one tone describe this fact on both surfaces.  No
// glyph: `◌` is ruled out (DESIGN-SPACING.md:98-115, "unevaluated / not
// set / pending — never a verdict"; the prior double-duty ruling at
// DESIGN-PRINCIPLES.md:63).  An inferred value WAS evaluated.
//
// Rule 13 / P9: the WORD is the channel — "inferred" vs "measured" — and
// the amber tone only reinforces it, so the signal never rests on colour.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { DetectedVsApplied } from "./DetectedVsApplied";

afterEach(cleanup);

type Method = "measured" | "inferred";

function road(roadTypeMethod: Method, dividedMethod: Method): ConfirmedRoad {
  return {
    candidate: {
      way_id: "1042",
      highway_class: "residential",
      name: "E Bayaud Ave",
      ref: null,
      bearing: 85,
      snap_distance_m: 4,
      snapped_lat: 39.71466,
      snapped_lng: -104.94071,
      tags: {
        oneway: null,
        maxspeed: "30 mph",
        lanes: "2",
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
        highway: "residential",
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
      detectedLanesTotal: 2,
      detectedOneway: false,
      fields: {
        speed: { value: 30, confidence: "high", source: "maxspeed", method: "measured" },
        lanes: { value: 2, confidence: "medium", source: "lanes", method: "measured" },
        roadType: {
          value: "rural_undivided",
          confidence: roadTypeMethod === "measured" ? "high" : "low",
          source: "highway",
          method: roadTypeMethod,
        },
        divided: {
          value: false,
          confidence: dividedMethod === "measured" ? "high" : "low",
          source: "highway",
          method: dividedMethod,
        },
      },
    },
    method: "operator_pick",
    pinLat: 39.71466,
    pinLng: -104.94071,
  } as unknown as ConfirmedRoad;
}

function scenario(rt: Method, dv: Method): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    lanes: 2,
    roadType: "rural_undivided",
    divided: false,
    // detection's relay as it left it — so the lanes row is in its normal
    // state here and not in #275's cleared-relay state
    detectedLanesTotal: 2,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.71466,
      lng: -104.94071,
      bearingDeg: 85,
      confirmedRoad: road(rt, dv),
    },
  } as Scenario;
}

/** The detected cell of a named row. */
function detectedCell(label: string): HTMLElement {
  const rows = Array.from(document.querySelectorAll(".dva-grid > .contents")).filter(
    (e) => !e.classList.contains("dva-head"),
  );
  const row = rows.find((r) => r.children[0]?.textContent?.trim() === label);
  if (!row) throw new Error(`no row labelled "${label}"`);
  return row.children[1] as HTMLElement;
}

describe("#274 inferred must not look like measured", () => {
  it("an inferred road type says so, in the picker's own words", () => {
    render(<DetectedVsApplied scenario={scenario("inferred", "measured")} />);
    expect(detectedCell("Road type").textContent).toMatch(/OSM · inferred/);
  });

  it("a measured road type says that instead — the row is marked in BOTH states", () => {
    render(<DetectedVsApplied scenario={scenario("measured", "measured")} />);
    const cell = detectedCell("Road type");
    expect(cell.textContent).toMatch(/OSM · measured/);
    expect(cell.textContent).not.toMatch(/inferred/);
  });

  it("Divided carries its own method, independently of Road type", () => {
    render(<DetectedVsApplied scenario={scenario("measured", "inferred")} />);
    expect(detectedCell("Road type").textContent).toMatch(/OSM · measured/);
    expect(detectedCell("Divided").textContent).toMatch(/OSM · inferred/);
  });

  it("the rows that are measured by construction carry NO marker", () => {
    render(<DetectedVsApplied scenario={scenario("inferred", "inferred")} />);
    for (const label of ["Bearing", "Speed limit", "Lanes per direction"]) {
      const cell = detectedCell(label);
      // no METHOD marker; #275's note is a different provenance line and
      // is asserted by its own suite.
      expect(cell.textContent, `${label} must carry no method marker`).not.toMatch(
        /OSM ·/,
      );
    }
  });

  it("the marker is a word, not a colour (Rule 13 / P9)", () => {
    render(<DetectedVsApplied scenario={scenario("inferred", "measured")} />);
    const marker = detectedCell("Road type").querySelector(".tr-prov")!;
    // the distinguishing channel is the text itself
    expect(marker.textContent!.trim()).toBe("OSM · inferred");
    // the tone is reinforcement, and it is the picker's existing warn token
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");
    const at = css.indexOf(".workbench .dva .dva-val .tr-prov.is-inferred");
    expect(at, "the inferred tone is declared").toBeGreaterThan(-1);
    const body = css.slice(css.indexOf("{", at), css.indexOf("}", at));
    expect(body).toMatch(/color:\s*var\(--warn\)/);
    // and it declares no size of its own — it is the provenance ROLE
    expect(body).not.toMatch(/font-size/);
  });

  it("the marker rides the provenance role, not a new one", () => {
    render(<DetectedVsApplied scenario={scenario("inferred", "inferred")} />);
    const marker = detectedCell("Divided").querySelector(".tr-prov");
    expect(marker, "the method marker IS the provenance role").not.toBeNull();
  });
});
