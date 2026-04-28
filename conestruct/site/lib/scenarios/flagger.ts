import {
  bufferFor,
  deviceSpacing,
  mergingTaperLength,
  nightDrumCount,
} from "./shared";
import type {
  DeviceListEntry,
  FlaggerLaneClosureScenario,
  FlaggerResult,
  FlaggerWorkType,
} from "./types";

// MUTCD Typical Application — TA-10 "Lane Closure on a Two-Lane Road
// Using Flaggers." CDOT Standard Plan S-630-2 mirrors this for Colorado.
const TA = "TA-10";
const CDOT_SHEET = "S-630-2";

// Pilot car threshold — MUTCD § 6E recommends a pilot car when the
// one-way segment exceeds the distance flaggers can maintain visual
// contact (typically ≈1500 ft). We surface this as a derived warning;
// the user's pilotCar checkbox is still authoritative.
export const PILOT_CAR_THRESHOLD_FT = 1500;

const WORK_LABELS: Record<FlaggerWorkType, string> = {
  utility_cut: "Utility cut",
  water_main: "Water main work",
  chip_seal: "Chip seal",
  patching: "Pavement patching",
  other: "Lane work",
};

export function flaggerWorkLabel(workType: FlaggerWorkType): string {
  return WORK_LABELS[workType];
}

export function computeFlagger(
  s: FlaggerLaneClosureScenario,
): FlaggerResult {
  const L = mergingTaperLength(s.laneWidth, s.speed);
  const B = bufferFor(s.speed);
  const sightDistance = bufferFor(s.speed); // MUTCD Table 6E-1
  const spacing = deviceSpacing(s.speed);

  // TA-10 has a taper at each end of the work zone (one per direction
  // of travel) plus cones along the centerline of the closed lane.
  const taperConesPerEnd = Math.max(4, Math.ceil(L / spacing));
  const taperCones = taperConesPerEnd * 2;
  const tangentCones = Math.ceil(s.workLen / spacing);
  const cones = taperCones + tangentCones;
  const drums = nightDrumCount(cones, s.night);

  // Sign set (per MUTCD TA-10, each direction):
  //   Short duration: W20-1 + W20-7/AFAD                      = 2 signs/dir
  //   Long term:      W20-1 + W20-4 + W3-4 + W20-7/AFAD       = 4 signs/dir
  const signsPerDirection = s.duration === "short" ? 2 : 4;
  const signs = signsPerDirection * 2;

  // Arrow boards aren't standard for TA-10 — flagger paddles or AFAD
  // perform the active-warning role.
  const arrowBoards = 0;

  // Flagger stations: AFAD replaces both flaggers; otherwise the user's
  // flaggerCount stands. Most short, mutual-visibility zones can use 1;
  // most jobs use 2 (one per direction).
  const flaggerStations = s.afad ? 0 : s.flaggerCount;
  const afadDevices = s.afad ? 2 : 0;
  const pilotCarVehicles = s.pilotCar ? 1 : 0;

  const totalDevices =
    cones +
    drums +
    signs +
    arrowBoards +
    flaggerStations +
    afadDevices +
    pilotCarVehicles;

  const uniqueTypes =
    1 + // cones
    (drums ? 1 : 0) +
    (signs ? 1 : 0) +
    (flaggerStations ? 1 : 0) +
    (afadDevices ? 1 : 0) +
    (pilotCarVehicles ? 1 : 0);

  // Flagger ops have more steps: radio briefing, station handoff,
  // takedown coordination. Pilot car adds a step too.
  let steps = s.duration === "short" ? 12 : 16;
  if (s.pilotCar) steps += 2;
  if (s.pedestrianAccess) steps += 1;

  const devices: DeviceListEntry[] = [
    {
      device: 'Traffic cone (28")',
      code: "—",
      fn: "Channelizing",
      qty: cones,
    },
  ];
  if (drums > 0) {
    devices.push({
      device: "Drum (Type IX sheeting)",
      code: "—",
      fn: "Channelizing (night)",
      qty: drums,
    });
  }
  // Signs (each spec'd per direction × 2)
  devices.push({
    device: "Road work ahead",
    code: "W20-1",
    fn: "Advance warning",
    qty: 2,
  });
  if (s.duration === "long") {
    devices.push({
      device: "One lane road ahead",
      code: "W20-4",
      fn: "Advance warning",
      qty: 2,
    });
    devices.push({
      device: "Be prepared to stop",
      code: "W3-4",
      fn: "Advance warning",
      qty: 2,
    });
  }
  if (s.afad) {
    devices.push({
      device: "AFAD ahead",
      code: "W20-7a",
      fn: "Advance warning",
      qty: 2,
    });
    devices.push({
      device: "Automated flagger device",
      code: "—",
      fn: "Active control",
      qty: afadDevices,
    });
  } else {
    devices.push({
      device: "Flagger ahead",
      code: "W20-7",
      fn: "Advance warning",
      qty: 2,
    });
    devices.push({
      device: "Flagger station",
      code: "—",
      fn: "Active control",
      qty: flaggerStations,
    });
  }
  if (s.pilotCar) {
    devices.push({
      device: "Pilot car",
      code: "—",
      fn: "Convoy lead",
      qty: 1,
    });
  }
  if (s.pedestrianAccess) {
    devices.push({
      device: "Pedestrian detour signage",
      code: "R9-3a / R9-9",
      fn: "ADA detour",
      qty: 2,
    });
  }

  return {
    kind: "flagger_lane_closure",
    ta: TA,
    cdotSheet: CDOT_SHEET,
    caseId: "Case 2B",
    L,
    B,
    spacing,
    taperCones,
    tangentCones,
    cones,
    drums,
    signs,
    arrowBoards,
    totalDevices,
    uniqueTypes,
    steps,
    devices,
    flaggerStations,
    pilotCarVehicles,
    afadDevices,
    sightDistance,
  };
}

export const DEFAULT_FLAGGER: FlaggerLaneClosureScenario = {
  kind: "flagger_lane_closure",
  meta: {
    project: "",
    address: "",
    lat: 0,
    lng: 0,
  },
  roadType: "rural_undivided",
  speed: 45,
  laneWidth: 12,
  workType: "utility_cut",
  duration: "long",
  workLen: 400,
  night: false,
  flaggerCount: 2,
  pilotCar: false,
  afad: false,
  pedestrianAccess: false,
};
