// #396 L2 (mission site-walkthrough-audit): the four CSS findings from the
// walkthrough, pinned as rules in the sources that draw them.  The
// rendered proof (before/after at 1440, 390 and 360, with measured
// heights, contrast and scrollWidth) is committed under
// validation-artifacts/committed/missions/site-walkthrough-audit/L2/.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SITE = join(__dirname, "..", "..");
const css = readFileSync(join(SITE, "app", "globals.css"), "utf-8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const appNav = readFileSync(join(SITE, "components", "AppNav.tsx"), "utf-8");
const fieldCell = readFileSync(join(SITE, "components", "bands", "FieldCell.tsx"), "utf-8");

/** The declarations of the first rule whose selector list contains `sel`. */
function ruleFor(sel: string): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|[},])\\s*${esc}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, "m").exec(css);
  return m ? m[1] : "";
}

describe("W12 — a pressed option carries a mark, not the blue alone (Rule 13; #407: the mark is ●)", () => {
  it("the kind chip reserves a trailing ● slot, shown only when pressed, and keeps its border under the pointer", () => {
    // Trailing, so the label keeps the citation line's left edge (P4);
    // reserved on every chip, so pressing moves nothing (P1).
    const sel = ".workbench .a-chip[aria-pressed] > .tr-field::after";
    const body = ruleFor(sel);
    expect(body, sel).toMatch(/content:\s*"\\00a0●"\s*\/\s*"";/);
    expect(body, sel).toMatch(/visibility:\s*hidden;/);
    expect(body, sel).toMatch(/color:\s*var\(--act\);/);
    expect(ruleFor('.workbench .a-chip[aria-pressed="true"] > .tr-field::after')).toMatch(
      /visibility:\s*visible;/,
    );
    // A pressed or checked chip under the pointer keeps its accent border.
    expect(css).not.toMatch(/\.workbench \.a-chip:hover\s*\{/);
    expect(
      ruleFor('.workbench .a-chip:not([aria-pressed="true"]):not([aria-checked="true"]):hover'),
    ).toMatch(/border-color:\s*var\(--raise-hi\);/);
  });

  it("the segmented ● hangs left of the label in its text flow, taking no width, so the centred label doesn't move", () => {
    // #412: in flow (not absolute at `top: 0`), so the ● sits on the label's
    // baseline like the other three marks; an inline-block whose negative
    // left margin equals its width advances the line by 0, so the label stays
    // centred and pressing moves nothing (P1).
    expect(fieldCell).toContain('<span className="a-seg-label">{o.l}</span>');
    const sel = '.workbench .a-seg > button[aria-pressed="true"] > .a-seg-label::before';
    const body = ruleFor(sel);
    expect(body, sel).toMatch(/content:\s*"●\\00a0"\s*\/\s*"";/);
    expect(body, sel).toMatch(/display:\s*inline-block;/);
    const width = /(?:^|;)\s*width:\s*([^;]+);/.exec(body)?.[1].trim();
    expect(width, sel).toBeTruthy();
    expect(body, sel).toContain(`margin-left: calc(-1 * ${width});`);
    expect(body, sel).toMatch(/text-align:\s*right;/);
    expect(body, sel).toMatch(/color:\s*var\(--act\);/);
  });

  it("#412: every selection ● sits on its label's baseline, in the label's font (one vertical rule for all four)", () => {
    // Side chip: an in-flow span inside .tr-field (WhereBand.tsx).  Kind chip
    // and segmented option: in-flow pseudo-elements.  Dismiss-reason chip:
    // its glyph cell and its text are flex items centred in the same line
    // box with the same font, so their baselines coincide.  None of them may
    // be lifted out of the flow or shifted on its own.
    const shifts = /position:\s*absolute|(?:^|;)\s*(?:top|bottom):|vertical-align:|transform:|font-size:|line-height:/;
    for (const sel of [
      ".workbench .a-chip[aria-pressed] > .tr-field::after",
      '.workbench .a-seg > button[aria-pressed="true"] > .a-seg-label::before',
      ".workbench .needs-you .reason-chip .reason-glyph",
      ".workbench .sym-select",
    ]) {
      const body = ruleFor(sel);
      expect(body, sel).not.toBe("");
      expect(body, sel).not.toMatch(shifts);
    }
    expect(ruleFor(".workbench .a-seg-label"), "no positioning context left for an absolute mark").toBe("");
  });
});

describe("W13 — native selects draw in the dark palette", () => {
  it(".a-fld declares color-scheme: dark beside its own ground and ink", () => {
    const body = ruleFor(".workbench .a-fld");
    expect(body).toMatch(/color-scheme:\s*dark;/);
    expect(body).toMatch(/background:\s*var\(--canvas-tint\);/);
    expect(body).toMatch(/color:\s*var\(--ink\);/);
  });
});

describe("W15 — the step label stays on one line", () => {
  it("the open band's step and head don't wrap; the provenance takes the wrap", () => {
    expect(ruleFor(".workbench .a-open .a-head .tr-step")).toMatch(/white-space:\s*nowrap;/);
    expect(ruleFor(".workbench .a-open .a-head .tr-section")).toMatch(/white-space:\s*nowrap;/);
    expect(ruleFor(".workbench .a-open .a-head .a-prov")).toMatch(/min-width:\s*0;/);
  });
});

describe("W21 — no empty bordered cell beside the wordmark at phone width", () => {
  it("AppNav's left group drops the wordmark's right border below md only", () => {
    expect(appNav).toContain('className="flex items-stretch max-md:[&>a:first-child]:border-r-0"');
  });
});
