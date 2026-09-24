// @vitest-environment happy-dom
//
// #289 fidelity F6 — the controls, Part 2 rules 130–135 and 29.  The
// audit (fidelity-audit.md, rows 48–61, 92–97, 142–153) measured each of
// these on prod; this suite pins the sheet's rule for each one and the
// rendered markup of the two strings the pass changed (the Generate
// reason line and the draft notice), so none can drift back silently.
// The rendered pixels are the re-run audit's to confirm.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GenerateButton } from "./GeneratorFormPrimitives";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");

function rule(selector: string): string {
  const i = css.indexOf(selector + " {");
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1);
  return css.slice(i + selector.length + 2, css.indexOf("}", i));
}

describe("rule 130 — the primary", () => {
  it("text on the act fill is #0c1622 (--on-act)", () => {
    expect(css).toMatch(/--on-act:\s*#0c1622;/);
    expect(rule(".workbench .a-pri")).toMatch(/color:\s*var\(--on-act\)/);
  });

  it("FIND's label is rule 8's body value, 13.5 — Ryan, 2026-09-24, over F6's 15.5", () => {
    // "'Pick on map' / 'Edit on map' text drops to the body value size
    // (rule 8, 13.5 px) — too large."  The other primaries keep 15.5.
    expect(rule(".workbench .a-findrow .a-pri")).toMatch(/font-size:\s*var\(--fs-body-value\)/);
    expect(css).toMatch(/--fs-body-value:\s*13\.5px;/);
    expect(rule(".workbench .a-pri")).toMatch(/font-size:\s*var\(--fs-primary\)/);
  });

  it("rule 114's box: 1fr / 132 px, 44 px, and the label never wraps (post-fidelity hand-check, finding 1)", () => {
    expect(rule(".workbench .a-findrow")).toMatch(/grid-template-columns:\s*1fr 132px/);
    const find = rule(".workbench .a-findrow .a-pri");
    expect(find).toMatch(/height:\s*44px/);
    expect(find).toMatch(/white-space:\s*nowrap/);
    // The source strings: the ruled "Pick on map", and its located pair.
    const where = readFileSync(join(__dirname, "bands", "WhereBand.tsx"), "utf-8");
    expect(where).toContain('located ? "Edit on map" : "Pick on map"');
    // (The comment above the expression quotes the retired label; the
    // expression is what renders.)
    expect(where).not.toMatch(/: *"Pick Location on Map"|\? *"Edit Location & Corridor/);
  });

  it("an aria-disabled primary takes the disabled pair, not the live fill", () => {
    const off = rule(".workbench .a-pri:disabled,\n.workbench .a-pri[aria-disabled=\"true\"]");
    expect(off).toMatch(/background:\s*var\(--pri-off\)/);
    expect(off).toMatch(/color:\s*var\(--pri-off-ink\)/);
  });

  it("rule 115: WHERE's confirm sits 14 px under the chips", () => {
    expect(rule(".workbench .a-pri.a-confirm")).toMatch(/margin-top:\s*14px/);
  });
});

describe("rule 131 — Generate, the XL primary", () => {
  it("is not uppercased by CSS, and holds 66 px / 17.5 at every width", () => {
    const xl = rule(".workbench .a-genframe .generate-btn");
    expect(xl).toMatch(/height:\s*66px/);
    expect(xl).toMatch(/font-size:\s*var\(--fs-primary-xl\)/);
    expect(xl).not.toMatch(/text-transform/);
    // No step-down to 48 at 380: rule 131 names the frame at 380 as XL.
    expect(css).not.toMatch(/\.workbench \.a-genframe \.generate-btn \{\s*height:\s*48px/);
  });

  it("is grey only when disabled — rule 130's pair", () => {
    const off = rule(".workbench .a-genframe .generate-btn:disabled");
    expect(off).toMatch(/background:\s*var\(--pri-off\)/);
    expect(off).toMatch(/color:\s*var\(--pri-off-ink\)/);
  });

  it("the label is the string as written, and the reason reads in the provenance role — not red, not uppercase", () => {
    const html = renderToStaticMarkup(
      <GenerateButton generating={false} onGenerate={() => {}} disabled disabledReason="choose the kind of work" />,
    );
    expect(html).toContain(">Generate plan<");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const reason = doc.querySelector('[data-testid="cta-reason"]')!;
    expect(reason.getAttribute("role")).toBe("alert");
    expect(reason.classList.contains("tr-prov")).toBe(true);
    expect(reason.className).not.toMatch(/uppercase|--fail/);
  });
});

describe("rule 132 — the ghost (download buttons)", () => {
  it("44 px, Inter 500 13, #eaf0f7 on a transparent ground, a #2c3e53 hairline", () => {
    const g = rule(".workbench .dl-btn");
    expect(g).toMatch(/min-height:\s*44px/);
    expect(g).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(g).toMatch(/font-size:\s*13px/);
    expect(g).toMatch(/font-weight:\s*500/);
    expect(g).toMatch(/color:\s*var\(--ink\)/);
    expect(g).toMatch(/background:\s*transparent/);
    expect(g).toMatch(/border:\s*1px solid var\(--rule\)/);
  });
});

describe("rule 133 — the ledger action", () => {
  it("every ledger action is mono 9.5 .14em uppercase at rest", () => {
    for (const sel of [
      ".workbench .needs-you .act",
      ".workbench .dl-all .act",
      ".workbench .jbar-suggest button.confirm,\n.workbench .jbar-suggest button.ghost",
    ]) {
      const r = rule(sel);
      expect(r, sel).toMatch(/font-size:\s*9\.5px/);
      expect(r, sel).toMatch(/letter-spacing:\s*0\.14em/);
      expect(r, sel).toMatch(/text-transform:\s*uppercase/);
      expect(r, sel).toMatch(/color:\s*var\(--ink-on-dark\)/);
    }
  });

  it("disabled is opacity .45 on the control's own ink", () => {
    const off = rule(
      ".workbench:not(.ws-locked) .needs-you .act:disabled,\n.workbench:not(.ws-locked) .needs-you .act:disabled:hover",
    );
    expect(off).toMatch(/opacity:\s*0\.45/);
    expect(off).toMatch(/color:\s*var\(--ink-on-dark\)/);
  });
});

describe("rule 135 / rule 5 — the flat chip speaks in the field-label role", () => {
  it("Inter 500 12.5 #eaf0f7", () => {
    const c = rule(".workbench .a-chip-flat");
    expect(c).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(c).toMatch(/font-weight:\s*500/);
    expect(c).toMatch(/font-size:\s*var\(--fs-field-label\)/);
    expect(c).toMatch(/color:\s*var\(--ink\)/);
  });
});

describe("rule 165 — the verdict strip at 380 (#289 fidelity follow-up)", () => {
  it("wraps; the word claims the first line so the pill drops to a second, at 8.5 px, without margin-left auto", () => {
    const at = css.indexOf("Rule 165 — at 380");
    expect(at).toBeGreaterThan(-1);
    const q = css.slice(css.indexOf("@media (max-width: 480px)", at), css.indexOf("\n}\n", at) + 2);
    expect(q).toMatch(/\.workbench \.status-bar \{\s*flex-wrap: wrap;/);
    expect(q).toMatch(/min-width: calc\(100% - 24px\)/);
    expect(q).toMatch(/\.workbench \.status-bar \.pill \{\s*margin-left: 0;\s*font-size: 8\.5px;/);
  });
});

describe("rule 130 busy — the motion is the working band's, never the button's", () => {
  it("the busy Generate carries no spinner, only the present participle", () => {
    const html = renderToStaticMarkup(<GenerateButton generating onGenerate={() => {}} />);
    expect(html).toContain("Generating plan…");
    expect(html).not.toMatch(/animate-spin|rounded-full/);
  });
});

describe("rule 29 — the draft notice", () => {
  it("18 px above it", () => {
    expect(rule(".workbench .draft-notice")).toMatch(/margin-top:\s*18px/);
  });
});
