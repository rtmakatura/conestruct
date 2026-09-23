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

describe("#245 — the reason picker's tokens (moved by #288 clause 1)", () => {
  it("unselected chips are the ghost pair; chosen chips the act pair; the legend the row ink", () => {
    expect(rule(".workbench .needs-you .reason-chip")).toMatch(/color:\s*var\(--ink-on-dark-faint\)/);
    expect(rule(".workbench .needs-you .reason-chip")).toMatch(/border:\s*1px solid var\(--rule\)/);
    expect(rule(".workbench .needs-you .reason-chip.chosen")).toMatch(/color:\s*var\(--act\)/);
    expect(rule(".workbench .needs-you .reason-chip.chosen")).toMatch(/border-color:\s*var\(--act\)/);
    expect(rule(".workbench .needs-you .site-correction-reasons legend")).toMatch(
      /color:\s*var\(--ink-on-dark\)/,
    );
  });
  it("the radio stays focusable (hidden by opacity, never display:none) and focus shows on the chip", () => {
    expect(rule(".workbench .needs-you .reason-chip input")).toMatch(/opacity:\s*0/);
    expect(rule(".workbench .needs-you .reason-chip input")).not.toMatch(/display:\s*none/);
    expect(rule(".workbench .needs-you .reason-chip:focus-within")).toMatch(/var\(--act-glow\)/);
  });
  it("#255: the chip centres its label — a mirror glyph slot on the trailing edge (F-S4-2)", () => {
    expect(rule(".workbench .needs-you .reason-chip")).toMatch(/justify-content:\s*center/);
    expect(rule(".workbench .needs-you .reason-chip .reason-glyph")).toMatch(/width:\s*10px/);
    expect(rule(".workbench .needs-you .reason-chip::after")).toMatch(/width:\s*10px/);
    expect(rule(".workbench .needs-you .reason-chip::after")).toMatch(/content:\s*""/);
  });
  it("#255: the note slot is a fixed 184px reservation; void = hidden, still laid out (P1)", () => {
    expect(rule(".workbench .needs-you .site-correction-note")).toMatch(/flex:\s*0 0 184px/);
    expect(rule(".workbench .needs-you .site-correction-note")).not.toMatch(/min-width/);
    const voided = rule(".workbench .needs-you .site-correction-note.is-void");
    expect(voided).toMatch(/visibility:\s*hidden/);
    expect(voided).not.toMatch(/display:\s*none/);
  });
  it("the other-note input is the field-input workbench pair, never the UA field", () => {
    const note = rule(".workbench .needs-you .site-correction-note");
    expect(note).toMatch(/background:\s*var\(--canvas\)/);
    expect(note).toMatch(/color:\s*var\(--ink-bright\)/); // #263: the token, not the literal
    expect(rule(".workbench .needs-you .site-correction-note::placeholder")).toMatch(
      /var\(--ink-on-dark-faint\)/,
    );
  });
});

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
    // The same filled pair on the picker's chosen chip.
    const chosen = rule(".workbench .needs-you .sc-picker .reason-chip.chosen");
    expect(chosen).toMatch(/background:\s*var\(--sc-act-wash\)/);
    expect(chosen).toMatch(/color:\s*var\(--act-bright\)/);
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

  it("rule 15 at 380: every control in the block clears 44px, and the note takes the full line", () => {
    const at480 = css.indexOf("@media (max-width: 480px)", css.indexOf("Rule 133 — LEDGER ACTION"));
    expect(at480).toBeGreaterThan(-1);
    const q = css.slice(at480, css.indexOf("\n}\n", at480));
    expect(q).toMatch(
      /\.workbench \.needs-you \.act,\s*\.workbench \.needs-you \.reason-chip,\s*\.workbench \.needs-you \.site-correction-note \{\s*min-height: 44px;/,
    );
    expect(q).toMatch(/flex:\s*1 1 100%/);
  });

  it("#270: the picker sub-row is one extra row — the legend its own line, Confirm on the shared action edge", () => {
    const sub = rule(".workbench .needs-you .ny-sub");
    expect(sub).toMatch(/border-top:\s*1px dashed var\(--rule\)/);
    expect(sub).toMatch(/align-items:\s*center/);
    const line = rule(".workbench .needs-you .ny-sub .sc-picker");
    expect(line).not.toMatch(/grid-column/);
    expect(line).toMatch(/flex-wrap:\s*wrap/);
    expect(line).toMatch(/align-items:\s*flex-end/);
    const legend = rule(".workbench .needs-you .sc-picker .site-correction-reasons legend");
    expect(legend).toMatch(/width:\s*100%/);
    expect(legend).toMatch(/float:\s*none/);
  });

  it("rule 78: the Apply row and the scan's provenance line are the block's last two lines, ruled off", () => {
    expect(rule(".workbench .needs-you .ny-apply")).toMatch(/border-top:\s*1px solid var\(--da-hair\)/);
    const foot = rule(".workbench .needs-you .ny-foot");
    expect(foot).toMatch(/border-top:\s*1px solid var\(--da-hair\)/);
    // The provenance line has no action track: it is not a data line.
    expect(foot).toMatch(/grid-template-columns:\s*20px minmax\(0, 1fr\)/);
    expect(rule(".workbench .needs-you .ny-foot .sc-time")).toMatch(/underline dotted/);
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
