"use client";

// #247 + #246 — the results-head slot, one component with two states,
// rendered VERBATIM from the shell's derived ``ResultsHead`` (the
// deriveRail idiom, #228: the component decides nothing).
//
//   wait      while a fetch for the GENERATED scenario is in flight —
//             the in-generate scan can run up to 20 s and the strip's
//             VERIFYING line sits under the fixed nav after the landing
//             (measured on prod 0e4b4a1: bar 27..74 at 1440, 7..95 at
//             380, nav 0..52).  This line is below the landing by
//             construction, so it is in view while the scan runs.
//   detected  the settled scan found ≥1 keyed condition: the count and
//             a read-only jump to the strip's correction block.
//   null      nothing to say (pre-generate, refused, settled with no
//             keyed detection — absence renders as absence, rule 10).
//
// The two never co-render: the derivation returns one state.  Visual
// only (no live region): the strip's polite region already announces
// COMPUTING / VERIFYING for the same in-flight state; a second polite
// region saying the same thing is noise (#193 ruling on the ribbon).
// Copy for the wait state is CHOSEN (the design PDF drew no detection
// loading state, p.5).  Not a rail entry (#228): the rail is unmounted
// post-generate and this is results content, not navigation.

import { jumpToAnchor } from "./GeneratorFormPrimitives";
import { SITE_CORRECTIONS_ANCHOR } from "@/lib/scenarios/site-corrections";

export type ResultsHeadState =
  | { kind: "wait" }
  | { kind: "detected"; count: number };

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
  return (
    <div className="site-jump mb-3">
      {`Site conditions — ${head.count} detected · `}
      <a
        className="tr-signpost"
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
