// @vitest-environment happy-dom
//
// #273 — the block's layout contract.  Two halves, because the defect has
// two halves and only one of them is testable in a DOM without layout:
//
//   * the DOM half (here): every cell in a value column carries the same
//     alignment token as the header above it, and the header row is a real
//     row wrapper so it can re-flow with the value rows when stacked.
//   * the GEOMETRY half: header ink right == value ink right (±1) on a
//     DIVERGENT-value fixture at 1440x1000 and 380x800, and the label edge
//     does not move when a value changes.  happy-dom has no layout engine,
//     so that half is proved by the browser leg
//     (validation-artifacts/committed/s2-arc29-detected-applied), NOT here.
//     Rule 11: test where the bug lives.
//
// The CSS block below is asserted by parsing globals.css — the same
// technique the #263 census uses — because the track model IS the fix and a
// class-only assertion would pass over a stylesheet that still says `auto`.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import type { ConfirmedRoad } from "@/lib/road-detection/types";
import { DetectedVsApplied } from "./DetectedVsApplied";

afterEach(cleanup);

function confirmedRoad(): ConfirmedRoad {
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
        lanes: "2",
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
      roadType: "urban_arterial",
      divided: false,
      lanesPerDirection: 2,
      speedLimitMph: 30,
      laneWidthFt: 11,
      confidence: "high",
      rationale: "test",
      detectedLanesTotal: 2,
      detectedLanesForward: undefined,
      detectedLanesBackward: undefined,
      detectedLanesBothWays: undefined,
      detectedOneway: false,
      fields: {
        speed: { value: 30, confidence: "high", source: "maxspeed", method: "measured" },
        lanes: { value: 2, confidence: "medium", source: "lanes", method: "measured" },
        roadType: { value: "urban_arterial", confidence: "high", source: "highway", method: "measured" },
        divided: { value: false, confidence: "high", source: "highway", method: "measured" },
      },
    },
    method: "operator_pick",
    pinLat: 39.71466,
    pinLng: -104.94071,
  } as unknown as ConfirmedRoad;
}

function pinnedShoulder(): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    speed: 30,
    lanes: 2,
    roadType: "urban_arterial",
    divided: false,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      lat: 39.71466,
      lng: -104.94071,
      bearingDeg: 90,
      confirmedRoad: confirmedRoad(),
    },
  } as Scenario;
}

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");

