// #263 P11 — ink literals as a CI gate.  Reads the sources (never a
// pre-baked list) and asserts every hex literal is declared in
// lib/design/ink-exceptions.ts, both directions; pins the token-mirror
// literals BY VALUE to the tokens they mirror; and requires the two
// decorative landing SVGs to say so in their header.
//
// Owner swaps (the five `#fff` in A/B/C's globals.css ranges) are an
// allow-list the owners delete rows from: the moment a literal is
// swapped, its row fails as stale until removed — so the list cannot
// quietly outlive the debt it names.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ZONE_COLOR } from "../corridor-zones";
import {
  CODE_LITERALS,
  CSS_DECORATIVE,
  CSS_OWNER_SWAPS,
} from "./ink-exceptions";

const SITE_ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(SITE_ROOT, "app", "globals.css"), "utf-8");

// ---------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------

interface CssHex {
  line: number;
  selector: string;
  hex: string;
}

/** Every hex literal in a declaration, with the innermost rule selector.
 *  Same walker as type-census.test.ts (comments blanked, quotes and
 *  parens tracked); the :root and .workbench token blocks are skipped —
 *  they are where hexes are supposed to live. */
export function cssHexLiterals(source: string): CssHex[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
  const out: CssHex[] = [];
  const stack: string[] = [];
  let buf = "";
  let line = 1;
  let quote: string | null = null;
  let paren = 0;
  const flush = (at: number) => {
    const selector = stack[stack.length - 1] ?? "";
    if (selector !== ":root" && selector !== ".workbench") {
      for (const hex of buf.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])
        out.push({ line: at, selector, hex });
    }
    buf = "";
  };
  for (const ch of stripped) {
    if (ch === "\n") line++;
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "(") paren++;
    else if (ch === ")") paren--;
    if (paren > 0) {
      buf += ch;
      continue;
    }
    if (ch === "{") {
      stack.push(buf.trim().replace(/\s+/g, " "));
      buf = "";
    } else if (ch === "}") {
      flush(line);
      stack.pop();
    } else if (ch === ";") {
      flush(line);
    } else buf += ch;
  }
  return out;
}

/** Code with comments removed (block and line), so a comment may NAME a
 *  rejected hex without declaring one. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/** 6-digit hex literals per source file (tests excluded). */
export function codeHexLiterals(root: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const dir of ["components", "lib", "app"]) {
    for (const rel of readdirSync(join(root, dir), { recursive: true })) {
      const f = String(rel).replace(/\\/g, "/");
      if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
      const file = `${dir}/${f}`;
      // The declaration names the literals it declares — by construction.
      if (file === "lib/design/ink-exceptions.ts") continue;
      const code = stripComments(readFileSync(join(root, file), "utf-8"));
      const hexes = code.match(/#[0-9a-fA-F]{6}(?![0-9a-zA-Z])/g) ?? [];
      if (hexes.length) out.set(file, hexes);
    }
  }
  return out;
}

function token(name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  expect(m, `token ${name}`).not.toBeNull();
  return m![1].toLowerCase();
}

// ---------------------------------------------------------------------
// globals.css outside the token blocks
// ---------------------------------------------------------------------

const observedCss = cssHexLiterals(css);
const cssKey = (r: { selector: string; hex: string }) =>
  `${r.selector} → ${r.hex.toLowerCase()}`;
const declaredCss = [...CSS_DECORATIVE, ...CSS_OWNER_SWAPS];

