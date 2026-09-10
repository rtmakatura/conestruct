// #253 — the next-steps strip's CSS contract: tokens only (P11), the
// spec's hexes mapped (surface rgba(15,26,38,.97) → the shared
// --ws-surface-rgb at .97; #2c3e53 → --rule; #223244 → --rule-soft;
// #34a9e8 → --act; #5cbef0 → --act-bright; #ff8a2e → --dim; #f4c020 →
// --warn; #4fd787 → --pass; #93a0b0 → --none; the open border →
// --warn-soft, decorative), the pin (sticky within the results zone at
// --nav-h / --z-strip — ruled deviation from spec 3), the un-pin below
// 520 px on the strip's own width with 44 px chips (spec 34 / P10), the
// anchors' scroll budget (--pin-h = --strip-h below the pinned strip),
// and the band-lock dim that keeps the chips clickable (#252 doctrine
// over spec 21).  Geometry is measured in the browser leg.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

function rule(selector: string): string {
  const i = css.indexOf(selector + " {");
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  const j = css.indexOf("}", i);
  return css.slice(i + selector.length + 2, j);
}
/** The whole `.ns-` family + the slot, for the no-hex scan. */
function stripBlock(): string {
  const start = css.indexOf("/* #253 — the next-steps strip");
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("/* #253 end */", start);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

describe("#253 .ns-strip — tokens only, the pin, the un-pin, the lock", () => {
  it("no hex literal anywhere in the strip's rules (P11) — every colour is a token", () => {
    const block = stripBlock().replace(/\/\*[\s\S]*?\*\//g, "");
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(block).toMatch(/rgb\(var\(--ws-surface-rgb\)\s*\/\s*0?\.97\)/);
  });

  it("the slot pins within the results zone: sticky at --nav-h, z --z-strip; the zone is the container the un-pin queries", () => {
    const slot = rule(".workbench .results-head-slot");
    expect(slot).toMatch(/position:\s*sticky/);
    expect(slot).toMatch(/top:\s*var\(--nav-h\)/);
    expect(slot).toMatch(/z-index:\s*var\(--z-strip\)/);
    expect(slot).toMatch(/min-height:\s*var\(--strip-h\)/);
    expect(rule(".workbench .zone.results")).toMatch(/container-type:\s*inline-size/);
  });

  it("the strip's surface, rules and geometry are the spec's, mapped", () => {
    const s = rule(".workbench .ns-strip");
    expect(s).toMatch(/padding:\s*9px 0/);
    expect(s).toMatch(/border-top:\s*1px solid var\(--rule-soft\)/);
    expect(s).toMatch(/border-bottom:\s*1px solid var\(--rule-soft\)/);
    expect(s).toMatch(/backdrop-filter:\s*blur\(3px\)/);
    const chips = rule(".workbench .ns-chips");
    expect(chips).toMatch(/display:\s*flex/);
    expect(chips).toMatch(/flex-wrap:\s*wrap/);
    expect(chips).toMatch(/gap:\s*8px/);
    const chip = rule(".workbench .ns-chip");
    expect(chip).toMatch(/flex:\s*1 1 150px/);
    expect(chip).toMatch(/min-width:\s*0/);
    expect(chip).toMatch(/align-items:\s*baseline/);
    expect(chip).toMatch(/padding:\s*8px 10px/);
    expect(chip).toMatch(/border:\s*1px solid var\(--rule\)/);
  });

  it("states: ▲ --warn, ✓ --pass, ◌ --none; the numeral --dim; the open border --warn-soft (decorative); hover --act; focus --act-bright", () => {
    expect(rule(".workbench .ns-chip.is-open .ns-glyph")).toMatch(/color:\s*var\(--warn\)/);
    expect(rule(".workbench .ns-chip.is-clear .ns-glyph,\n.workbench .ns-chip.is-ready .ns-glyph")).toMatch(/color:\s*var\(--pass\)/);
    expect(rule(".workbench .ns-chip.is-none .ns-glyph")).toMatch(/color:\s*var\(--none\)/);
    expect(rule(".workbench .ns-num")).toMatch(/color:\s*var\(--dim\)/);
    expect(rule(".workbench .ns-chip.is-open")).toMatch(/border-color:\s*var\(--warn-soft\)/);
    expect(rule(".workbench .ns-chip:hover")).toMatch(/border-color:\s*var\(--act\)/);
    expect(rule(".workbench .ns-chip:focus-visible")).toMatch(/outline:\s*2px solid var\(--act-bright\)/);
  });

  it("the type rides the four roles; the glyph is the one chosen size (11px, spec 17)", () => {
    const glyph = rule(".workbench .ns-glyph");
    expect(glyph).toMatch(/font-size:\s*11px/);
    expect(glyph).toMatch(/line-height:\s*1/);
    // No other font-size inside the strip's rules: the label, index, name
    // and count carry .tr-section / .tr-step / .tr-field.
    const sizes = stripBlock().replace(/\/\*[\s\S]*?\*\//g, "").match(/font-size:[^;]+/g) ?? [];
    expect(sizes).toEqual(["font-size: 11px"]);
  });

  it("below 520 px of the strip's own width the slot un-pins, the chips stack full-width at 44 px, and the anchors' budget drops the strip", () => {
    const q = css.indexOf("@container (max-width: 519px) {");
    expect(q).toBeGreaterThan(-1);
    const block = css.slice(q, css.indexOf("\n}\n", q));
    expect(block).toMatch(/\.workbench \.results-head-slot \{[^}]*position:\s*static/);
    expect(block).toMatch(/\.workbench \.ns-chip \{[^}]*flex:\s*1 1 100%;[^}]*min-height:\s*44px/);
    expect(block).toMatch(/\.ns-below \{[^}]*--pin-h:\s*0px/);
  });

  it("targets below the pinned strip budget it: .ns-below sets --pin-h to --strip-h post-generate", () => {
    expect(rule('.workbench:not([data-stage="pre"]) .ns-below')).toMatch(/--pin-h:\s*var\(--strip-h\)/);
  });

  it("under the band the chips dim to .45 but keep their pointer — read controls stay live (#252 doctrine over spec 21)", () => {
    const locked = rule(".workbench.ws-locked .ns-chip");
    expect(locked).toMatch(/opacity:\s*0?\.45/);
    expect(locked).not.toMatch(/pointer-events/);
  });

  it("the #249 lockup's rules are gone; .zone-title reads --ink-bright (the D hand-off)", () => {
    expect(css).not.toContain(".results-head-lockup");
    expect(rule(".workbench .zone-title")).toMatch(/color:\s*var\(--ink-bright\)/);
    expect(rule(".workbench .zone-title")).not.toContain("#fff");
  });
});
