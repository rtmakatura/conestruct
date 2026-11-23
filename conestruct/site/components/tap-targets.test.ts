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
    // Seven: Close, the search box and its search button, Cancel,
    // Save & Close, the intersection pin's Clear, and Re-detect.  #537
    // removed the "Or enter coordinates manually" toggle and its Latitude
    // and Longitude fields (three of the old ten).  #541 removed the
    // coordinates bar's controls; the search box is the only field-input.
    expect(picker.match(/className="tap-44 /g)?.length).toBe(7);
    expect(picker).toMatch(/aria-label="Close"\s+className="tap-44 /);
    expect(picker).toMatch(/data-testid="picker-redetect"\s+className="tap-44 /);
    expect(picker.match(/className="field-input/g)?.length).toBeUndefined();
    expect(picker.match(/className="tap-44 field-input mw-search-input"/g)?.length).toBe(1);
    expect(picker).toContain('className="picker-map ');
  });

  it("#541: the coordinates line is 44 px and holds no control; the 'Did you mean' choice is 44 px", () => {
    // The line under the map: no button, input or form inside it.
    const bar = picker.slice(picker.indexOf('<div className="mw-cbar" data-testid="coords-bar">'));
    const line = bar.slice(0, bar.indexOf("</div>"));
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toMatch(/<(button|input|form|a)\b/);
    expect(picker).not.toMatch(/mw-cbar-(edit|input|go|cancel|face)/);
    // Top-level rules (no media or container query), so they hold at every width.
    expect(css).toContain("\n.map-window .mw-cbar {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  height: 44px;\n  flex-shrink: 0;");
    // The phone query changes the side padding only.
    const phone = css.slice(css.indexOf("@media (max-width: 479px) {\n  .map-window .mw-cbar {"));
    expect(phone).toMatch(/^@media \(max-width: 479px\) \{\n {2}\.map-window \.mw-cbar \{\n {4}padding: 0 16px;\n {2}\}\n\}/);
    // The one new control: the swap choice in the search's floating list.
    expect(picker).toContain('className="mw-link mw-search-pick"');
    expect(css).toMatch(/\n\.map-window \.mw-search-pick \{\n {2}display: block;\n {2}width: 100%;\n {2}min-height: 44px;\n/);
    // The list floats: it is out of the flow, so no line in it resizes the page.
    expect(css).toMatch(/\n\.map-window \.mw-search-list \{\n {2}position: absolute;\n/);
  });

  it("R140: the form chip rows are 44 at every width, outside any media query", () => {
    const at = css.indexOf("/* R140: the form chip rows");
    expect(at).toBeGreaterThan(0);
    expect(css.slice(at)).toMatch(/\*\/\n\.workbench \.band-stack \.chip \{\n {2}min-height: 44px;\n\}/);
    // and no longer on rule 15's 32 px desk list
    expect(css).not.toMatch(/\.band-stack \.chip \{\n {2}min-height: 32px/);
    expect(css).not.toMatch(/\.band-stack \.chip,\n/);
  });

  it("the cross-street lane confirm carries tap-44; its undo is the shared link, 44 px on its own", () => {
    // #457 rulings 1-3: the undo left tap-44 for .undo-link, whose rule
    // floors it at 44 px (undo-link.test.tsx, GeneratorShell.hit-targets).
    expect(ni.match(/className="tap-44 mt-1\.5/g)?.length).toBe(1);
    expect(ni.match(/className="undo-link"/g)?.length).toBe(1);
  });
});

// #545, Ryan's ruling 4 of 2026-11-22 (docs/prompts/
// cc-prompt-ux-map-window-tidy.md).  Mapbox shows its compact "Toggle
// attribution" button whenever the map is 640 px wide or less, whatever the
// viewport, so its 44 px tap area can't live in the phone-width block.  The
// tap area itself is probed in a browser (validation-artifacts/committed/
// missions/ux-map-window-tidy/issue-545/); this keeps the rules in place.
describe("#545 the attribution button's tap area", () => {
  const rule =
    '\n.picker-map .mapboxgl-ctrl-attrib-button::after {\n  content: "";\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  width: 44px;\n  height: 44px;\n  transform: translate(-50%, -50%);\n}\n';

  it("globals.css gives the picker's attribution button a 44 x 44 ::after centred on it, with no background, border or shadow", () => {
    expect(css).toContain(rule);
  });

  it("that rule is at the top level of globals.css, before the 480 px block, so it holds at every width", () => {
    // Top level: the last thing before it that starts at column 0 closes a
    // block (rules inside an @media block are indented), and the 480 px
    // block opens after it.
    const at = css.indexOf(rule);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(css.indexOf("@media (max-width: 480px) {\n  .tap-44 {"));
    const before = css.slice(0, at);
    expect(before.lastIndexOf("\n}\n")).toBeGreaterThan(before.lastIndexOf("\n@media"));
  });

  it("with the line open, a clip-path cuts a 6 x 20 px notch out of that ::after's left edge, and no rule in globals.css styles the attribution's line or its links", () => {
    expect(css).toContain(
      "\n.picker-map .mapboxgl-compact-show .mapboxgl-ctrl-attrib-button::after {\n  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 32px, 6px 32px, 6px 12px, 0 12px);\n}\n",
    );
    expect(css).not.toMatch(/mapboxgl-ctrl-attrib-inner[^{}]*\{/);
    expect(css).not.toMatch(/mapboxgl-ctrl-attrib[^{}]* a\b[^{}]*\{/);
  });

  it("no rule in globals.css that names the attribution sets display: none, visibility: hidden, opacity: 0, a font size or a text colour", () => {
    const rules = [...css.matchAll(/([^{}]*mapboxgl-ctrl-attrib[^{}]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const m of rules) {
      expect(m[2], m[1].trim()).not.toMatch(/display:\s*none|visibility:\s*hidden|opacity:\s*0|font-size|(?<![-\w])color:/);
    }
  });
});