// The declaration block of a selector, as written in globals.css.
function ruleBody(selector: string, from = 0): string {
  const at = css.indexOf(selector, from);
  if (at === -1) return "";
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("s2-arc30 — the ledger's layout contract", () => {
  // RETIRED with the two-column table, and recorded rather than deleted
  // in silence: "both value tracks are one fixed width", "--dva-val is
  // declared once", "headers take their column's alignment", "the header
  // row is a row wrapper", "one register per column", "every value cell
  // carries the same alignment token as its header", and the 520 STACK.
  // They described a grid that no longer exists.  #273's OUTCOME — the
  // applied values share one right edge — is asserted below, obtained
  // now from the row body's full width rather than from a pinned track.

  it("the old two-column geometry is gone, not merely unused", () => {
    expect(css).not.toMatch(/--dva-val/);
    expect(css).not.toMatch(/\.dva-grid/);
    expect(css).not.toMatch(/\.dva-head/);
    expect(css).not.toMatch(/\.dva-slot/);
    render(<DetectedVsApplied scenario={pinnedShoulder()} />);
    expect(document.querySelector(".dva-grid")).toBeNull();
    expect(document.querySelector(".dva-head")).toBeNull();
  });

  it("a row is a 16 px glyph gutter plus a body, and the gutter is the shared token", () => {
    const body = ruleBody(".workbench .dva .dva-row");
    const tracks = /grid-template-columns:\s*([^;]+);/.exec(body)?.[1].trim();
    expect(tracks).toBeTruthy();
    // --glyph-cell is #227's declared 16 px, not a local number
    expect(tracks).toMatch(/var\(--glyph-cell\)/);
    expect(tracks).toMatch(/minmax\(\s*0\s*,\s*1fr\s*\)/);
  });

  it("the gutter gap is PINNED at 6 px — the measured fit, not a taste", () => {
    // At gap 8 the worst MATCH clause (236.8 px) exceeds the 236 px left
    // to it and wraps by 0.8 px — on every row of the dominant flow.
    // At 6 it clears by 1.2 px.  Measured prod b2a325a at 380.
    const body = ruleBody(".workbench .dva .dva-row");
    expect(body).toMatch(/column-gap:\s*6px/);
  });

  it("the block keeps 10 px sides: spec 8.6's 14 would undo the gap's fit", () => {
    // content 260 → 252 at 14 px, which takes the clause from 238 px to
    // 230 against a 236.8 px worst MATCH.  Measured; ruled 2026-09-11.
    const body = ruleBody(".workbench .dva {");
    expect(body).toMatch(/padding:\s*8px\s+10px/);
  });

  it("the clause slot is RESERVED, so a row's height is the viewport's property", () => {
    // one line at/above 520 px, two below.  min-height rather than
    // height: inside the measured domain nothing exceeds the reserve at
    // any width >= 380, and if it ever did it must WRAP, never be
    // clipped (spec 8.2 — nothing truncated at any width).
    const body = ruleBody(".workbench .dva .dva-clause");
    expect(body).toMatch(/min-height:\s*16px/);
    expect(body).not.toMatch(/(^|[^-])height:\s*\d/);
    const at = css.indexOf("@media (max-width: 519.98px)");
    expect(at, "the 520 switch is declared").toBeGreaterThan(-1);
    const narrow = css.slice(at, at + 400);
    expect(narrow).toMatch(/\.dva-clause/);
    expect(narrow).toMatch(/min-height:\s*32px/);
  });

  it("the applied value holds the right axis even when line 1 wraps", () => {
    // Under `justify-content: space-between` a wrapped value is the only
    // item on its line and lands at flex-START — measured 72.8 to
    // 122.4 px off the axis on the six label x value pairs that wrap at
    // 380 (of 66 in the domain).  `margin-left: auto` returns every one
    // of them to 0.0 px.
    const line = ruleBody(".workbench .dva .dva-line1");
    expect(line).not.toMatch(/justify-content:\s*space-between/);
    const val = ruleBody(".workbench .dva .dva-val");
    expect(val).toMatch(/margin-left:\s*auto/);
    expect(val).toMatch(/text-align:\s*right/);
  });

  it("the row padding is the measured 4/3, not the spec's 9/8", () => {
    // 9/8 put the block at 386 px at 1440 (+109.6 on today's 276.4);
    // 4/3 puts it at 336 (+59.6), with 7 px / 6 px ink gaps — exactly
    // .fact-strip .fact-cell's measured rhythm on this same panel.
    expect(ruleBody(".workbench .dva .dva-row")).toMatch(/padding:\s*4px\s+0\s+3px/);
  });

  it("one hairline above the caveat, not two (spec 7.4)", () => {
    expect(ruleBody(".workbench .dva .dva-row:last-child")).toMatch(
      /border-bottom:\s*0/,
    );
    expect(ruleBody(".workbench .dva .dva-caveat")).toMatch(/border-top:\s*1px solid/);
  });

  it("every row renders one glyph and one clause — neither without the other (spec 4.6)", () => {
    render(<DetectedVsApplied scenario={pinnedShoulder()} />);
    const rows = Array.from(document.querySelectorAll(".dva-row"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.querySelectorAll(".dva-glyph").length).toBe(1);
      expect(r.querySelectorAll(".dva-clause .tr-prov").length).toBe(1);
      expect(r.querySelector(".dva-clause")!.textContent!.trim().length).toBeGreaterThan(0);
    }
  });

  it("the verdict glyphs are the house vocabulary, each on its own token", () => {
    // ✓ --pass "confirmed", ⚠ --warn "changed / needs attention",
    // ◌ --none "not set — never a verdict".  The design asked for ▲ in
    // #f4c020; ▲ is the delta glyph in --dim (#ff8a2e, orange) here and
    // the design's own rule 0.12 bars orange from this block, so the
    // spec's constraint ruled out the spec's glyph.  No vocabulary
    // change was needed.
    expect(ruleBody(".workbench .dva .dva-glyph.is-match")).toMatch(
      /color:\s*var\(--pass\)/,
    );
    expect(ruleBody(".workbench .dva .dva-glyph.is-differ")).toMatch(
      /color:\s*var\(--warn\)/,
    );
    expect(ruleBody(".workbench .dva .dva-glyph.is-unset")).toMatch(
      /color:\s*var\(--none\)/,
    );
    // never ▲ here, and never the orange it would carry
    expect(css.slice(css.indexOf(".workbench .dva {"), css.indexOf(".workbench .sched-windows"))).not.toMatch(
      /var\(--dim\)/,
    );
  });

  it("no value carries its own size: the register is one named class", () => {
    render(<DetectedVsApplied scenario={pinnedShoulder()} />);
    for (const v of Array.from(document.querySelectorAll(".dva-val"))) {
      expect(v.className).not.toMatch(/text-\[/);
    }
    expect(ruleBody(".workbench .dva .dva-val")).toMatch(/font-size:\s*14px/);
  });

  it("operator-set switches FAMILY only — weight is not an axis", () => {
    const body = ruleBody(".workbench .dva .dva-val.is-operator");
    expect(body).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(body).not.toMatch(/font-weight/);
    expect(body).not.toMatch(/font-size/);
    expect(body).not.toMatch(/color/);
  });
});
