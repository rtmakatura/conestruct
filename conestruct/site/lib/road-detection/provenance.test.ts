// #273 — the provenance vocabulary's tests.
//
// Two jobs.  First, FREEZE the token table: these words are read by
// operators and quoted in issues, and until this file they existed as
// inline literals in two components, so a rename in one place drifted
// the other silently.  The literals below are written out rather than
// derived from the exports, so a rename fails here and has to be made on
// purpose.
//
// Second, pin the grammar — fragment order, the separator, and which
// fragments are optional in which state — because the clause's rendered
// WIDTH is what sets the ledger's reserved row height (236.8 px worst
// MATCH, 332.8 px worst DIFFER, measured on prod b2a325a).  A stray
// fragment is a layout regression, not just a wording one.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  APPLIED_TOKENS,
  DETECTED_TOKENS,
  NO_DETECTED_TOKEN,
  SEP,
  SOURCE,
  WITHDRAWN,
  appliedTokenFor,
  provenanceClause,
  sourceToken,
  valuesAgree,
} from "@/lib/road-detection/provenance";

describe("the frozen token table", () => {
  it("the detected-side words are exactly these three", () => {
    expect([...DETECTED_TOKENS]).toEqual(["measured", "inferred", "overridden"]);
  });

  it("the applied-side words are exactly these two", () => {
    expect([...APPLIED_TOKENS]).toEqual(["operator-set", "changed in plan"]);
  });

  it("the replacement words say the absence rather than leaving a gap", () => {
    expect(NO_DETECTED_TOKEN).toBe("no source tag");
    expect(WITHDRAWN).toBe("withdrawn");
  });

  it("the source and separator are the picker's, byte for byte", () => {
    expect(SOURCE).toBe("OSM");
    expect(SEP).toBe(" · ");
    // the picker's field-row label, which this producer now composes
    expect(sourceToken("measured")).toBe("OSM · measured");
    expect(sourceToken("inferred")).toBe("OSM · inferred");
  });
});

describe("the clause grammar (spec 4.4 / 4.5, as amended)", () => {
  it("MATCH names the detected value and its token, and stops", () => {
    expect(
      provenanceClause({ detectedValue: "Urban arterial", detectedToken: "measured" }),
    ).toBe("OSM · Urban arterial · measured");
  });

  it("the detected value appears on matching rows too — the ruling against 'same as detected'", () => {
    const clause = provenanceClause({ detectedValue: "30 mph", detectedToken: "inferred" });
    expect(clause).toContain("30 mph");
    expect(clause).not.toContain("same as detected");
  });

  it("DIFFER adds the applied token, and only that", () => {
    expect(
      provenanceClause({
        detectedValue: "Freeway / interstate",
        detectedToken: "inferred",
        appliedToken: "operator-set",
      }),
    ).toBe("OSM · Freeway / interstate · inferred · operator-set");
  });

  it("a detection with no method says so, rather than rendering a gap", () => {
    expect(provenanceClause({ detectedValue: "30 mph" })).toBe(
      "OSM · 30 mph · no source tag",
    );
  });

  it("a withdrawn detection puts the word in the VALUE position and carries no detected token", () => {
    // #275: printing `OSM · 2 · withdrawn` would present the cleared
    // relay's number as though it still stood.
    expect(
      provenanceClause({ detectedValue: null, appliedToken: "operator-set" }),
    ).toBe("OSM · withdrawn · operator-set");
    expect(provenanceClause({ detectedValue: null })).toBe("OSM · withdrawn");
  });

  it("a withdrawn detection never says 'no source tag' — there is no detection to characterise", () => {
    expect(provenanceClause({ detectedValue: null })).not.toContain(NO_DETECTED_TOKEN);
  });

  it("every clause opens with the source and joins on one separator", () => {
    const clauses = [
      provenanceClause({ detectedValue: "2", detectedToken: "measured" }),
      provenanceClause({ detectedValue: null, appliedToken: "operator-set" }),
      provenanceClause({ detectedValue: "85°", appliedToken: "changed in plan" }),
    ];
    for (const c of clauses) {
      expect(c.startsWith(`${SOURCE}${SEP}`)).toBe(true);
      expect(c).not.toContain("  ");
      expect(c).not.toMatch(/·\s*·/);
    }
  });

  it("the worst case is the DIFFER clause the row height was measured against", () => {
    // 332.8 px at the tr-prov role, prod b2a325a — the figure the
    // two-line reserve below 520 px exists for.
    expect(
      provenanceClause({
        detectedValue: "Freeway / interstate",
        detectedToken: "inferred",
        appliedToken: "operator-set",
      }),
    ).toBe("OSM · Freeway / interstate · inferred · operator-set");
  });
});

describe("agreement is a comparison of model values, not of display strings", () => {
  it("numbers agree at the precision the display shows", () => {
    // the bearing row renders Math.round on both sides, so a sub-degree
    // difference the reader cannot see must not flag as a difference
    expect(valuesAgree(85.4, 85)).toBe(true);
    expect(valuesAgree(85, 86)).toBe(false);
  });

  it("enums and booleans compare directly", () => {
    expect(valuesAgree("urban_arterial", "urban_arterial")).toBe(true);
    expect(valuesAgree("urban_arterial", "freeway")).toBe(false);
    expect(valuesAgree(true, true)).toBe(true);
    expect(valuesAgree(true, false)).toBe(false);
  });

  it("a missing side never reads as agreement", () => {
    expect(valuesAgree(undefined, 30)).toBe(false);
    expect(valuesAgree(30, undefined)).toBe(false);
  });

  it("the display defect the spec predicted cannot arise: units never reach this function", () => {
    // "30" vs "30 mph" is what a display comparison would have done;
    // the model gives 30 and 30.
    expect(valuesAgree(30, 30)).toBe(true);
  });
});

// The point of a single producer is that no surface keeps a second
// copy, and that is a property of the SOURCE, not of any render.  So it
// is asserted by reading the source — the same idiom the #263 census
// uses (type-census.test.ts): a test that only checks rendered output
// would pass happily while a second mint sat in the file waiting to
// drift.
const SITE_ROOT = join(__dirname, "..", "..");
const readSource = (rel: string) => readFileSync(join(SITE_ROOT, rel), "utf-8");

describe("no surface mints this vocabulary a second time", () => {
  it("the picker composes from the producer instead of templating its own", () => {
    const src = readSource("components/LocationPickerModal.tsx");
    expect(src).toContain('from "@/lib/road-detection/provenance"');
    expect(src).toContain("sourceToken(field.method)");
    // the literal it replaced
    expect(src).not.toContain("`OSM · ${field.method}`");
  });
});

describe("which applied token a differing row carries", () => {
  it("a matching row carries none", () => {
    expect(appliedTokenFor({ differs: false, isDomainSnap: false })).toBeUndefined();
    expect(appliedTokenFor({ differs: false, isDomainSnap: true })).toBeUndefined();
  });

  it("an operator edit says operator-set", () => {
    expect(appliedTokenFor({ differs: true, isDomainSnap: false })).toBe("operator-set");
  });

  it("a domain snap says changed in plan — the system's rounding is not the operator's doing", () => {
    expect(appliedTokenFor({ differs: true, isDomainSnap: true })).toBe("changed in plan");
  });
});
