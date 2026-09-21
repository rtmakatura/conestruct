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
//   · DISMISS / KEEP and CORRECT IN SETUP are real writes, but they live
//     in the corrections block in SetupStrip.tsx, which NEEDS YOU absorbs
//     WHOLE under Part 1 §8.5 — a separate commit that moves the staging
//     contract, the standing sentence, the disabled-at-zero button and the
//     dismiss picker verbatim.  Until that absorb lands, a button here
//     would either write nothing or duplicate a write that already has an
//     owner.  An honest item without a control beats a control that writes
//     nothing.
// The rows still carry their provenance and citation, which is what makes
// them worth showing before their actions arrive.

import type { AppliedDelta } from "./jurisdiction";
import type { SiteAdjustmentRecord } from "./render-types";
import type { NeedsYouItem, NeedsYouTier } from "./needs-you";
import type { TierSources } from "./tier-sources";
import type { ItemSpec } from "@/components/AuditTrail";

/** A delta's one-line body: what it did, in the wire's own words. */
function deltaTitle(d: AppliedDelta): string {
  const { op, device, qty, note } = d.effect;
  if (note) return note;
  const parts = [op, qty != null ? String(qty) : null, device ?? null].filter(Boolean);
  return parts.join(" ");
}

/** The evidence a delta carried, and nothing more (rule 75). */
function deltaEvidence(d: AppliedDelta): string | undefined {
  return d.baseline ? `baseline ${d.baseline}` : undefined;
}

function fromDelta(d: AppliedDelta, i: number, tier: NeedsYouTier): NeedsYouItem {
  return {
    id: `jur:delta:${i}`,
    tier,
    title: deltaTitle(d),
    result: d.status.toUpperCase(),
    cite: d.rule,
    evidence: deltaEvidence(d),
    action: null,
  };
}

function fromSiteAdjustment(rec: SiteAdjustmentRecord, label: string): NeedsYouItem {
  const added = rec.devices_added;
  const modified = rec.devices_modified ?? 0;
  // Counts come from the record; the sentence is assembled from them and
  // never rounded, inferred or summed across records.
  const counts = [
    added > 0 ? `${added} device${added === 1 ? "" : "s"} added` : null,
    modified > 0 ? `${modified} modified` : null,
  ].filter(Boolean).join(" · ");
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
    deltas,
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
  deltasChanged.forEach((d) => items.push(fromDelta(d, deltaIndex.get(d) ?? -1, "changed")));
  siteChanged.forEach((rec) => items.push(fromSiteAdjustment(rec, siteLabel(rec.flag))));
  if (finesItem && finesApplicable) {
    items.push(fromItemSpec(finesItem, "audit:fines_double", "changed"));
  }

  // ── ⚠ attention — obligations the tool cannot discharge ──
  deltasAttention.forEach((d) => items.push(fromDelta(d, deltaIndex.get(d) ?? -1, "attention")));
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
