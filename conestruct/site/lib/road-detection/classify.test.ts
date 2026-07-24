import { describe, expect, it } from "vitest";

import {
  classifyFromOsmTags,
  lanesPerDirectionFromTags,
  parseMaxspeedToMph,
} from "@/lib/road-detection/classify";

// These tests pin classifyFromOsmTags's output for the field/tag
// combinations the existing tool relies on.  Output shape and values
// match what the previous Mapbox-tilequery-based path produced; the
// audit lives in the plan, the tests pin the result.

describe("parseMaxspeedToMph", () => {
  it("parses bare numbers as mph (US convention)", () => {
    expect(parseMaxspeedToMph("55")).toBe(55);
    expect(parseMaxspeedToMph("25 mph")).toBe(25);
    expect(parseMaxspeedToMph("45.0")).toBe(45);
  });

  it("converts km/h to mph", () => {
    expect(parseMaxspeedToMph("80 kmh")).toBe(50);
    expect(parseMaxspeedToMph("100 km/h")).toBe(62);
  });

  it("returns null for sentinel values and bad parses", () => {
    expect(parseMaxspeedToMph("none")).toBeNull();
    expect(parseMaxspeedToMph("signals")).toBeNull();
    expect(parseMaxspeedToMph("variable")).toBeNull();
    expect(parseMaxspeedToMph("")).toBeNull();
    expect(parseMaxspeedToMph(null)).toBeNull();
  });
});

describe("lanesPerDirectionFromTags", () => {
  it("uses lanes:forward when explicitly set", () => {
    expect(
      lanesPerDirectionFromTags({ lanes: "4", lanes_forward: "3", oneway: null }),
    ).toBe(3);
  });

  it("halves total lanes on two-way roads (no lanes:forward)", () => {
    expect(
      lanesPerDirectionFromTags({ lanes: "4", lanes_forward: null, oneway: null }),
    ).toBe(2);
    expect(
      lanesPerDirectionFromTags({ lanes: "3", lanes_forward: null, oneway: null }),
    ).toBe(1);
  });

  it("returns total when oneway", () => {
    expect(
      lanesPerDirectionFromTags({ lanes: "2", lanes_forward: null, oneway: "yes" }),
    ).toBe(2);
  });

  it("returns undefined when lanes tag missing", () => {
    expect(
      lanesPerDirectionFromTags({ lanes: null, lanes_forward: null, oneway: null }),
    ).toBeUndefined();
  });
});

describe("classifyFromOsmTags detectedLanesTotal (issue #136)", () => {
  const tags = {
    oneway: null,
    maxspeed: null,
    lanes: null,
    lanes_forward: null,
    lanes_backward: null,
  };

  it("relays a genuine single-lane road as detectedLanesTotal 1", () => {
    const r = classifyFromOsmTags(
      { highwayClass: "residential", name: "Narrow Ln", ref: null, tags: { ...tags, lanes: "1" } },
      false,
      null,
    );
    expect(r.detectedLanesTotal).toBe(1);
  });

  it("relays the raw OSM total unchanged for a 2-lane road", () => {
    const r = classifyFromOsmTags(
      { highwayClass: "secondary", name: "Two Lane Rd", ref: null, tags: { ...tags, lanes: "2" } },
      false,
      null,
    );
    expect(r.detectedLanesTotal).toBe(2);
  });

  it("is undefined when OSM carried no lanes tag — never a false block", () => {
    const r = classifyFromOsmTags(
      { highwayClass: "residential", name: "Untagged", ref: null, tags },
      false,
      null,
    );
    expect(r.detectedLanesTotal).toBeUndefined();
  });
});

