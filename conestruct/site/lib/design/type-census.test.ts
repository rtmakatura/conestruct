// #263 — the static type census (P5: "no other type sizes", as a CI
// gate).  Parses every `font-size` declaration in app/globals.css with
// its innermost selector (:root excluded) and every Tailwind size class
// in components/**/*.tsx + app/**/*.tsx, and asserts the observed set
// equals the declaration in lib/design/type-exceptions.ts in BOTH
// directions: a new size, a new site, a resized site, or a stale row all
// fail by name.  `.tr-*` blocks are checked against the role table
// instead of the list.
//
// Rule 5: declare, then enforce — this round declares 100% of today's
// sizes (named exceptions + owned debt) and folds nothing.  The rendered
// tuple census (63 on /sandbox, audit 2e0b25e) is the Playwright
// evidence leg; this file is what runs in CI.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CENSUS_PINS,
  ROLE_CLASSES,
  TYPE_DEBT,
  TYPE_EXCEPTIONS,
  type CssSite,
  type TsxSite,
} from "./type-exceptions";
import { TYPE_ROLES } from "./type-roles";

const SITE_ROOT = join(__dirname, "..", "..");

// ---------------------------------------------------------------------
// Parsers — the census reads the sources, never a pre-baked list.
// ---------------------------------------------------------------------

interface CssDecl extends CssSite {
  line: number;
}

/** Every `font-size` declaration with the innermost rule selector.
 *  Comments are blanked (line numbers kept); quotes and parentheses are
 *  tracked so a `url("data:…;…")` cannot split a declaration; at-rule
 *  nesting (@layer / @media / @container) pushes like a rule, so the
 *  innermost selector is the rule's own. */
