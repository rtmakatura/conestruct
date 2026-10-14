// #285: the nearest-cross-street tag, from relay to the WHERE band.
//
// The backend composes the words; these pin what the frontend does with
// them: relay the road's name and ref only while the pin is the confirmed
// one, ask only for a confirmed work-start pin, re-ask only when the pin,
// road or marked cross pin changes, and print a `found` answer in the
// "Work starts" row, the fact line and its provenance, while every other
// answer leaves the road name (Rule 10).

import { describe, expect, it } from "vitest";
import { DEFAULT_SHOULDER } from "./scenarios";
import type { Scenario } from "./scenarios/types";
import type { ConfirmedRoad } from "./road-detection/types";
import { withRelayedCenterline } from "./scenarios/centerline-relay";
import { whereProvenance, whereValue } from "./scenarios/band-facts";
import { deriveMoveLedger } from "./scenarios/move-ledger";
import {
  crossStreetKey,
  crossStreetRequestFor,
  crossStreetTag,
  type NearestIntersection,
} from "./cross-street-tag";

const PIN = { lat: 39.7337, lng: -104.98753 };

function road(name: string | null, ref: string | null, at = PIN): ConfirmedRoad {
  return {
    candidate: {
      way_id: "131232822",
      highway_class: "primary",
      name,
      ref,
      bearing: 180,
      snap_distance_m: 11,
      snapped_lat: at.lat,
      snapped_lng: at.lng,
      tags: {
        oneway: "yes",
        maxspeed: null,
        lanes: null,
        lanes_forward: null,
        lanes_backward: null,
        lanes_both_ways: null,
        turn_lanes: null,
        turn_lanes_forward: null,
        turn_lanes_backward: null,
      },
      signal_distance_m: null,
      geometry: [
        [39.74, -104.9875],
        [39.73, -104.9875],
      ],
    },
    classification: null as never,
    method: "auto_single",
    isUrban: true,
    placeName: null,
    pinLat: at.lat,
    pinLng: at.lng,
  };
}

function scenario(meta: Partial<Scenario["meta"]> = {}, rest: Partial<Scenario> = {}): Scenario {
  return {
    ...DEFAULT_SHOULDER,
    ...rest,
    meta: {
      ...DEFAULT_SHOULDER.meta,
      ...PIN,
      pinModel: "work_start",
      confirmedRoad: road("North Broadway", null),
      ...meta,
    },
  } as Scenario;
}

const FOUND: NearestIntersection = {
  status: "found",
  text: "50 ft S of East 11th Avenue",
  cross_street: "East 11th Avenue",
  offset_ft: 50,
  direction: "S",
  source: "osm_shared_node",
  provenance_text: "cross street from OSM node 3397108608 · searched 1,700 m",
  osm_node_id: 3397108608,
  reason: null,
  radius_m: 1700,
};

describe("the relay carries the road's name and ref", () => {
  it("while the pin is the confirmed one", () => {
    const m = withRelayedCenterline(scenario({ confirmedRoad: road("North Broadway", "US 287") })).meta;
    expect(m.roadName).toBe("North Broadway");
    expect(m.roadRef).toBe("US 287");
  });

  it("omits a field the candidate does not have", () => {
    const m = withRelayedCenterline(scenario({ confirmedRoad: road(null, "US 287") })).meta;
    expect(m.roadName).toBeUndefined();
    expect(m.roadRef).toBe("US 287");
  });

  it("never once the pin has moved", () => {
    const m = withRelayedCenterline(scenario({ lat: PIN.lat + 0.001 })).meta;
    expect(m.roadName).toBeUndefined();
    expect(m.centerline).toBeUndefined();
  });
});

describe("what is asked, and when", () => {
  it("asks for a confirmed work-start pin only", () => {
    expect(crossStreetRequestFor(scenario())).not.toBeNull();
    expect(crossStreetRequestFor(scenario({ pinModel: "corridor_end" }))).toBeNull();
    expect(crossStreetRequestFor(scenario({ confirmedRoad: undefined }))).toBeNull();
    expect(crossStreetRequestFor(scenario({ lat: PIN.lat + 0.001 }))).toBeNull();
    expect(crossStreetRequestFor(scenario({ lat: 0, lng: 0 }))).toBeNull();
  });

  it("re-asks for a new pin or road, not for a new speed or length", () => {
    const a = scenario();
    expect(crossStreetKey({ ...a, speed: 45, workLen: 2000 } as Scenario)).toBe(crossStreetKey(a));
    expect(crossStreetKey(scenario({ confirmedRoad: road("Lincoln Street", null) }))).not.toBe(
      crossStreetKey(a),
    );
    const moved = { lat: PIN.lat + 0.001, lng: PIN.lng };
    expect(crossStreetKey(scenario({ ...moved, confirmedRoad: road("North Broadway", null, moved) }))).not.toBe(
      crossStreetKey(a),
    );
  });
});

describe("only a found answer carries words", () => {
  it("found gives the tag and its provenance", () => {
    expect(crossStreetTag(FOUND)).toEqual({
      text: "50 ft S of East 11th Avenue",
      provenance: "cross street from OSM node 3397108608 · searched 1,700 m",
    });
  });

  it.each(["none", "unavailable", "not_applicable"] as const)("%s gives nothing", (status) => {
    expect(crossStreetTag({ ...FOUND, status, text: null })).toBeNull();
  });

  it("no answer yet gives nothing", () => {
    expect(crossStreetTag(null)).toBeNull();
  });
});

describe("the WHERE band prints it", () => {
  const tag = "50 ft S of East 11th Avenue";

  it("in the Work starts row, the road name otherwise", () => {
    const s = scenario();
    const start = (t: string | null) =>
      deriveMoveLedger(s, null, false, null, null, t).rows.find((r) => r.id === "start")!.value;
    expect(start(tag)).toBe(tag);
    expect(start(null)).toBe("North Broadway Southbound");
  });

  it("in the fact line after the road", () => {
    expect(whereValue(scenario({}, { workLen: 1000 }), false, tag)).toBe(
      "North Broadway Southbound · 50 ft S of East 11th Avenue · 1,000 ft",
    );
    expect(whereValue(scenario({}, { workLen: 1000 }), false, null)).toBe("North Broadway Southbound · 1,000 ft");
  });

  it("in place of the near-intersection plan's bare 'at' clause, never beside it", () => {
    const s = {
      ...scenario({ intersection: { lat: 39.734, lng: -104.9875, name: "East 11th Avenue" } }),
      kind: "near_intersection",
    } as Scenario;
    expect(whereValue(s, false, null)).toContain("at East 11th Avenue");
    const tagged = whereValue(s, false, "50 ft S of East 11th Avenue")!;
    expect(tagged).toContain("50 ft S of East 11th Avenue");
    expect(tagged).not.toContain("at East 11th Avenue");
  });

  it("with its provenance on the WHERE line", () => {
    expect(whereProvenance(scenario(), FOUND.provenance_text)).toMatch(
      / · cross street from OSM node 3397108608 · searched 1,700 m$/,
    );
    expect(whereProvenance(scenario(), null)).not.toContain("cross street from");
  });
});
