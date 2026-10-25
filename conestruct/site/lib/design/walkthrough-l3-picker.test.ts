// #396 L3 (mission site-walkthrough-audit, W14): the location picker at
// phone width fills the screen, keeps "Save & Close" on one line and
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

  it("the footer wraps below md only, and each status line takes a full line there", () => {
    const footer = classesWith("flex flex-wrap md:flex-nowrap");
    expect(footer).toEqual(expect.arrayContaining(["justify-end", "gap-3"]));
    const status = [...src.matchAll(/className="([^"]*basis-full[^"]*)"/g)].map((m) => m[1].split(/\s+/));
    expect(status).toHaveLength(2);
    for (const c of status) expect(c).toContain("md:basis-auto");
  });

  it("Save & Close never breaks its label", () => {
    const save = /className="([^"]*)"\s*>\s*Save &amp; Close/.exec(src);
    expect(save?.[1].split(/\s+/)).toContain("whitespace-nowrap");
  });

  it("the picker stacks above the workbench frame and below the working band", () => {
    // Edge to edge at phone width, a picker under the frame (z 60, fixed,
    // inset 8 px) would show the frame's rule through it (#232).
    expect(classesWith("fixed inset-0 z-")).toContain("z-[var(--z-modal)]");
    expect(zOf("--z-modal")).toBeGreaterThan(zOf("--z-frame"));
    expect(zOf("--z-modal")).toBeLessThan(zOf("--z-band"));
  });
});
