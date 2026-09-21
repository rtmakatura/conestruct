"use client";

// #288 Phase 1 (s2-arc33) — the reserved first row of the results stack.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// — the rule-28 ruling (Ryan, 2026-09-21) and #281 Part 1 §8.29.
//
// WHAT THIS WAS.  Until this commit the component rendered the
// next-steps strip ("NEXT — 3 STEPS", three chips) inside a reserved,
// pinned slot (#253, #249, #247, #246).  §8.29 drops the strip: its
// three chips pointed at site conditions, pending items and downloads,
// and in Direction A's column all three are visible in the same
// viewport, so the strip restated what is already on screen.
//
// WHAT SURVIVES, and it is the whole reason the component still exists:
//   · the RESERVED ROW — rule 28.  "The results stack's first row is a
//     reserved slot of its own height plus its gap, mounted from the
//     Generate click onward, released under a decline.  This is the
//     results-head slot's job, kept after the strip itself is dropped."
//   · the LANDING ANCHOR — the slot is the first thing inside
//     `.zone.results`, whose scroll-margin-top lands the verdict strip
//     clear of the nav (globals.css, the #250 ruling).  Ruling 184's
//     arc-28 landing carries everything below it.
//
// The reserve is now --fact-h, NOT --strip-h.  The ruling's reason, kept
// because it is the part that generalises: --strip-h was a MEASUREMENT
// (81.19 at 1440 on the dev server at d3c2dcf, rounded to 82), so it
// died with the thing it measured.  --fact-h is read off rule 56, which
// fixes the setup fact line's row height at 44 px at one line — a rule,
// not a measurement, so it cannot drift and needs no re-measuring.  It
// does not depend on NEEDS YOU's content, so a block that grows with its
// item count never changes the reserve.
//
// The slot is no longer sticky.  It was pinned because the strip was
// pinned; an empty reserved row has nothing to pin, and rule 32 allows
// no sticky element except the nav.
//
// The row is EMPTY in this commit.  What forms in it at the settle is
// the setup fact line, which arrives with the stack container; the
// reserve is a rule and holds whether or not its occupant is built yet.

export function ResultsHead({ reserve = false }: { reserve?: boolean }) {
  if (!reserve) return null;
  return <div className="results-head-slot" />;
}
