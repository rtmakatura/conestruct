// #443 rulings 6-8: the search, pure.  Case-free, part of a word, every field
// of a closed row, nicknames, and the counts the status line prints (X1).

import { describe, expect, it } from "vitest";

import { buildMatcher, planChips, searchSections, statusLine, type SearchableSection } from "./reference-search";

const SECTIONS: SearchableSection[] = [
  {
    id: "checked",
    name: "Checked and passed",
    groups: [
      {
        rows: [
          { id: "taper", title: "Taper length", result: "50 ft", detail: { pairs: [{ label: "L/3", value: "50 ft" }] } },
          { id: "buffer", title: "Buffer space", detail: { sentences: ["Sized for stopping sight distance."], source: "MUTCD TABLE 6B-2" } },
        ],
      },
    ],
  },
  {
    id: "reference",
    name: "Denver rules and site facts",
    groups: [
      {
        rows: [
          {
            id: "devices",
            title: "Device schedule",
            detail: {
              list: {
                noun: { one: "device type", many: "device types" },
                lines: [
                  { text: "Drum", value: "10", sub: "CH-1 · channelizing device" },
                  { text: "Sidewalk closed sign", value: "2", sub: "R9-9 · sign" },
                  { text: "Barricade", value: "2", sub: "BAR · Type III" },
                ],
              },
            },
          },
          { id: "sidewalk", title: "Pedestrian sidewalks present", detail: {} },
        ],
      },
    ],
  },
];

const hit = (q: string, section: string, row: string) => searchSections(SECTIONS, q)?.sections.get(section)?.rows.get(row);

describe("the matcher", () => {
  it("an empty or spaces-only query is no search at all (ruling 9)", () => {
    expect(buildMatcher("")).toBeNull();
    expect(buildMatcher("   ")).toBeNull();
    expect(searchSections(SECTIONS, "  ")).toBeNull();
  });

  it("ignores case and matches part of a word", () => {
    expect(hit("TAPER", "checked", "taper")).toBeTruthy();
    expect(hit("idewal", "reference", "sidewalk")).toBeTruthy();
  });

  it("a regex character in the query is plain text", () => {
    expect(() => searchSections(SECTIONS, "(6B")).not.toThrow();
    expect(searchSections(SECTIONS, "(6B")!.count).toBe(0);
    expect(hit("L/3", "checked", "taper")).toBeTruthy();
    expect(searchSections(SECTIONS, ".*")!.count).toBe(0);
  });
});

describe("what a hit opens (X20)", () => {
  it("a match only in the title or result leaves the row closed", () => {
    expect(hit("Pedestrian", "reference", "sidewalk")).toMatchObject({ inside: false, inSource: false });
  });

  it("a match in a sentence or value opens it", () => {
    expect(hit("stopping", "checked", "buffer")!.inside).toBe(true);
    expect(hit("L/3", "checked", "taper")!.inside).toBe(true);
  });

  it("a match only in the source shows the source line, without opening", () => {
    expect(hit("6B", "checked", "buffer")).toMatchObject({ inside: false, inSource: true });
  });

  it("a long list reports which of its lines match", () => {
    expect(hit("drum", "reference", "devices")).toMatchObject({ inside: true, listLines: [0] });
  });

  it("X10: a whole formula line is findable across its label and value", () => {
    expect(hit("L/3 = 50 ft", "checked", "taper")!.inside).toBe(true);
  });
});

describe("nicknames count (ruling 6)", () => {
  it('"cone" finds channelizing devices', () => {
    expect(hit("cone", "reference", "devices")!.listLines).toEqual([0]);
    expect(hit("cones", "reference", "devices")!.listLines).toEqual([0]);
  });

  it('"sign" also finds sign codes', () => {
    expect(hit("sign", "reference", "devices")!.listLines).toEqual([1]);
  });

  it('"barricade" reaches "Type III" as well as the word', () => {
    expect(hit("barricade", "reference", "devices")!.listLines).toEqual([2]);
  });
});

describe("the counts (X1: a line is one row)", () => {
  it("one section names it, and says 'all in' when there are several", () => {
    const r = searchSections(SECTIONS, "sidewalk")!;
    expect(r.count).toBe(2);
    expect(statusLine(SECTIONS, r)).toEqual({ lead: "2 matching lines, all in ", where: "Denver rules and site facts" });
    const one = searchSections(SECTIONS, "buffer")!;
    expect(statusLine(SECTIONS, one)).toEqual({ lead: "1 matching line, in ", where: "Checked and passed" });
  });

  it("two sections count them", () => {
    const r = searchSections(SECTIONS, "e")!;
    expect(statusLine(SECTIONS, r).where).toBeNull();
    expect(statusLine(SECTIONS, r).lead).toMatch(/^\d+ matching lines, in 2 sections$/);
  });

  it("a section knows its row total for 'N of M lines match'", () => {
    const r = searchSections(SECTIONS, "taper")!;
    expect(r.sections.get("checked")).toMatchObject({ total: 2 });
    expect(r.sections.get("checked")!.rows.size).toBe(1);
    expect(r.sections.get("reference")!.rows.size).toBe(0);
  });
});

describe("the chips (X18)", () => {
  it("only candidates that hit this plan, in order, at most 5, and each one really finds something", () => {
    const chips = planChips(SECTIONS);
    expect(chips.slice(0, 3)).toEqual(["taper", "buffer", "sidewalk"]);
    expect(chips.length).toBeLessThanOrEqual(5);
    for (const c of chips) expect(searchSections(SECTIONS, c)!.count, c).toBeGreaterThan(0);
  });

  it("a plan with nothing that matches offers none", () => {
    expect(planChips([])).toEqual([]);
  });
});
