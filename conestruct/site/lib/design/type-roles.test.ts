// The two-axis rule as a test (issue #226) — so it can't regress
// silently.  Two halves, deliberately paired per the spacing-scale
// idiom (arc12 vacuous-guard lesson): the pure half asserts the rule
// over the authoritative table; the mirror half asserts the .tr-*
// blocks in app/globals.css carry the table's values, so neither the
// table nor the CSS can drift alone.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TYPE_AXES,
  TYPE_ROLES,
  expectedDeclarations,
  type TypeRoleName,
} from "./type-roles";

const ROLE_NAMES = Object.keys(TYPE_ROLES) as TypeRoleName[];

describe("two-axis rule — any two label roles differ on ≥2 of the six axes (PDF p. 3)", () => {
  // Six pairs from four roles; enumerated explicitly so a failure names
  // the pair.
  const pairs: Array<[TypeRoleName, TypeRoleName]> = [];
  for (let i = 0; i < ROLE_NAMES.length; i++)
    for (let j = i + 1; j < ROLE_NAMES.length; j++)
      pairs.push([ROLE_NAMES[i], ROLE_NAMES[j]]);

  it("enumerates exactly the six role pairs", () => {
    expect(pairs).toHaveLength(6);
  });

  it.each(pairs)("%s ↔ %s differ on at least two axes", (a, b) => {
    const ra = TYPE_ROLES[a];
    const rb = TYPE_ROLES[b];
    const differing = TYPE_AXES.filter((axis) => ra[axis] !== rb[axis]);
    expect(
      differing.length,
      `${a} ↔ ${b} differ only on [${differing.join(", ")}]`,
    ).toBeGreaterThanOrEqual(2);
  });

  it("weight is not counted as an axis", () => {
    // The PDF's six-axis list excludes weight; if someone adds it to
    // TYPE_AXES the rule's arithmetic silently changes — pin the list.
    expect(TYPE_AXES).toEqual([
      "family",
      "casing",
      "size",
      "tracking",
      "color",
      "decoration",
    ]);
  });
});

describe("CSS mirror — the .tr-* blocks in globals.css match the table", () => {
  const css = readFileSync(
    join(__dirname, "..", "..", "app", "globals.css"),
    "utf-8",
  );

  it.each(ROLE_NAMES)("the %s role's .tr-* block mirrors the table", (name) => {
    const role = TYPE_ROLES[name];
    const block = css.match(
      new RegExp(`\\.workbench \\.${role.cssClass} \\{[^}]*\\}`),
    );
    expect(block, `.workbench .${role.cssClass} missing from globals.css`)
      .not.toBeNull();
    for (const decl of expectedDeclarations(role)) {
      expect(block![0]).toContain(decl);
    }
  });

  it("no .tr-* block re-adds a text-transform to the provenance role (GO ruling 1)", () => {
    const block = css.match(/\.workbench \.tr-prov \{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block![0]).not.toContain("text-transform: uppercase");
    expect(block![0]).not.toContain("text-transform: lowercase");
  });
});
