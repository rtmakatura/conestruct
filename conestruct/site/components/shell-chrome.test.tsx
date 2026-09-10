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

// Line endings normalised: the checkout may carry CRLF (core.autocrlf).
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
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
  // #250 (c): the budget for the pinned chrome is a token, --pin-h — the
  // rail's height while the rail is mounted (pre-generate: 98 unchanged),
  // 0 once the lifecycle leaves "pre" (the rail unmounts with the
  // sidebar; the old formula kept budgeting it, and the landing depended
  // on Chrome's scroll anchoring to make up the difference).
  it(".zone and the jump anchors carry scroll-margin-top = nav + pin + 8px; --pin-h is the rail pre-generate and 0 after", () => {
    const margin = /scroll-margin-top:\s*calc\(var\(--nav-h\)\s*\+\s*var\(--pin-h\)\s*\+\s*8px\)/;
    expect(rule(".workbench .zone")).toMatch(margin);
    expect(rule(".workbench .jump-anchor")).toMatch(margin);
    expect(rule(".workbench")).toMatch(/--pin-h:\s*var\(--rail-h\)/);
    expect(rule('.workbench:not([data-stage="pre"])')).toMatch(/--pin-h:\s*0px/);
  });
  // validation-artifacts/committed/s2-arc26-landing/GO-rulings.md — the
  // s2-batch-1 GO cross-bucket ruling 1 (Ryan, 2026-09-09): "Post-generate
  // landing target = 136 ±1
  // (calc(var(--nav-h) + 8px + var(--status-h) + 24px)), not 98.
  // Reason: 98 puts the verdict strip at 22..74, under the nav."  The
  // strip sits ABOVE the results zone in the DOM, so the zone's own
  // scroll-margin budgets it: 52 + 8 + 52 + 24 = 136, the strip at 60..112.
  it("post-generate the results zone lands at nav + 8 + status-h + 24 (= 136, ruling 1)", () => {
    expect(rule('.workbench:not([data-stage="pre"]) .zone.results')).toMatch(
      /scroll-margin-top:\s*calc\(var\(--nav-h\)\s*\+\s*8px\s*\+\s*var\(--status-h\)\s*\+\s*24px\)/,
    );
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

// #250 (option f2) — the verdict strip's room is reserved before the
// answer lands: one token for the strip's pill-state height (52 at
// 1440, 70 in the ≤480 query — both MEASURED on the dev server at
// 224feb9: 51.59 / 69.19 with the pill, 46.8 / 67.59 without; the slot
// takes the taller so nothing below moves at the first verdict), and
// the live wrapper (``.status-slot``) carries it plus the 24 px gap the
// strip used to own.  The strip's own margin is zeroed INSIDE the slot
// (a non-zero min-height stops the child margin collapsing through, so
// the gap would otherwise double).
describe("#250 f2 — the verdict strip's reserved slot", () => {
  it("the workbench defines --status-h: 52px and pins 70px in the ≤480 query", () => {
    expect(rule(".workbench")).toMatch(/--status-h:\s*52px/);
    // The sheet carries several ≤480 queries (bucket C added two, #225 /
    // #261); the pin is that ONE of them re-declares --status-h on .workbench.
    const blocks = css
      .split("@media (max-width: 480px) {")
      .slice(1)
      .map((b) => b.slice(0, b.indexOf("\n}\n")));
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((b) => /\.workbench \{[^}]*--status-h:\s*70px/.test(b))).toBe(true);
  });
  // #260 (3): the strip itself takes the token too — one height across
  // AWAITING → VERIFYING → INVALID → VERIFIED (47 → 52 at 1440 before;
  // F-S1-4), not just the room around it.
  it("#260: .status-bar carries min-height: var(--status-h) — one height across the pre-generate states", () => {
    expect(rule(".workbench .status-bar")).toMatch(/min-height:\s*var\(--status-h\)/);
  });
  it(".status-slot reserves the strip's height and owns the 24 px gap; the strip's margin is zero inside it", () => {
    const slot = rule(".workbench .status-slot");
    expect(slot).toMatch(/min-height:\s*var\(--status-h\)/);
    expect(slot).toMatch(/margin-bottom:\s*24px/);
    expect(rule(".workbench .status-slot > .status-bar,\n.workbench .status-slot > .status-details")).toMatch(
      /margin-bottom:\s*0/,
    );
  });
});

// #240 — the second reserved slot: the results head.  --strip-h is the
// lockup's MEASURED height (37.19 on the dev server at 224feb9 → 38;
// #253's strip takes the token over when it lands) and the slot owns
// the 14 px gap the lockup used to carry (mb-3.5), so the slot's height
// is the same whether the lockup is in it or not.
describe("#240 — the results-head slot", () => {
  it("the workbench defines --strip-h: 38px; .results-head-slot reserves it and owns the gap", () => {
    expect(rule(".workbench")).toMatch(/--strip-h:\s*38px/);
    const slot = rule(".workbench .results-head-slot");
    expect(slot).toMatch(/min-height:\s*var\(--strip-h\)/);
    expect(slot).toMatch(/margin-bottom:\s*14px/);
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
