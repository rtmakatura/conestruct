import { describe, expect, it } from "vitest";

import {
  classifyFromCandidate,
  classifyFromOsmTags,
  lanesPerDirectionFromTags,
  parseMaxspeedToMph,
} from "@/lib/road-detection/classify";
import type { RoadCandidate } from "@/lib/road-detection/types";

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
    lanes_backward: null, lanes_both_ways: null,
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

describe("classifyFromOsmTags per-direction lane relays (issue #120)", () => {
  const tags = {
    oneway: null,
    maxspeed: null,
    lanes: null,
    lanes_forward: null,
    lanes_backward: null,
    lanes_both_ways: null,
  };

  it("relays forward/backward/both_ways parsed, alongside the total", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "secondary",
        name: "TWLTL Ave",
        ref: null,
        tags: {
          ...tags,
          lanes: "3",
          lanes_forward: "1",
          lanes_backward: "1",
          lanes_both_ways: "1",
        },
      },
      true,
      null,
    );
    expect(r.detectedLanesTotal).toBe(3);
    expect(r.detectedLanesForward).toBe(1);
    expect(r.detectedLanesBackward).toBe(1);
    expect(r.detectedLanesBothWays).toBe(1);
  });

  it("each relay is undefined when its tag is absent — never a false signal", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "secondary",
        name: "Sparse Rd",
        ref: null,
        tags: { ...tags, lanes: "2" },
      },
      true,
      null,
    );
    expect(r.detectedLanesTotal).toBe(2);
    expect(r.detectedLanesForward).toBeUndefined();
    expect(r.detectedLanesBackward).toBeUndefined();
    expect(r.detectedLanesBothWays).toBeUndefined();
  });
});

describe("classifyFromOsmTags", () => {
  const baseTags = {
    oneway: null,
    maxspeed: null,
    lanes: null,
    lanes_forward: null,
    lanes_backward: null, lanes_both_ways: null,
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

  // #308 (RULE 5, stated in the checkpoint's churn table): primary + oneway
  // was divided by the tag alone.  Now the same-name twin decides; with no
  // twin evidence the road is undecided, which reads as not divided until
  // the operator confirms (ruling R83).
  it("classifies primary + oneway with no twin evidence as undecided, not divided", () => {
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
    expect(r.divided).toBe(false);
    expect(r.carriageway).toEqual({
      oneway: "yes",
      highwayClass: "primary",
      twinDistanceM: null,
      twinSearched: false,
    });
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

  it("exposes the raw directional lane tags and oneway string (issue #178)", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "secondary",
        name: "E Colfax Ave",
        ref: null,
        tags: {
          ...baseTags,
          lanes: "5",
          lanes_forward: "3",
          lanes_backward: "2",
          oneway: "yes",
        },
      },
      true,
      "Denver",
    );
    expect(r.raw.osmLanesTag).toBe("5");
    expect(r.raw.osmLanesForwardTag).toBe("3");
    expect(r.raw.osmLanesBackwardTag).toBe("2");
    expect(r.raw.osmLanesBothWaysTag).toBe(null);
    expect(r.raw.osmOnewayTag).toBe("yes");
  });

  it("never presents lanes:forward as the lanes total (#178 amendment 1)", () => {
    // Pre-#178, raw.osmLanesTag fell back to lanes:forward — the one
    // raw lanes string could print a directional tag under a `lanes=`
    // label. The lanes FIELD still reads the forward tag as evidence
    // (behavior preserved); only the raw label is now honest.
    const r = classifyFromOsmTags(
      {
        highwayClass: "primary",
        name: "Main St",
        ref: null,
        tags: { ...baseTags, lanes_forward: "3" },
      },
      false,
      null,
    );
    expect(r.raw.osmLanesTag).toBe(null);
    expect(r.raw.osmLanesForwardTag).toBe("3");
    expect(r.lanesPerDirection).toBe(3);
    expect(r.fields.lanes.confidence).toBe("high");
    expect(r.fields.lanes.method).toBe("measured");
    expect(r.fields.lanes.rawData).toBe("lanes:forward=3");
  });
});

