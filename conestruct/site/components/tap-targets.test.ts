// Phase 4 / R138 tap-target guard.  The sizes themselves are measured in
// a real browser (validation-artifacts/committed/phase4-380-arc/tap-targets/);
// this static scan keeps the hooks that produce them from rotting: the
// phone-width rules in globals.css, the `tap-44` class on every picker and
// cross-street-confirm control the 360x800 census found under 44 px, and
// the segmented control's frame staying off the button track.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
const picker = readFileSync(join(__dirname, "LocationPickerModal.tsx"), "utf-8").replace(/\r\n/g, "\n");
const ni = readFileSync(join(__dirname, "NearIntersectionForm.tsx"), "utf-8").replace(/\r\n/g, "\n");

function block(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
}

describe("R138 tap targets", () => {
  it("the segmented control frames with an inset shadow, not a border", () => {
    const seg = block(".workbench .a-seg");
    expect(seg).toMatch(/height:\s*44px/);
    expect(seg).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
    expect(seg).not.toMatch(/\bborder:/);
  });

  it("the phone rules lift every listed control to 44 px", () => {
    const phone = css.slice(css.indexOf("R138 (Phase 4, tap targets): the rest of WHERE"));
    for (const sel of [
      ".workbench .a-lk {\n    min-width: 44px",
      ".workbench .a-footline {\n    min-height: 44px",
      ".workbench .field-input {\n    min-height: 44px",
      ".workbench .range-orange {\n    height: 44px",
    ]) {
      expect(phone).toContain(sel);
    }
    const tap = css.slice(css.indexOf("@media (max-width: 480px) {\n  .tap-44 {"));
    expect(tap).toMatch(/^@media \(max-width: 480px\) \{\n {2}\.tap-44 \{\n {4}min-height: 44px;\n {4}min-width: 44px;/);
    expect(tap).toContain(".picker-map .mapboxgl-ctrl-group button {\n    width: 44px;\n    height: 44px;");
    expect(tap).toContain(".picker-map .mapboxgl-ctrl-attrib-button {\n    width: 44px;\n    height: 44px;");
  });

  it("every picker control the census found under 44 carries tap-44", () => {
    // Close, coordinate toggle, STREETS, CHANGE, Re-detect, Cancel,
    // Save & Close, and the three text fields.
    expect(picker.match(/className="tap-44 /g)?.length).toBe(10);
    expect(picker).toMatch(/aria-label="Close"\s+className="tap-44 /);
    expect(picker).toMatch(/data-testid="picker-redetect"\s+className="tap-44 /);
    expect(picker).not.toMatch(/className="field-input/);
    expect(picker).toContain('className="picker-map ');
  });

  it("R140: the form chip rows are 44 at every width, outside any media query", () => {
    const at = css.indexOf("/* R140: the form chip rows");
    expect(at).toBeGreaterThan(0);
    expect(css.slice(at)).toMatch(/\*\/\n\.workbench \.band-stack \.chip \{\n {2}min-height: 44px;\n\}/);
    // and no longer on rule 15's 32 px desk list
    expect(css).not.toMatch(/\.band-stack \.chip \{\n {2}min-height: 32px/);
    expect(css).not.toMatch(/\.band-stack \.chip,\n/);
  });

  it("the cross-street lane confirm and its undo carry tap-44", () => {
    expect(ni.match(/className="tap-44 mt-1\.5/g)?.length).toBe(2);
  });
});
