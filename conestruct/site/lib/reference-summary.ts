// #288 Phase 1 · §8.31 pulled forward (Ryan's hand-check, 2026-09-22) —
// the Reference row's summary line.
//
// §8.31: "Jurisdiction context bar — DROPPED as a bar.  Its three cells
// go to: jurisdiction → the WHAT band's field and the setup fact line;
// street classification → the same; governing spec chain → the reference
// disclosure's first line, which is where S8 shows it."
//
// Two of those three destinations are Phase 2's (the WHAT band and the
// setup fact line do not exist yet).  Rather than drop the bar and let
// its facts fall on the floor until Phase 2 catches them, the hand-check
// ruled all three onto the destination that DOES exist now: the Reference
// disclosure row's summary line, which is rule 88's provenance slot.
//
// DECLARED (Rule 5): this is a behaviour change, not a move of pixels.
// The bar rendered three labelled cells with a skeleton state, a term
// glossary ("calls this plan a MHT, the ROW public space") and a
// class-required note.  The row's summary line is ONE line.  What
// survives is the three FACTS the bar existed to state — which
// jurisdiction, which street class, which spec chain — and the honest
// word for each when it is unset.  What does not survive is the
// glossary, the skeleton and the note; they are Phase 2's fields' to
// carry, where there is room for them.
//
// Rule 14 governs the unset case: "a value that is not known renders as
// a word".  "Not set" is that word, and it is the bar's own.

import type { JurisdictionBlock, StreetClass } from "./jurisdiction";
import { normalizeChainLink } from "./jurisdiction";

/** The statewide floor, shown when no jurisdiction is selected — the
 *  same two links the bar showed, moved with the facts. */
export const BASELINE_CHAIN_DISPLAY = ["MUTCD 11th + CO Suppl.", "CDOT Specs §630"] as const;

const CLASS_LABEL: Record<StreetClass, string> = {
  local: "Local",
  collector: "Collector",
  arterial: "Arterial",
};

export interface ReferenceSummaryInput {
  jurisdiction: JurisdictionBlock | null;
  streetClass: StreetClass | null;
  /** True while a chosen jurisdiction's block is still loading.  The bar
   *  showed a skeleton here; a one-line summary cannot, so it says what
   *  is true instead (rule 14, and #252's "no skeletons anywhere"). */
  loading?: boolean;
}

/** The three facts, in §8.31's own order, as one provenance line. */
export function referenceSummary({
  jurisdiction,
  streetClass,
  loading = false,
}: ReferenceSummaryInput): string {
  const chain = jurisdiction
    ? jurisdiction.chain.map(normalizeChainLink).map((l) => l.display_name)
    : [...BASELINE_CHAIN_DISPLAY];
  const name = jurisdiction
    ? jurisdiction.name
    : loading
      ? "Checking…"
      : "Not set";
  const cls = streetClass ? CLASS_LABEL[streetClass] : "Not set";
  // The chain joins with "›" as the bar drew it, so the reading is the
  // same sequence the operator saw before.
  return `${name} · ${cls} · ${chain.join(" › ")}`;
}
