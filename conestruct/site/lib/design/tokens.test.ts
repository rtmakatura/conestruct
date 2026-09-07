// #227 — the sizing-token mirror (the type-roles.test.ts idiom): the
// TS table and the .workbench custom-property definitions must agree,
// so a token edit in one home cannot drift the other silently.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIZE_TOKENS } from "./tokens";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../app/globals.css"),
  "utf-8",
);

describe("SIZE_TOKENS mirror .workbench custom properties (#227)", () => {
  for (const [name, value] of Object.entries(SIZE_TOKENS)) {
    it(`${name} is defined as ${value}`, () => {
      const re = new RegExp(`${name}:\\s*${value};`);
      expect(css).toMatch(re);
    });
  }

  it("the table stays exactly the two ruled tokens", () => {
    expect(Object.keys(SIZE_TOKENS).sort()).toEqual([
      "--bar-seg-min",
      "--glyph-cell",
    ]);
  });
});

// #252 — the chrome stack and the working band's surface, one home
// each; AppNav reads the nav token instead of a Tailwind literal.
describe("#252 chrome + surface tokens", () => {
  it("defines the z stack and the band surface exactly as ruled, and the chrome reads them", () => {
    for (const decl of [
      "--z-strip: 30;",
      "--z-nav: 40;",
      "--z-frame: 60;",
      "--z-band: 70;",
      "--ws-surface-rgb: 15 26 38;",
      "--ws-surface: rgb(var(--ws-surface-rgb));",
    ]) {
      expect(css, decl).toContain(decl);
    }
    expect(css).toMatch(/\.workbench-frame \{[^}]*z-index: var\(--z-frame\);/);
    expect(css).toMatch(/\.progress-rail \{[^}]*z-index: var\(--z-strip\);/);
    expect(css).toMatch(/\.working-band \{[^}]*z-index: var\(--z-band\);[^}]*background: var\(--ws-surface\);/);
    const nav = fs.readFileSync(path.resolve(__dirname, "../../components/AppNav.tsx"), "utf-8");
    expect(nav).toContain("z-[var(--z-nav)]");
    expect(nav).not.toMatch(/z-30/);
  });

  it("the band's track is the only motion and stops under reduced motion (spec 23: a static --act-glow fill, no sweep)", () => {
    expect(css).toMatch(/\.wb-track::after \{[^}]*animation: wb-sweep 1\.5s linear infinite;/);
    // The band's own reduced-motion block: the last one before its row rule.
    const reduced = css.slice(
      css.lastIndexOf("@media (prefers-reduced-motion: reduce)", css.indexOf(".workbench .wb-row {")),
      css.indexOf(".workbench .wb-row {"),
    );
    expect(reduced).toMatch(/\.workbench \.wb-track \{\s*background: var\(--act-glow\);/);
    expect(reduced).toMatch(/\.workbench \.wb-track::after \{\s*animation: none;/);
    // Nothing else in the band animates (spec 24).
    const bandCss = css.slice(css.indexOf(".workbench .working-band {"), css.indexOf(".workbench .wb-lock {"));
    expect(bandCss.match(/animation:/g)).toHaveLength(2);
  });
});
