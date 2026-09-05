// #245 — the dismiss reason picker's rules reference the block's named
// pairs (rule 13: the floor is measured in the browser leg; this pins the
// tokens the measurement was taken on, so a later edit cannot drift to a
// literal or to the UA's white field).  Same reader as shell-chrome.test.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");

function rule(selector: string): string {
  const i = css.indexOf(selector + " {");
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  const j = css.indexOf("}", i);
  return css.slice(i + selector.length + 2, j);
}

describe("#245 — the reason picker's tokens", () => {
  it("unselected chips are the ghost pair; chosen chips the act pair; the legend the row ink", () => {
    expect(rule(".workbench .jbar-suggest .reason-chip")).toMatch(/color:\s*var\(--ink-on-dark-faint\)/);
    expect(rule(".workbench .jbar-suggest .reason-chip")).toMatch(/border:\s*1px solid var\(--rule\)/);
    expect(rule(".workbench .jbar-suggest .reason-chip.chosen")).toMatch(/color:\s*var\(--act\)/);
    expect(rule(".workbench .jbar-suggest .reason-chip.chosen")).toMatch(/border-color:\s*var\(--act\)/);
    expect(rule(".workbench .jbar-suggest .site-correction-reasons legend")).toMatch(
      /color:\s*var\(--ink-on-dark\)/,
    );
  });
  it("the radio stays focusable (hidden by opacity, never display:none) and focus shows on the chip", () => {
    expect(rule(".workbench .jbar-suggest .reason-chip input")).toMatch(/opacity:\s*0/);
    expect(rule(".workbench .jbar-suggest .reason-chip input")).not.toMatch(/display:\s*none/);
    expect(rule(".workbench .jbar-suggest .reason-chip:focus-within")).toMatch(/var\(--act-glow\)/);
  });
  it("the other-note input is the field-input workbench pair, never the UA field", () => {
    const note = rule(".workbench .jbar-suggest .site-correction-note");
    expect(note).toMatch(/background:\s*var\(--canvas\)/);
    expect(note).toMatch(/color:\s*#fff/);
    expect(rule(".workbench .jbar-suggest .site-correction-note::placeholder")).toMatch(
      /var\(--ink-on-dark-faint\)/,
    );
  });
});
