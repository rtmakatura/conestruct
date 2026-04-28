import {
  bufferFor,
  deviceSpacing,
  mergingTaperLength,
  nightDrumCount,
} from "./shared";
import type {
  DeviceListEntry,
  ShoulderResult,
  ShoulderScenario,
  ShoulderWorkType,
} from "./types";

// MUTCD Typical Application — TA-2 "Work on the Shoulders" is the most
// common shoulder scenario. TA-1 ("beyond the shoulder") and TA-3 ("with
// minor encroachment") are refinements that need additional inputs
// (shoulder width, encroachment) before we can branch reliably.
const TA = "TA-2";
const CDOT_SHEET = "S-630-1";

// Short-form sign labels printed on the work-zone description.
const WORK_LABELS: Record<ShoulderWorkType, string> = {
  utility_locate: "Utility locate",
  survey: "Survey crew",
  signal_cabinet: "Signal cabinet",
  guardrail: "Guardrail repair",
  other: "Shoulder work",
};

export function shoulderWorkLabel(workType: ShoulderWorkType): string {
  return WORK_LABELS[workType];
}

export function computeShoulder(s: ShoulderScenario): ShoulderResult {
  const L = mergingTaperLength(s.laneWidth, s.speed);
  const B = bufferFor(s.speed);
  const spacing = deviceSpacing(s.speed);

  // Shoulder taper is shorter than a merging taper (MUTCD § 6C.08:
  // shoulder taper ≈ 1/3 L). For v1 we use full L as a conservative
  // upper bound — easier to defend in review than under-coning.
  const taperCones = Math.max(4, Math.ceil(L / spacing));
  const tangentCones = Math.ceil(s.workLen / spacing);
  const cones = taperCones + tangentCones;
  const drums = nightDrumCount(cones, s.night);

  // Sign count per MUTCD § 6G.02:
  //   Short-duration (<1h): minimum signing — typically just W20-1.
  //   Long-term: 3 signs ≥45 mph, 2 signs <45 mph (advance warning).
  const signs =
    s.duration === "short" ? 1 : s.speed >= 45 ? 3 : 2;

  // Shoulder closures don't require an arrow board (no merge needed).
  const arrowBoards = 0;

  const totalDevices = cones + drums + signs + arrowBoards;
  const uniqueTypes = 1 + (drums ? 1 : 0) + (signs ? 1 : 0);

  // Setup/takedown step count — short-duration jobs skip a few steps.
  const steps = s.duration === "short" ? 8 : cones > 30 ? 14 : 11;

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
  if (signs >= 1) {
    devices.push({
      device: "Road work ahead",
      code: "W20-1",
      fn: "Advance warning",
      qty: 2,
    });
  }
  if (signs >= 2) {
    devices.push({
      device: "Shoulder work",
      code: "W21-5",
      fn: "Advance warning",
      qty: 2,
    });
  }
  if (signs >= 3) {
    devices.push({
      device: "End road work",
      code: "G20-2",
      fn: "Termination",
      qty: 2,
    });
  }

  return {
    kind: "shoulder",
    ta: TA,
    cdotSheet: CDOT_SHEET,
    caseId: s.divided ? "Case 1A" : "Case 1B",
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

export const DEFAULT_SHOULDER: ShoulderScenario = {
  kind: "shoulder",
  meta: {
    project: "",
    address: "",
    lat: 0,
    lng: 0,
  },
  roadType: "rural_divided",
  speed: 65,
  lanes: 2,
  laneWidth: 12,
  divided: true,
  workType: "utility_locate",
  duration: "short",
  workLen: 200,
  night: false,
};
