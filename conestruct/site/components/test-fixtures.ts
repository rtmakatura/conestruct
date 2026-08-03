// Shared mounted-test fixtures.
//
// #186: a fresh DEFAULT_* scenario sits at the 0/0 unset-location
// sentinel, which now renders AWAITING LOCATION with a gated Generate.
// Mounted suites that assert a verdict or an enabled CTA start from a
// located scenario instead — the standing E Colfax test spot
// (memory.md: 39.73997, -104.96632).  ``pinned`` preserves the kind, so
// per-kind fixtures stay per-kind.

import { DEFAULT_FLAGGER, DEFAULT_SHOULDER } from "@/lib/scenarios";
import type {
  FlaggerLaneClosureScenario,
  Scenario,
  ShoulderScenario,
} from "@/lib/scenarios";

export const TEST_PIN = { lat: 39.73997, lng: -104.96632 };

export function pinned<S extends Scenario>(s: S): S {
  return { ...s, meta: { ...s.meta, ...TEST_PIN } };
}

export const PINNED_SHOULDER: ShoulderScenario = pinned(DEFAULT_SHOULDER);
// #179: the confirm-undo loop mounts a located flagger.
export const PINNED_FLAGGER: FlaggerLaneClosureScenario =
  pinned(DEFAULT_FLAGGER);
