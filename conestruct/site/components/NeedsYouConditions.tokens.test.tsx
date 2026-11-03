// #288 Phase 1 clause 1 — the moved block's CSS contract.
//
// This file is SetupStrip.corrections-tokens.test.tsx and
// SetupStrip.grid-tokens.test.tsx, MERGED and transferred with the block
// they pin.  happy-dom lays out nothing, so the browser leg proves the
// alignment; this pins the rules the measurement was taken on, so a
// later edit cannot drift to a literal or to the UA's white field.
//
// BYTE-IDENTICAL from the two originals: every #245 picker claim (the
// ghost pair, the act pair, the legend ink, the focusable radio, the
// mirrored glyph slot, the 184 px note reservation, the field-input
// pair), the tier tones (▲ --dim, ✓ --pass, ◌ --none), the staged
// tone, the filled control's wash + --act-bright, the rejected-hex
// sweep, and the band's byte-identical shared rules.  Only the SELECTOR
// changed on those, `.jbar-suggest` → `.needs-you`.
//
// RETIRED with the #249 ledger, and deliberately not re-asserted: the
// two-track grid and its subgrid rows, --sc-row-h, the dotted leader
// (--sc-leader with it), the `.sc-right` group, the `.sc-action` cell,
// `button.ghost` / `.sc-text-btn`, the record's negative margin, and the
// @container query keyed to the block's own width.  Rule 74's three
// tracks and rule 133's `.act` are what the rows wear now, and they are
// pinned below in their place.
//
// #437 branch 3: the dismiss reason picker was deleted in branch 2 and
// its CSS (.reason-chip*, .site-correction-*, .sc-picker*, .ny-foot*) in
// branch 3, so every #245 picker test, the #270 picker sub-row test and
// the scan's .ny-foot claim are DELETED here: they pinned a UI that no
// longer exists.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Line endings normalized: the repo stores LF, Windows checkouts read CRLF.
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

// The moved block alone — the hex sweep is scoped to it.
const moved = css.slice(
  css.indexOf("/* ─── #288 Phase 1 clause 1 — the condition rows inside NEEDS YOU ───"),
  css.indexOf("/* ─── #227 system-event container ───"),
);

function rule(selector: string, from = 0): string {
  const i = css.indexOf(selector + " {", from);
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  const j = css.indexOf("}", i);
  return css.slice(i + selector.length + 2, j);
}

