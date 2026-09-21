// @vitest-environment happy-dom
//
// #288 Phase 1 clause 2 — the counts hero at rules 80–83.
//
// Two halves, because the change has two halves.  The CSS contract pins
// the ruled shell (happy-dom lays out nothing, so the browser leg
// measures it; this pins the rules the measurement is taken on).  The
// mounted half pins rule 83's degradations, which are the part Part 1
// §8.7 says is KEPT — a restyle that quietly changed them would be a
// behaviour change wearing a stylesheet's clothes.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { ResultsHero } from "./ResultsHero";
import type { DeviceBreakdownState } from "./DeviceBreakdown";
import type { JurisdictionBlock } from "@/lib/jurisdiction";

afterEach(cleanup);

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
function rule(selector: string, from = 0): string {
  const i = css.indexOf(selector + " {", from);
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  return css.slice(i + selector.length + 2, css.indexOf("}", i));
}

const JUR = {
  key: "denver",
  name: "Denver",
  tcp_term: "MHT",
} as unknown as JurisdictionBlock;

const GEOMETRY = {
  taper_l_ft: 205,
  buffer_b_ft: 115,
  device_spacing_ft: 40,
  work_len_ft: 1200,
};
const ready = (over: Record<string, unknown> = {}): DeviceBreakdownState =>
  ({
    state: "ready",
    data: {
      total_devices: 33,
      unique_types: 11,
      devices: [{ jurisdiction_required: true }, { jurisdiction_required: false }],
      zone_geometry: GEOMETRY,
      ...over,
    },
  }) as unknown as DeviceBreakdownState;

