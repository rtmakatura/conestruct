// #227 — the sizing-token mirror (the type-roles.test.ts idiom): the
// TS table and the .workbench custom-property definitions must agree,
// so a token edit in one home cannot drift the other silently.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIZE_TOKENS } from "./tokens";
import { TYPE_ROLES } from "./type-roles";

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

// #263 P11 — the brightest ink is a token, not a literal.  `.tr-section`
// carried `color: #ffffff` (arc-9 marked it CHOSEN but never tokenised)
// and three workbench rules carried `#fff`; the confirm-hover ink was a
// fourth literal (#0b1420) beside the existing --on-act.  One token,
// --ink-bright, defined in the .workbench block; the sites read it.  The
// other seven #fff outside D's ranges are hand-offs to their owners
// (A/B/C), each citing this token — that is why it ships first.
describe("#263 --ink-bright and the confirm-hover ink", () => {
  function token(name: string): string {
    const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    expect(m, `token ${name}`).not.toBeNull();
    return m![1].toLowerCase();
  }
  function lum(hex: string): number {
    const [r, g, b] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a: string, b: string): number {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  it("defines --ink-bright: #ffffff inside the .workbench token block", () => {
    const start = css.indexOf(".workbench {");
    const end = css.indexOf("\n}", start);
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start, end)).toContain("--ink-bright: #ffffff;");
  });

  it("the three workbench sites and the section role read var(--ink-bright), not a literal", () => {
    for (const sel of [
      ".workbench .tr-section",
      ".workbench .jbar-readonly .jbar-slot-hint b",
      ".workbench .chain .seg.local",
    ]) {
      const block = css.match(new RegExp(`${sel.replace(/[.]/g, "\\.")} \\{[^}]*\\}`));
      expect(block, sel).not.toBeNull();
      expect(block![0], sel).toContain("color: var(--ink-bright)");
      expect(block![0], sel).not.toMatch(/color:\s*#fff/i);
    }
    expect(TYPE_ROLES.section.color).toBe("var(--ink-bright)");
  });

  it("confirm hover/focus ink is var(--on-act) on --act — 6.25:1 measured (declared change from #0b1420's 7.04:1)", () => {
    const block = css.match(
      /\.workbench \.jbar-suggest button\.confirm:hover,\s*\.workbench \.jbar-suggest button\.confirm:focus-visible \{[^}]*\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("background: var(--act)");
    expect(block![0]).toContain("color: var(--on-act)");
    expect(block![0]).not.toContain("#0b1420");
    const ratio = contrast(token("--on-act"), token("--act"));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(6.25, 1);
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
