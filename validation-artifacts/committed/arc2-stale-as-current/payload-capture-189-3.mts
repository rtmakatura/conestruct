/**
 * Arc 2 — #189-3 payload evidence (Refs #197).
 *
 * Section A re-drives the PRE-FIX defect exactly as GeneratorSidebar's
 * onPickerSave behaved at cb0472e: a settled-null save at pin B nulls
 * confirmedRoad but leaves pin A's relay fields on the scenario — the
 * wire payload carries detectedLanesTotal=5 (2+2+1, the standing E
 * Colfax test spot) under the Cheesman Park coordinates.
 *
 * Section B runs the POST-FIX path through the real clearDetectionRelays
 * (lib/scenarios): the relays and the #177 markers are absent from the
 * payload — the same honest nothing a fresh no-detection pin sends.
 *
 * Rerun from this directory:  npx -y tsx payload-capture-189-3.mts
 * Committed output: payload-captures-189-3.txt
 */
import {
  applyClassification,
  clearDetectionRelays,
  defaultFor,
} from "../../../conestruct/site/lib/scenarios/index";
import type { RoadClassification } from "../../../conestruct/site/lib/road-detection/types";
import type { Scenario } from "../../../conestruct/site/lib/scenarios/types";

const ECOLFAX = {
  roadType: "urban_arterial",
  divided: false,
  laneWidthFt: 12,
  speedLimitMph: 35,
  lanesPerDirection: 2,
  detectedLanesTotal: 5,
  detectedLanesForward: 2,
  detectedLanesBackward: 2,
  detectedLanesBothWays: 1,
} as unknown as RoadClassification;

const PIN_A = { project: "", address: "E Colfax Ave & Race St", lat: 39.73997, lng: -104.96632 };
const PIN_B = { lat: 39.7312, lng: -104.9665, address: "Cheesman Park lawn" };

function slice(s: Scenario) {
  const a = s as unknown as Record<string, unknown>;
  const meta = a.meta as Record<string, unknown>;
  return {
    lat: meta.lat,
    lng: meta.lng,
    confirmedRoad: meta.confirmedRoad ?? null,
    detectedLanesTotal: a.detectedLanesTotal,
    detectedLanesForward: a.detectedLanesForward,
    detectedLanesBackward: a.detectedLanesBackward,
    detectedLanesBothWays: a.detectedLanesBothWays,
    oneway: a.oneway,
    detectionOverrides: a.detectionOverrides,
  };
}

// Pin A: resolved save applies the detection (both eras).
let s: Scenario = { ...defaultFor("shoulder"), meta: PIN_A } as Scenario;
s = applyClassification(s, ECOLFAX).scenario;
s = {
  ...s,
  meta: { ...(s.meta as object), confirmedRoad: { classification: ECOLFAX, wayId: 600545947 } },
} as unknown as Scenario;
console.log("pin A applied:", JSON.stringify(slice(s), null, 2));

// Pin B settled-null save, PRE-FIX handler order (cb0472e): new coords,
// confirmedRoad <- null, applyClassification skipped, nothing cleared.
const preFix = {
  ...s,
  meta: { ...(s.meta as object), ...PIN_B, confirmedRoad: null },
} as unknown as Scenario;
console.log("A PRE-FIX — pin B settled-null save:", JSON.stringify(slice(preFix), null, 2));
console.log("A PRE-FIX wire payload:", JSON.stringify({ scenario: preFix }));
console.log(
  (preFix as unknown as Record<string, unknown>).detectedLanesTotal !== undefined
    ? "A: REPRODUCES — pin A's relays ride under pin B's coordinates.\n"
    : "A: did not reproduce.\n",
);

// POST-FIX: the else-branch calls clearDetectionRelays (GeneratorSidebar
// onPickerSave) and resets the apply-guard.
const postFix = clearDetectionRelays(preFix);
console.log("B POST-FIX — same save through clearDetectionRelays:", JSON.stringify(slice(postFix), null, 2));
console.log("B POST-FIX wire payload:", JSON.stringify({ scenario: postFix }));
console.log(
  (postFix as unknown as Record<string, unknown>).detectedLanesTotal === undefined
    ? "B: FIXED — no relay field crosses the wire; absence renders as absence."
    : "B: relays still present (unexpected).",
);
