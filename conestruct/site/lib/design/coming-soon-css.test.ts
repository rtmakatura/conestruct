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
