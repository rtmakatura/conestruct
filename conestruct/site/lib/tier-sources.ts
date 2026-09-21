// #288 Phase 1 (s2-arc33) step 1 — the tier sources, one producer.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// clause b — "Section 03's tiered-reference component retires as a shape;
// its five tiers and its disclose-never-writes contract TRANSFER."  This
// file is that transfer's first half.
//
// WHY IT EXISTS.  `assignTiers` (lib/tiering.ts) decides which tier every
// fact belongs to, but a `TierFact` is only `{ id, tier, reason }` — it
// carries no title, citation or body.  The renderable content for the two
// consequence tiers (▲ changed, ⚠ attention) was derived inline inside
// TieredReference.tsx, so a second consumer — NEEDS YOU — had exactly two
// options: re-derive it, or read it from here.  Re-deriving would put a
// second producer on the same facts, which is the corridor-spacing.ts
// failure mode Rule 3 names and the "one voice per fact" rule P2 forbids.
//
// WHAT MOVED, precisely.  The PURE derivation from TieredReference's body:
// its opening block (the audit view, the tier model, the delta and site
// groups, the scan wire and corrections map) and its closing block (the
// Colorado checks, the corridor/scan/geometry/fines/approaches/pending
// item specs, the trace items, the hours status).  Values identical, order
// identical, predicates identical — this is a move, not a rewrite.
//
// WHAT DID NOT MOVE, and why: the JSX helpers between those two blocks —
// `signpost`, `siteRow`, and the `scanAbsentRows` / `scanReferenceRows`
// loops.  They build ReactNode and close over the component's write-lock
// and jump handler, so they are rendering, not derivation, and they stay
// where they render.  The ruled boundary was "lines 146–374"; the honest
// boundary is the pure subset of that range, and the difference is those
// ~110 lines.  Reported rather than quietly re-scoped (Rule 5).
//
// Behaviour change: NONE.  The six TieredReference.*.test.tsx suites are
// the proof, and they are unmodified by this commit.

import {
  approachesItem,
  buildScenarioItems,
  corridorValidationItem,
  finesDoubleItem,
  geometryValidationItem,
  pendingVerificationItem,
  siteScanNotCheckedItem,
  settledData,
  type ItemSpec,
} from "@/components/AuditTrail";
import {
  SCAN_BUCKET_TO_FLAG,
  assignTiers,
  type ScanCorrectionWire,
  type ScanWire,
  type TierModel,
} from "@/lib/tiering";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { Scenario } from "@/lib/scenarios";
import type { AuditState, SiteAdjustmentRecord } from "@/lib/render-types";

type SettledAudit = ReturnType<typeof settledData>;

interface ColoradoCheck {
  pass: boolean;
  label: string;
  citation: string;
  detail: string;
}
interface ColoradoSection {
  checks?: ColoradoCheck[];
  info_items?: { label: string; citation: string; detail: string }[];
}
interface CorridorSection {
  checked?: boolean;
  warnings?: unknown[];
}

export interface TierSourcesInput {
  jurisdiction: JurisdictionBlock | null;
  jurisdictionLoading: boolean;
  revalidating?: boolean;
  scenario: Scenario;
  audit: AuditState;
  generated: boolean;
  showAudit: boolean;
}

export interface TierSources {
  /** The jurisdiction block, or null while it is loading. */
  jur: JurisdictionBlock | null;
  /** The settled audit view — never the in-flight one. */
  settled: SettledAudit;
  auditFailed: boolean;
  declined: boolean;
  throttled: boolean;
  isRefreshing: boolean;
  isFirstLoad: boolean;
  refreshing: boolean;
  /** The five-tier ledger — the ONE sorter (P2). */
  model: TierModel;
  /** Value renderer: "—" until the bundle is generated. */
  r: (n: number | string) => string;

  // ── ▲ changed ──
  deltasChanged: JurisdictionBlock["applied_deltas"];
  siteChanged: SiteAdjustmentRecord[];
  finesItem: ItemSpec | null;
  finesApplicable: boolean;

  // ── ⚠ attention ──
  deltasAttention: JurisdictionBlock["applied_deltas"];
  coloradoFails: ColoradoCheck[];
  corridorItem: ItemSpec | null;
  siteScanItem: ItemSpec | null;
  geometryItem: ItemSpec | null;
  approachesSpec: ItemSpec | null;
  approachesSignalized: boolean;

  // ── ✓ checked · ◌ pending · i reference ──
  deltasAdmin: JurisdictionBlock["applied_deltas"];
  siteAdvisory: SiteAdjustmentRecord[];
  coloradoPasses: ColoradoCheck[];
  coloradoInfos: NonNullable<ColoradoSection["info_items"]>;
  corridorClean: boolean;
  pendingSpec: ItemSpec | null;
  traceItems: ItemSpec[];
  hoursStatus: string | null;

  // ── the scan wire, shared by the rows that render it ──
  siteRecords: SiteAdjustmentRecord[];
  scan: ScanWire | undefined;
  /** Typed from the wire, not widened: the rows that read a bucket
   *  need its shape, and `Record<string, unknown>` lost it. */
  scanBuckets: NonNullable<ScanWire["buckets"]> | null;
  flagToBucket: Map<string, string>;
  corrections: Map<string, ScanCorrectionWire>;
}

