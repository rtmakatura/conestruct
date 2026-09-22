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
  it(".status-slot reserves the strip's height and owns the gap — 18 px since #289 Phase 2; the strip's margin is zero inside it", () => {
    const slot = rule(".workbench .status-slot");
    expect(slot).toMatch(/min-height:\s*var\(--status-h\)/);
    // #289 Phase 2 — 24 -> 18.  The slot still OWNS the gap, which is
    // what #250 f2 was protecting; the figure is now Part 2 rule 26's
    // ("18 px between the verdict strip and the first band") instead of
    // a number that predated Part 2.  The strip moved above the band
    // stack in the same commit (Part 1 §1.2's source order), so the gap
    // it owns is the one rule 26 names.
    expect(slot).toMatch(/margin-bottom:\s*18px/);
    expect(rule(".workbench .status-slot > .status-bar,\n.workbench .status-slot > .status-details")).toMatch(
      /margin-bottom:\s*0/,
    );
  });
});

// #288 rule 28 (was #240) — the second reserved slot.  It reserved
// --strip-h, the next-steps strip's MEASURED height (#253: 81.19 at 1440
// -> 82 pinned; 192 stacked in the <=480 query).  Part 1 8.29 dropped the
// strip, so the measurement died with it and the reserve is now
// --fact-min-h (#289 R9 renamed it to what it is — a row FLOOR):
// rule 56's 44 px fact line, a RULE not a measurement, the same at both
// widths.  The slot still owns the 14 px gap, so its height is the same
// whether its occupant is built yet or not.
describe("#288 — the results stack's reserved first row", () => {
  it("the workbench defines --fact-min-h: 48px with no <=480 override", () => {
    // Ryan's hand-check at f44377e made the slot a Phase 1 DEVIATION: it
    // reserved 44 px for Phase 2's setup fact line, so in Phase 1 it was
    // an empty box preventing no movement.  The RULE is gone; the TOKEN
    // stays, declared ahead of its surface in #283's idiom, and Phase 2's
    // fact line reads it when the slot returns.
    // #289 R9 (ruled 2026-09-22): the token is a FLOOR and its name says
    // so, and 48 px is rule 56's own arithmetic — 13 px padding twice plus
    // rule 8's 13.5/1.45 line box plus two borders is 47.58, and the
    // shortest renderable row measures 45.50.  The line it reserves for is
    // rule 119's setup string, which wraps to 60.00 px at 1440 and 130.63
    // at 380 with #281's own example, so a fixed height would reserve the
    // wrong amount and the results would still shift at the settle.
    // Measured in validation-artifacts/committed/issue-289-band-stack/
    // prototype/band-stack-landing.md.
    expect(rule(".workbench")).toMatch(/--fact-min-h:\s*48px/);
    // Several <=480 queries in the sheet (C's idiom above): NONE
    // re-declares the floor, because rule 56 does not vary by viewport.
    const blocks = css
      .split("@media (max-width: 480px) {")
      .slice(1)
      .map((b) => b.slice(0, b.indexOf("\n}\n")));
    expect(blocks.some((b) => /--fact-min-h\s*:/.test(b))).toBe(false);
    // #289 Phase 2: the slot's rule returns with its occupant — the
    // setup fact line (rule 119) — which is what Phase 1's recorded
    // deviation said would happen.  Asserted in
    // components/results-slot-tokens.test.tsx, which owns the slot.
  });
});

// #289 Phase 2 — #232's and #233's rail blocks RETIRE WITH THE RAIL.
//
// §8.17: "Progress rail — replaced, per step, by the move ledger inside
// the open band, and by the pending fact lines for steps not yet
// reached."  Both describes below asserted geometry of a component that
// no longer exists:
//
//   #232 "the rail sticks at --nav-h" — nothing sticks any more.  Rule 32
//        allows no sticky element except the nav, and `--pin-h` is what
//        carried the rail's budget into every scroll target; it stays
//        declared and is asserted above, because the token is what the
//        landing reads.
//   #233 "the rail stays one row; the blocker elides, never re-words" —
//        the blocker's one-row elision was a property of a 38 px sticky
//        strip.  The blocker string itself is unchanged and
//        single-sourced (rule 139): it renders on the verdict strip and
//        on the disabled primary's `title` + `cta-reason` alert, and
//        `GeneratorFormPrimitives.GenerateButton` — which the GENERATE
//        band mounts unchanged — is where that is asserted.
//
// Kept rather than deleted silently, because "the rail sticks" going
// quiet is exactly the kind of absence a suite is supposed to notice.

