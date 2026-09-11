// @vitest-environment happy-dom
//
// The ledger's CLAUSE CONTENT (s2-arc30).  This file was the reserved-slot
// suite; the slot it asserted is gone with the two-column table, and what
// survives of it is here in the shape the clause gives it.
//
// RETIRED, and recorded rather than dropped in silence:
//   D1  "the provenance slot is reserved in every value cell" — there are
//       no value cells now.  Its CONTENT survives as the reserved clause
//       line, asserted in the layout suite (min-height 16/32 px), and its
//       purpose survives whole: a row's height still never depends on
//       whether it carries a token.
//   D3  "the header declares its column's extent" — there is no header
//       row and no column to declare.
//
// D2 survives and is the heart of the file: the applied value states
// where IT came from.  Under the clause it no longer needs a second
// token slot — a matching row simply carries no applied fragment,
// because `OSM · <value> · <token>` already says the plan used what was
// detected.  The moment the plan's value differs, the clause says who
// changed it, and s2-arc30 splits that in two: `operator-set` for an
// edit, `changed in plan` for auto-apply's own domain snap, which is
// nobody's edit at all.
//
// D4 survives as the grammar: one clause per row, at most one token per
// side, and no empty fragment in the join.

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

function ledgerRow(label: string): HTMLElement {
  const rows = Array.from(document.querySelectorAll(".dva-row"));
  const row = rows.find(
    (r) => r.querySelector(".tr-field")?.textContent?.trim() === label,
  );
  if (!row) throw new Error(`no row "${label}"`);
  return row as HTMLElement;
}
const clauseOf = (label: string) =>
  ledgerRow(label).querySelector(".dva-clause .tr-prov")!.textContent!.trim();
const glyphOf = (label: string) =>
  ledgerRow(label).querySelector(".dva-glyph")!;

/** A scenario whose DETECTED speed differs from the fixture's. */
function withSpeeds(detected: number, applied: number): Scenario {
  const r = road();
  return matched({
    speed: applied,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.71466,
      lng: -104.94071,
      bearingDeg: 85,
      confirmedRoad: {
        ...r,
        classification: { ...r.classification, speedLimitMph: detected },
      },
    },
  } as unknown as Partial<Scenario>);
}

describe("D2 — the clause states where the APPLIED value came from", () => {
  it("while the plan shows the detected value, the clause carries no applied token", () => {
    // The row is agreement, and the clause says so by saying nothing
    // extra: `OSM · <value> · <token>` already means the plan used what
    // was detected.
    render(<DetectedVsApplied scenario={matched()} />);
    expect(clauseOf("Road type")).toBe("OSM · Rural — undivided · inferred");
    expect(clauseOf("Road type")).not.toMatch(/operator-set/);
    expect(glyphOf("Road type").className).toMatch(/is-match/);
  });

  it("the clause says operator-set the moment the plan's value differs", () => {
    render(<DetectedVsApplied scenario={matched({ roadType: "urban_arterial" })} />);
    expect(clauseOf("Road type")).toMatch(/· operator-set$/);
    // the detected value is still named — the ruling against
    // "same as detected" cuts both ways: the clause always says what
    // detection found
    expect(clauseOf("Road type")).toMatch(/Rural — undivided/);
    expect(glyphOf("Road type").className).toMatch(/is-differ/);
  });

  it("a domain snap says `changed in plan`, not `operator-set`", () => {
    // auto-apply rounds the detected speed into the kind's domain
    // (snapSpeedToDomain, auto-apply.ts:381) before the plan sees it, so
    // a plan can differ from detection with nobody having touched
    // anything.  Reporting an operator action that did not happen is a
    // Rule 10 defect.  32 snaps to 30.
    render(<DetectedVsApplied scenario={withSpeeds(32, 30)} />);
    expect(clauseOf("Speed limit")).toMatch(/32 mph/);
    expect(clauseOf("Speed limit")).toMatch(/· changed in plan$/);
    expect(clauseOf("Speed limit")).not.toMatch(/operator-set/);
  });

  it("a difference the snap does NOT explain is still the operator's", () => {
    // 45 is already in the domain and on the 5 mph grid, so a plan
    // reading 30 against it is an edit, not a rounding.
    render(<DetectedVsApplied scenario={withSpeeds(45, 30)} />);
    expect(clauseOf("Speed limit")).toMatch(/· operator-set$/);
  });

  it("the operator-set value switches family, and nothing else", () => {
    render(<DetectedVsApplied scenario={matched({ roadType: "urban_arterial" })} />);
    expect(
      ledgerRow("Road type").querySelector(".dva-val")!.className,
    ).toMatch(/is-operator/);
    // an untouched row does not
    expect(ledgerRow("Divided").querySelector(".dva-val")!.className).not.toMatch(
      /is-operator/,
    );
  });

  it("the two sides are independent: one row inferred-and-agreed, another overridden-and-changed", () => {
    render(
      <DetectedVsApplied
        scenario={matched({
          lanes: 3,
          detectedLanesTotal: undefined,
          detectionOverrides: [
            {
              via: "shoulder_lane_edit",
              detectedLanesTotal: 4,
              asserted: "3 lanes per direction",
            } as DetectionOverride,
          ],
        })}
      />,
    );
    expect(clauseOf("Road type")).toBe("OSM · Rural — undivided · inferred");
    expect(clauseOf("Lanes per direction")).toBe("OSM · 2 · overridden · operator-set");
  });
});

describe("D4 — one clause per row, and its grammar holds", () => {
  it("no row carries two applied tokens, or two detected ones", () => {
    render(
      <DetectedVsApplied
        scenario={matched({
          roadType: "urban_arterial",
          lanes: 3,
          detectedLanesTotal: undefined,
        })}
      />,
    );
    for (const row of Array.from(document.querySelectorAll(".dva-row"))) {
      const text = row.querySelector(".dva-clause")!.textContent!.trim();
      const applied = (text.match(/operator-set|changed in plan/g) ?? []).length;
      const detected = (text.match(/measured|inferred|overridden|withdrawn/g) ?? []).length;
      expect(applied, text).toBeLessThanOrEqual(1);
      expect(detected, text).toBeLessThanOrEqual(1);
      // and no empty fragment anywhere in the join
      expect(text).not.toMatch(/·\s*·/);
    }
  });

  it("Rule 10: a plan that has taken no value is `not set`, not a verdict", () => {
    // ◌ is the house glyph for exactly this, and DESIGN-SPACING says it
    // is never a verdict — so the row reads neither agreement nor
    // disagreement, which is the truth.
    render(
      <DetectedVsApplied
        scenario={matched({
          meta: {
            ...DEFAULT_SHOULDER.meta,
            lat: 39.71466,
            lng: -104.94071,
            bearingDeg: undefined,
            confirmedRoad: road(),
          },
        } as unknown as Partial<Scenario>)}
      />,
    );
    expect(glyphOf("Bearing").className).toMatch(/is-unset/);
    expect(glyphOf("Bearing").textContent).toBe("◌");
    // the clause still names what detection found
    expect(clauseOf("Bearing")).toMatch(/OSM · 85°/);
    // and it claims no applied provenance, because nothing was applied
    expect(clauseOf("Bearing")).not.toMatch(/operator-set|changed in plan/);
  });

  it("the #214 caveat sentence is byte-identical across the rebuild", () => {
    render(<DetectedVsApplied scenario={matched()} />);
    expect(document.querySelector(".dva-caveat")!.textContent).toBe(
      "road geometry governs the drawing — the typed bearing sets the travel-direction sign only",
    );
  });
});
