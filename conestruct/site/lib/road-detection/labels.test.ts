import { describe, expect, it } from "vitest";

import {
  bearingToDirectionLabel,
  candidateLabel,
  humanizeHighwayClass,
} from "@/lib/road-detection/labels";
import type { RoadCandidate } from "@/lib/road-detection/types";

function mkCandidate(over: Partial<RoadCandidate>): RoadCandidate {
  return {
    way_id: "1",
    highway_class: "primary",
    name: null,
    ref: null,
    bearing: 0,
    snap_distance_m: 0,
    snapped_lat: 0,
    snapped_lng: 0,
    tags: {
      oneway: null,
      maxspeed: null,
      lanes: null,
      lanes_forward: null,
      lanes_backward: null,
      turn_lanes: null,
      turn_lanes_forward: null,
      turn_lanes_backward: null,
    },
    signal_distance_m: null,
    ...over,
  };
}

describe("bearingToDirectionLabel", () => {
  it("returns *bound for cardinal directions", () => {
    expect(bearingToDirectionLabel(0)).toBe("Northbound");
    expect(bearingToDirectionLabel(90)).toBe("Eastbound");
    expect(bearingToDirectionLabel(180)).toBe("Southbound");
    expect(bearingToDirectionLabel(270)).toBe("Westbound");
  });

  it("returns compass-form for intercardinals (no awkward *-bound)", () => {
    expect(bearingToDirectionLabel(45)).toBe("Northeast");
    expect(bearingToDirectionLabel(135)).toBe("Southeast");
    expect(bearingToDirectionLabel(225)).toBe("Southwest");
    expect(bearingToDirectionLabel(315)).toBe("Northwest");
  });
});

describe("humanizeHighwayClass", () => {
  it("maps OSM classes to display labels", () => {
    expect(humanizeHighwayClass("motorway")).toBe("Freeway");
    expect(humanizeHighwayClass("primary")).toBe("Primary");
    expect(humanizeHighwayClass("residential")).toBe("Residential");
    expect(humanizeHighwayClass("unclassified")).toBe("Local road");
  });

  it("falls back to the raw class for unknown values", () => {
    expect(humanizeHighwayClass("track")).toBe("track");
  });
});

describe("candidateLabel", () => {
  it("uses name when present", () => {
    const l = candidateLabel(
      mkCandidate({ name: "Main Street", highway_class: "primary", bearing: 0 }),
    );
    expect(l.primary).toBe("Main Street");
    expect(l.sub).toBe("Primary");
    expect(l.direction).toBe("Northbound");
  });

  it("falls back to ref when name is missing", () => {
    const l = candidateLabel(
      mkCandidate({ name: null, ref: "I 25", highway_class: "motorway", bearing: 180 }),
    );
    expect(l.primary).toBe("I 25");
    expect(l.sub).toBe("Freeway");
    expect(l.direction).toBe("Southbound");
  });

  it('falls back to "Unnamed <class>" when both name and ref are missing', () => {
    const l = candidateLabel(
      mkCandidate({ name: null, ref: null, highway_class: "residential", bearing: 90 }),
    );
    expect(l.primary).toBe("Unnamed residential");
    expect(l.sub).toBe("Residential");
    expect(l.direction).toBe("Eastbound");
  });
});
