// #288 Phase 1 clause 3 — THE ONE DERIVATION FOR THE RESULTS PRIMARY.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md,
// "The Phase 1 finish ruling" clause 3, which settles #281's ruling 183:
//
//   "one derivation — NEEDS YOU count > 0 → its actions are primary and
//    '↓ All (.zip)' is a ghost; count 0 → '↓ All (.zip)' is the primary;
//    same at 380."
//
// And ruling 182, confirmed as written: in S5 NEEDS YOU's item actions
// are primary and the download row stays a flat four-card row — not
// promoted, and NEEDS YOU not demoted to a disclosure.
//
// WHY A MODULE FOR ONE TERNARY.  Two surfaces render the answer — the
// download row and NEEDS YOU's own action treatment — and #281's
// acceptance line 2 is "one primary per state at both widths".  Two
// surfaces each deciding "am I the primary?" from the same count is two
// producers of one fact, which is the corridor-spacing.ts failure mode
// Rule 3 names and P2's "one voice per fact" forbids: they would agree
// until one of them grew a condition the other did not.  So the fact is
// derived ONCE, here, and read twice.
//
// It is also why this returns WHICH SURFACE OWNS the primary rather than
// a pair of booleans.  A boolean per surface can be true twice; a single
// owner cannot, so "one primary per state" holds by construction and not
// by two call sites agreeing.
//
// Clause 3 supersedes both of rule 183's own options and the halves of
// rules 86 and 168 that stated them: the zip button renders at BOTH
// widths (rule 86 said not at 1440), and it is not unconditionally the
// phone's primary (rule 168 said it was).  What decides is the count,
// and the same count decides at both widths.

/** Which surface carries the results area's one primary action. */
export type PrimaryOwner = "needs-you" | "download-all";

/**
 * The derivation.  `needsYouCount` is ruling 185's SUM — the ▲ changed
 * and ⚠ attention tiers — which is the number NEEDS YOU's header shows.
 * Deliberately not the block's row count: the site-condition rows are
 * always there to correct post-scan, so counting them would make the zip
 * never the primary and the derivation would answer the same thing
 * forever.
 */
export function derivePrimaryOwner(needsYouCount: number): PrimaryOwner {
  return needsYouCount > 0 ? "needs-you" : "download-all";
}
