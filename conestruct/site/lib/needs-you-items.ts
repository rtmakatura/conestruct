// #288 Phase 1 (s2-arc33) step 2 — the ▲/⚠ facts as NEEDS YOU item rows.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// clauses a, b and d, with #281 comment 1 rules 74–79 and ruling 185.
//
// The second half of clause b's transfer.  Step 1 put every ▲/⚠ source
// behind one producer (lib/tier-sources.ts); this file maps those sources
// to the rows rule 74 draws.  It is a re-grouping, not a classification:
// which tier a fact sits in was decided by `assignTiers` and is read here,
// never re-decided (P2).
//
// ORDER.  Within a tier the wire's order is preserved, and the groups run
// in the order section 03 rendered them, so lifting the tiers into NEEDS
// YOU does not silently re-rank anything:
//   ▲  jurisdiction deltas · site adjustments · fines-double
//   ⚠  jurisdiction deltas (conditional/unknown) · Colorado FAILs ·
//      site-scan NOT CHECKED · corridor · geometry · signalized approaches
//
// ACTIONS — ruling d, applied strictly.  Every item here carries
// `action: null`, so no row renders a button.  That is not an oversight
// and not a placeholder:
//   · ACKNOWLEDGE has nothing on the wire to write at all (clause d).
//   · DISMISS / KEEP and CORRECT IN SETUP are real writes, and they have
//     an owner: NeedsYouConditions.tsx, which absorbed the corrections
//     block WHOLE under Part 1 §8.5 — the staging contract, the standing
//     sentence, the disabled-at-zero button and the dismiss picker,
//     verbatim.  A button on THESE rows would duplicate a write that
//     already has an owner.  An honest item without a control beats a control that writes
//     nothing.
// The rows still carry their provenance and citation, which is what makes
// them worth showing before their actions arrive.

import type { AppliedDelta } from "./jurisdiction";
import { deltaCite, deltaDetail, deltaTitle } from "./delta-words";
import type { SiteAdjustmentRecord } from "./render-types";
import type { NeedsYouItem, NeedsYouTier } from "./needs-you";
import type { TierSources } from "./tier-sources";
import type { ItemSpec } from "@/components/AuditTrail";

/** R116 / R117: a rule's row, in the words lib/delta-words chooses --
 *  a plain title, one detail line, the source as the citation.  Never a
 *  raw key, never the rule's sentence (that stays in Plan reference). */
function fromDelta(
  d: AppliedDelta,
  i: number,
  tier: NeedsYouTier,
  jurisdictionName: string | null,
): NeedsYouItem {
  return {
    id: `jur:delta:${i}`,
    tier,
    title: deltaTitle(d, jurisdictionName),
    result: d.status.toUpperCase(),
    cite: deltaCite(d),
    evidence: deltaDetail(d, jurisdictionName),
    action: null,
  };
}

/** A site adjustment's device counts, as the record carried them ("6
 *  devices added", "3 modified"), or "" when it added and modified none.
 *  Shared with the merged condition row (NeedsYouConditions.tsx, R99) so
 *  the fact reads the same wherever it renders (P2). */
export function siteAdjustmentCounts(rec: SiteAdjustmentRecord): string {
  const added = rec.devices_added;
  const modified = rec.devices_modified ?? 0;
  // Counts come from the record; the sentence is assembled from them and
  // never rounded, inferred or summed across records.
  return [
    added > 0 ? `${added} device${added === 1 ? "" : "s"} added` : null,
    modified > 0 ? `${modified} modified` : null,
  ].filter(Boolean).join(" · ");
}

function fromSiteAdjustment(rec: SiteAdjustmentRecord, label: string): NeedsYouItem {
  const counts = siteAdjustmentCounts(rec);
  return {
    id: `audit:site:${rec.flag}`,
    tier: "changed",
    title: label,
    result: "APPLIED",
    cite: rec.citation,
    evidence: counts || undefined,
    action: null,
  };
}

function fromItemSpec(spec: ItemSpec, id: string, tier: NeedsYouTier): NeedsYouItem {
  return {
    id,
    tier,
    title: spec.title,
    result: spec.result,
    cite: spec.cite,
    action: null,
  };
}

export interface NeedsYouItemsInput {
  sources: TierSources;
  /** SITE_ADJUSTMENT_DETAIL, injected so this module stays free of the
   *  component layer's copy table. */
  siteLabel: (flag: string) => string;
}

export function buildNeedsYouItems({ sources, siteLabel }: NeedsYouItemsInput): NeedsYouItem[] {
  const {
    deltas, jurisdictionName,
    deltasChanged, siteChanged, finesItem, finesApplicable,
    deltasAttention, coloradoFails, siteScanItem, corridorItem, geometryItem,
    approachesSpec, approachesSignalized,
  } = sources;

  // A delta's id is its index over the FULL applied_deltas array, which is
  // what lib/tiering.ts uses and what src/rendering/tier_ledger.py mirrors.
  // Indexing over the filtered group instead gave the same fact a different
  // id AND collided `jur:delta:0` between the two tiers -- caught by this
  // module's own id-uniqueness test, not by review.
  const deltaIndex = new Map(deltas.map((d, i) => [d, i] as const));

  const items: NeedsYouItem[] = [];

  // ── ▲ changed — this plan is different because of these ──
  deltasChanged.forEach((d) =>
    items.push(fromDelta(d, deltaIndex.get(d) ?? -1, "changed", jurisdictionName)),
  );
  siteChanged.forEach((rec) => items.push(fromSiteAdjustment(rec, siteLabel(rec.flag))));
  if (finesItem && finesApplicable) {
    items.push(fromItemSpec(finesItem, "audit:fines_double", "changed"));
  }

  // ── ⚠ attention — obligations the tool cannot discharge ──
  deltasAttention.forEach((d) =>
    items.push(fromDelta(d, deltaIndex.get(d) ?? -1, "attention", jurisdictionName)),
  );
  coloradoFails.forEach((c, i) =>
    items.push({
      id: `audit:colorado:fail:${i}`,
      tier: "attention",
      title: c.label,
      result: "FAIL",
      cite: c.citation,
      evidence: c.detail || undefined,
      action: null,
    }),
  );
  if (siteScanItem) items.push(fromItemSpec(siteScanItem, "audit:scan:not_checked", "attention"));
  if (corridorItem) items.push(fromItemSpec(corridorItem, "audit:corridor", "attention"));
  if (geometryItem) items.push(fromItemSpec(geometryItem, "audit:geometry", "attention"));
  if (approachesSpec && approachesSignalized) {
    items.push(fromItemSpec(approachesSpec, "audit:approaches", "attention"));
  }

  return items;
}
