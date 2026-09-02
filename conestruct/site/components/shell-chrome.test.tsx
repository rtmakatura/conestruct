// @vitest-environment happy-dom
//
// s2-arc14 style contracts for the shell chrome (#231 #232 #233).  The
// three fixes are CSS-only (plus one ``title`` attribute), so the
// contract is asserted on the stylesheet text and the class hooks the
// components carry — the geometry itself (headings landing under the
// nav, no text under a frame edge, one-row rail) is measured in the
// browser by the arc's live check, not here.
//
//   #231  a single --nav-h token; the nav is sized by it; every scroll
//         target (.zone, FieldGroup anchor headers) carries a
//         scroll-margin-top built from it so ``block: "start"`` lands
//         the heading clear of the sticky nav + rail.
//   #232  the rail parks under the nav (sticky top = --nav-h, not 0);
//         the frame keeps left/right rules + four ticks, no bottom rule.
//   #233  the rail's owning entry can grow and shrink; the blocker
//         string elides (nowrap + ellipsis) and carries the full string
//         as ``title``; rail gap/padding tightened.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FieldGroup } from "./GeneratorFormPrimitives";
import { ProgressRail } from "./ProgressRail";
import type { Rail } from "@/lib/scenarios/rail";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");
const nav = readFileSync(join(__dirname, "AppNav.tsx"), "utf-8");

/** The declarations of the FIRST rule whose selector line is exactly
 *  ``selector`` (the stylesheet has one rule per selector here). */
function rule(selector: string): string {
  const i = css.indexOf(selector + " {");
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  const j = css.indexOf("}", i);
  return css.slice(i + selector.length + 2, j);
}

afterEach(cleanup);

describe("#231 — one nav-height token drives the scroll targets", () => {
  it("the workbench defines --nav-h and --rail-h", () => {
    expect(rule(".workbench")).toMatch(/--nav-h:\s*52px/);
    expect(rule(".workbench")).toMatch(/--rail-h:\s*38px/);
  });
  it("the nav's height is the token, not a literal", () => {
    expect(nav).toContain("h-[var(--nav-h)]");
    expect(nav).not.toContain("h-[52px]");
  });
  it(".zone and the jump anchors carry scroll-margin-top = nav + rail + 8px", () => {
    const margin = /scroll-margin-top:\s*calc\(var\(--nav-h\)\s*\+\s*var\(--rail-h\)\s*\+\s*8px\)/;
    expect(rule(".workbench .zone")).toMatch(margin);
    expect(rule(".workbench .jump-anchor")).toMatch(margin);
  });
  it("FieldGroup's anchored header carries the jump-anchor hook", () => {
    const { container } = render(
      <FieldGroup label="Work" step={4} anchorId="rail-step-work">
        <div />
      </FieldGroup>,
    );
    const el = container.querySelector("#rail-step-work");
    expect(el?.className).toContain("jump-anchor");
  });
});

describe("#232 — three-sided frame, rail under the nav", () => {
  it("the rail sticks at --nav-h", () => {
    expect(rule(".workbench .setup-panel .progress-rail")).toMatch(/top:\s*var\(--nav-h\)/);
  });
  it("the frame has no bottom rule and keeps its four ticks", () => {
    expect(rule(".workbench-frame")).toMatch(/border-bottom:\s*none/);
    for (const t of ["tl", "tr", "bl", "br"]) {
      expect(css).toContain(`.workbench-frame .ftick.${t} {`);
    }
  });
});

const RAIL: Rail = {
  entries: [
    {
      id: "location",
      label: "Location",
      anchorId: "rail-step-location",
      state: "pending",
      issues: [],
      step: 2,
      glyph: "◌",
      word: "pending",
      info: null,
      aria: "Location — pending (current blocker)",
    },
  ],
  blocker: {
    message: "Set a location first — pick on map or enter manually.",
    entryId: "location",
  },
};

describe("#233 — the rail stays one row; the blocker elides, never re-words", () => {
  it("rail chrome tightened: gap 2px 10px, padding 8px 16px", () => {
    const r = rule(".workbench .setup-panel .progress-rail");
    expect(r).toMatch(/gap:\s*2px 10px/);
    expect(r).toMatch(/padding:\s*8px 16px/);
  });
  it("the owning entry grows and shrinks; the blocker elides", () => {
    expect(rule(".workbench .progress-rail .rail-entry.current")).toMatch(
      /flex:\s*1 1 0;\s*min-width:\s*0/,
    );
    const b = rule(".workbench .progress-rail .rail-blocker");
    expect(b).toMatch(/white-space:\s*nowrap/);
    expect(b).toMatch(/overflow:\s*hidden/);
    expect(b).toMatch(/text-overflow:\s*ellipsis/);
    expect(b).toMatch(/flex:\s*1 1 auto;[\s\S]*min-width:\s*0/);
  });
  it("the blocker span carries the full string as title; textContent unchanged", () => {
    const { container } = render(<ProgressRail rail={RAIL} generateAnchorId="gen" />);
    const b = container.querySelector(".rail-blocker");
    expect(b?.textContent).toBe(RAIL.blocker!.message);
    expect(b?.getAttribute("title")).toBe(RAIL.blocker!.message);
  });
});
