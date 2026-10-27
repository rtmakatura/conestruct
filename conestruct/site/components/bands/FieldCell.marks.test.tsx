// @vitest-environment happy-dom
//
// #411 — the provenance marker's glyph takes its rule-18 hue, and a plain
// "default" is the word alone.
//
// Rule 18 (lib/design/symbols.ts:5-7): "Symbol colours, fixed across the
// whole page ... A symbol never changes hue by context."  The marker used
// to draw ✓, ◌ and i in the trigger's faint ink (.a-mark); the glyph now
// carries symClass(glyph), and the word keeps the faint ink.  Ryan,
// 2026-10-26 (#411, amending R110 Q8): "'✓ default' becomes plain
// 'default', with no mark."

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { symClass } from "@/lib/design/symbols";
import { markerOf } from "@/lib/scenarios/provenance-marker";
import { FieldCell } from "./FieldCell";

afterEach(cleanup);

function mount(line: string, opts: Parameters<typeof markerOf>[1] = {}) {
  render(
    <FieldCell label="Row" provenance={<span>{line}</span>} marker={markerOf(line, opts)} testid="row">
      <input aria-label="row" />
    </FieldCell>,
  );
  return screen.getByTestId("info-toggle-row");
}

describe("#411: the marker's glyph in its own hue", () => {
  it.each([
    ["OSM · 30 mph · measured", "✓"],
    ["your change · operator-set from here on", "✓"],
    ["not set · operator-set when picked", "◌"],
    ["median present · every other road type sets this itself (#85)", "i"],
  ])("%s → %s carries symClass", (line, glyph) => {
    const t = mount(line);
    const g = t.querySelector(`.${symClass(glyph)}`);
    expect(g?.textContent).toBe(glyph);
  });

  it("a plain default is the word alone: no glyph, no hue class", () => {
    const t = mount("default · daytime; night work adds retroreflective devices");
    expect(t.textContent).toBe("default");
    expect(t.querySelector('[class*="sym-"]')).toBeNull();
    expect(t.className).toContain("is-plain");
  });
});
