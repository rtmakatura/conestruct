// #396 L3 (mission site-walkthrough-audit, W14): the location picker at
// phone width fills the screen, keeps "Save and close" on one line and
// puts the footer's warning on its own line.  Pinned as classes in the
// source; the rendered proof (rects at 1440, 390, 360 and WebKit 390,
// before vs after) is committed under
// validation-artifacts/committed/missions/site-walkthrough-audit/L3/.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SITE = join(__dirname, "..", "..");
const src = readFileSync(join(SITE, "components", "LocationPickerModal.tsx"), "utf-8");
const css = readFileSync(join(SITE, "app", "globals.css"), "utf-8");
const zOf = (name: string) => Number(new RegExp(`${name}:\\s*(\\d+);`).exec(css)?.[1]);

/** The body of the first CSS rule whose selector is exactly `sel`. */
function rule(sel: string): string {
  const at = css.search(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{`));
  if (at < 0) return "";
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

/** The className of the first element whose className contains `marker`. */
function classesWith(marker: string): string[] {
  const m = new RegExp(`className="([^"]*${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"]*)"`).exec(src);
  return m ? m[1].split(/\s+/) : [];
}

describe("W14 — the location picker at phone width", () => {
  it("the backdrop has no padding below md, so the dialog covers the page; desktop keeps md:p-6", () => {
    const c = classesWith("fixed inset-0 z-");
    expect(c).toContain("p-0");
    expect(c).toContain("md:p-6");
    expect(c).not.toContain("p-2");
  });

  // #507 ruling 1 moved the footer's layout from Tailwind classes to the
  // map window's own rules in globals.css (.mw-foot / .mw-foot-line /
  // .mw-btn); the W14 contract is the same, read where it now lives.
  it("the footer wraps below md only, and each status line takes a full line there", () => {
    const foot = rule(".map-window .mw-foot");
    expect(foot).toMatch(/flex-wrap:\s*wrap/);
    expect(foot).toMatch(/justify-content:\s*flex-end/);
    expect(rule(".map-window .mw-foot-line")).toMatch(/flex-basis:\s*100%/);
    const md = /@media screen and \(min-width: 980px\) \{\s*\.map-window \.mw-foot \{([^}]*)\}\s*\.map-window \.mw-foot-line \{([^}]*)\}/.exec(css);
    expect(md?.[1]).toMatch(/flex-wrap:\s*nowrap/);
    expect(md?.[2]).toMatch(/flex-basis:\s*auto/);
    // Both status lines (blocked, waiting) carry the class.
    expect([...src.matchAll(/className="mw-foot-line"/g)]).toHaveLength(2);
    expect(src).toMatch(/className="mw-foot"/);
  });

  it("Save and close never breaks its label", () => {
    const save = /className="([^"]*)"\s*>\s*Save and close/.exec(src);
    expect(save?.[1].split(/\s+/)).toContain("mw-btn");
    expect(rule(".map-window .mw-btn")).toMatch(/white-space:\s*nowrap/);
  });

  it("the picker stacks above the workbench frame and below the working band", () => {
    // Edge to edge at phone width, a picker under the frame (z 60, fixed,
    // inset 8 px) would show the frame's rule through it (#232).
    expect(classesWith("fixed inset-0 z-")).toContain("z-[var(--z-modal)]");
    expect(zOf("--z-modal")).toBeGreaterThan(zOf("--z-frame"));
    expect(zOf("--z-modal")).toBeLessThan(zOf("--z-band"));
  });
});
