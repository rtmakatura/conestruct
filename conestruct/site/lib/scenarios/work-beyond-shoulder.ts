import type {
  DeviceListEntry,
  WorkBeyondShoulderResult,
  WorkBeyondShoulderScenario,
  WorkBeyondShoulderWorkType,
} from "./types";

// MUTCD Typical Application — TA-1 "Work Beyond the Shoulder."
// Per § 6G.04, work outside the roadway shoulder requires only
// minimal advance signing. No taper, buffer, or channelizing devices.
const TA = "TA-1";
const CDOT_SHEET = "S-630-1";

const WORK_LABELS: Record<WorkBeyondShoulderWorkType, string> = {
  utility: "Utility work (off-road)",
  environmental: "Environmental sampling",
  landscaping: "Landscaping / mowing",
  survey: "Survey crew (off-road)",
  fence_repair: "Fence / right-of-way repair",
  other: "Off-road work",
};

export function workBeyondShoulderWorkLabel(
  workType: WorkBeyondShoulderWorkType,
): string {
  return WORK_LABELS[workType];
}

export function computeWorkBeyondShoulder(
  s: WorkBeyondShoulderScenario,
): WorkBeyondShoulderResult {
  // No taper, no buffer, no channelizing — only signs.
  const L = 0;
  const B = 0;
  const spacing = s.speed; // informational

  const cones = 0;
  const drums = 0;
  const taperCones = 0;
  const tangentCones = 0;

  // W21-5 SHOULDER WORK upstream + G20-2 END ROAD WORK if long-term.
  const signs = s.duration === "long" ? 2 : 1;
  const arrowBoards = 0;

  const totalDevices = signs;
  const uniqueTypes = signs > 0 ? 1 : 0;

  const steps = s.duration === "short" ? 4 : 6;

  const devices: DeviceListEntry[] = [
    {
      device: "Shoulder work",
      code: "W21-5",
      fn: "Advance warning",
      qty: 1,
    },
  ];
  if (s.duration === "long") {
    devices.push({
      device: "End road work",
      code: "G20-2",
      fn: "Termination",
      qty: 1,
    });
  }

  return {
    kind: "work_beyond_shoulder",
    ta: TA,
    cdotSheet: CDOT_SHEET,
    caseId: "Case 1",
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
  };
}

export const DEFAULT_WORK_BEYOND_SHOULDER: WorkBeyondShoulderScenario = {
  kind: "work_beyond_shoulder",
  meta: { project: "", address: "", lat: 0, lng: 0 },
  roadType: "rural_undivided",
  speed: 45,
  laneWidth: 12,
  workType: "utility",
  duration: "short",
  workLen: 200,
  night: false,
};
