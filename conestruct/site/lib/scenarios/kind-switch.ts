// #456 M13: the scenario a kind switch writes, as one pure function.  Moved
// verbatim out of GeneratorSidebar's onKindChange (#181's carry, the relays
// re-derived from the confirmed detection, the operator's speed on top) so
// the WHERE band's load-ahead builds the same scenario the click writes and
// finds its picture already there.  No behaviour change.

import { applyClassification, carryAcrossKinds, defaultFor } from "./index";
import type { AutoApplyDelta, Scenario, ScenarioKind } from "./index";
import { applyOverridesToScenario } from "./overrides";

export interface KindSwitch {
  next: Scenario;
  /** What the sidebar's handoff summary needs, when a road is confirmed. */
  applied: { prior: Scenario; delta: AutoApplyDelta } | null;
}

export function kindSwitch(scenario: Scenario, kind: ScenarioKind): KindSwitch {
  // #181: a kind switch is not an erase site.  Shared inputs carry
  // (carryAcrossKinds), and the safety relays re-derive from the
  // confirmed detection so the new kind gets its own relay shape —
  // flagger gains `oneway` (#158) here even though the shoulder
  // branch never captured it.  No detection on record → no relays:
  // absence renders as absence (rule 10).
  const next = carryAcrossKinds(scenario, defaultFor(kind));
  const confirmed = scenario.meta.confirmedRoad;
  if (!confirmed) return { next, applied: null };
  const applied = applyClassification(next, confirmed.classification);
  // The operator's in-effect speed outranks the re-applied detection
  // speed — same override-over-detection order as onPickerSave.  The
  // re-application exists to rebuild the relays for the new kind,
  // not to revert a value the operator already reviewed.
  return {
    next: applyOverridesToScenario(applied.scenario, { speedMph: scenario.speed }),
    applied: { prior: next, delta: applied.delta },
  };
}
