// coming-soon-gate R13 — what the road's measurement relies on in CSS,
// which happy-dom cannot lay out.  The browser leg
// (arc3-evidence/measure.cjs) measures the result.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("R13 — the road's column", () => {
  it("is a flow root, so section 01's top margin cannot collapse through it (the road starts above 01's milepost)", () => {
    expect(css).toMatch(/\.workbench \.cs-road-wrap \{[^}]*display: flow-root;/);
  });

  it("the road and the marker exist only from 980 px", () => {
    expect(css).toMatch(/\.workbench \.cs-road-svg,\s*\.workbench \.cs-mp \{\s*display: none;/);
    const wide = css.indexOf("@media (min-width: 980px)");
    expect(wide).toBeGreaterThan(-1);
    expect(css.slice(wide, wide + 600)).toMatch(/\.cs-road-svg \{[^}]*display: block;/);
  });
});

describe("R22 — 02's front sheets settle on whole pixels, untilted", () => {
  it("the plan card's front sheet shifts but never rotates, and the crew sheet lifts without scaling (a tilted 2 px line or a scaled row reads jagged or soft at 1×)", () => {
    const rule = (m: string) => {
      const at = css.indexOf(`.cs-stack[data-move="${m}"] .cs-s1 {`);
      expect(at, m).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf("}", at));
    };
    expect(rule("plan")).toMatch(/transform: translate\(/);
    expect(rule("plan")).not.toMatch(/rotate/);
    expect(rule("crew")).toMatch(/transform: translateY\(/);
    expect(rule("crew")).not.toMatch(/scale/);
  });
});

describe("R23 — the founders' rows share the column equally beside the note", () => {
  it("from 1024 px the list fills the column with 1fr rows, content centred; nothing outside that query sets it", () => {
    const at = css.indexOf(".workbench .cs-founders-side {");
    expect(at).toBeGreaterThan(-1);
    const query = css.lastIndexOf("@media", at);
    expect(css.slice(query, query + 30)).toMatch(/@media \(min-width: 1024px\)/);
    expect(css.slice(at)).toMatch(/\.cs-founders-side \{\s*display: flex;\s*flex-direction: column;/);
    expect(css).toMatch(/\.cs-founders-list \{\s*flex: 1;\s*display: grid;\s*grid-auto-rows: 1fr;/);
    expect(css.slice(at)).toMatch(/\.cs-founder \{\s*justify-content: center;/);
    // Only the one grid-auto-rows rule, inside the 1024 query (phone rows keep their natural height).
    expect(css.match(/grid-auto-rows: 1fr/g)).toHaveLength(1);
  });
});
