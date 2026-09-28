/**
 * ship-loop ruling R2: the Vercel skip rule's outside paths are a
 * hand-kept list (SITE_INPUTS in vercel-ignore.sh at the site root) and will drift.
 * This fails when the site or its tests reach a path outside the site dir
 * that the list does not cover, because a skip that misses an input ships
 * a stale frontend silently (Rule 10).
 *
 * What it reads: every .ts/.tsx/.js/.mjs/.cjs file under the site
 * (node_modules and .next excluded), and two forms of path:
 *   - join(__dirname, ...) / resolve(__dirname, ...) with string-literal
 *     arguments (the leading literals are resolved from the file's dir);
 *   - any string literal that starts with "../" (imports included),
 *     resolved from the file's dir.
 * A path is an input only if it resolves outside the site dir.
 *
 * Not seen, and stated: a path assembled from variables, or one relative
 * to process.cwd() (every such read today is site-local).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SITE = path.resolve(__dirname, "..");
const IGNORE_SCRIPT = path.join(SITE, "vercel-ignore.sh");
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const EXT = /\.(tsx?|mjs|cjs|js)$/;

/** SITE_INPUTS from vercel-ignore.sh, resolved to absolute paths. */
export function siteInputs(script: string): string[] {
  const block = /SITE_INPUTS=\(([\s\S]*?)\)/.exec(script);
  if (!block) throw new Error("SITE_INPUTS not found in vercel-ignore.sh");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => path.resolve(SITE, m[1]));
}

/** Every outside path one source file reaches (absolute). */
export function outsidePaths(file: string, source: string): string[] {
  const dir = path.dirname(file);
  const found = new Set<string>();
  const add = (p: string) => {
    const rel = path.relative(SITE, p);
    if (rel.startsWith("..") || path.isAbsolute(rel)) found.add(p);
  };
  for (const m of source.matchAll(/(?:join|resolve)\(\s*__dirname\s*,([^)]*)\)/g)) {
    const parts: string[] = [];
    for (const arg of m[1].split(",")) {
      const lit = /^\s*["'`]([^"'`]*)["'`]\s*$/.exec(arg);
      if (!lit) break;
      parts.push(lit[1]);
    }
    if (parts.length) add(path.resolve(dir, ...parts));
  }
  for (const m of source.matchAll(/["'`]((?:\.\.\/)+[^"'`\s]*)["'`]/g)) {
    add(path.resolve(dir, m[1]));
  }
  return [...found];
}

export function covered(p: string, inputs: string[]): boolean {
  return inputs.some((i) => p === i || p.startsWith(i + path.sep));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

describe("the Vercel skip rule's inputs (R2)", () => {
  const inputs = siteInputs(readFileSync(IGNORE_SCRIPT, "utf8"));

  it("reads the list from vercel-ignore.sh", () => {
    expect(inputs).toContain(SITE);
    expect(inputs.length).toBeGreaterThan(1);
  });

  it("every path outside the site that the site or its tests reach is on the list", () => {
    const missing: string[] = [];
    // This file is skipped: its red proof below holds deliberately unlisted
    // paths as strings.
    for (const file of walk(SITE).filter((f) => f !== __filename)) {
      for (const p of outsidePaths(file, readFileSync(file, "utf8"))) {
        if (!covered(p, inputs)) {
          missing.push(`${path.relative(SITE, file)} -> ${path.relative(SITE, p)}`);
        }
      }
    }
    expect(missing, "add these to SITE_INPUTS in vercel-ignore.sh").toEqual([]);
  });

  it("catches an unlisted outside path (the check's own red proof)", () => {
    const file = path.join(SITE, "components", "Example.test.tsx");
    const src = [
      'const A = join(__dirname, "..", "..", "..", "tests", "fixtures", "new-thing");',
      'const B = readFileSync("../../../data/jurisdictions/cdot.json");',
      'const C = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering", "x.json");',
      'import { x } from "../lib/render-types";',
    ].join("\n");
    const outside = outsidePaths(file, src);
    const unlisted = outside.filter((p) => !covered(p, inputs)).map((p) => path.relative(SITE, p));
    expect(unlisted.sort()).toEqual(
      [
        path.join("..", "..", "tests", "fixtures", "new-thing"),
        path.join("..", "..", "data", "jurisdictions", "cdot.json"),
      ].sort(),
    );
  });
});
