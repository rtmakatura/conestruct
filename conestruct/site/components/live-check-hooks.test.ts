// #237 — "zero-match fails loudly", brought forward to CI.  The live rigs
// in validation-artifacts/committed/issue-289-band-stack/ select every band
// control through live-check.cjs's `hook(page, "<testid>")`, which throws on
// zero matches at run time.  This suite reads those rigs, extracts every
// hook they name, and fails if a component no longer declares it — so a
// renamed hook breaks here, not in a prod run after a ship.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SITE = join(__dirname, "..");
const ARC = join(SITE, "..", "..", "validation-artifacts", "committed", "issue-289-band-stack");
const RIGS = [
  "fidelity-audit/probe.cjs",
  "strip-reserve/measure-strip.cjs",
  "fidelity-after/measure-gutter.cjs",
];

function componentSource(): string {
  const out: string[] = [];
  for (const rel of readdirSync(join(SITE, "components"), { recursive: true })) {
    const f = String(rel);
    if (/\.tsx$/.test(f) && !/\.test\.tsx$/.test(f)) {
      out.push(readFileSync(join(SITE, "components", f), "utf-8"));
    }
  }
  return out.join("\n");
}

const hooksIn = (src: string) =>
  [...src.matchAll(/hook\(page, "([^"]+)"\)/g)].map((m) => m[1]);

describe("#237 — every hook a live rig selects is declared by a component", () => {
  const src = componentSource();

  for (const rig of RIGS) {
    it(`${rig}: its hooks exist`, () => {
      const hooks = hooksIn(readFileSync(join(ARC, rig), "utf-8"));
      // The rig must select SOMETHING through the helper — an empty list
      // here is the #237 failure mode one level up.
      expect(hooks.length, `${rig} selects no hooks`).toBeGreaterThan(0);
      for (const h of hooks) {
        // A literal testid, or a templated family (`kind-chip-${k}`,
        // `setup-link-${key}`) whose prefix the component declares.
        const prefix = h.slice(0, h.lastIndexOf("-") + 1);
        const declared =
          src.includes(`data-testid="${h}"`) ||
          (prefix.length > 0 && src.includes(`data-testid={\`${prefix}\${`));
        expect(declared, `${rig}: hook "${h}" is declared by no component`).toBe(true);
      }
    });
  }

  it("the helper's own contract (node --test) ships beside it", () => {
    const helper = readFileSync(join(ARC, "live-check.cjs"), "utf-8");
    expect(helper).toMatch(/zero matches fail loudly/);
    expect(readFileSync(join(ARC, "live-check.test.cjs"), "utf-8")).toMatch(/node:test/);
  });
});