describe("#288 clause 1 — the condition rows inside NEEDS YOU", () => {
  it("the tier tokens ride symbol and word (▲ --warn, ✓ --pass, ◌ --none; the none word stays provenance ink)", () => {
    // #289 fidelity F1: Part 2 rule 18 fixes ▲ at #f4c020 (--warn) —
    // "a symbol never changes hue by context" — superseding --dim here.
    expect(rule(".workbench .needs-you .ny-cond .ny-glyph.sc-detected")).toMatch(/color:\s*var\(--warn\)/);
    expect(rule(".workbench .needs-you .ny-cond .ny-glyph.sc-absent")).toMatch(/color:\s*var\(--pass\)/);
    // #289 fidelity F2: the detected WORD is provenance ink (rule 6) — no
    // rule colours it; the tier's hue is the ▲'s alone (rule 18).
    expect(css).not.toMatch(/\.sc-result\.sc-detected\s*\{/);
    // The absent row's WORD is never green: green lives in the glyph, so
    // five clear rows are not five green claims (spec 24 / K78).
    expect(css).not.toMatch(/\.sc-result\.sc-absent/);
    expect(rule(".workbench .needs-you .sc-evidence")).toMatch(/tabular-nums/);
    // #254: the staged tone is --none on both glyph and word (rule 13:
    // the word rides the glyph, never the hue alone).
    expect(
      rule(".workbench .needs-you .ny-cond .ny-glyph.sc-staged,\n.workbench .needs-you .ny-cond .ny-glyph.sc-unset"),
    ).toMatch(/color:\s*var\(--none\)/);
    expect(
      rule(".workbench .needs-you .sc-result.sc-staged,\n.workbench .needs-you .sc-result.sc-unset"),
    ).toMatch(/color:\s*var\(--none\)/);
  });

  it("the two scoped values that survived the ledger live on the block, not :root; no spec hex leaks in", () => {
    const scope = rule(".workbench .needs-you");
    expect(scope).toMatch(/--sc-act-wash:\s*rgba\(52, 169, 232, 0\.14\)/);
    expect(scope).toMatch(/--sc-disabled:\s*rgba\(147, 160, 176, 0\.35\)/);
    // --sc-row-h and --sc-leader died with the ledger they measured.
    expect(css).not.toContain("--sc-row-h");
    expect(css).not.toContain("--sc-leader");
    const declarations = moved.replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase();
    for (const hex of ["#e0a63c", "#8a97a7", "#5d6b7c", "#8fd2f6", "#a9dcf8", "#bde3f9", "#3c5069"]) {
      expect(declarations).not.toContain(hex);
    }
    // K82: no amber trace on a Dismiss border, anywhere.
    expect(css).not.toMatch(/rgba\(224, 166, 60/);
  });

  it("rule 133: .act is ONE treatment, rule 15's floor is its min-height, 'on' is border and text --act on the wash", () => {
    const act = rule(".workbench .needs-you .act");
    expect(act).toMatch(/min-height:\s*32px/);
    expect(act).toMatch(/padding:\s*7px 11px/);
    expect(act).toMatch(/border:\s*1px solid var\(--rule\)/);
    expect(act).toMatch(/background:\s*transparent/);
    // #289 fidelity F6: rule 133's own 9.5 px, not .tr-step's 10.
    expect(act).toMatch(/font-size:\s*9\.5px/);
    // Rule 133 "on" — "border and text #34a9e8", the row's recommended
    // action.  #289 fidelity F6 (audit row 58): the text is --act, not
    // --act-bright — 5.19:1 on the wash over NEEDS YOU's --da-ground
    // (#34a9e8 on #153044, measured; --act-bright was 6.42), AA.  #288
    // clause 3 SCOPED it to the block that owns the results primary, so
    // no state can show two: the selector carries `.owns-primary`.
    const on = rule(".workbench .needs-you.owns-primary .act.is-on");
    expect(on).toMatch(/background:\s*var\(--sc-act-wash\)/);
    expect(on).toMatch(/color:\s*var\(--act\)/);
    expect(on).toMatch(/border-color:\s*var\(--act\)/);
    // #437 branch 3: the picker's chosen chip (the same filled pair) left
    // with the picker, so its assertion is dropped.
    // Rule 16: focus is visible on every control in the block.
    expect(rule(".workbench .needs-you .act:focus-visible")).toMatch(/outline:\s*2px solid var\(--act\)/);
  });

  it("#289 fidelity F8 — rule 167 at 380: 18 / 1fr items, the citation in the body track, the actions on their own row", () => {
    const at = css.indexOf("#289 fidelity F8 — rule 167");
    expect(at).toBeGreaterThan(-1);
    const q = css.slice(css.indexOf("@media (max-width: 480px)", at), css.indexOf("\n}\n", at) + 2);
    expect(q).toMatch(/\.workbench \.ny-item \{\s*grid-template-columns: 18px minmax\(0, 1fr\);/);
    expect(q).toMatch(/\.workbench \.ny-right \{\s*display: contents;/);
    expect(q).toMatch(/\.workbench \.ny-cite \{\s*grid-column: 2;[^}]*text-align: left;[^}]*white-space: normal;/);
    expect(q).toMatch(/\.workbench \.ny-acts \{\s*grid-column: 1 \/ -1;/);
    // It must come AFTER the desk's three-track rule, or the desk wins.
    expect(at).toBeGreaterThan(css.indexOf(".workbench .ny-item {"));
  });

  it("rule 15 at 380: every control in the block clears 44px", () => {
    const at480 = css.indexOf("@media (max-width: 480px)", css.indexOf("Rule 133 — LEDGER ACTION"));
    expect(at480).toBeGreaterThan(-1);
    const q = css.slice(at480, css.indexOf("\n}\n", at480));
    // #437 branch 3: the chip and the note left with the picker, so .act
    // is the block's one control in the sweep, and the note's full-line
    // rule is gone with the note.
    expect(q).toMatch(/\.workbench \.needs-you \.act \{\s*min-height: 44px;/);
    expect(q).not.toMatch(/reason-chip|site-correction-note/);
  });

  it("rule 78: the Apply row is ruled off at rule 78's padding", () => {
    // #437 branch 3: the scan's .ny-foot provenance line and its .sc-time
    // rule left the sheet as dead CSS, so only the Apply row is pinned.
    expect(rule(".workbench .needs-you .ny-apply")).toMatch(/border-top:\s*1px solid var\(--da-hair\)/);
    // #289 fidelity follow-up (after-audit row 6): the Apply row takes
    // rule 78's own "padding 13 px 16 px".
    expect(rule(".workbench .needs-you .ny-apply")).toMatch(/padding:\s*13px 16px/);
  });

  it("the band's shared rules: .sys-event byte-identical to arc 18; the suggestion line on Part 2 rule 6 (#289 fidelity F2)", () => {
    // #289 fidelity F2 changed two of these three rules ON PURPOSE: the
    // suggestion line is a provenance line (rule 6: mono 10.5 / 1.5
    // #93a0b0) and its <b> is rule 6's emphasis (#c8d1dd, never bold).
    // The byte check stays on the one rule the pass did not touch.
    const row = rule(".workbench .jbar-suggest .sugg-row");
    for (const d of [
      "display: flex;",
      "align-items: center;",
      "gap: 10px;",
      "flex-wrap: wrap;",
      "font-family: var(--font-mono);",
      "font-size: 10.5px;",
      "line-height: 1.5;",
      "color: var(--ink-on-dark-faint);",
    ])
      expect(row).toContain(d);
    expect(rule(".workbench .jbar-suggest .sys-event")).toBe(
      "\n  align-self: stretch;\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n",
    );
    const name = rule(".workbench .jbar-suggest .sugg-name");
    expect(name).toContain("color: var(--ink-on-dark);");
    expect(name).toContain("font-weight: 400;");
  });
});
