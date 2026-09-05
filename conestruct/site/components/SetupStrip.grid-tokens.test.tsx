// #248 — the scanned block's grid rules (s2-arc20).  happy-dom lays out
// nothing, so the browser leg proves the alignment; this pins the rules
// the measurement was taken on (the corrections-tokens reader idiom):
// the four-track grid, subgrid rows, the action cell on the end edge,
// the tier glyph tokens, and the ≤480px two-track collapse.  It also
// pins that the band's shared rules were not touched.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Line endings normalized: the repo stores LF, Windows checkouts read CRLF.
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

function rule(selector: string, from = 0): string {
  const i = css.indexOf(selector + " {", from);
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  const j = css.indexOf("}", i);
  return css.slice(i + selector.length + 2, j);
}

describe("#248 — the scanned block's grid", () => {
  it("four tracks on the block, subgrid rows, the action cell on the end edge", () => {
    expect(rule(".workbench .jbar-suggest .sc-grid")).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\) auto/,
    );
    expect(rule(".workbench .jbar-suggest .sc-grid")).toMatch(/column-gap:\s*14px/);
    const row = rule(".workbench .jbar-suggest .sc-grid .sc-row");
    expect(row).toMatch(/grid-template-columns:\s*subgrid/);
    expect(row).toMatch(/align-items:\s*baseline/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-action")).toMatch(/justify-self:\s*end/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-row.sc-record")).toMatch(
      /grid-template-columns:\s*subgrid/,
    );
  });
  it("the Result glyphs carry the tier tokens (▲ --dim, ✓ --pass) in a --glyph-cell", () => {
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-glyph")).toMatch(/width:\s*var\(--glyph-cell\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-glyph.sc-detected")).toMatch(/color:\s*var\(--dim\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-glyph.sc-absent")).toMatch(/color:\s*var\(--pass\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-evidence")).toMatch(/var\(--ink-on-dark-faint\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-evidence")).toMatch(/tabular-nums/);
  });
  it("≤480px collapses to two tracks with the action spanning the stacked facts", () => {
    const media = css.indexOf("@media (max-width: 480px)");
    expect(media).toBeGreaterThan(-1);
    const action = rule(".workbench .jbar-suggest .sc-grid .sc-action", media);
    expect(action).toMatch(/grid-column:\s*2/);
    expect(action).toMatch(/grid-row:\s*1 \/ span 3/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-head", media)).toMatch(/display:\s*none/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-evidence", media)).toMatch(/grid-row:\s*3/);
  });
  it("the band's shared rules are byte-identical to their arc-18 text", () => {
    expect(rule(".workbench .jbar-suggest .sugg-row")).toBe(
      "\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex-wrap: wrap;\n  font-size: 11.5px;\n  color: var(--ink-on-dark);\n",
    );
    expect(rule(".workbench .jbar-suggest .sys-event")).toBe(
      "\n  align-self: stretch;\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n",
    );
    expect(rule(".workbench .jbar-suggest .sugg-name")).toBe("\n  color: var(--ink-on-dark);\n");
  });
});
