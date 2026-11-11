// #493 round 2: worst-case request bodies against the 32 KB render-family cap
// (MAX_BODY_BYTES in app/api/render/{bundle,quote-breakdown,audit,...}/route.ts,
// checked on the browser -> Next route body). Run from conestruct/site:
//   npx tsx --tsconfig ./tsconfig.json <script>
import { DEFAULT_NEAR_INTERSECTION } from "@/lib/scenarios";
import { withRelayedCenterline } from "@/lib/scenarios/centerline-relay";
import { DEFAULT_QUOTE_SETTINGS } from "@/lib/quote-settings";
import { intersectionRecord } from "@/lib/road-detection/cross-street-lookup";
import { GEOMETRY_MAX_NODES } from "@/lib/road-detection/stitch";

const CAP = 32 * 1024;
const TAP = { lat: 39.7399691, lng: -104.968354 };
// OSM's 7 decimals, as Overpass sends them.
const line = (dLat: number, dLng: number) =>
  Array.from({ length: GEOMETRY_MAX_NODES }, (_, i): [number, number] => [
    +(39.7399691 + i * dLat).toFixed(7),
    +(-104.968354 + i * dLng).toFixed(7),
  ]);
const road = line(1.234567e-5, -1.234567e-5);
const cross = line(-1.234567e-5, 1.234567e-5);

function scenario(acks: number) {
  const base = structuredClone(DEFAULT_NEAR_INTERSECTION) as any;
  const rec = intersectionRecord(TAP, {
    name: "North Speer Boulevard Southbound Frontage Road",
    highwayClass: "secondary",
    legCount: 2,
    signalized: true,
    speedMph: 35,
    lanesPerDirection: 2,
    lanesSuspect: true,
    lanesSuspectReason: "turn lanes",
    roadType: "urban_arterial",
    bearingDeg: 0,
    detectedLanesTotal: 5,
    detectedLanesForward: 2,
    detectedLanesBackward: 2,
    detectedLanesBothWays: 1,
    geometry: cross,
  });
  if (!rec.geometry || rec.geometry.length !== GEOMETRY_MAX_NODES) throw new Error("no 300-point line");
  const note = "n".repeat(200);
  base.meta = {
    ...base.meta,
    project: "Water main replacement, phase 2, E Colfax Ave between Franklin and Gilpin",
    address: "1600 E Colfax Ave, Denver, CO 80218, United States",
    locationDescription: "E Colfax Ave WB, Franklin St to Gilpin St, Denver (City and County of Denver)",
    lat: TAP.lat,
    lng: TAP.lng,
    pinModel: "work_start",
    work: { side: "right", travel: "with_geometry" },
    confirmedRoad: {
      candidate: {
        way_id: "1547338997",
        highway_class: "primary",
        name: "East Colfax Avenue",
        ref: "US 40;US 287",
        bearing: 270,
        snap_distance_m: 3.21,
        snapped_lat: TAP.lat,
        snapped_lng: TAP.lng,
        tags: {
          oneway: "no", maxspeed: "30 mph", lanes: "5", lanes_forward: "2", lanes_backward: "2",
          lanes_both_ways: "1", turn_lanes: "left|through|through|through|right",
          turn_lanes_forward: "left|through", turn_lanes_backward: "through|right",
        },
        signal_distance_m: 12.34,
        geometry: road,
        twin_distance_m: 123.45,
        twin_searched: true,
      },
      pinLat: TAP.lat,
      pinLng: TAP.lng,
    },
    intersection: rec,
    siteConditions: {
      adjacent_intersection: true, adjacent_interchange: true, pedestrian_facility: true,
      bicycle_facility: true, school_zone: true, limited_sight_distance: true, driveways_present: true,
    },
    // The backend's max_length=5, each with the longest note (200).
    siteConditionOverrides: [
      "adjacent_intersection", "adjacent_interchange", "pedestrian_facility", "bicycle_facility", "school_zone",
    ].map((flag) => ({ flag, action: "dismiss", reason: "other", note, recorded_at: "2026-11-10T14:08:10.123Z" })),
    acknowledged: Array.from({ length: acks }, (_, i) => `jur:delta:city-and-county-of-denver:${i.toString(16).padStart(10, "0")}`),
  };
  return base;
}

const settings = { ...DEFAULT_QUOTE_SETTINGS, project_duration_days: 365, num_flaggers: 20, delivery_distance_miles: 499.5 };
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v));
for (const [label, acks] of [["realistic (5 acknowledged)", 5], ["backend max (50 acknowledged)", 50]] as const) {
  const s = scenario(acks);
  const rows: Array<[string, number]> = [
    ["bundle (browser -> /api/render/bundle)", bytes({ scenario: s, settings })],
    ["quote-breakdown (browser -> /api/render/quote-breakdown)", bytes({ scenario: s, settings })],
    ["audit (browser -> /api/render/audit)", bytes(s)],
    ["needs-you map (browser -> route)", bytes({ scenario: s, flag: "adjacent_intersection", width: 846, height: 423 })],
    ["upstream bundle part (proxy -> Modal, + derived centerline; no cap there)", bytes({ scenario: withRelayedCenterline(s), settings })],
  ];
  console.log(`## ${label}`);
  for (const [name, n] of rows) console.log(`${name}: ${n} bytes, ${n < CAP ? "under" : "OVER"} the ${CAP}-byte cap (${CAP - n} left)`);
}
