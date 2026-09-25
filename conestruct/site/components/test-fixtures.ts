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

// #290: under the work-start model a located scenario the shell will
// CHECK also has its side confirmed (ruling 10: side unset is needs-you,
// and no check fires until it is answered).  The fixture pin has no
// confirmed road, so its direction is the four-way heading (the
// open-points ruling 1) — right side, traffic heading north.
export const TEST_SIDE = { side: "right", heading: "N" } as const;

export function pinned<S extends Scenario>(s: S): S {
  return { ...s, meta: { ...s.meta, ...TEST_PIN, work: { ...TEST_SIDE } } };
}

// #261: the smallest audit answer the shell can hold — `sections` and
// `pending_verification` present (assignTiers reads both for the audit
// card's count), everything else absent.  For suites that mock zone 3
// away and used to answer /api/render/audit with `{}`: the shell now
// derives the audit card's "N checks" from the settled audit itself, so
// the answer must be wire-shaped (Pydantic never omits these).
export const MIN_AUDIT = {
  summary: {},
  sections: {},
  pending_verification: { count: 0, note: "", tracking_issue: null },
};

// #290: the backend's /render/corridor-geometry answer for a pin with no
// confirmed road and no side yet — the four headings, worded as the
// backend words them (render_api._side_options).  For suites whose fetch
// mock must answer the WHERE band's geometry read so the side control
// renders; `answerSide()` (band-helpers) then clicks it as a person would.
export const NO_ROAD_SIDE_OPTIONS = [
  { work: { side: "right", heading: "N" }, label: "East side · traffic heads north", built: true },
  { work: { side: "right", heading: "E" }, label: "South side · traffic heads east", built: true },
  { work: { side: "right", heading: "S" }, label: "West side · traffic heads south", built: true },
  { work: { side: "right", heading: "W" }, label: "North side · traffic heads west", built: true },
];

export function corridorGeometryResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: "side_not_confirmed",
      pin_model: "work_start",
      pin: null,
      travel_bearing_deg: null,
      work: null,
      approaches: [],
      coverage_ft: null,
      message: null,
      side_options: NO_ROAD_SIDE_OPTIONS,
    }),
  } as unknown as Response;
}

export const PINNED_SHOULDER: ShoulderScenario = pinned(DEFAULT_SHOULDER);
// #179: the confirm-undo loop mounts a located flagger.
export const PINNED_FLAGGER: FlaggerLaneClosureScenario =
  pinned(DEFAULT_FLAGGER);
