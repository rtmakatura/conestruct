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

describe("#273 the block's layout contract", () => {
  it("both value tracks are one fixed width, so no value can resize a track or move the label edge", () => {
    const body = ruleBody(".workbench .dva .dva-grid");
    const tracks = /grid-template-columns:\s*([^;]+);/.exec(body)?.[1].trim();
    expect(tracks, "the .dva-grid track model").toBeTruthy();
    // minmax(0,1fr) label + the SAME custom property twice: one declared
    // width for both value columns, sized to the domain's widest value.
    expect(tracks).toMatch(/minmax\(\s*0\s*,\s*1fr\s*\)/);
    const vals = tracks!.match(/var\(--dva-val\)/g) ?? [];
    expect(vals.length, `both value tracks read var(--dva-val) — got "${tracks}"`).toBe(2);
    // and nothing content-sized survives
    expect(tracks).not.toMatch(/\bauto\b/);
    expect(tracks).not.toMatch(/max-content|min-content|fit-content/);
  });

  it("--dva-val is declared once, in px, as a stated width", () => {
    expect(css).toMatch(/--dva-val:\s*\d+px/);
  });

  it("headers take their column's alignment (right), scoped to the block", () => {
    const body = ruleBody(".workbench .dva .tr-step");
    expect(body, "a .dva-scoped .tr-step rule must exist").not.toBe("");
    expect(body).toMatch(/text-align:\s*right/);
  });

  it("below the measured threshold the block stacks: label on its own row, two equal value cells", () => {
    // 520px: measured content width is viewport-120 in the narrow regime, so
    // a 90px label floor plus two 132px tracks and two 14px gaps needs
    // >= 502px.  Pinned at 520 with margin (s2a29-threshold.js).
    const at = css.indexOf("@media (max-width: 520px)");
    expect(at, "a 520px stack breakpoint must exist").toBeGreaterThan(-1);
    const region = css.slice(at, at + 1400);
    expect(region).toMatch(/\.dva/);
    // the row wrapper stops being display:contents so it can pair its cells
    expect(region).toMatch(/grid-template-columns:\s*1fr\s+1fr/);
    // and the label spans the full width above them
    expect(region).toMatch(/grid-column:\s*1\s*\/\s*-1/);
  });

  it("the header row is a row wrapper, so it re-flows with the value rows", () => {
    render(<DetectedVsApplied scenario={pinnedShoulder()} />);
    const grid = document.querySelector(".dva-grid")!;
    const head = grid.querySelector(".dva-head");
    expect(head, "the three header cells sit in their own wrapper").not.toBeNull();
    // the spacer is addressable (it must be hidden when stacked)
    expect(head!.querySelector(".dva-corner")).not.toBeNull();
    const heads = Array.from(head!.querySelectorAll(".tr-step")).map((e) => e.textContent);
    expect(heads).toEqual(["Detected", "Applied"]);
    // every row wrapper is a sibling of the header wrapper, same grid
    const wrappers = Array.from(grid.children).filter((e) =>
      e.classList.contains("contents"),
    );
    expect(wrappers.length).toBeGreaterThanOrEqual(2);
    expect(wrappers[0]).toBe(head);
  });

  it("no value cell declares its own size: the block's value register is one named class", () => {
    const tsx = readFileSync(
      join(process.cwd(), "components", "DetectedVsApplied.tsx"),
      "utf-8",
    );
    // the two ad-hoc Tailwind sizes were the #263 declared debt row
    expect(tsx).not.toMatch(/text-\[11px\]/);
    // and the raw Tailwind white is off the token system (P11)
    expect(tsx).not.toMatch(/text-white/);
    const body = ruleBody(".workbench .dva .dva-val");
    expect(body, "one declared value register").not.toBe("");
    // The size stays 11px — the size it already rendered, so no visual
    // change — but it is stated once, in one place, instead of twice as an
    // inline utility.  Ruled 2026-09-11: 11px is a declared #263
    // EXCEPTION, not debt and not a fifth `tr-*` role (the #226 table is a
    // LABEL vocabulary; a value register is not a label).
    expect(body).toMatch(/font-size:\s*11px/);
    const decl = readFileSync(
      join(process.cwd(), "lib", "design", "type-exceptions.ts"),
      "utf-8",
    );
    expect(decl).toMatch(/\.workbench \.dva \.dva-val/);
    expect(decl, "the register is a named exception").toMatch(
      /name: "detected-vs-applied value register"/,
    );
    // and the debt row it replaced is gone, in both of its forms
    expect(decl, "no Tailwind debt row survives").not.toMatch(
      /file: "components\/DetectedVsApplied\.tsx"/,
    );
    expect(decl, "no interim debt owner survives").not.toMatch(/ruling needed —/);
  });

  it("one register per column — same size and weight, ink is the only axis", () => {
    render(<DetectedVsApplied scenario={pinnedShoulder()} />);
    const det = document.querySelectorAll(".dva-val.is-detected");
    const app = document.querySelectorAll(".dva-val.is-applied");
    expect(det.length).toBeGreaterThan(0);
    expect(det.length).toBe(app.length);
    // the two registers are declared once each, and differ only in colour
    const d = ruleBody(".workbench .dva .dva-val.is-detected");
    const a = ruleBody(".workbench .dva .dva-val.is-applied");
    expect(d).toMatch(/color:\s*var\(--ink-on-dark-faint\)/);
    expect(a).toMatch(/color:\s*var\(--ink-bright\)/);
    for (const decl of [/font-size/, /font-weight/, /font-family/]) {
      expect(d, "size/weight/family belong to the shared register").not.toMatch(decl);
      expect(a, "size/weight/family belong to the shared register").not.toMatch(decl);
    }
  });

  it("every value cell carries the same alignment token as its header", () => {
    render(<DetectedVsApplied scenario={pinnedShoulder()} />);
    const grid = document.querySelector(".dva-grid")!;
    const rows = Array.from(grid.children).filter(
      (e) => e.classList.contains("contents") && !e.classList.contains("dva-head"),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const cells = Array.from(r.children);
      expect(cells.length).toBe(3);
      // cells[0] is the label; 1 and 2 are the value columns
      for (const c of cells.slice(1)) {
        // alignment and numerals now ride the declared register, not
        // per-span utilities — the register is asserted against the
        // stylesheet above.
        expect(
          c.className,
          `value cell "${c.textContent}" must carry the value register`,
        ).toMatch(/\bdva-val\b/);
      }
      const regBody = ruleBody(".workbench .dva .dva-val");
      expect(regBody).toMatch(/text-align:\s*right/);
      expect(regBody).toMatch(/font-variant-numeric:\s*tabular-nums/);
    }
  });
});
