// R143 guard: the floor is 320 px.  The fit itself is measured in a real
// browser by scripts/verify-phone-fit.cjs (every stage at 320×800 and
// 360×800, no sideways scroll); this keeps the pieces that make it hold:
// the audit row's phone layout, the results tap targets, and the docs and
// script that name the floor (DESIGN-SPACING names the script).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...p: string[]) => readFileSync(join(__dirname, ...p), "utf-8").replace(/\r\n/g, "\n");
const css = read("..", "app", "globals.css");
const quote = read("QuotePanel.tsx");
const spacing = read("..", "DESIGN-SPACING.md");

describe("R143: the audit calculation row wraps at the phone width", () => {
  const at = css.indexOf("/* R143 (Phase 4, the floor at 320)");
  const block = css.slice(at, css.indexOf("\n}\n", at));

  it("is phone-only: the title has the row, the result and the cite drop under it", () => {
    expect(at).toBeGreaterThan(0);
    expect(block).toContain("@media (max-width: 480px) {");
    expect(block).toContain("grid-template-columns: 36px minmax(0, 1fr) auto;");
    expect(block).toContain('"num title chev"\n      ". result ."\n      ". cite .";');
    expect(block).toContain(".workbench .audit-head .result {\n    grid-area: result;");
    expect(block).toContain(".workbench .audit-head .cite {\n    grid-area: cite;");
  });

  it("leaves the desk row's five columns alone", () => {
    expect(css).toContain("grid-template-columns: 36px 1fr auto auto auto;");
  });
});

describe("R143: the results tap targets", () => {
  it("the quote's number input and its download controls carry tap-44", () => {
    // The input (one component, 8 fields), Preview + Download (md:flex-1),
    // and the three state-dependent download controls (block w-full).
    expect(quote.match(/className="tap-44 /g)?.length).toBe(6);
    expect(quote).toContain('className="tap-44 bg-[color:var(--canvas)] border');
  });
});

describe("R143: the floor is named where sizes are named", () => {
  it("DESIGN-SPACING names 320 as the floor and the fit check", () => {
    expect(spacing).toContain("| **320×800** | the floor, a fit check only (R143): no stage scrolls sideways |");
    expect(spacing).toContain("`scripts/verify-phone-fit.cjs`");
    expect(spacing).not.toMatch(/floor-message branch/);
  });
  // (The script itself lives outside the site; reading it here would make
  // it a Vercel build input — tests/build-inputs.test.ts — so it isn't.)
});
