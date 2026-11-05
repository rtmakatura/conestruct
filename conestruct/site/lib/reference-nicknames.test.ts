// #443 X19: every nickname is tied to a term that really appears.  The corpus
// is the recorded audits and the jurisdiction records the rows read, plus the
// frontend's own site-adjustment sentences; nothing here is written for the
// test.  An entry with no hit is removed from the table, not excused.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NICKNAMES, nicknameTerms } from "./reference-nicknames";

const FIXTURE_DIR = join(__dirname, "..", "..", "..", "tests", "fixtures", "tiering");
const corpus = [
  ...readdirSync(FIXTURE_DIR).map((f) => readFileSync(join(FIXTURE_DIR, f), "utf-8")),
  readFileSync(join(__dirname, "..", "components", "__fixtures__", "jurisdiction-demo.json"), "utf-8"),
  readFileSync(join(__dirname, "..", "components", "AuditTrail.tsx"), "utf-8"),
].join("\n");

describe("the nickname table", () => {
  for (const { nick, term } of NICKNAMES) {
    it(`"${nick}" reaches "${term}", which is real text`, () => {
      expect(corpus).toMatch(new RegExp(term, "i"));
    });
  }

  it("#443's named behaviour: a flagger plan's word has no nickname, so SearchNone holds", () => {
    expect(nicknameTerms("flagger")).toEqual([]);
  });

  it("the plural and a typed prefix both reach the entry; a short fragment reaches nothing", () => {
    expect(nicknameTerms("cones")).toEqual(["channeliz"]);
    expect(nicknameTerms("con")).toEqual(["channeliz"]);
    expect(nicknameTerms("co")).toEqual([]);
  });
});
