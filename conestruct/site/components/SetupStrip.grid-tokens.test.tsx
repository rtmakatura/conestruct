// #249 — the scanned block's ledger rules (s2-arc21; #248's grid rules
// before it).  happy-dom lays out nothing, so the browser leg proves the
// alignment; this pins the rules the measurement was taken on (the
// corrections-tokens reader idiom): the two-track grid, subgrid rows,
// the action cell on the end edge, the tier tokens on symbol and word,
// the three scoped values, the container query.  It also pins that the
// band's shared rules were not touched.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Line endings normalized: the repo stores LF, Windows checkouts read CRLF.
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

// The ledger block alone — the hex sweep and the @media/@container
// checks are scoped to it (other blocks own their own values).
const ledger = css.slice(
  css.lastIndexOf("/*", css.indexOf("#249 the scanned block")),
  css.lastIndexOf("/*", css.indexOf("#227 system-event container")),
);

function rule(selector: string, from = 0): string {
  const i = css.indexOf(selector + " {", from);
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  const j = css.indexOf("}", i);
  return css.slice(i + selector.length + 2, j);
}

describe("#249 — the scanned block as a ledger", () => {
  it("two tracks on the block (ledger · 92px action), subgrid rows, the action cell on the end edge", () => {
    expect(rule(".workbench .jbar-suggest .sc-grid")).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) 92px/);
    const row = rule(".workbench .jbar-suggest .sc-grid .sc-row");
    expect(row).toMatch(/grid-template-columns:\s*subgrid/);
    expect(row).toMatch(/align-items:\s*baseline/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-action")).toMatch(/justify-self:\s*end/);
    // #255: one row height for every row kind — the scoped --sc-row-h
    // (46, the measured scan row) as min-height on .sc-row; the record
    // row keeps the shared edges (horizontal margin only), vertical
    // inset 9 like its peers, centred so a one-line record sits at 46.
    expect(rule(".workbench .site-corrections")).toMatch(/--sc-row-h:\s*46px/);
    expect(row).toMatch(/min-height:\s*var\(--sc-row-h\)/);
    const record = rule(".workbench .jbar-suggest .sc-grid .sc-row.sc-record");
    expect(record).toMatch(/grid-template-columns:\s*subgrid/);
    expect(record).toMatch(/align-items:\s*center/);
    expect(record).toMatch(/margin:\s*0 -12px/);
    expect(record).toMatch(/padding:\s*9px 11px 9px 9px/);
    // The ledger line: symbol → name (wraps) → leader (absorbs slack) → right group (nowrap).
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-lead")).toMatch(/display:\s*flex/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-name")).toMatch(/white-space:\s*normal/);
    expect(rule(".workbench .jbar-suggest .sc-leader")).toMatch(/flex:\s*1 1 18px/);
    expect(rule(".workbench .jbar-suggest .sc-leader")).toMatch(/transform:\s*translateY\(-4px\)/);
    // Spec 5/7/8: row inset 9px, ledger gap 8px, right-group gap 10px.
    expect(row).toMatch(/padding:\s*9px 0/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-lead")).toMatch(/gap:\s*8px/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-right")).toMatch(/gap:\s*10px/);
    // Spec 19: the record sentence is sans prose.
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-disclosure")).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-disclosure")).toMatch(/text-wrap:\s*pretty/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-right")).toMatch(/white-space:\s*nowrap/);
  });
  it("the tier tokens ride symbol and word (▲ --dim, ✓ --pass; the none word stays body ink) in a --glyph-cell", () => {
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-glyph")).toMatch(/width:\s*var\(--glyph-cell\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-glyph.sc-detected")).toMatch(/color:\s*var\(--dim\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-glyph.sc-absent")).toMatch(/color:\s*var\(--pass\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-result")).toMatch(/color:\s*var\(--ink-on-dark\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-result.sc-detected")).toMatch(/color:\s*var\(--dim\)/);
    expect(css).not.toMatch(/\.sc-result\.sc-absent/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-evidence")).toMatch(/var\(--ink-on-dark-faint\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-evidence")).toMatch(/tabular-nums/);
    // The three scoped values live on the block, not :root (GO ruling a);
    // no spec hex leaks in.
    const scope = rule(".workbench .site-corrections");
    expect(scope).toMatch(/container-type:\s*inline-size/);
    expect(scope).toMatch(/--sc-leader:\s*#4a6280/);
    expect(scope).toMatch(/--sc-act-wash:\s*rgba\(52, 169, 232, 0\.14\)/);
    expect(scope).toMatch(/--sc-disabled:\s*rgba\(147, 160, 176, 0\.35\)/);
    expect(rule(".workbench .jbar-suggest .sc-leader")).toMatch(/border-bottom:\s*1px dotted var\(--sc-leader\)/);
    const declarations = ledger.replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase(); // comments may NAME a rejected hex
    for (const hex of ["#e0a63c", "#8a97a7", "#5d6b7c", "#8fd2f6", "#a9dcf8", "#bde3f9", "#3c5069"]) {
      expect(declarations).not.toContain(hex);
    }
    // Chosen chip = --act border + the wash + --act-bright ink (6.15:1 measured).
    const chosen = rule(".workbench .jbar-suggest .sc-picker .reason-chip.chosen");
    expect(chosen).toMatch(/border-color:\s*var\(--act\)/);
    expect(chosen).toMatch(/background:\s*var\(--sc-act-wash\)/);
    expect(chosen).toMatch(/color:\s*var\(--act-bright\)/);
    // Confirm on the wash takes the same bright ink (6.15:1 measured; --act on the wash was 4.97).
    const confirm = rule(".workbench .jbar-suggest .sc-picker button.confirm");
    expect(confirm).toMatch(/background:\s*var\(--sc-act-wash\)/);
    expect(confirm).toMatch(/color:\s*var\(--act-bright\)/);
    // The footer stretches to the block like the grid (its leader spans the slack).
    expect(rule(".workbench .jbar-suggest .sc-foot")).toMatch(/align-self:\s*stretch/);
    // K82: the Dismiss border keeps --rule; no amber trace anywhere.
    expect(rule(".workbench .jbar-suggest .sc-grid button.ghost")).toMatch(/border-color:\s*var\(--rule\)/);
    expect(css).not.toMatch(/rgba\(224, 166, 60/);
  });
  it("≤420px of the block's own width narrows the action to 88px, hides the leader, lets the right group wrap", () => {
    const cq = css.indexOf("@container (max-width: 420px)");
    expect(cq).toBeGreaterThan(-1);
    // The first rule in the query is a selector list (grid, row, record)
    // ending in the 88px tracks.
    expect(ledger.slice(ledger.indexOf("@container"))).toMatch(
      /\.sc-grid,\s*\.workbench \.jbar-suggest \.sc-grid \.sc-row,\s*\.workbench \.jbar-suggest \.sc-grid \.sc-row\.sc-record \{\s*grid-template-columns:\s*minmax\(0, 1fr\) 88px;/,
    );
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-leader", cq)).toMatch(/display:\s*none/);
    const right = rule(".workbench .jbar-suggest .sc-grid .sc-right", cq);
    expect(right).toMatch(/flex:\s*1 1 100%/);
    expect(right).toMatch(/white-space:\s*normal/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-lead", cq)).toMatch(/flex-wrap:\s*wrap/);
    // #255 / #153: under the block's own ≤420 a wrapped record may grow;
    // Undo rides the top line again.
    // (Anchored past the query's selector-list rule, whose tail is the
    // same selector.)
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-row.sc-record", css.indexOf("#255 / #153", cq))).toMatch(
      /align-items:\s*start/,
    );
    // The arc-20 viewport query is gone with the four-track grid.
    expect(ledger).not.toContain("@media");
  });
  it("#254: the staged row's tone is --none (◌ + the word, rule 13); the Apply row spans both tracks at --sc-row-h, its button the Confirm pair", () => {
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-glyph.sc-staged")).toMatch(/color:\s*var\(--none\)/);
    expect(rule(".workbench .jbar-suggest .sc-grid .sc-result.sc-staged")).toMatch(/color:\s*var\(--none\)/);
    const apply = rule(".workbench .jbar-suggest .sc-grid .sc-row.sc-apply");
    expect(apply).toMatch(/grid-column:\s*1 \/ -1/);
    expect(apply).toMatch(/display:\s*flex/);
    expect(apply).toMatch(/justify-content:\s*space-between/);
    expect(apply).toMatch(/min-height:\s*var\(--sc-row-h\)/);
    expect(apply).toMatch(/padding:\s*8px 0/); // 46 − the 30 px filled control
    const cq = css.indexOf("@container (max-width: 420px)");
    expect(rule(".workbench .jbar-suggest .sc-apply button.confirm", cq)).toMatch(/margin-left:\s*auto/);
    const btn = rule(".workbench .jbar-suggest .sc-apply button.confirm");
    expect(btn).toMatch(/background:\s*var\(--sc-act-wash\)/);
    expect(btn).toMatch(/color:\s*var\(--act-bright\)/);
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
