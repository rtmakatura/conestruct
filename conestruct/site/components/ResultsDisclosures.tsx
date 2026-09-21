"use client";

// #288 Phase 1 clause 4 — THE STACK'S DISCLOSURE ROWS.
//
// Authority: rulings.md, "The Phase 1 finish ruling" clause 4 — "Quote,
// Checked & passed, Pending / not verified as disclosure rows (rules
// 87–89): counted tiers show a number, the quote row its 'not a permit
// fee' summary.  Reference stays as built."  With Part 1 §8.9 and §8.11.
//
// WHAT MOVES.  §8.9 splits section 03's five tiers: ▲ and ⚠ lift into
// NEEDS YOU (clause 1 did that), and "✓, ◌ and the uncounted i tier stay
// as disclosures".  Clause 4 promotes ✓ and ◌ out of the chips INSIDE
// section 03 and into rule-87 rows BESIDE it, so the stack reads:
//
//   verdict → NEEDS YOU → counts hero → downloads → quote →
//   checked & passed → pending / not verified → reference
//
// The tier BODIES are unchanged — same producer, same inputs, same JSX.
// What changes is which container draws them, and that a counted tier's
// number now sits in rule 88's count slot instead of a chip's summary.
//
// WHY EACH ROW READS THE PRODUCER ITSELF.  Every instance of
// TieredReference below calls `deriveTierSources` with the SAME inputs,
// so the three containers cannot disagree about a fact (P2): there is
// one producer and three readers, exactly as clause b set up for NEEDS
// YOU and section 03.  The alternative — threading five pre-rendered
// bodies down through the shell — would put the composition in the one
// place that already has the most of it.
//
// RULE 89, and why the reference row is the odd one: a COUNTED tier
// shows its number, and ✓ / ◌ are counted by `assignTiers`' ledger (the
// same token the audit PDF's cover prints, mirrored by
// src/rendering/tier_ledger.py).  The i tier is deliberately uncounted —
// it says what is inside instead — which is why it keeps the component
// it already had (ReferenceDisclosure) and is NOT rebuilt here.

import type { ComponentProps } from "react";
import { useState } from "react";

import { DisclosureRow } from "./DisclosureRow";
import { TieredReference } from "./TieredReference";

type TierProps = Omit<ComponentProps<typeof TieredReference>, "tiers" | "bare">;

/**
 * One counted tier as a rule-87 row.  `count` comes from the ledger the
 * shell already computes; the body is the tier's own, rendered bare
 * because the row is the disclosure now.
 */
function TierDisclosure({
  symbol,
  name,
  count,
  provenance,
  tier,
  tierProps,
  defaultOpen = false,
}: {
  symbol: string;
  name: string;
  count: number;
  provenance?: string;
  tier: "checked" | "pending";
  tierProps: TierProps;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <DisclosureRow
      symbol={symbol}
      name={name}
      count={count}
      provenance={provenance}
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <TieredReference {...tierProps} tiers={[tier]} bare />
    </DisclosureRow>
  );
}

/** ✓ CHECKED & PASSED — every check named, each cited. */
export function CheckedDisclosure({
  count,
  cited,
  tierProps,
}: {
  count: number;
  /** The "each cited" assurance the chip's summary carried.  Absent
   *  while no audit has settled — rule 10: it is a claim about a
   *  settled answer, so it does not render before there is one. */
  cited: boolean;
  tierProps: TierProps;
}) {
  return (
    <TierDisclosure
      symbol="✓"
      name="Checked & passed"
      count={count}
      provenance={cited ? "each cited" : undefined}
      tier="checked"
      tierProps={tierProps}
    />
  );
}

/** ◌ PENDING / NOT VERIFIED — its own tier, never buried (#219). */
export function PendingDisclosure({
  count,
  tierProps,
}: {
  count: number;
  tierProps: TierProps;
}) {
  return (
    <TierDisclosure
      symbol="◌"
      name="Pending / not verified"
      count={count}
      tier="pending"
      tierProps={tierProps}
    />
  );
}
