import type {
  DeviceListEntry,
  MobileOpMultilaneResult,
  MobileOpMultilaneScenario,
} from "./types";

// MUTCD Typical Application — TA-26 "Mobile Operation on a Multi-Lane
// Road." Per § 6G.06. Slow-moving operations on freeways and divided
// highways with TMA + arrow board mandatory; second TMA upstream is
// recommended at speeds ≥ 55 mph.
const TA = "TA-26";
const CDOT_SHEET = "S-630-3";

export function computeMobileOpMultilane(
  s: MobileOpMultilaneScenario,
): MobileOpMultilaneResult {
  const L = 0;
  const B = 0;
  const spacing = s.speed;
  const cones = 0;
  const drums = 0;
  const taperCones = 0;
  const tangentCones = 0;

  const signs = 0; // no roadside advance signs; shadow's arrow board is the warning
  const arrowBoards = 1; // mandatory on shadow
  const shadowVehicles = 1;
  const tmaCount = (s.secondTMA ? 2 : 1) + 1; // shadow + (optional second) + work truck

  const totalDevices = arrowBoards + tmaCount;
  const uniqueTypes = 1 + (arrowBoards ? 1 : 0); // TMA + arrow board

  const steps = s.secondTMA ? 8 : 6;

  const devices: DeviceListEntry[] = [
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
    {
      device: "Arrow board (LEFT arrow)",
      code: "—",
      fn: "Lane-closure indication",
      qty: 1,
    },
  ];
  if (s.secondTMA) {
    devices.push({
      device: "Upstream shadow TMA",
      code: "—",
      fn: "Additional protection (≥55 mph)",
      qty: 1,
    });
  }

  return {
    kind: "mobile_op_multilane",
    ta: TA,
    cdotSheet: CDOT_SHEET,
    caseId: "Case 4B",
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

export const DEFAULT_MOBILE_OP_MULTILANE: MobileOpMultilaneScenario = {
  kind: "mobile_op_multilane",
  meta: { project: "", address: "", lat: 0, lng: 0 },
  roadType: "freeway",
  speed: 65,
  laneWidth: 12,
  workType: "striping",
  workLen: 300,
  night: false,
  secondTMA: false,
};
