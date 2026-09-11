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

/** One ledger row, by its label. */
function ledgerRow(label: string): HTMLElement {
  const rows = Array.from(document.querySelectorAll(".dva-row"));
  const row = rows.find(
    (r) => r.querySelector(".tr-field")?.textContent?.trim() === label,
  );
  if (!row) throw new Error(`no row labelled "${label}"`);
  return row as HTMLElement;
}

/** That row's provenance clause — line 2, one text node. */
function clause(label: string): string {
  return ledgerRow(label)
    .querySelector(".dva-clause .tr-prov")!
    .textContent!.trim();
}

describe("#274 inferred must not look like measured", () => {
  it("an inferred road type says so, in the picker's own words", () => {
    render(<DetectedVsApplied scenario={scenario("inferred", "measured")} />);
    expect(clause("Road type")).toMatch(/· inferred/);
  });

  it("a measured road type says that instead — the row is marked in BOTH states", () => {
    render(<DetectedVsApplied scenario={scenario("measured", "measured")} />);
    expect(clause("Road type")).toMatch(/· measured/);
    expect(clause("Road type")).not.toMatch(/inferred/);
  });

  it("Divided carries its own method, independently of Road type", () => {
    render(<DetectedVsApplied scenario={scenario("measured", "inferred")} />);
    expect(clause("Road type")).toMatch(/· measured/);
    expect(clause("Divided")).toMatch(/· inferred/);
  });

  it("the rows measured by construction carry no method — and SAY the absence", () => {
    render(<DetectedVsApplied scenario={scenario("inferred", "inferred")} />);
    for (const label of ["Bearing", "Speed limit", "Lanes per direction"]) {
      const c = clause(label);
      expect(c, `${label} must carry no method`).not.toMatch(/measured|inferred/);
      // Rule 10: the absence is stated, never left as a gap the reader
      // has to interpret.
      expect(c, `${label} must say the absence`).toMatch(/no source tag/);
    }
  });

  it("the marker is a word, not a colour (Rule 13 / P9)", () => {
    render(<DetectedVsApplied scenario={scenario("inferred", "measured")} />);
    // the distinguishing channel is the text itself
    expect(clause("Road type")).toMatch(/inferred/);
    // the tone is reinforcement, and it is the picker's existing warn token
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");
    const at = css.indexOf(".workbench .dva .dva-clause .tr-prov.is-amber");
    expect(at, "the amber clause tone is declared").toBeGreaterThan(-1);
    const body = css.slice(css.indexOf("{", at), css.indexOf("}", at));
    expect(body).toMatch(/color:\s*var\(--warn\)/);
    // and it declares no size of its own — it is the provenance ROLE
    expect(body).not.toMatch(/font-size/);
  });

  it("the clause rides the provenance role, not a new one", () => {
    render(<DetectedVsApplied scenario={scenario("inferred", "inferred")} />);
    expect(
      ledgerRow("Divided").querySelector(".dva-clause .tr-prov"),
      "the clause IS the provenance role",
    ).not.toBeNull();
  });

  it("spec 5.4: a MATCHING row whose detection was inferred is green glyph, amber clause", () => {
    // Two facts, honestly separated: the plan used what was detected
    // (green), and what was detected was a guess (amber).  Green never
    // means measured.  Contrast measured on the block's own background:
    // --pass 8.1:1, --warn 8.82:1.
    render(<DetectedVsApplied scenario={scenario("inferred", "measured")} />);
    const row = ledgerRow("Road type");
    expect(row.querySelector(".dva-glyph")!.className).toMatch(/is-match/);
    expect(row.querySelector(".dva-clause .tr-prov")!.className).toMatch(/is-amber/);
    // and a measured, matching row is NOT ambered
    cleanup();
    render(<DetectedVsApplied scenario={scenario("measured", "measured")} />);
    expect(
      ledgerRow("Road type").querySelector(".dva-clause .tr-prov")!.className,
    ).not.toMatch(/is-amber/);
  });
});