export function deriveTierSources({
  jurisdiction,
  jurisdictionLoading,
  revalidating = false,
  scenario,
  audit,
  generated,
  showAudit,
}: TierSourcesInput): TierSources {
  const r = (n: number | string) => (generated ? String(n) : "—");

  const jur = jurisdictionLoading ? null : jurisdiction;
  const settled = showAudit ? settledData(audit) : null;
  const auditFailed = showAudit && audit.state === "error";
  const declined = auditFailed && audit.httpStatus === 400;
  const throttled = auditFailed && audit.httpStatus === 429;
  const isRefreshing = audit.state === "loading" && audit.lastReady !== null;
  const isFirstLoad = showAudit && audit.state === "loading" && audit.lastReady === null;

  const model = assignTiers({ jurisdiction: jur, audit: settled, auditFailed });

  // ── fact groups (same predicates as lib/tiering.ts — single mapping) ──
  const deltas = jur?.applied_deltas ?? [];
  const deltasChanged = deltas.filter(
    (d) => d.status === "fires" && d.severity !== "admin",
  );
  const deltasAttention = deltas.filter(
    (d) => d.status === "conditional" || d.status === "unknown",
  );
  const deltasAdmin = deltas.filter(
    (d) => d.status === "fires" && d.severity === "admin",
  );

  const siteRecords: SiteAdjustmentRecord[] = settled?.sections.site_adjustments ?? [];
  const siteChanged = siteRecords.filter(
    (rec) => rec.devices_added > 0 || (rec.devices_modified ?? 0) > 0,
  );
  const siteAdvisory = siteRecords.filter(
    (rec) => rec.devices_added === 0 && (rec.devices_modified ?? 0) === 0,
  );
  // #224 phase 3 (s2-arc17): the scan's own facts, read off the same
  // wire section the classifier reads (lib/tiering.ts — one mapping).
  const scan = settled?.sections.site_scan as ScanWire | undefined;
  const scanBuckets = scan?.status === "ok" ? (scan.buckets ?? {}) : null;
  const flagToBucket = new Map(SCAN_BUCKET_TO_FLAG.map(([b, f]) => [f, b] as const));
  // #224 phase 4 (s2-arc18): the operator's corrections, as the backend
  // applied and disclosed them (one sentence each, printed verbatim).
  const corrections = new Map<string, ScanCorrectionWire>(
    (scan?.corrections ?? []).map((c) => [c.flag, c] as const),
  );

  const colorado = settled?.sections.colorado as ColoradoSection | undefined;
  const coloradoPasses = (colorado?.checks ?? []).filter((c) => c.pass);
  const coloradoFails = (colorado?.checks ?? []).filter((c) => !c.pass);
  const coloradoInfos = colorado?.info_items ?? [];

  const corridorSection = settled?.sections.corridor_validation as CorridorSection | undefined;
  const corridorItem = settled ? corridorValidationItem(settled.sections.corridor_validation) : null;
  // #224 phase 2/3: the NOT-CHECKED disclosure — one counted attention
  // fact since phase 3 (audit:scan:not_checked).
  const siteScanItem = settled
    ? siteScanNotCheckedItem(settled.sections.site_scan as Record<string, unknown> | undefined)
    : null;
  const corridorClean =
    corridorSection?.checked === true && (corridorSection.warnings ?? []).length === 0;

  const geometryItem = settled ? geometryValidationItem(settled.sections.geometry_validation) : null;

  const finesSection = settled?.sections.fines_double;
  const finesItem = finesSection ? finesDoubleItem(finesSection) : null;
  const finesApplicable = finesSection?.applicable === true;

  const approachesSpec = settled ? approachesItem(settled.sections.approaches) : null;
  const approachesSection = settled?.sections.approaches as
    | { approaches?: { signalized?: boolean }[] }
    | undefined;
  const approachesSignalized = (approachesSection?.approaches ?? []).some(
    (a) => a.signalized === true,
  );

  const pendingSpec = settled ? pendingVerificationItem(settled.pending_verification) : null;

  // Trace items: the per-kind set minus the Colorado aggregate (its
  // checks render as named rows so "every check named at a glance"
  // holds — the aggregate accordion would hide them behind a click).
  const traceItems = settled
    ? buildScenarioItems(scenario, audit, generated, r).filter(
        (i) => !i.title.startsWith("Colorado requirements"),
      )
    : auditFailed
      ? buildScenarioItems(scenario, audit, generated, r).filter(
          (i) => !i.title.startsWith("Colorado requirements"),
        )
      : [];

  const hoursStatus = jur ? jur.hours_eval.status : null;

  const refreshing = revalidating || isRefreshing;

  return {
    jur, settled, auditFailed, declined, throttled, isRefreshing, isFirstLoad, refreshing,
    model, r,
    deltasChanged, siteChanged, finesItem, finesApplicable,
    deltasAttention, coloradoFails, corridorItem, siteScanItem, geometryItem,
    approachesSpec, approachesSignalized,
    deltasAdmin, siteAdvisory, coloradoPasses, coloradoInfos, corridorClean,
    pendingSpec, traceItems, hoursStatus,
    siteRecords, scan, scanBuckets, flagToBucket, corrections,
  };
}
