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
// ─── PHASE 1 DEVIATION FROM RULE 28 (Ryan's hand-check on prod at
//     f44377e, 2026-09-22) — THE SLOT RENDERS NOTHING FOR NOW ───
//
// Rule 28 reserves the stack's first row so the results do not move when
// its occupant forms at the settle.  That is a rule about MOVEMENT, and
// it earns its 44 px by preventing some.  In Phase 1 the occupant — the
// setup fact line — is not built: it arrives with Phase 2's band stack
// (§8.16, §8.27).  So the slot reserved space for something that never
// appears, and on prod it read as an empty box under the verdict strip.
//
// An always-empty reserve prevents no movement.  It is 44 px of nothing,
// and Rule 10's instinct applies to space as much as to text: absence
// should render as absence, not as a placeholder holding a place for a
// thing that is not coming this phase.
//
// So the component renders null until Phase 2 mounts the fact line, and
// rule 28 is honoured THEN — when there is an occupant whose arrival
// would otherwise shift the stack.  The component and `--fact-h` both
// stay: the token is rule 56's 44 px, declared ahead of its surface in
// the idiom #283 established, and this file is where Phase 2 restores
// the slot.  `.results-head-slot` itself is deleted, because its element
// is gone and a rule whose only element is gone is a rule that rots.
//
// Recorded as a DEVIATION, not a correction of rule 28: the rule is right
// about the settle, and nothing here disputes it.  What Phase 1 cannot
// do is reserve for an occupant it did not build.
export function ResultsHead({ reserve = false }: { reserve?: boolean }) {
  // `reserve` is kept in the signature deliberately.  It is the shell's
  // "post-generate and not declined" predicate, already wired and already
  // tested; Phase 2 needs exactly that predicate, and deleting the prop
  // would mean re-deriving it later from scratch.
  void reserve;
  return null;
}
