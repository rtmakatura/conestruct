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
    // The one new control: the swap choice (#565: in the right panel's box).
    expect(picker).toContain('className="mw-link mw-search-pick"');
    expect(css).toMatch(/\n\.map-window \.mw-search-pick \{\n {2}display: block;\n {2}width: 100%;\n {2}min-height: 44px;\n/);
    // #565: the choice is inside the box in the right panel, and nothing
    // of the search floats over the map any more.
    const feedback = picker.slice(picker.indexOf('<div className="mw-feedback" role="status" data-testid="search-feedback">'));
    expect(feedback.slice(0, feedback.indexOf("</div>"))).toContain('className="mw-link mw-search-pick"');
    expect(css).not.toContain(".mw-search-list");
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

// #557, Ryan's ruling of 2026-11-24 (docs/prompts/
// cc-prompt-ux-spacing-round.md, item 3).  The sizes are measured in a
// browser (validation-artifacts/committed/missions/ux-spacing-round/
// issue-557/walk.md); these read globals.css and BandPrimitives.tsx as text
// and keep the rules that produce them in place.
describe("#557 the spacing round's page fixes (stylesheet)", () => {
  const primitives = readFileSync(join(__dirname, "bands", "BandPrimitives.tsx"), "utf-8").replace(/\r\n/g, "\n");
  /** The rule's body, only when the rule sits at the top level (column 0). */
  const top = (selector: string): string => {
    const at = css.indexOf(`\n${selector} {\n`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf("\n}", at));
  };

  it("d: the collapsed row's link takes the row actions' rule (.wq-link: Inter 13.5 / 600 in --act, 44 px), with no tracking and no capitals", () => {
    expect(primitives).toContain('className="a-lk wq-link"');
    const wq = top(".workbench .wq-link,\n.workbench .undo-link");
    expect(wq).toMatch(/min-height: 44px;/);
    expect(wq).toMatch(/min-width: 44px;/);
    expect(wq).toMatch(/color: var\(--act\);/);
    expect(wq).toMatch(/font-family: var\(--font-sans\);/);
    expect(wq).toMatch(/font-size: var\(--fs-body-value\);/);
    expect(wq).toMatch(/font-weight: 600;/);
    const lk = top(".workbench .a-fact .a-lk");
    expect(lk).toMatch(/letter-spacing: 0;/);
    expect(lk).toMatch(/text-transform: none;/);
    // The 44 px box on the row's 32 px line: 6 px taken back above and below.
    expect(lk).toMatch(/margin: -6px 0;/);
    expect(lk).not.toMatch(/font-size/);
    // It has to come after both rules it adjusts.
    expect(css.indexOf("\n.workbench .a-fact .a-lk {\n")).toBeGreaterThan(css.indexOf("\n.workbench .wq-link,\n.workbench .undo-link {\n"));
    // On the phone the link has its own 44 px row, so nothing is taken back.
    expect(css).toMatch(/@media \(max-width: 480px\) \{\n {2}\.workbench \.a-fact \.a-lk \{\n {4}margin: 0;\n {2}\}\n\}/);
  });

  it("e: the small aerial's zoom buttons are 44 x 44 at every width, with no smaller size left", () => {
    const z = top(".workbench .a-aerial-zbtn");
    expect(z).toMatch(/min-width: 44px;/);
    expect(z).toMatch(/height: 44px;/);
    // One rule sets the size: the old phone override is gone.
    expect(css.match(/\.workbench \.a-aerial-zbtn \{/g)?.length).toBe(1);
  });

  it("e (S11): under the bar, in one column over 480 px, the zoom is a row, so Reset stays clear of the big-map button", () => {
    expect(css).toContain(
      "\n@container (max-width: 719.98px) {\n  @media (min-width: 481px) {\n    .workbench .a-aerial-frame.has-bar .a-aerial-edit ~ .a-aerial-zoom {\n      flex-direction: row;\n      align-items: flex-start;\n    }\n  }\n}\n",
    );
    // The stack's own rule stays a column (two columns, and with no bar).
    expect(top(".workbench .a-aerial-zoom")).toMatch(/flex-direction: column;/);
    // The phone's rule comes later and keeps its stack on the left.
    const phone = css.indexOf("@media (max-width: 480px) {\n  /* At 380-390 the right column holds Edit on map");
    expect(phone).toBeGreaterThan(css.indexOf("@container (max-width: 719.98px) {\n  @media (min-width: 481px) {"));
    expect(css.slice(phone, phone + 1200)).not.toMatch(/flex-direction/);
  });

  it("f: the hours link has 8 px above it at every width, and the row lines its words up by their baseline", () => {
    expect(top(".workbench .w-hours-row .w-link")).toMatch(/margin-top: 8px;/);
    const row = top(".workbench .w-hours-row");
    expect(row).toMatch(/align-items: baseline;/);
    expect(row).toMatch(/padding: 4px 0 8px;/);
    // After the shared .w-link rule, so the margin is not reset.
    expect(css.indexOf("\n.workbench .w-hours-row .w-link {\n")).toBeGreaterThan(css.indexOf("\n.workbench .w-link {\n"));
  });

  it("g: a Default source line gains 2 px each side by padding, taken back by the margin", () => {
    const d = top('.workbench .w-src[data-source="default"]');
    expect(d).toMatch(/padding: 0 2px;/);
    expect(d).toMatch(/margin: 0 -2px;/);
    expect(css.indexOf('\n.workbench .w-src[data-source="default"] {\n')).toBeGreaterThan(css.indexOf("\n.workbench .w-src {\n"));
  });
});
