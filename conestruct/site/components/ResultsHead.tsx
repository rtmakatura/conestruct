"use client";

// #249 (s2-arc21) + #247 + #246 — the results-head slot, one component
// rendered VERBATIM from the shell's derived ``ResultsHead`` (the
// deriveRail idiom, #228: the component decides nothing).
//
//   (wait)   retired by #252: the in-flight state used to render a wait
//            line here because the strip's VERIFYING sat under the nav
//            after the landing (#247).  The working band — fixed to the
//            viewport's bottom edge, in view from anywhere — is now the
//            page's one working voice; in flight this slot is empty.
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
//            checked — no block exists to correct), an audit error, and
//            any fetch for the generated scenario in flight.  Only true
//            statements render (rule 10).
//
// Visual only (no live region).  Not a rail entry (#228): the rail is
// unmounted post-generate and this is results content, not navigation.
// The lockup sits BELOW the zone head (spec 60 deviation, ruled): the
// head is the #152 E landing target.

import { jumpToAnchor } from "./GeneratorFormPrimitives";
import { SITE_CORRECTIONS_ANCHOR } from "@/lib/scenarios/site-corrections";

export type ResultsHeadState = { kind: "scanned"; count: number; total: number };

// #240 (P1): ``reserve`` — the shell passes ``genState !== "pre" &&
// !planDeclined``: from the Generate click the slot (`.results-head-slot`,
// min-height --strip-h + the 14 px gap) is mounted, empty, so the lockup
// lands at the settle into room already allocated and nothing below it
// moves; released under a declined plan (the refusal container is the
// voice and no lockup will come).  Pre-generate: nothing, not even the
// slot.  The lockup itself is unchanged (P16: the empty slot is room,
// not a skeleton — no placeholder content).
export function ResultsHead({
  head,
  reserve = false,
}: {
  head: ResultsHeadState | null;
  reserve?: boolean;
}) {
  if (head === null && !reserve) return null;
  return <div className="results-head-slot">{head && <Lockup head={head} />}</div>;
}

function Lockup({ head }: { head: ResultsHeadState }) {
  const detected = head.count > 0;
  return (
    // Spec 54–58: figure · stacked labels · link; no fill, no border, no
    // icon — the 24px figure alone is the weight.  Figure --dim when
    // ≥1 detected (the tier set's mark, GO ruling a), chromeless --none
    // at 0 (spec 59).  Digits, not words, for both numbers (rule 12).
    // #240: the 14 px gap moved to the slot (a margin inside a min-height
    // box does not collapse through, so the slot would grow with it).
    <div className="results-head-lockup">
      <span className={`rh-figure ${detected ? "rh-detected" : "rh-none"}`}>{head.count}</span>
      <span className="rh-labels">
        <span className="rh-line1 tr-field">
          {detected ? "Site conditions detected" : "No site conditions detected"}
        </span>
        <span className="rh-line2 tr-step">{`of ${head.total} checked`}</span>
      </span>
      <a
        className="tr-signpost rh-link"
        data-read=""
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
