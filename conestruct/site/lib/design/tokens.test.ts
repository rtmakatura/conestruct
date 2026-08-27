// #227 — the sizing-token mirror (the type-roles.test.ts idiom): the
// TS table and the .workbench custom-property definitions must agree,
// so a token edit in one home cannot drift the other silently.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIZE_TOKENS } from "./tokens";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../app/globals.css"),
  "utf-8",
);

describe("SIZE_TOKENS mirror .workbench custom properties (#227)", () => {
  for (const [name, value] of Object.entries(SIZE_TOKENS)) {
    it(`${name} is defined as ${value}`, () => {
      const re = new RegExp(`${name}:\\s*${value};`);
      expect(css).toMatch(re);
    });
  }

  it("the table stays exactly the two ruled tokens", () => {
    expect(Object.keys(SIZE_TOKENS).sort()).toEqual([
      "--bar-seg-min",
      "--glyph-cell",
    ]);
  });
});
