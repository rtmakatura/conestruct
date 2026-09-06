"use client";

// #249 (s2-arc21) + #247 + #246 — the results-head slot, one component
// with two states, rendered VERBATIM from the shell's derived
// ``ResultsHead`` (the deriveRail idiom, #228: the component decides
// nothing).
//
//   wait     while a fetch for the GENERATED scenario is in flight —
//            the in-generate scan can run up to 20 s and the strip's
//            VERIFYING line sits under the fixed nav after the landing
//            (measured on prod 0e4b4a1: bar 27..74 at 1440, 7..95 at
//            380, nav 0..52).  This line is below the landing by
//            construction, so it is in view while the scan runs.
//   scanned  the settled scan RAN (status ok): the three-part lockup
//            (spec H, 54–59) — the count figure, two stacked labels,
//            the jump to the strip's correction block.  The figure is
//            the detected count over the keyed buckets ON THE WIRE
//            (``total``, rule 12: never a literal five); 0 renders as
//            "0 · No site conditions detected · of N checked" — a
//            stated change from arc-19/20's "0 ⇒ nothing" (GO ruling d).
//   null     nothing to say: pre-generate, a refused scan (the refusal
//            container is the voice), a proceeded outage (the strip's
//            NOT CHECKED container is the voice), not_run (nothing was
//            checked — no block exists to correct), an audit error.
//            Only true statements render (rule 10).
//
// The two never co-render: the derivation returns one state.  Visual
// only (no live region): the strip's polite region already announces
// COMPUTING / VERIFYING for the same in-flight state; a second polite
// region saying the same thing is noise (#193 ruling on the ribbon).
// Copy for the wait state is CHOSEN (the design PDF drew no detection
// loading state, p.5).  Not a rail entry (#228): the rail is unmounted
// post-generate and this is results content, not navigation.  The
// lockup sits BELOW the zone head (spec 60 deviation, ruled): the head
// is the #152 E landing target and the wait line's in-view geometry
// was measured at this position.

import { jumpToAnchor } from "./GeneratorFormPrimitives";
import { SITE_CORRECTIONS_ANCHOR } from "@/lib/scenarios/site-corrections";

export type ResultsHeadState =
  | { kind: "wait" }
  | { kind: "scanned"; count: number; total: number };

export const RESULTS_HEAD_WAIT_COPY =
  "Scanning site conditions along the corridor — up to 20 s · the plan settles here";

export function ResultsHead({ head }: { head: ResultsHeadState | null }) {
  if (head === null) return null;
  if (head.kind === "wait") {
    return (
      <div className="site-jump results-head-wait mb-3">
        <span className="rh-spin" aria-hidden />
        {RESULTS_HEAD_WAIT_COPY}
      </div>
    );
  }
  const detected = head.count > 0;
  return (
    // Spec 54–58: figure · stacked labels · link; no fill, no border, no
    // icon — the 24px figure alone is the weight.  Figure --dim when
    // ≥1 detected (the tier set's mark, GO ruling a), chromeless --none
    // at 0 (spec 59).  Digits, not words, for both numbers (rule 12).
    <div className="results-head-lockup mb-3.5">
      <span className={`rh-figure ${detected ? "rh-detected" : "rh-none"}`}>{head.count}</span>
      <span className="rh-labels">
        <span className="rh-line1 tr-field">
          {detected ? "Site conditions detected" : "No site conditions detected"}
        </span>
        <span className="rh-line2 tr-step">{`of ${head.total} checked`}</span>
      </span>
      <a
        className="tr-signpost rh-link"
        href={`#${SITE_CORRECTIONS_ANCHOR}`}
        onClick={(e) => {
          e.preventDefault();
          jumpToAnchor(SITE_CORRECTIONS_ANCHOR);
        }}
      >
        correct in setup ↑
      </a>
    </div>
  );
}
