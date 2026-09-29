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
  it("the only @keyframes are the band's sweep, the drawing's plotter (R10, R42: draw, fade, stroke, drop, stamp) and 02's mark replay (R21)", () => {
    const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]).sort();
    expect(names).toEqual(["cs-draw", "cs-drop", "cs-fade", "cs-k", "cs-stamp", "cs-stroke", "wb-sweep"]);
  });

  it("every animation declaration is the band's or sits inside the no-preference block", () => {
    const at = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(at, "the drawing's no-preference block").toBeGreaterThan(-1);
    const noPref = block(at);
    // Exactly six animations in it — R42's plotter (draw, fade, stroke,
    // drop, stamp) and 02's mark replay (R21) — each once.
    expect(noPref.match(/animation:/g)).toHaveLength(6);
    expect(noPref).toMatch(/\.workbench \.cs-stack\.is-fanned \.cs-seq \{[^}]*animation: cs-k 0\.35s ease-out both;/);
    expect(noPref).toMatch(/\.workbench \.cs-draw \{[^}]*animation: cs-draw 0\.45s ease-out both;/);
    expect(noPref).toMatch(/\.workbench \.cs-fade \{[^}]*animation: cs-fade 0\.35s ease-out both;/);
    expect(noPref).toMatch(/\.workbench \.cs-stroke \{[^}]*animation: cs-stroke 0\.4s ease-out both;/);
    expect(noPref).toMatch(/\.workbench \.cs-drop \{[^}]*animation: cs-drop 0\.25s ease-out both;/);
    expect(noPref).toMatch(/\.workbench \.cs-stamp \{[^}]*animation: cs-stamp 0\.28s ease-out 2\.05s both;/);
    // Outside it: only the band's sweep and the band's reduced-motion off.
    const outside = css.replace(noPref, "");
    const decls = [...outside.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1].trim()).sort();
    expect(decls).toEqual(["none", "wb-sweep 1.5s linear infinite"]);
  });

  it("the drawing animates opacity, a mask's scale and a stroke's offset; R42's two recorded moves (a device's drop, the stamp's press) are transforms on absolutely placed or SVG marks, so no box moves in layout (P1); 02's replay animates --k only", () => {
    const own: Record<string, string[]> = {
      "cs-draw": ["transform"],
      "cs-fade": ["opacity"],
      "cs-stroke": ["stroke-dashoffset"],
      "cs-drop": ["opacity", "transform"],
      "cs-stamp": ["opacity", "transform"],
      "cs-k": ["--k"],
    };
    for (const name of Object.keys(own)) {
      const k = block(css.indexOf(`@keyframes ${name}`));
      const props = [...k.matchAll(/(--[\w-]+|[\w-]+)\s*:/g)].map((m) => m[1]);
      expect(new Set(props), name).toEqual(new Set(own[name]));
    }
  });

  it("R15 / R21: 02's sheets are the no-preference block's one transition, on --fan (never transform: the compositor would rotate a bitmap); no coming-soon rule transitions anywhere else", () => {
    const at = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    const noPref = block(at);
    expect([...noPref.matchAll(/transition:\s*([^;]+);/g)].map((m) => m[1].trim())).toEqual([
      "--fan 0.35s ease-out",
    ]);
    expect(noPref).toMatch(
      /\.workbench \.cs-s1,\s*\.workbench \.cs-s2,\s*\.workbench \.cs-s3 \{\s*transition: --fan 0\.35s ease-out;/,
    );
    // Outside it, no rule whose selector names a .cs- class transitions.
    const outside = css.replace(noPref, "");
    const csTransitions = [...outside.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(
      ([, sel, body]) => /\.cs-/.test(sel) && /transition\s*:/.test(body),
    );
    expect(csTransitions.map(([, sel]) => sel.trim())).toEqual([]);
    // Only one no-preference block.
    expect(css.indexOf("@media (prefers-reduced-motion: no-preference)", at + 1)).toBe(-1);
  });

  it("R21: --fan rests at 0 and --k at 1, registered, so a stack that is not animating shows every mark in place", () => {
    expect(css).toMatch(/@property --fan \{[^}]*syntax: "<number>";[^}]*initial-value: 0;/);
    expect(css).toMatch(/@property --k \{[^}]*syntax: "<number>";[^}]*initial-value: 1;/);
    // The derived properties: nothing in 02 sets transform or opacity to a
    // literal that a transition or animation could hand to the compositor.
    expect(css).toMatch(/\.workbench \.cs-seq-appear \{\s*opacity: var\(--k\);/);
    expect(css).toMatch(/\.workbench \.cs-seq-fill \{[^}]*transform: scaleX\(var\(--k\)\);/);
    expect(css).toMatch(/\.workbench \.cs-seq-draw \{[^}]*stroke-dashoffset: calc\(1 - var\(--k\)\);/);
    expect(css).toMatch(/\.workbench \.cs-seq-ink \{[^}]*fill-opacity: var\(--k\);/);
    for (const m of ["plan", "quote", "audit", "crew"]) {
      const rules = [...css.matchAll(new RegExp(`\\.cs-stack\\[data-move="${m}"\\] \\.cs-s\\d \\{([^}]*)\\}`, "g"))];
      expect(rules.length, m).toBeGreaterThan(0);
      for (const [, body] of rules) expect(body, m).toMatch(/transform: [^;]*var\(--fan\)/);
    }
  });

  it("the no-preference block comes after the band's rules, so the band's own test still finds its block", () => {
    expect(css.indexOf("@media (prefers-reduced-motion: no-preference)")).toBeGreaterThan(
      css.indexOf(".workbench .wb-row {"),
    );
  });
});
