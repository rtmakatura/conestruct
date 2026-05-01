import {
  bufferFor,
  deviceSpacing,
  mergingTaperLength,
  nightDrumCount,
} from "./shared";
import type {
  DeviceListEntry,
  LaneClosureDividedScenario,
  LaneClosureResult,
  LaneClosureWorkType,
} from "./types";

// MUTCD Typical Application — TA-19 "Lane Closure on Divided Highway"
// (right-lane closed, two lanes per direction, full merging taper).
// CDOT Standard Plan S-630-3 mirrors this for Colorado.
const TA = "TA-19";
const CDOT_SHEET = "S-630-3";

const WORK_LABELS: Record<LaneClosureWorkType, string> = {
  pavement_repair: "Pavement repair",
  striping: "Pavement striping",
  drainage: "Drainage / culvert",
  bridge_deck: "Bridge deck repair",
  guardrail: "Guardrail repair",
  other: "Lane closure work",
};

export function laneClosureWorkLabel(workType: LaneClosureWorkType): string {
  return WORK_LABELS[workType];
}

export function computeLaneClosure(
  s: LaneClosureDividedScenario,
): LaneClosureResult {
  const L = mergingTaperLength(s.laneWidth, s.speed);
  const B = bufferFor(s.speed);
  const spacing = deviceSpacing(s.speed);

  // Full merging taper L (not L/3) per MUTCD §6C.08 for travel-lane closure.
  const taperCones = Math.max(2, Math.ceil(L / spacing));
  const tangentCones = Math.max(2, Math.ceil(s.workLen / spacing));
  // Downstream taper opens the lane back up — typically short (≈L/3) and
  // we render it with 2 cones to keep the merging taper unambiguous.
  const downstreamCones = 2;
  const cones = taperCones + tangentCones + downstreamCones;
  const drums = nightDrumCount(cones, s.night);

  // Sign set per MUTCD TA-19 (each direction on a divided highway):
  //   W20-1 ROAD WORK AHEAD
  //   W20-5 RIGHT LANE CLOSED AHEAD
  //   W4-2  RIGHT LANE ENDS (merge arrow)
  //   G20-2 END ROAD WORK
  // CDOT mirrors all four on the median side. Long-term jobs add G20-5P
  // CONSTRUCTION ZONE plaques inside the work zone.
  const advanceSignsPerDirection = 3;
  const endSignsPerDirection = 1;
  const signsPerDirection = advanceSignsPerDirection + endSignsPerDirection;
  const signs = signsPerDirection * 2; // mirrored on divided highway
  const plaques = s.duration === "long" ? 2 : 0;

  // Arrow board mandatory on multi-lane lane closures (≥40 mph). One unit
  // at the upstream end of the merging taper, LEFT-arrow mode.
  const arrowBoards = 1;

  // TMA recommended for lane closures ≥45 mph — count if user opted in.
  const tmaCount = s.truckMountedAttenuator ? 1 : 0;

  const totalDevices =
    cones + drums + signs + plaques + arrowBoards + tmaCount;
  const uniqueTypes =
    1 + // cones
    (drums ? 1 : 0) +
    (signs ? 1 : 0) +
    (plaques ? 1 : 0) +
    (arrowBoards ? 1 : 0) +
    (tmaCount ? 1 : 0);

  // Multi-lane lane closures have more setup steps (lane shift, arrow
  // board positioning, TMA staging, mirror sign placement).
  let steps = s.duration === "short" ? 14 : 18;
  if (s.truckMountedAttenuator) steps += 2;

  const devices: DeviceListEntry[] = [];
  devices.push({
    device: "Drum (Type IX sheeting)",
    code: "—",
    fn: "Channelizing taper + tangent",
    qty: cones,
  });
  if (drums > 0) {
    // For night, the TS model treats `cones` as the placed-channelizer
    // count and `drums` as the *additional* retroreflective surcharge.
    // Devices line above already covers the daytime drums; add the
    // night surcharge separately.
    devices[devices.length - 1].fn = "Channelizing (day)";
    devices.push({
      device: "Drum w/ Type IX (night)",
      code: "—",
      fn: "Channelizing (night surcharge)",
      qty: drums,
    });
  }
  devices.push({
    device: "Road work ahead",
    code: "W20-1",
    fn: "Advance warning",
    qty: 2,
  });
  devices.push({
    device: "Right lane closed ahead",
    code: "W20-5R",
    fn: "Advance warning",
    qty: 2,
  });
  devices.push({
    device: "Right lane ends",
    code: "W4-2R",
    fn: "Advance warning (merge)",
    qty: 2,
  });
  devices.push({
    device: "End road work",
    code: "G20-2",
    fn: "Termination",
    qty: 2,
  });
  if (plaques > 0) {
    devices.push({
      device: "Construction zone plaque",
      code: "G20-5P",
      fn: "Inside work zone",
      qty: plaques,
    });
  }
  devices.push({
    device: "Arrow board (Type C)",
    code: "—",
    fn: "Lane-closure arrow",
    qty: arrowBoards,
  });
  if (tmaCount > 0) {
    devices.push({
      device: "Truck-mounted attenuator",
      code: "—",
      fn: "Upstream protection",
      qty: tmaCount,
    });
  }

  return {
    kind: "lane_closure_divided",
    ta: TA,
    cdotSheet: CDOT_SHEET,
    caseId: "Case 3A",
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
    tmaCount,
  };
}

export const DEFAULT_LANE_CLOSURE: LaneClosureDividedScenario = {
  kind: "lane_closure_divided",
  meta: {
    project: "",
    address: "",
    lat: 0,
    lng: 0,
  },
  roadType: "freeway",
  speed: 65,
  laneWidth: 12,
  workType: "pavement_repair",
  duration: "long",
  workLen: 800,
  night: false,
  truckMountedAttenuator: true,
};