describe("#263 ink literals — globals.css outside :root / .workbench", () => {
  it("the parser reads the sheet and skips the token blocks", () => {
    expect(observedCss.length).toBeGreaterThan(0);
    expect(observedCss.map((r) => r.selector)).not.toContain(":root");
    expect(observedCss.map((r) => r.selector)).not.toContain(".workbench");
    // The tokens exist (so the skip is a skip, not an absence).
    expect(token("--ink-bright")).toBe("#ffffff");
  });

  it("every literal is a declared decorative or an owner-swap row (a new hex without a role fails)", () => {
    const declared = new Set(declaredCss.map(cssKey));
    const undeclared = observedCss
      .filter((r) => !declared.has(cssKey(r)))
      .map((r) => `globals.css:${r.line}  ${cssKey(r)}`);
    expect(undeclared, "undeclared hex literals").toEqual([]);
  });

  it("every declared row still exists (a swapped owner row must be deleted)", () => {
    const observed = new Set(observedCss.map(cssKey));
    const stale = declaredCss.map(cssKey).filter((k) => !observed.has(k));
    expect(stale, "rows whose literal is gone — delete them").toEqual([]);
  });

  it("the decorative set is exactly the two ruled sites and the owner swaps are #fff only", () => {
    expect(CSS_DECORATIVE.map((r) => r.hex)).toEqual(["#1a1200", "#4a6280"]);
    for (const s of CSS_OWNER_SWAPS) expect(s.hex).toBe("#fff");
    expect(CSS_OWNER_SWAPS).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------
// components / lib / app
// ---------------------------------------------------------------------

const observedCode = codeHexLiterals(SITE_ROOT);

describe("#263 ink literals — code (comments stripped)", () => {
  it("the scanner reads the tree", () => {
    expect(observedCode.get("components/TaperViz.tsx")?.length).toBe(18);
  });

  it("every file with a literal is declared with its exact set and count; every declared file still has them", () => {
    const declared = new Map(CODE_LITERALS.map((f) => [f.file, f]));
    const undeclared = [...observedCode.keys()].filter((f) => !declared.has(f));
    expect(undeclared, "files with undeclared hex literals").toEqual([]);
    for (const f of CODE_LITERALS) {
      const hexes = observedCode.get(f.file);
      expect(hexes, `${f.file} declared but carries no literal`).toBeDefined();
      expect([...new Set(hexes)].sort(), f.file).toEqual([...f.hexes].sort());
      expect(hexes!.length, `${f.file} occurrence count`).toBe(f.count);
    }
  });

  it("TaperViz and PlanSheet declare themselves decorative in their header", () => {
    for (const f of CODE_LITERALS.filter((x) => x.headerMarker)) {
      const head = readFileSync(join(SITE_ROOT, f.file), "utf-8").split("\n").slice(0, 12).join("\n");
      expect(head, f.file).toContain(f.headerMarker!);
      expect(f.disposition).toBe("decorative");
    }
  });
});

// ---------------------------------------------------------------------
// Token mirrors — by value
// ---------------------------------------------------------------------

describe("#263 ink literals — the token mirrors equal their tokens", () => {
  const picker = readFileSync(
    join(SITE_ROOT, "components", "LocationPickerModal.tsx"),
    "utf-8",
  );
  const constant = (name: string) => {
    const m = picker.match(new RegExp(`const ${name} = "(#[0-9a-fA-F]{6})"`));
    expect(m, name).not.toBeNull();
    return m![1];
  };

  it("PIN_COLOR === --dim-deep", () => {
    expect(constant("PIN_COLOR").toLowerCase()).toBe(token("--dim-deep"));
  });

  it("CROSS_PIN_COLOR === ZONE_COLOR.work_zone", () => {
    expect(constant("CROSS_PIN_COLOR")).toBe(ZONE_COLOR.work_zone);
  });

  it("the Generate spinner's #06222F === --on-act", () => {
    const prim = readFileSync(
      join(SITE_ROOT, "components", "GeneratorFormPrimitives.tsx"),
      "utf-8",
    );
    expect(prim).toContain("border-[#06222F]/40 border-t-[#06222F]");
    expect("#06222F".toLowerCase()).toBe(token("--on-act"));
  });

  it("Mapbox label paint is the only place #ffffff / #000000 appear in the picker", () => {
    const code = stripComments(picker);
    const paint = code.match(/paint: \{[^}]*"text-color": "#ffffff",[^}]*"text-halo-color": "#000000",[^}]*\}/);
    expect(paint).not.toBeNull();
    expect((code.match(/#ffffff/g) ?? []).length).toBe(1);
    expect((code.match(/#000000/g) ?? []).length).toBe(1);
  });
});
