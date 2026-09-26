// coming-soon-gate R10 — the recorded motion exception.  The product has
// one piece of motion, the working band's track (tokens.test.ts pins it
// inside the band's slice).  R10 adds exactly one more: the coming-soon
// drawing's load animation, which must exist ONLY under
// `prefers-reduced-motion: no-preference`, so a reader who asked for less
// motion gets the drawing static in its end state.  Any other @keyframes
// or animation in globals.css fails here by name.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function block(from: number): string {
  // The balanced { … } block that opens at or after `from`.
  const open = css.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(from, i + 1);
  }
  throw new Error("unbalanced");
}

describe("R10 — animation is the band's track and the coming-soon drawing, nothing else (hover colour transitions are not animation)", () => {
  it("the only @keyframes are the band's sweep and the drawing's draw/fade", () => {
    const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]).sort();
    expect(names).toEqual(["cs-draw", "cs-fade", "wb-sweep"]);
  });

  it("every animation declaration is the band's or sits inside the no-preference block", () => {
    const at = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(at, "the drawing's no-preference block").toBeGreaterThan(-1);
    const noPref = block(at);
    // Exactly two animations in it — the draw and the fade — each once.
    expect(noPref.match(/animation:/g)).toHaveLength(2);
    expect(noPref).toMatch(/\.workbench \.cs-draw \{[^}]*animation: cs-draw 1\.4s ease-out both;/);
    expect(noPref).toMatch(/\.workbench \.cs-fade \{[^}]*animation: cs-fade 0\.5s ease-out both;/);
    // Outside it: only the band's sweep and the band's reduced-motion off.
    const outside = css.replace(noPref, "");
    const decls = [...outside.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1].trim()).sort();
    expect(decls).toEqual(["none", "wb-sweep 1.5s linear infinite"]);
  });

  it("the drawing animates opacity and a mask's scale only — nothing that moves a box (P1)", () => {
    for (const name of ["cs-draw", "cs-fade"]) {
      const k = block(css.indexOf(`@keyframes ${name}`));
      const props = [...k.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
      expect(new Set(props), name).toEqual(new Set(name === "cs-draw" ? ["transform"] : ["opacity"]));
    }
  });

  it("the no-preference block comes after the band's rules, so the band's own test still finds its block", () => {
    expect(css.indexOf("@media (prefers-reduced-motion: no-preference)")).toBeGreaterThan(
      css.indexOf(".workbench .wb-row {"),
    );
  });
});
