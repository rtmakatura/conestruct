// R142 guard: Mapbox's wordmark is always shown.  GL JS hides its own logo
// control with an inline `display: none` when a source says
// `mapbox_logo: false`; one top-level `!important` rule outranks it at every
// width.  The live check is the 1440/360 satellite screenshots
// (validation-artifacts/committed/phase4-380-arc/r142-wordmark/); this keeps
// the rule from being dropped, scoped into a media query, or turned into a
// restyle of the logo itself.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

describe("R142: the Mapbox wordmark is always shown", () => {
  it("one top-level rule forces the logo control's container visible", () => {
    // Column 0: not inside any @media block (those indent their rules).
    expect(css).toContain(
      "\n.mapboxgl-ctrl:has(> .mapboxgl-ctrl-logo) {\n  display: block !important;\n}\n",
    );
    expect(css.match(/\.mapboxgl-ctrl:has\(> \.mapboxgl-ctrl-logo\)/g)?.length).toBe(1);
  });

  it("the 44 px attribution toggle draws its icon once (R138's tiled-icon regression)", () => {
    const at = css.indexOf(".picker-map .mapboxgl-ctrl-attrib-button {");
    expect(at).toBeGreaterThan(0);
    expect(css.slice(at, css.indexOf("}", at))).toMatch(/background-repeat:\s*no-repeat/);
  });

  it("nothing in our CSS styles, hides or resizes the logo itself", () => {
    expect(css).not.toMatch(/\.mapboxgl-ctrl-logo\s*[{,]/);
    expect(css).not.toMatch(/\.mapboxgl-ctrl-bottom-left[^{]*\{[^}]*display:\s*none/);
  });
});
