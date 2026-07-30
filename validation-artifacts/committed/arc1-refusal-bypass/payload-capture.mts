/**
 * Arc 1 (#181/#189/#190) — payload-level evidence generator.
 *
 * Drives the REAL frontend modules in the order the component handlers
 * call them and prints the wire payload (JSON.stringify({scenario}) —
 * GeneratorShell.tsx audit fetch) before and after each triggering
 * event, plus the frontend gate-mirror verdicts.
 *
 * Run from this directory:  npx -y tsx payload-capture.mts
 * Output is committed alongside as payload-captures.txt; the live
 * backend 200/400 proof is live-backend-transcript.md.
 *
 * Test spot (memory.md standing spot): E Colfax near Race St,
 * 39.73997,-104.96632 — raw lanes=5, decomposes 2+2+1.  The #86 gate
 * refuses total >= 4, so relays-intact => refusal; relays-wiped =>
 * the plan generates.  detectedOneway "yes" rides along to show the
 * #158 relay path (Rule 12: lane facts from the memory.md survey;
 * the oneway value is CHOSEN to exercise the gate, not a claim about
 * the real E Colfax tags).
 */
import {
  applyClassification,
  carryAcrossKinds,
  carryMeta,
  defaultFor,
} from "../../../conestruct/site/lib/scenarios/index";
import {
  flaggerLaneIneligibleHigh,
  matchRefusalAffordance,
  ONEWAY_BLOCKING,
} from "../../../conestruct/site/lib/scenarios/auto-apply";
import { applyOverridesToScenario } from "../../../conestruct/site/lib/scenarios/overrides";
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
  detectedOneway: undefined,
} as unknown as RoadClassification;

const META = {
  project: "",
  address: "E Colfax Ave & Race St, Denver",
  lat: 39.73997,
  lng: -104.96632,
};

function relaySlice(s: Scenario) {
  const any = s as Record<string, unknown>;
  return {
    kind: s.kind,
    speed: (s as { speed: number }).speed,
    detectedLanesTotal: any.detectedLanesTotal,
    detectedLanesForward: any.detectedLanesForward,
    detectedLanesBackward: any.detectedLanesBackward,
    detectedLanesBothWays: any.detectedLanesBothWays,
    oneway: any.oneway,
    detectionOverrides: any.detectionOverrides,
  };
}

function gateVerdict(s: Scenario) {
  if (s.kind !== "flagger_lane_closure") {
    return "flagger gates not applicable (kind=" + s.kind + ")";
  }
  const any = s as Record<string, unknown>;
  return {
    mirror_flagger_lane_ineligible_high: flaggerLaneIneligibleHigh(
      any.detectedLanesTotal as number | undefined,
      any.detectedLanesForward as number | undefined,
      any.detectedLanesBackward as number | undefined,
      any.detectedLanesBothWays as number | undefined,
    ),
    mirror_oneway_blocking:
      any.oneway !== undefined && ONEWAY_BLOCKING.has(any.oneway as string),
    mirror_single_lane: any.detectedLanesTotal === 1,
    refusalAffordance: matchRefusalAffordance(s)?.code ?? null,
    note: "mirrors of the backend gates at render_api.py:406-412; backend authoritative",
  };
}

const out: string[] = [];
function log(title: string, s: Scenario) {
  out.push(`--- ${title}`);
  out.push("relay slice: " + JSON.stringify(relaySlice(s), null, 2));
  out.push("gate mirror verdict: " + JSON.stringify(gateVerdict(s), null, 2));
  out.push("full wire payload: " + JSON.stringify({ scenario: s }));
  out.push("");
}

// =========================================================================
// #181 — kind-switch (pre-fix path via carryMeta, post-fix via
// carryAcrossKinds + re-application from the confirmed detection)
// =========================================================================
out.push("================ #181 kind-switch ================");
let s: Scenario = { ...defaultFor("shoulder"), meta: META } as Scenario;
s = applyClassification(s, ECOLFAX).scenario;
log("#181 A1: after detection on SHOULDER kind (payload BEFORE kind switch)", s);

const preFix = carryMeta(s, defaultFor("flagger_lane_closure"));
log(
  "#181 A2 PRE-FIX (carryMeta, the defect): payload AFTER the switch — the bypass",
  preFix,
);

let postFix = carryAcrossKinds(s, defaultFor("flagger_lane_closure"));
const reapplied = applyClassification(postFix, ECOLFAX);
postFix = applyOverridesToScenario(reapplied.scenario, {
  speedMph: (s as { speed: number }).speed,
});
log(
  "#181 A3 POST-FIX (carryAcrossKinds + re-apply, GeneratorSidebar.onKindChange): relays re-armed",
  postFix,
);

let f: Scenario = { ...defaultFor("flagger_lane_closure"), meta: META } as Scenario;
f = applyClassification(f, ECOLFAX).scenario;
log("#181 B CONTROL: flagger-first, same detection — the gate arms", f);

// =========================================================================
// #189 — picker Save mid-detection (classification === null skips
// applyClassification at GeneratorSidebar.onPickerSave; relays never set)
// =========================================================================
out.push("================ #189 mid-detection Save ================");
let m: Scenario = { ...defaultFor("flagger_lane_closure"), meta: META } as Scenario;
m = { ...m, meta: { ...m.meta, confirmedRoad: null } } as unknown as Scenario;
m = applyOverridesToScenario(m, {});
log(
  "#189: payload after a mid-flight Save (classification null) — no relays ever arrive; " +
    "post-fix, canSave blocks this state (LocationPickerModal)",
  m,
);

// =========================================================================
// #190 — picker re-save re-imposing restored overrides
// =========================================================================
out.push("================ #190 re-save reverts manual edit ================");
let g: Scenario = { ...defaultFor("shoulder"), meta: META } as Scenario;
g = applyClassification(g, ECOLFAX).scenario;
g = applyOverridesToScenario(g, { speedMph: 40 });
out.push(`#190 1: first save, picker override speed 40 -> speed=${(g as { speed: number }).speed}`);
g = { ...g, speed: 25 } as Scenario;
out.push(`#190 2: manual form edit -> speed=${(g as { speed: number }).speed}  (payload BEFORE re-save)`);
const preFixResave = applyOverridesToScenario(g, { speedMph: 40 });
out.push(
  `#190 3 PRE-FIX: unconditional re-apply on a no-change re-save -> speed=${(preFixResave as { speed: number }).speed}  (manual 25 reverted; no marker recorded)`,
);
out.push(
  "#190 4 POST-FIX: GeneratorSidebar.onPickerSave now compares the overrides JSON " +
    "(lastAppliedOverridesRef) and skips the unchanged re-emit -> speed stays 25 " +
    "(pinned by GeneratorShell.picker-reapply.test.tsx).",
);

console.log(out.join("\n"));
