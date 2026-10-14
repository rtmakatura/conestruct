// #295 (A): the stale palette clears the floor AFTER the dim (rule 13).
//
// `.results-stale` used to dim its text with `opacity: .5`, which took
// every token under it to 2.57–3.80:1.  It now redefines the ink tokens to
// the `--stale-*` palette.  This pins the numbers that palette was chosen
// on, computed from the hexes in globals.css: each stale ink clears 4.5:1
// on both grounds the wrapper's text sits on, still reads dimmer than the
// token it stands in for, and keeps the palette's order.  The composited
// reading (the grayscale wash on top) is the browser leg's to take:
// validation-artifacts/committed/issue-295-stale-ink/probe295.js.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

// The workbench's own declarations: the marketing `:root` above it
// declares a dark --ink of its own.
const wbAt = css.indexOf("\n.workbench {");
const workbench = css.slice(wbAt, css.indexOf("\n}\n", wbAt));

function token(name: string): number[] {
  const m = workbench.match(new RegExp(`\\n\\s*${name}:\\s*(#[0-9a-fA-F]{6});`));
  expect(m, `token ${name} present as a 6-digit hex`).not.toBeNull();
  return [1, 3, 5].map((i) => parseInt(m![1].slice(i, i + 2), 16));
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: number[], bg: number[]): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [string, string][] = [
  ["--stale-ink", "--ink"],
  ["--stale-ink-on-dark", "--ink-on-dark"],
  ["--stale-ink-faint", "--ink-on-dark-faint"],
  ["--stale-dim", "--dim"],
];

describe("#295 (A): the stale palette", () => {
  for (const ground of ["--canvas", "--da-ground"]) {
    it(`every stale ink clears 4.5:1 on ${ground}`, () => {
      for (const [stale] of PAIRS) {
        expect(contrast(token(stale), token(ground)), `${stale} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("each stale ink still reads dimmer than the token it replaces", () => {
    const canvas = token("--canvas");
    for (const [stale, full] of PAIRS) {
      expect(contrast(token(stale), canvas), `${stale} vs ${full}`).toBeLessThan(contrast(token(full), canvas));
    }
  });

  it("keeps the palette's order: ink above ink-on-dark above faint", () => {
    const canvas = token("--canvas");
    const r = (n: string) => contrast(token(n), canvas);
    expect(r("--stale-ink")).toBeGreaterThan(r("--stale-ink-on-dark"));
    expect(r("--stale-ink-on-dark")).toBeGreaterThan(r("--stale-ink-faint"));
  });
});
