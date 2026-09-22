"use client";

// #288 Phase 1 (s2-arc33) step 4 — the reference disclosure.
//
// Authority: #281 Part 1 §8.35 (RENAMED, no behaviour change: "Section 03
// — tiered reference → reference disclosure") with comment 1 rules 87–89
// and 125–129.  S8 is this row expanded.
//
// It owns one piece of state — open or closed — and nothing else.  The
// content is unchanged: section 03's tiers render inside it exactly as
// they rendered beside it.  Rule 129 holds through the move: the
// reference never writes, and opening it is a read.
//
// Rule 89: the reference tier is UNCOUNTED.  It says what is inside
// instead of how many, because a number here would have to be a sum
// across kinds that do not add up to anything the operator acts on.
//
// DECLARED BEHAVIOUR CHANGE (Rule 5): section 03 now starts COLLAPSED.
// It rendered open-always before.  That is rule 125's S5/S8 split — S5
// is the stack with the reference closed, S8 is the same stack with it
// expanded — and it is the point of folding a reference tier behind a
// disclosure at all.  Nothing inside it changed.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { DisclosureRow } from "./DisclosureRow";

export function ReferenceDisclosure({
  children,
  defaultOpen = false,
  summary,
}: {
  children: ReactNode;
  /** #288 · §8.31 pulled forward (Ryan's hand-check, 2026-09-22): the
   *  jurisdiction context bar is dropped, and its three facts — which
   *  jurisdiction, which street class, which spec chain — land on THIS
   *  line.  §8.31 sends the spec chain here by name ("the reference
   *  disclosure's first line, which is where S8 shows it"); the other
   *  two are bound for Phase 2's WHAT band and setup fact line, and the
   *  hand-check ruled them here meanwhile rather than letting them fall
   *  on the floor until Phase 2 catches them.
   *  Derived by lib/reference-summary.ts — one producer, so the row and
   *  any future fact line cannot disagree about the same three facts. */
  summary?: string;
  /** RULE 10, and the reason this prop exists.  The verdict strip's
   *  "retry below" points at a Retry that lives INSIDE this panel.  Rule
   *  10 requires that pointer to land on a panel that exists, and a
   *  panel folded shut exists without being reachable — the operator
   *  would be told to retry below and find nothing there.  So on a
   *  declined, throttled or failed audit the reference opens by default.
   *  Found by six honesty suites failing the moment section 03 was
   *  folded (#180, #182, #184, #187, #196, #152 D), not by reading the
   *  spec: rules 125 and §8.35 say S5 closes the reference and S8 opens
   *  it, and say nothing about the state where the panel is the only
   *  route to a recovery action. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // The flag arrives LATE.  `defaultOpen` is false at mount — the audit
  // has not answered yet — and becomes true when the answer is a refusal
  // or a failure, which is exactly when rule 10 needs this panel open so
  // the verdict strip's "retry below" lands on a Retry that exists.  A
  // `useState` initialiser reads it once and never again, so the panel
  // stayed shut through every error that arrived after the first render.
  // This is the ReferenceChip `autoExpand` idiom, which has handled the
  // same false→true arrival since #219; a manual collapse is respected
  // until the flag transitions again.
  // Found by three #187 honesty suites failing the moment ✓ and ◌ left
  // this component — not by reading the spec, which says nothing about
  // when the flag arrives.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  return (
    <DisclosureRow
      symbol="i"
      name="Reference"
      count={null}
      provenance={summary ?? "jurisdiction rules · permit · audit trail"}
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      {children}
    </DisclosureRow>
  );
}
