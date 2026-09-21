// #288 Phase 1 (s2-arc33) — NEEDS YOU's derivation.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// (Ryan, 2026-09-21, clauses a–d) and #281 comment 1 rules 72–79, with
// rulings 185 and 186.
//
// Pure re-grouping, NOT a second classification (P2).  Every item here is
// already tiered by ``assignTiers`` (lib/tiering.ts:160, mirrored by
// src/rendering/tier_ledger.py); this file lifts the two consequence
// tiers — ▲ changed and ⚠ attention — out of the reference fold and into
// the block the operator acts from.  It decides no tier, computes no
// count the wire did not carry, and invents no evidence.
//
// Ruling 185: the header count is the SUM; the decomposition (how many
// changed, how many need attention) is provenance, not a second number.
// Ruling 186: the block is always expanded — there is no collapsed state
// to derive.
//
// Ruling d (ACKNOWLEDGE): an item whose action would write nothing
// renders with its provenance and NO button.  ``action: null`` is that
// state, and it is the default — a control appears only where a real
// write exists.  The one `acknowledge` in this codebase is the scan
// proceed-anyway stamp (GeneratorShell.tsx:492), a per-input
// acknowledgement of a refused scan: a different fact, not a ledger
// write, and deliberately not reused here.

import type { Tier } from "./tiering";

/** The two consequence tiers NEEDS YOU hosts.  The other three (✓ ◌ i)
 *  stay in the reference disclosure — rule 89. */
export type NeedsYouTier = Extract<Tier, "changed" | "attention">;

export const NEEDS_YOU_TIERS: readonly NeedsYouTier[] = ["changed", "attention"] as const;

/** Rule 75: "The provenance always names the tier in words".  These are
 *  the words, and they are the only two. */
export const TIER_WORDS: Record<NeedsYouTier, string> = {
  changed: "changed this plan",
  attention: "needs attention",
};

/** An action that writes.  ``kind`` names the write so the write-lock
 *  declaration (data-write) and the suggest-never-set audit can both read
 *  it; a row with no real write carries ``null`` instead (ruling d). */
export interface NeedsYouAction {
  kind: "dismiss" | "keep" | "correct-in-setup";
  label: string;
  /** Rule 77: a row carries one button unless it offers a true pair. */
  pair?: NeedsYouAction;
}

export interface NeedsYouItem {
  /** Stable id, shared with the Python mirror (TierFact.id). */
  id: string;
  tier: NeedsYouTier;
  /** Rule 9 body — the item's own line. */
  title: string;
  /** The status the wire carried, rendered as-is. */
  result: string;
  /** Rule 11 citation, right track, above the actions. */
  cite: string;
  /** Rule 75: the evidence the wire carried — count, nearest distance,
   *  coordinates.  Absent when the wire carried none; never fabricated. */
  evidence?: string;
  /** null = no control renders (ruling d). */
  action: NeedsYouAction | null;
}

export interface NeedsYouModel {
  items: NeedsYouItem[];
  /** Ruling 185: the one number in the header. */
  count: number;
  /** Ruling 185: the decomposition, for the provenance line only. */
  changed: number;
  attention: number;
}

/** Rule 75's provenance line for one item: the tier in words, then the
 *  wire's own evidence when it carried any.  Never invents. */
export function itemProvenance(item: NeedsYouItem): string {
  const word = TIER_WORDS[item.tier];
  return item.evidence ? `${word} · ${item.evidence}` : word;
}

/** Ruling 185's provenance decomposition.  Returns null when one side is
 *  zero: "3 changed this plan" alone is the honest line, not
 *  "3 changed this plan · 0 need attention" (Rule 10 — absence renders as
 *  absence, not as a zero). */
export function countProvenance(model: NeedsYouModel): string | null {
  const parts: string[] = [];
  if (model.changed > 0) parts.push(`${model.changed} ${TIER_WORDS.changed}`);
  if (model.attention > 0) parts.push(`${model.attention} ${TIER_WORDS.attention}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The derivation.  Input is already-tiered items; this orders them and
 *  counts them, and does nothing else.
 *
 *  Order: ▲ changed before ⚠ attention (consequence first), and within a
 *  tier the caller's order is preserved — which is the wire's order, per
 *  rule 79 for the condition rows. */
export function deriveNeedsYou(items: readonly NeedsYouItem[]): NeedsYouModel {
  const ordered = NEEDS_YOU_TIERS.flatMap((t) => items.filter((i) => i.tier === t));
  const changed = ordered.filter((i) => i.tier === "changed").length;
  const attention = ordered.length - changed;
  return { items: ordered, count: ordered.length, changed, attention };
}