// #123: the divided rationale must describe the value that was actually
// returned; a trunk one-way's divided attributes to its class (the GO's
// tightening).  #308: a street-class one-way is decided by its same-name
// twin, and its rationale names that evidence (R89 retired the old word
// for the oneway → divided reading).
describe("divided rationale/value agreement (#123)", () => {
  const onewayTags = {
    oneway: "yes",
    maxspeed: null,
    lanes: null,
    lanes_forward: null,
    lanes_backward: null,
    lanes_both_ways: null,
  };
  const classify = (highwayClass: string) =>
    classifyFromOsmTags(
      { highwayClass, name: "One Way St", ref: null, tags: onewayTags },
      true,
      "Denver",
    );

  // #308: the twin rule (a mirror of src/rules/carriageway.py, display
  // only) decides every street-class one-way; R89 retired the old word.
  const withTwin = (highwayClass: string, distanceM: number | null, searched = true) =>
    classifyFromOsmTags(
      {
        highwayClass,
        name: "One Way St",
        ref: null,
        tags: onewayTags,
        twin: { distanceM, searched },
      },
      true,
      "Denver",
    );

  it("primary one-way, no same-name twin: a one-way street, not divided", () => {
    const r = withTwin("primary", null);
    expect(r.divided).toBe(false);
    expect(r.fields.divided.source).toBe(
      "OSM oneway=yes; no same-name carriageway within 100 m → one-way street",
    );
  });

  it("primary one-way with a same-name twin inside 100 m: divided", () => {
    const r = withTwin("primary", 21.7);
    expect(r.divided).toBe(true);
    expect(r.fields.divided.source).toBe(
      "OSM oneway=yes; same-name carriageway 21.7 m away → divided",
    );
  });

  it("a twin beyond 100 m does not make it divided", () => {
    expect(withTwin("primary", 100.1).divided).toBe(false);
  });

  it.each(["secondary", "tertiary", "unclassified", "residential"])(
    "%s one-way takes the twin rule too (R85)",
    (hc) => {
      expect(withTwin(hc, null).divided).toBe(false);
      expect(withTwin(hc, 17.2).divided).toBe(true);
    },
  );

  it.each(["primary", "secondary", "tertiary", "unclassified"])(
    "%s one-way whose same-name search didn't run says so",
    (hc) => {
      const r = classify(hc);
      expect(r.divided).toBe(false);
      expect(r.fields.divided.source).toBe(
        "OSM oneway=yes; the same-name search didn't run → confirm one-way street or divided",
      );
    },
  );

  it("rural: a one-way street is rural_undivided, a twinned one rural_divided", () => {
    const rural = (d: number | null) =>
      classifyFromOsmTags(
        {
          highwayClass: "primary",
          name: "One Way St",
          ref: null,
          tags: onewayTags,
          twin: { distanceM: d, searched: true },
        },
        false,
        null,
      );
    expect(rural(null).roadType).toBe("rural_undivided");
    expect(rural(13).roadType).toBe("rural_divided");
  });

  it("trunk one-way: divided by class, no carriageway facts relayed", () => {
    const r = classify("trunk");
    expect(r.divided).toBe(true);
    expect(r.fields.divided.source).toBe("inferred from class=trunk");
    expect(r.carriageway).toBeUndefined();
  });

  it("primary_link one-way keeps its class rule (a ramp is not a one-way street)", () => {
    const r = classify("primary_link");
    expect(r.divided).toBe(true);
    expect(r.carriageway).toBeUndefined();
  });

  it("R89: no rationale anywhere says couplet", () => {
    for (const hc of [
      "motorway",
      "trunk",
      "primary",
      "primary_link",
      "secondary",
      "tertiary",
      "unclassified",
      "residential",
    ]) {
      expect(classify(hc).fields.divided.source).not.toMatch(/couplet/i);
      expect(withTwin(hc, 20).fields.divided.source).not.toMatch(/couplet/i);
    }
  });

  it("relays the carriageway facts for the backend on a street-class one-way", () => {
    expect(withTwin("primary", 21.7).carriageway).toEqual({
      oneway: "yes",
      highwayClass: "primary",
      twinDistanceM: 21.7,
      twinSearched: true,
    });
  });

  it("two-way roads keep their existing rationale (no churn off the oneway path)", () => {
    const r = classifyFromOsmTags(
      {
        highwayClass: "secondary",
        name: "Main St",
        ref: null,
        tags: { ...onewayTags, oneway: null },
      },
      true,
      "Denver",
    );
    expect(r.divided).toBe(false);
    expect(r.fields.divided.source).toBe("inferred from class=secondary");
  });
});

describe("classifyFromCandidate carries the route's twin evidence (#308)", () => {
  const candidate = (twin: Partial<RoadCandidate>): RoadCandidate => ({
    way_id: "131232822",
    highway_class: "primary",
    name: "North Broadway",
    ref: null,
    bearing: 180,
    snap_distance_m: 11,
    snapped_lat: 39.7337,
    snapped_lng: -104.98753,
    tags: {
      oneway: "yes",
      maxspeed: "30 mph",
      lanes: "5",
      lanes_forward: null,
      lanes_backward: null,
      lanes_both_ways: null,
      turn_lanes: "||||right",
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    ...twin,
  });

  it("North Broadway, no same-name twin: a one-way street", () => {
    const r = classifyFromCandidate(
      candidate({ twin_distance_m: null, twin_searched: true }),
      true,
      "Denver",
    );
    expect(r.divided).toBe(false);
    expect(r.carriageway).toEqual({
      oneway: "yes",
      highwayClass: "primary",
      twinDistanceM: null,
      twinSearched: true,
    });
  });

  it("a twin 21.7 m away: divided", () => {
    const r = classifyFromCandidate(
      candidate({ twin_distance_m: 21.7, twin_searched: true }),
      true,
      "Denver",
    );
    expect(r.divided).toBe(true);
  });

  it("a pre-#308 candidate with no twin fields: undecided", () => {
    const r = classifyFromCandidate(candidate({}), true, "Denver");
    expect(r.divided).toBe(false);
    expect(r.carriageway?.twinSearched).toBe(false);
  });
});
