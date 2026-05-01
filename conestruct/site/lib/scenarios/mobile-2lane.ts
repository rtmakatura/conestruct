import type {
  DeviceListEntry,
  MobileOp2LaneResult,
  MobileOp2LaneScenario,
  MobileWorkType,
} from "./types";

// MUTCD Typical Application — TA-35 "Mobile Operation on a Two-Lane
// Road." Per § 6G.05. Slow-moving operations (sweeping, striping,
// mowing, patching) where protection moves with the work truck.
const TA = "TA-35";
const CDOT_SHEET = "S-630-1";

const WORK_LABELS: Record<MobileWorkType, string> = {
  striping: "Pavement striping",
  sweeping: "Street sweeping",
  mowing: "Roadside mowing",
  patching_pothole: "Pothole patching",
  crack_seal: "Crack sealing",
  sign_maintenance: "Sign maintenance",
  asphalt_repair: "Asphalt repair (mobile)",
  other: "Mobile work",
};

export function mobileWorkLabel(workType: MobileWorkType): string {
  return WORK_LABELS[workType];
}

export function computeMobileOp2Lane(
  s: MobileOp2LaneScenario,
): MobileOp2LaneResult {
  // Mobile ops have no fixed taper / buffer / channelizers.
  const L = 0;
  const B = 0;
  const spacing = s.speed;
  const cones = 0;
  const drums = 0;
  const taperCones = 0;
  const tangentCones = 0;

  const signs = 1; // W21-1A WORKERS AHEAD on shadow
  const arrowBoards = s.arrowBoardOnShadow ? 1 : 0;
  const shadowVehicles = 1;
  const tmaCount = 1; // shadow vehicle includes TMA

  const totalDevices = signs + arrowBoards + shadowVehicles + tmaCount + 1; // +1 work truck
  const uniqueTypes =
    1 + // work truck (TMA-class)
    1 + // shadow TMA
    (arrowBoards ? 1 : 0) +
    (signs ? 1 : 0);

  const steps = 6; // mobile ops have lean setup: brief + roll out + work + return

  const devices: DeviceListEntry[] = [
    {
      device: "Workers ahead",
      code: "W21-1A",
      fn: "Advance warning (vehicle-mounted)",
      qty: 1,
    },
    {
      device: "Work truck",
      code: "—",
      fn: "Mobile work platform",
      qty: 1,
    },
    {
      device: "Shadow vehicle w/ TMA",
      code: "—",
      fn: "Trailing protection",
      qty: 1,
    },
  ];
  if (s.arrowBoardOnShadow) {
    devices.push({
      device: "Arrow board (caution mode)",
      code: "—",
      fn: "Active warning",
      qty: 1,
    });
  }

  return {
    kind: "mobile_op_2lane",
    ta: TA,
    cdotSheet: CDOT_SHEET,
    caseId: "Case 4A",
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
    shadowVehicles,
    tmaCount,
  };
}

export const DEFAULT_MOBILE_OP_2LANE: MobileOp2LaneScenario = {
  kind: "mobile_op_2lane",
  meta: { project: "", address: "", lat: 0, lng: 0 },
  roadType: "rural_undivided",
  speed: 45,
  laneWidth: 12,
  workType: "striping",
  workLen: 200,
  night: false,
  arrowBoardOnShadow: true,
};
