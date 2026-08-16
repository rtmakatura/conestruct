// @vitest-environment happy-dom
//
// Quiet-band contrast fixture (arc16 coda, Refs #200).  The arc16 live
// axe pass caught the pre-pin quiet band ("Drop a site pin…") at
// ~3.76:1 — the token's #93a0b0 composited through the band's 0.7
// opacity over --canvas — under the 4.5:1 AA floor (Rule 13: measured,
// not asserted).  Two halves, deliberately paired (arc12 vacuous-guard
// lesson): the static half COMPUTES the band's effective contrast from
// the tokens and rule actually in globals.css; the mounted half proves
// `.jbar-suggest.quiet` still binds to real component DOM, so the
// static guard cannot rot into measuring a rule nothing matches.
//
// Scope: this band only.  The wider faint-register family (.reserved
// etc.) stays on the a11y triage pile by ruling — this fixture must
// not grow into a family sweep.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { JurisdictionControls } from "./JurisdictionSection";

afterEach(cleanup);

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");

function token(name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  expect(m, `token ${name} present as a 6-digit hex`).not.toBeNull();
  return m![1].toLowerCase();
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
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

describe("pre-pin quiet band meets the AA floor (arc16 coda)", () => {
  it("computed contrast of the quiet band's effective ink over --canvas is ≥ 4.5:1", () => {
    // The band's ink: .jbar-suggest base color, from the token.
    const base = css.match(/\.workbench \.jbar-suggest \{[^}]*\}/);
    expect(base).not.toBeNull();
    expect(base![0]).toContain("color: var(--ink-on-dark-faint)");
    const ink = channels(token("--ink-on-dark-faint"));
    const canvas = channels(token("--canvas"));

    // Composite through whatever opacity the quiet rule carries — the
    // guard measures the rendered result, so reintroducing a dimmer
    // fails on the number, not on a property ban.
    const quiet = css.match(/\.workbench \.jbar-suggest\.quiet \{[^}]*\}/);
    expect(quiet).not.toBeNull();
    const op = quiet![0].match(/opacity:\s*([\d.]+)/);
    const alpha = op ? parseFloat(op[1]) : 1;
    const effective = ink.map((v, i) =>
      Math.round(alpha * v + (1 - alpha) * canvas[i]),
    );

    // #93a0b0 on #14202e = 6.19:1 at alpha 1; the 0.7 dimmer measured
    // 3.76:1 (the arc16 axe finding this fixture pins closed).
    expect(contrast(effective, canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it("`.jbar-suggest.quiet` binds to the real pre-pin band in JurisdictionControls", () => {
    const { container } = render(
      <JurisdictionControls
        jurisdiction={null}
        jurisdictionKey={null}
        setJurisdictionKey={() => {}}
        streetClass={null}
        setStreetClass={() => {}}
      />,
    );
    const band = container.querySelector(".jbar-suggest.quiet");
    expect(band).not.toBeNull();
    expect(band!.textContent).toContain(
      "Drop a site pin for a jurisdiction suggestion",
    );
  });
});