describe("#288 clause 2 — the counts hero's ruled shell (rules 80–83)", () => {
  it("rule 80: three tracks 1fr / 1fr / 300px, 20px 22px cells, the ruled ground and hairline", () => {
    const hero = rule(".workbench .hero");
    expect(hero).toMatch(/grid-template-columns:\s*1fr 1fr 300px/);
    expect(hero).toMatch(/border:\s*1px solid var\(--rule\)/);
    expect(hero).toMatch(/background:\s*var\(--da-ground\)/);
    const cell = rule(".workbench .hero-cell");
    expect(cell).toMatch(/padding:\s*20px 22px/);
    expect(cell).toMatch(/border-right:\s*1px solid var\(--da-hair\)/);
    // "last cell none" — the geometry cell is the last, and drops it.
    expect(rule(".workbench .hero-meta")).toMatch(/border-right:\s*none/);
    expect(rule(".workbench .hero-meta")).toMatch(/padding:\s*20px 22px/);
  });

  it("rule 81: the numeral is mono 500 at the RULED size, on one line, in generated-number ink", () => {
    const num = rule(".workbench .hero-cell .num");
    // #283 declared 62px on :root ahead of this surface; clause 2 is the
    // phase that draws it, so the cell reads the token rather than
    // minting the literal again.
    expect(num).toMatch(/font-size:\s*var\(--fs-hero-numeral\)/);
    expect(num).toMatch(/line-height:\s*1;/);
    expect(num).toMatch(/font-weight:\s*500/);
    expect(num).toMatch(/color:\s*var\(--dim\)/);
    expect(num).toMatch(/margin:\s*10px 0 8px/);
    expect(css).toMatch(/--fs-hero-numeral:\s*62px/);
    // Rule 169's 42px at the narrow width, from its own declared token.
    expect(css).toMatch(/--fs-hero-numeral-380:\s*42px/);
    const narrow = css.indexOf("@media (max-width: 980px)", css.indexOf(".workbench .hero {"));
    expect(rule(".workbench .hero-cell .num", narrow)).toMatch(
      /font-size:\s*var\(--fs-hero-numeral-380\)/,
    );
  });

  it("rule 81: the cell label is rule 3's QUIET section header — .18em, provenance ink", () => {
    const k = rule(".workbench .hero-cell .k");
    expect(k).toMatch(/letter-spacing:\s*0\.18em/);
    expect(k).toMatch(/text-transform:\s*uppercase/);
    expect(k).toMatch(/font-weight:\s*500/);
    expect(k).toMatch(/color:\s*var\(--mut/);
  });

  it("rule 82: the geometry rows are space-between, mono 11px, body ink, gap 7px", () => {
    const row = rule(".workbench .hero-meta .row");
    expect(row).toMatch(/justify-content:\s*space-between/);
    expect(row).toMatch(/font-size:\s*11px/);
    expect(row).toMatch(/gap:\s*7px/);
    expect(row).toMatch(/color:\s*var\(--body/);
    // The case-ID line is provenance AT --ink, the one override rule 82
    // names; its SIZE comes from the .tr-prov role, not from here.
    const caseid = rule(".workbench .hero-meta .caseid");
    expect(caseid).toMatch(/color:\s*var\(--ink\)/);
    expect(caseid).not.toMatch(/font-size/);
  });

  it("rule 80 specifies the whole shell, so the old corner ticks are gone", () => {
    const { container } = render(<ResultsHero breakdown={ready()} jurisdiction={JUR} />);
    expect(container.querySelector(".hero .tick")).toBeNull();
    expect(rule(".workbench .hero")).not.toMatch(/position:\s*relative/);
    expect(css).not.toContain(".workbench .hero .tick");
  });

  it("the sub-line and the case-ID line carry the provenance role rather than their own size", () => {
    const { container } = render(<ResultsHero breakdown={ready()} jurisdiction={JUR} />);
    expect(container.querySelector(".hero-cell .sub")!.className).toContain("tr-prov");
    expect(container.querySelector(".hero-meta .caseid")!.className).toContain("tr-prov");
  });
});

describe("#288 clause 2 — rule 83's degradations are UNCHANGED (Part 1 §8.7 KEPT)", () => {
  it("both numerals and both sub-lines still render, from the wire", () => {
    const { container } = render(<ResultsHero breakdown={ready()} jurisdiction={JUR} />);
    expect(Array.from(container.querySelectorAll(".num")).map((n) => n.textContent)).toEqual([
      "33",
      "11",
    ]);
    // The jurisdiction-required tally is the backend's flag, counted, and
    // it still rides the output accent in both sub-lines.
    const subs = Array.from(container.querySelectorAll(".sub")).map((s) => s.textContent);
    expect(subs[0]).toContain("incl. +1 jurisdiction-required");
    expect(subs[1]).toContain("1 from Denver");
  });

  it("the four geometry rows render verbatim from zone_geometry", () => {
    const { container } = render(<ResultsHero breakdown={ready()} jurisdiction={JUR} />);
    const rows = Array.from(container.querySelectorAll(".hero-meta .row")).map(
      (r) => r.textContent,
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]).toBe("Taper L205 ft");
    expect(rows[3]).toBe("Work zone1,200 ft");
    expect(container.querySelector(".caseid")!.textContent).toBe("Denver · MHT");
  });

  it("absent zone_geometry renders ONE honest row — nothing is recomputed locally", () => {
    const { container } = render(
      <ResultsHero breakdown={ready({ zone_geometry: null })} jurisdiction={JUR} />,
    );
    const rows = Array.from(container.querySelectorAll(".hero-meta .row"));
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toBe("Zone geometry unavailable");
    // Rule 12 / Rule 10: no number appears for a value the wire withheld.
    expect(container.querySelector(".hero-meta")!.textContent).not.toMatch(/\d+\s*ft/);
  });

  it("a response missing either count renders NO hero at all", () => {
    for (const missing of [{ total_devices: null }, { unique_types: null }]) {
      const { container } = render(
        <ResultsHero breakdown={ready(missing)} jurisdiction={JUR} />,
      );
      expect(container.querySelector(".hero")).toBeNull();
      cleanup();
    }
  });

  it("no settled breakdown renders no hero — and a loading one holds the previous answer", () => {
    const { container } = render(
      <ResultsHero breakdown={{ state: "loading", lastReady: null } as DeviceBreakdownState} jurisdiction={JUR} />,
    );
    expect(container.querySelector(".hero")).toBeNull();
    cleanup();
    // #192: mid-refetch the hero holds the carried answer; the parent
    // dims it under an explicit ribbon, so it is marked, never current.
    const held = {
      state: "loading",
      lastReady: (ready() as unknown as { data: unknown }).data,
    } as unknown as DeviceBreakdownState;
    const { container: c2 } = render(<ResultsHero breakdown={held} jurisdiction={JUR} />);
    expect(c2.querySelector(".num")!.textContent).toBe("33");
  });
});
