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

import { useState } from "react";
import type { ReactNode } from "react";

import { DisclosureRow } from "./DisclosureRow";

export function ReferenceDisclosure({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
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
  return (
    <DisclosureRow
      symbol="i"
      name="Reference"
      count={null}
      provenance="jurisdiction rules · permit · audit trail"
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      {children}
    </DisclosureRow>
  );
}
