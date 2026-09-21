import { describe, expect, it } from "vitest";

import { buildNeedsYouItems } from "./needs-you-items";
import { deriveNeedsYou } from "./needs-you";
import type { TierSources } from "./tier-sources";

// #288 step 2 — the ▲/⚠ sources mapped to NEEDS YOU rows.
//
// The risk this suite exists for is INFLATION: NEEDS YOU's count is the
// number the operator reads as "things wanting my attention", so a row
// that should have self-suppressed is not a cosmetic bug, it is a lie
// about how much is wrong. Every clean-state case below asserts zero.

const EMPTY = {
  deltas: [],
  deltasChanged: [],
  siteChanged: [],
  finesItem: null,
  finesApplicable: false,
  deltasAttention: [],
  coloradoFails: [],
  siteScanItem: null,
  corridorItem: null,
  geometryItem: null,
  approachesSpec: null,
  approachesSignalized: false,
} as unknown as TierSources;

const src = (over: Partial<TierSources>): TierSources =>
  ({ ...EMPTY, ...over }) as TierSources;

const build = (over: Partial<TierSources>) =>
  buildNeedsYouItems({ sources: src(over), siteLabel: (f) => `label:${f}` });

const spec = (title: string) => ({ title, result: "RESULT", cite: "CITE", body: null });

const delta = (over: Record<string, unknown> = {}) =>
  ({
    severity: "count",
    rule: "MUTCD § 6C.02",
    status: "fires",
    effect: { op: "add", qty: 2, device: "cones" },
    source: {},
    ...over,
  }) as never;

describe("buildNeedsYouItems", () => {
  it("a clean plan yields ZERO items — nothing is invented to fill the block", () => {
    expect(build({})).toEqual([]);
    expect(deriveNeedsYou(build({})).count).toBe(0);
  });

  it("a fines item present but NOT applicable contributes nothing", () => {
    expect(build({ finesItem: spec("Fines double") as never, finesApplicable: false })).toEqual([]);
  });

  it("an approaches spec present but NO signalized approach contributes nothing", () => {
    expect(
      build({ approachesSpec: spec("Approaches") as never, approachesSignalized: false }),
    ).toEqual([]);
  });

  it("maps a fired delta to a ▲ row carrying its rule as the citation", () => {
    const [item] = build({ deltasChanged: [delta()] });
    expect(item.tier).toBe("changed");
    expect(item.title).toBe("add 2 cones");
    expect(item.cite).toBe("MUTCD § 6C.02");
    expect(item.result).toBe("FIRES");
    expect(item.action).toBeNull();
  });

  it("a delta's note wins over the assembled effect — the wire's own words", () => {
    const [item] = build({ deltasChanged: [delta({ effect: { op: "add", note: "Two extra cones per Lakewood" } })] });
    expect(item.title).toBe("Two extra cones per Lakewood");
  });

  it("carries a baseline as evidence, and carries nothing when there is none", () => {
    const [withBaseline] = build({ deltasChanged: [delta({ baseline: "MUTCD 6C.02" })] });
    expect(withBaseline.evidence).toBe("baseline MUTCD 6C.02");
    const [without] = build({ deltasChanged: [delta()] });
    expect(without.evidence).toBeUndefined();
  });

  it("a site adjustment's counts come from the record and are never summed across records", () => {
    const items = build({
      siteChanged: [
        { flag: "adjacent_intersection", action: "a", rule: "r", citation: "C1", devices_added: 2 },
        { flag: "school_zone", action: "a", rule: "r", citation: "C2", devices_added: 0, devices_modified: 1 },
      ] as never,
    });
    expect(items).toHaveLength(2);
    expect(items[0].evidence).toBe("2 devices added");
    expect(items[0].cite).toBe("C1");
    expect(items[0].title).toBe("label:adjacent_intersection");
    expect(items[1].evidence).toBe("1 modified");
  });

  it("singularises one device without inventing a plural", () => {
    const [item] = build({
      siteChanged: [{ flag: "f", action: "a", rule: "r", citation: "c", devices_added: 1 }] as never,
    });
    expect(item.evidence).toBe("1 device added");
  });

  it("a Colorado FAIL becomes a ⚠ row with its detail as evidence", () => {
    const [item] = build({
      coloradoFails: [{ pass: false, label: "Flagger certification", citation: "CDOT 630", detail: "not stated" }],
    });
    expect(item.tier).toBe("attention");
    expect(item.result).toBe("FAIL");
    expect(item.evidence).toBe("not stated");
  });

  it("ruling d: every row carries action null — the writes still live in the corrections block", () => {
    const items = build({
      deltasChanged: [delta()],
      coloradoFails: [{ pass: false, label: "L", citation: "C", detail: "d" }],
      corridorItem: spec("Corridor") as never,
      geometryItem: spec("Geometry") as never,
    });
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) expect(i.action).toBeNull();
  });

  it("orders ▲ before ⚠, and within a tier keeps the wire's order", () => {
    const model = deriveNeedsYou(
      build({
        deltasChanged: [delta({ effect: { op: "add", note: "C1" } }), delta({ effect: { op: "add", note: "C2" } })],
        coloradoFails: [{ pass: false, label: "A1", citation: "c", detail: "" }],
        corridorItem: spec("A2") as never,
      }),
    );
    expect(model.items.map((i) => i.title)).toEqual(["C1", "C2", "A1", "A2"]);
    expect(model.changed).toBe(2);
    expect(model.attention).toBe(2);
    expect(model.count).toBe(4);
  });

  it("ids are stable and unique — they are shared with the Python mirror", () => {
    const d0 = delta(), d1 = delta(), d2 = delta({ status: "conditional" });
    const items = build({
      deltas: [d0, d1, d2],
      deltasChanged: [d0, d1],
      deltasAttention: [d2],
      siteChanged: [{ flag: "school_zone", action: "a", rule: "r", citation: "c", devices_added: 1 }] as never,
      coloradoFails: [{ pass: false, label: "L", citation: "c", detail: "" }],
    });
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("jur:delta:0");
    expect(ids).toContain("jur:delta:2"); // the attention delta keeps its FULL-array index
    expect(ids).toContain("audit:site:school_zone");
    expect(ids).toContain("audit:colorado:fail:0");
  });
});