describe("classifyFromOsmTags", () => {
  const baseTags = {
    oneway: null,
    maxspeed: null,
    lanes: null,
    lanes_forward: null,
    lanes_backward: null,
  };

  it("classifies motorway as freeway/divided/high", () => {
    const r = classifyFromOsmTags(
      { highwayClass: "motorway", name: "Interstate 25", ref: "I 25", tags: baseTags },
      false,
      null,
    );
    expect(r.roadType).toBe("freeway");
    expect(r.divided).toBe(true);
    expect(r.confidence).toBe("high");
    expect(r.fields.roadType.confidence).toBe("high");
  });

  it("classifies rural trunk as rural_divided", () => {
    const r = classifyFromOsmTags(
      { highwayClass: "trunk", name: "US 85", ref: "US 85", tags: baseTags },
      false,
      null,
    );
    expect(r.roadType).toBe("rural_divided");
    expect(r.divided).toBe(true);
  });

  it("classifies primary + oneway as divided (couplet)", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "primary",
        name: "Stout Street",
        ref: null,
        tags: { ...baseTags, oneway: "yes" },
      },
      true,
      "Denver",
    );
    expect(r.roadType).toBe("urban_arterial");
    expect(r.divided).toBe(true);
  });

  it("uses OSM maxspeed at high confidence when present", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "primary",
        name: "Main St",
        ref: null,
        tags: { ...baseTags, maxspeed: "45 mph" },
      },
      false,
      null,
    );
    expect(r.speedLimitMph).toBe(45);
    expect(r.fields.speed.value).toBe(45);
    expect(r.fields.speed.confidence).toBe("high");
    expect(r.fields.speed.source).toBe("OSM maxspeed tag");
  });

  it("falls back to class-based speed at low confidence when maxspeed missing", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "residential",
        name: null,
        ref: null,
        tags: baseTags,
      },
      true,
      "Denver",
    );
    // SPEED_BY_CLASS["residential"] = 25, kept verbatim from the
    // previous road-classify.ts; tested explicitly so a regression in
    // the fallback table is caught.
    expect(r.fields.speed.value).toBe(25);
    expect(r.fields.speed.confidence).toBe("low");
    expect(r.fields.speed.source).toContain("highway-class fallback");
    expect(r.speedLimitMph).toBeUndefined();
  });

  it("preserves null speed when maxspeed sentinel is 'none' (unparseable)", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "motorway",
        name: null,
        ref: "Autobahn",
        tags: { ...baseTags, maxspeed: "none" },
      },
      false,
      null,
    );
    expect(r.fields.speed.confidence).toBe("medium");
    expect(r.fields.speed.source).toContain("un-parseable");
  });

  it("uses lanes:forward at high confidence", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "primary",
        name: "Main St",
        ref: null,
        tags: { ...baseTags, lanes_forward: "3", lanes: "5" },
      },
      false,
      null,
    );
    expect(r.lanesPerDirection).toBe(3);
    expect(r.fields.lanes.confidence).toBe("high");
  });

  it("halves generic lanes tag at medium confidence", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "primary",
        name: "Main St",
        ref: null,
        tags: { ...baseTags, lanes: "4" },
      },
      false,
      null,
    );
    expect(r.lanesPerDirection).toBe(2);
    expect(r.fields.lanes.confidence).toBe("medium");
  });

  // #152 follow-up: every field carries a measured/inferred method,
  // set where the tag-vs-fallback fact is known.  These pin the
  // provenance color/label contract: amber marks inferred only.
  describe("provenance method (measured vs inferred)", () => {
    it("a real maxspeed tag is measured; a class fallback is inferred", () => {
      const measured = classifyFromOsmTags(
        { highwayClass: "primary", name: null, ref: null, tags: { ...baseTags, maxspeed: "45 mph" } },
        false,
        null,
      );
      expect(measured.fields.speed.method).toBe("measured");

      const fallback = classifyFromOsmTags(
        { highwayClass: "residential", name: null, ref: null, tags: baseTags },
        true,
        "Denver",
      );
      expect(fallback.fields.speed.method).toBe("inferred");
    });

    it("an un-parseable maxspeed tag is inferred even at medium confidence", () => {
      const r = classifyFromOsmTags(
        { highwayClass: "motorway", name: null, ref: "Autobahn", tags: { ...baseTags, maxspeed: "none" } },
        false,
        null,
      );
      expect(r.fields.speed.confidence).toBe("medium");
      expect(r.fields.speed.method).toBe("inferred");
    });

    it("a lanes tag is measured even when only medium (no directional split)", () => {
      const r = classifyFromOsmTags(
        { highwayClass: "primary", name: null, ref: null, tags: { ...baseTags, lanes: "4" } },
        false,
        null,
      );
      expect(r.fields.lanes.confidence).toBe("medium");
      expect(r.fields.lanes.method).toBe("measured");

      const fallback = classifyFromOsmTags(
        { highwayClass: "residential", name: null, ref: null, tags: baseTags },
        true,
        "Denver",
      );
      expect(fallback.fields.lanes.method).toBe("inferred");
    });

    it("motorway → freeway/divided is measured; every lesser class is inferred", () => {
      const mw = classifyFromOsmTags(
        { highwayClass: "motorway", name: null, ref: "I 25", tags: baseTags },
        false,
        null,
      );
      expect(mw.fields.roadType.method).toBe("measured");
      expect(mw.fields.divided.method).toBe("measured");

      const res = classifyFromOsmTags(
        { highwayClass: "residential", name: null, ref: null, tags: baseTags },
        true,
        "Denver",
      );
      expect(res.fields.roadType.method).toBe("inferred");
      expect(res.fields.divided.method).toBe("inferred");
    });

    it("a low-confidence field is never labelled measured (measured ⟹ not low)", () => {
      // Sweep the fallback-heavy sparse-tag classes; any low field must
      // read inferred so amber (the warning tone) can key off method.
      for (const highwayClass of ["residential", "unclassified", "tertiary", "secondary"]) {
        const r = classifyFromOsmTags(
          { highwayClass, name: null, ref: null, tags: baseTags },
          true,
          "Denver",
        );
        for (const f of [r.fields.speed, r.fields.lanes, r.fields.roadType, r.fields.divided]) {
          if (f.confidence === "low") expect(f.method).toBe("inferred");
        }
      }
    });
  });

  it("attributes source 'osm-tags' and preserves placeName + raw evidence", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "primary",
        name: "Speer Boulevard",
        ref: null,
        tags: { ...baseTags, oneway: "yes", maxspeed: "35 mph", lanes: "3" },
      },
      true,
      "Denver",
    );
    expect(r.source).toBe("osm-tags");
    expect(r.raw.roadName).toBe("Speer Boulevard");
    expect(r.raw.placeName).toBe("Denver");
    expect(r.raw.osmMaxspeedTag).toBe("35 mph");
    expect(r.raw.osmLanesTag).toBe("3");
  });

  it("relays the raw OSM oneway tag for the flagger gate (issue #158)", () => {
    // Broadway/Civic Center demo pin: a 5-lane one-way arterial — the case
    // #136's single-lane gate could never catch.
    const broadway = classifyFromOsmTags(
      {
        highwayClass: "secondary",
        name: "Broadway",
        ref: null,
        tags: { ...baseTags, oneway: "yes", lanes: "5" },
      },
      true,
      "Denver",
    );
    expect(broadway.detectedOneway).toBe("yes");
    expect(broadway.detectedLanesTotal).toBe(5);

    // A two-way road relays the literal tag; undefined when OSM had none.
    expect(
      classifyFromOsmTags(
        { highwayClass: "secondary", name: null, ref: null, tags: { ...baseTags, oneway: "no" } },
        false,
        null,
      ).detectedOneway,
    ).toBe("no");
    expect(
      classifyFromOsmTags(
        { highwayClass: "secondary", name: null, ref: null, tags: { ...baseTags, oneway: null } },
        false,
        null,
      ).detectedOneway,
    ).toBeUndefined();
  });
});