export function cssFontSizes(css: string): CssDecl[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
  const out: CssDecl[] = [];
  const stack: string[] = [];
  let buf = "";
  let line = 1;
  let quote: string | null = null;
  let paren = 0;
  const flush = (at: number) => {
    const m = /^font-size\s*:\s*(.+)$/.exec(buf.trim());
    if (m)
      out.push({
        line: at,
        selector: stack[stack.length - 1] ?? "",
        size: m[1].trim(),
      });
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

const TAILWIND_SIZE =
  /(?<![\w-])text-(\[[0-9.]+(?:px|rem|em)\]|xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g;

/** Every Tailwind size class per file (tests excluded), with its count. */
export function tsxSizeClasses(root: string): TsxSite[] {
  const counts = new Map<string, number>();
  for (const dir of ["components", "app"]) {
    for (const rel of readdirSync(join(root, dir), { recursive: true })) {
      const f = String(rel).replace(/\\/g, "/");
      if (!f.endsWith(".tsx") || f.endsWith(".test.tsx")) continue;
      const file = `${dir}/${f}`;
      const text = readFileSync(join(root, file), "utf-8");
      for (const m of text.matchAll(TAILWIND_SIZE)) {
        const key = `${file} ${m[0]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts]
    .map(([key, count]) => {
      const [file, cls] = key.split(" ");
      return { file, cls, count };
    })
    .sort((a, b) => (a.file + a.cls).localeCompare(b.file + b.cls));
}

// ---------------------------------------------------------------------
// The census
// ---------------------------------------------------------------------

const css = readFileSync(join(SITE_ROOT, "app", "globals.css"), "utf-8");
const observedCss = cssFontSizes(css).filter(
  (d) => !d.selector.includes(":root"),
);
const observedTsx = tsxSizeClasses(SITE_ROOT);

const cssKey = (s: CssSite) => `${s.selector} → ${s.size}`;
const tsxKey = (s: TsxSite) => `${s.file} ${s.cls} ×${s.count}`;

const isRoleBlock = (selector: string) =>
  ROLE_CLASSES.some((c) => selector.endsWith(`.${c}`));

const declaredCss = [
  ...TYPE_EXCEPTIONS.flatMap((e) => e.css),
  ...TYPE_DEBT.flatMap((d) => d.css),
];
const declaredTsx = [
  ...TYPE_EXCEPTIONS.flatMap((e) => e.tsx),
  ...TYPE_DEBT.flatMap((d) => d.tsx),
];

describe("#263 type census — globals.css font-sizes", () => {
  it("the parser reads the sheet (a broken parser must not pass vacuously)", () => {
    expect(observedCss.length).toBeGreaterThan(50);
    // Sanity anchors: the four role blocks and the hero numeral are found
    // with their real selectors.
    expect(observedCss.map(cssKey)).toEqual(
      expect.arrayContaining([
        ".workbench .tr-section → 10px",
        ".workbench .tr-field → 12px",
        ".workbench .hero-cell .num → 76px",
      ]),
    );
  });

  it("every .tr-* block carries its role's size (type-roles.ts)", () => {
    const roleBlocks = observedCss.filter((d) => isRoleBlock(d.selector));
    expect(roleBlocks).toHaveLength(ROLE_CLASSES.length);
    for (const block of roleBlocks) {
      const role = Object.values(TYPE_ROLES).find((r) =>
        block.selector.endsWith(`.${r.cssClass}`),
      );
      expect(role, block.selector).toBeDefined();
      expect(block.size, block.selector).toBe(role!.size);
    }
  });

  it("every other font-size site is a named exception or a declared-debt row (new size/site fails)", () => {
    const declared = new Set(declaredCss.map(cssKey));
    const undeclared = observedCss
      .filter((d) => !isRoleBlock(d.selector))
      .filter((d) => !declared.has(cssKey(d)))
      .map((d) => `globals.css:${d.line}  ${cssKey(d)}`);
    expect(undeclared, "undeclared font-size sites").toEqual([]);
  });

  it("every declared row still exists (a stale row fails)", () => {
    const observed = new Set(observedCss.map(cssKey));
    const stale = declaredCss.map(cssKey).filter((k) => !observed.has(k));
    expect(stale, "declared rows with no matching declaration").toEqual([]);
  });

  it("no site is declared twice", () => {
    const keys = declaredCss.map(cssKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("#263 type census — Tailwind size classes in components/ and app/", () => {
  it("the scanner reads the tree", () => {
    expect(observedTsx.length).toBeGreaterThan(50);
    expect(observedTsx.map(tsxKey)).toContain(
      "components/GeneratorShell.tsx text-[28px] ×1",
    );
  });

  it("every (file, class, count) is declared exactly — a new class, file, or extra use fails", () => {
    const declared = new Set(declaredTsx.map(tsxKey));
    const undeclared = observedTsx
      .filter((s) => !declared.has(tsxKey(s)))
      .map(tsxKey);
    expect(undeclared, "undeclared Tailwind size sites (or count drift)").toEqual([]);
  });

  it("every declared Tailwind row still exists", () => {
    const observed = new Set(observedTsx.map(tsxKey));
    const stale = declaredTsx.map(tsxKey).filter((k) => !observed.has(k));
    expect(stale).toEqual([]);
  });

  it("no Tailwind site is declared twice", () => {
    const keys = declaredTsx.map((s) => `${s.file} ${s.cls}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("#263 type census — the exceptions are the ruled set and the pins are the sources' figures", () => {
  it("exception sizes are exactly the ruling's: 76/60, 28, 20/17, 16, 14×2, 11, 9 (24 left with the #249 lockup — #253 conflict 1; s2-arc30, 2026-09-11: the #273 value register moved 11 → 14 when the ledger dropped its second value column, so 14 is now carried TWICE — sans body copy and the ledger's mono value, two registers at one size — and 11 stays as the ledger's glyph cell)", () => {
    const sizes = TYPE_EXCEPTIONS.flatMap((e) => e.sizes).sort();
    expect(sizes).toEqual(
      ["76px", "60px", "28px", "20px", "17px", "16px", "14px", "14px", "11px", "9px"].sort(),
    );
    // Each exception's rows carry only its own sizes.
    for (const e of TYPE_EXCEPTIONS) {
      for (const row of [...e.css, ...e.tsx]) {
        const size = "size" in row ? row.size : row.cls.replace(/^text-\[|\]$/g, "");
        expect(e.sizes, `${e.name}: ${JSON.stringify(row)}`).toContain(size);
      }
    }
  });

  it("every debt group names an owner", () => {
    for (const d of TYPE_DEBT) {
      expect(d.owner.length).toBeGreaterThan(0);
      expect(d.css.length + d.tsx.length).toBeGreaterThan(0);
    }
  });

  it("CENSUS_PINS equal the figures read from the sources (the README quotes these)", () => {
    expect({
      cssDeclarations: observedCss.length,
      cssSizes: new Set(observedCss.map((d) => d.size)).size,
      tsxSites: observedTsx.length,
      tsxUses: observedTsx.reduce((n, s) => n + s.count, 0),
      tsxFiles: new Set(observedTsx.map((s) => s.file)).size,
    }).toEqual(CENSUS_PINS);
  });
});
