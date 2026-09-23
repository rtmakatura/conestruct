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
  // Ten pairs from five roles (#283: role 5, the step question, joins the
  // four-role label table — #281 ruling 180); enumerated explicitly so a
  // failure names the pair.
  const pairs: Array<[TypeRoleName, TypeRoleName]> = [];
  for (let i = 0; i < ROLE_NAMES.length; i++)
    for (let j = i + 1; j < ROLE_NAMES.length; j++)
      pairs.push([ROLE_NAMES[i], ROLE_NAMES[j]]);

  it("enumerates exactly the ten role pairs", () => {
    expect(pairs).toHaveLength(10);
  });

  // #289 F2: casing is compared as the reader SEES it.  Part 2 rule 4
  // writes the step index's caps into the string ("caps-voice") where the
  // section header uppercases by CSS — both display in capitals, so
  // counting them as different casing would claim a difference nobody
  // can see.  The rule must hold on the other axes, and it does.
  const displayed = (r: (typeof TYPE_ROLES)[TypeRoleName], axis: (typeof TYPE_AXES)[number]) =>
    axis === "casing" && r.casing === "caps-voice" ? "uppercase" : r[axis];

  // #289 fidelity F2 — ONE recorded exception, and why.  Part 2 gives the
  // field label (rule 5) and the step question (rule 7) the same family
  // (Inter), casing (sentence), tracking (0) and colour (#eaf0f7); they
  // differ in size (12.5 vs 22) and weight (500 vs 600), and weight is
  // not one of the six axes.  That is Part 2's own design, adopted by
  // ruling (Q1), not a slip in the build.  #226's rule was written for
  // the four LABEL roles (the PDF's p. 3); the question joined the table
  // at #283 and is not a label (see type-roles.ts, `question`).  So the
  // pair is named here: it must still differ on one axis and in weight,
  // and no OTHER pair may use this exception.
  const RULED_ONE_AXIS: ReadonlyArray<readonly [TypeRoleName, TypeRoleName]> = [
    ["field", "question"],
  ];
  const isRuled = (a: TypeRoleName, b: TypeRoleName) =>
    RULED_ONE_AXIS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  it("the one-axis exception is exactly field ↔ question, and they still differ in size and weight", () => {
    expect(RULED_ONE_AXIS).toEqual([["field", "question"]]);
    const f = TYPE_ROLES.field;
    const q = TYPE_ROLES.question;
    expect(TYPE_AXES.filter((axis) => displayed(f, axis) !== displayed(q, axis))).toEqual(["size"]);
    expect(f.weight).not.toBe(q.weight);
  });

  it.each(pairs.filter(([a, b]) => !isRuled(a, b)))("%s ↔ %s differ on at least two axes", (a, b) => {
    const ra = TYPE_ROLES[a];
    const rb = TYPE_ROLES[b];
    const differing = TYPE_AXES.filter((axis) => displayed(ra, axis) !== displayed(rb, axis));
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
