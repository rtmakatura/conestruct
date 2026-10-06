// R96 C (declutter-three-surfaces) — NEEDS YOU's site-condition rows,
// classified once, and the header count they feed.
//
// Authority: validation-artifacts/committed/declutter-three-surfaces/
// rulings.md — R99 ("Ruling 185 amended. Detected conditions count in
// NEEDS YOU, so the header count equals the rows listed") and R101 (build
// C as mocked up: mockups/needsyou.html).
//
// ONE CLASSIFICATION, TWO READERS (P2).  `conditionRows` decides, per
// flag, which row the block draws; `SiteConditionRows` renders exactly
// these rows and the shell counts exactly the listed ones, so the header
// numeral and the rows under it cannot disagree.  The predicates are the
// ones the block applied before this file existed (NeedsYouConditions.tsx,
// moved from SetupStrip under #288 clause 1): a staged intent outranks an
// applied record, which outranks the scan's own bucket; a bucket missing
// from the wire draws nothing (Rule 10); with no ok scan only the records
// draw; the two manual keys ride the scanned rows.
//
// LISTED vs FOLDED.  A row is LISTED — above the fold, and counted — when
// it needs the operator or records what the operator did: a detected
// condition, an applied correction (P15: the record stays), a staged
// intent, an asserted manual key.  A condition the scan found none of, or
// a manual key nobody asserted, is FOLDED behind a labelled count (P13,
// P19); its row and its Assert action are unchanged inside the fold.
//
// THE MERGE.  A site adjustment (`audit:site:<flag>`, ▲ changed this
// plan) whose flag has a listed row is the same fact as that row — "58
// sidewalks found" and "6 devices added for them" — so it renders inside
// the row (NeedsYouConditions reads the record) and leaves the item list.
// An adjustment with no listed row of its own (no scan ran) stays an item.
// Pure: a re-grouping of wire facts, no value computed (Rule 3).

import { SCAN_BUCKET_TO_FLAG, type ScanBucketWire } from "./tiering";
import type { SiteScanCorrection, SiteScanProvenance } from "./render-types";
import type { NeedsYouModel } from "./needs-you";
import { MANUAL_FLAGS, isFieldStaged, isScannedFlag } from "./scenarios/site-corrections";
import type { StagedCorrection, StagedFieldEdit } from "./scenarios/types";

type FlagStaged = Exclude<StagedCorrection, StagedFieldEdit>;

export type ConditionRow =
  | { kind: "staged"; flag: string; staged: FlagStaged; bucket?: ScanBucketWire }
  | { kind: "record"; flag: string; correction: SiteScanCorrection }
  | { kind: "detected"; flag: string; bucket: ScanBucketWire }
  | { kind: "absent"; flag: string; bucket: ScanBucketWire }
  | { kind: "manual-on"; flag: string }
  | { kind: "manual-off"; flag: string };

const LISTED: ReadonlySet<ConditionRow["kind"]> = new Set([
  "staged",
  "record",
  "detected",
  "manual-on",
]);

export function isListed(row: ConditionRow): boolean {
  return LISTED.has(row.kind);
}

export function conditionRows(
  siteScan: SiteScanProvenance | null,
  staged: readonly StagedCorrection[],
  manualFlags: Record<string, boolean | undefined>,
): ConditionRow[] {
  if (!siteScan) return [];
  const buckets =
    siteScan.status === "ok"
      ? ((siteScan.buckets as Record<string, ScanBucketWire> | undefined) ?? {})
      : null;
  const corrections = (siteScan.corrections ?? []).filter((c) => isScannedFlag(c.flag));
  if (buckets === null && corrections.length === 0) return [];
  const byFlag = new Map(corrections.map((c) => [c.flag, c] as const));
  const stagedFor = new Map(
    staged.filter((s): s is FlagStaged => !isFieldStaged(s)).map((s) => [s.flag as string, s] as const),
  );

  const rows: ConditionRow[] = [];
  if (buckets !== null) {
    for (const [bucketName, flag] of SCAN_BUCKET_TO_FLAG) {
      const bucket = buckets[bucketName];
      if (!bucket || !isScannedFlag(flag)) continue;
      const st = stagedFor.get(flag);
      const c = byFlag.get(flag);
      if (st) rows.push({ kind: "staged", flag, staged: st, bucket });
      else if (c) rows.push({ kind: "record", flag, correction: c });
      else rows.push({ kind: bucket.detected === true ? "detected" : "absent", flag, bucket });
    }
  } else {
    for (const c of corrections) {
      const st = stagedFor.get(c.flag);
      rows.push(st ? { kind: "staged", flag: c.flag, staged: st } : { kind: "record", flag: c.flag, correction: c });
    }
  }
  for (const flag of MANUAL_FLAGS) {
    const st = stagedFor.get(flag);
    if (st) rows.push({ kind: "staged", flag, staged: st });
    else rows.push({ kind: manualFlags[flag] === true ? "manual-on" : "manual-off", flag });
  }
  return rows;
}

export interface ConditionSummary {
  /** Rows above the fold — each counts in the header (R99). */
  listed: number;
  /** Folded: the scan found none along the corridor. */
  noneFound: number;
  /** Folded: a manual key nobody asserted. */
  notAsserted: number;
}

export function conditionSummary(rows: readonly ConditionRow[]): ConditionSummary {
  return {
    listed: rows.filter(isListed).length,
    noneFound: rows.filter((r) => r.kind === "absent").length,
    notAsserted: rows.filter((r) => r.kind === "manual-off").length,
  };
}

const SITE_ITEM = "audit:site:";

export function mergeConditions(model: NeedsYouModel, rows: readonly ConditionRow[]): NeedsYouModel {
  const listedFlags = new Set(rows.filter(isListed).map((r) => r.flag));
  const items = model.items.filter(
    (i) => !(i.id.startsWith(SITE_ITEM) && listedFlags.has(i.id.slice(SITE_ITEM.length))),
  );
  const changed = items.filter((i) => i.tier === "changed").length;
  const conditions = listedFlags.size;
  return {
    items,
    count: items.length + conditions,
    changed,
    attention: items.length - changed,
    conditions,
  };
}
