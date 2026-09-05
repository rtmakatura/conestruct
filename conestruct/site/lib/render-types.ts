/**
 * Response types for /api/render/* endpoints.
 *
 * These mirror the Pydantic-defined shapes in `src/api/audit.py`
 * (audit_projection) and `src/api/render_api.py`.  Kept loose
 * (`Record<string, unknown>` per audit section) intentionally:
 * fully typing all nine sections would mean ~100 lines mirroring
 * the Python dict shapes verbatim, for a renderer that accesses
 * each field by name once.  Backend renames surface fast in the
 * browser (the row reads `undefined ft`), and the deletion side
 * of the dual-source-of-truth retirement is the win, not type
 * safety on a one-way data flow.
 */

// The files inside the "download all" MHT-package zip, in bundle order.
// /api/render/bundle renders exactly these kinds (fetchAllRenderParts
// spreads this list), and OutputCards derives its "MHT PACKAGE · N FILES"
// header count from its length — one source, so the label can never
// drift from what the zip actually contains.  Lives here rather than in
// render-proxy.ts because render-proxy imports server-only modules
// (Clerk, the DB) and can't be pulled into a client component.
export const BUNDLE_PART_KINDS = ["pdf", "xlsx", "markdown", "quote"] as const;

export interface AuditSummary {
  ta: string;
  cdot_sheet: string;
  case_id: string;
  taper_length_ft: number;
  taper_label: string;
  buffer_space_ft: number;
  device_spacing_taper_ft: number;
  device_spacing_tangent_ft: number;
  step_count: number;
  // V1-Wide S1: two-routing case model (shoulder only).
  //   "shoulder_no_reduction" — Case 11 (posted speed unchanged).
  //   "shoulder_reduced_speed" — Cases 26/27 parametric (Sheet 14).
  // Absent on flagger and lane-closure scenarios — they have their
  // own case structure outside the S1 two-routing model.
  case_routing?: string;
  // Verbatim Sheet 14 trigger callout, only when the routing maps to
  // Case 26 (65 mph) or Case 27 (75 mph). Absent for Case 11 reductions
  // because Sheet 14 doesn't tabulate trigger text at other speeds —
  // verbatim or nothing.
  trigger_condition?: string;
}

export interface PendingItem {
  kind: string;
  label: string;
  tracking_issue: string | null;
}

export interface PendingVerification {
  count: number;
  // ``note`` and ``tracking_issue`` mirror ``items[0]`` when ``items`` is
  // present, preserving the pre-Item-1 shape for callers that only read
  // the flat fields. ``items`` is omitted when nothing is pending so the
  // empty-rollup shape stays byte-identical to the pre-Item-1 baseline.
  note: string;
  tracking_issue: string | null;
  items?: PendingItem[];
}

// #60 plan-flags rollup — the backend's single derived verdict for the
// status strip. Categories are kept distinct (different lifecycles):
// validation_warnings (fix your input), compliance_fails (a colorado
// check failed), v1_limitations (Conestruct doesn't emit X yet). The
// strip reads ``is_clean`` for its green/off-green decision instead of
// re-deriving it, so the strip and the audit panel can't drift.
//
// OPTIONAL on the type: the backend ships this only after `modal deploy`;
// during the brief Vercel-leads-Modal deploy window the frontend may
// receive an audit response without it, so StatusBar falls back to the
// pre-#60 validation-warnings-only behavior when it's absent.
export interface PlanFlags {
  validation_warnings: number;
  compliance_fails: number;
  v1_limitations: number;
  is_clean: boolean;
}

// #104 — one record per fired site-condition flag, passed through from the
// backend's apply_site_adjustments verbatim plus a derived ``citation``
// display string (the panel chip, e.g. "MUTCD § 6B.04"). The panel reads
// ``citation`` backend-first so the static SITE_ADJUSTMENT_DETAIL table is
// a deploy-window fallback only, closing the citation-drift class.
export interface SiteAdjustmentRecord {
  flag: string;
  action: string;
  rule: string;
  citation: string;
  devices_added: number;
  devices_modified?: number;
}

// Engine-removal PR B/D — the corridor-preview zone lengths, backend-
// computed (the audit's own numbers).  Geometry (anchor/bearing/work-zone
// length) stays client-side: these are MUTCD lengths only.  The same
// shape comes back from POST /api/render/corridor-spec (the picker
// modal's source).  OPTIONAL on the audit sections: absent during a
// deploy window / rollback, in which case the preview degrades to
// "unavailable" — it is never recomputed client-side.
export interface CorridorSpecLengths {
  taper_ft: number;
  buffer_ft: number;
  advance_warning_ft: number;
  downstream_taper_ft: number;
  road_category: string | null;
}

export interface AuditResponse {
  summary: AuditSummary;
  plan_flags?: PlanFlags;
  sections: {
    taper: Record<string, unknown>;
    buffer: Record<string, unknown>;
    spacing: Record<string, unknown>;
    advance: Record<string, unknown>;
    colorado: Record<string, unknown>;
    case: Record<string, unknown>;
    flagger: Record<string, unknown>;
    corridor_validation: Record<string, unknown>;
    geometry_validation: Record<string, unknown>;
    // Engine-removal PR B: preview zone lengths (see CorridorSpecLengths).
    // Absent only in a deploy window / rollback.
    corridor_spec?: CorridorSpecLengths;
    // V1-Wide Item 3: Fines Double envelope section. Absent when the
    // work-zone posted speed is not reduced. Present with
    // ``applicable=true`` (envelope + Sheet 12 operational notes) for
    // shoulder/lane closures with reduction, or ``applicable=false``
    // (carve-out reason) for flagger scenarios with reduction.
    fines_double?: Record<string, unknown>;
    // #104: absent when no site-condition flag fired AND during the
    // Vercel-leads-Modal deploy window (fallback: static table).
    site_adjustments?: SiteAdjustmentRecord[];
    // #224 phase 1: the in-generate scan's provenance — ALWAYS present
    // on the wire (not_run/not_requested when no scan was asked for);
    // optional here only for the deploy window.
    site_scan?: SiteScanProvenance;
    // #117: per-leg cross-street advance signing.  Present only for the
    // (gated) near_intersection kind; the panel self-suppresses when
    // absent.  Kept loose like the other sections (file-header note).
    approaches?: Record<string, unknown>;
  };
  pending_verification: PendingVerification;
}

/**
 * Stale-while-revalidate state for the audit trail.
 *
 * Unlike DeviceBreakdownState (which clears on refetch), AuditTrail
 * keeps the previously-ready audit visible during refetch so a user
 * reading mid-edit doesn't see content flash empty.  ``lastReady``
 * carries the most recent successful response across both ``loading``
 * and ``error`` states.  Only ``null`` on the very first load before
 * any audit has resolved.
 */
export type AuditState =
  | { state: "loading"; lastReady: AuditResponse | null }
  | {
      state: "ready";
      data: AuditResponse;
      // The scenario object this answer was fetched for (opaque, identity
      // comparison only).  GeneratorShell uses it to tell "settled for
      // the input on screen" from "settled for an input that has since
      // been edited": the audit effect flips to ``loading`` only after
      // paint, so without this stamp one rendered frame would present
      // the previous verdict as current (frontend-engine-removal
      // Decision 2 — the strip never shows a stale verdict).  This field
      // is the original instance of the #197 input-identity stamp; the
      // shared idiom and its full contract live in lib/answer-stamp.ts.
      forScenario?: unknown;
    }
  | {
      state: "error";
      message: string;
      // HTTP status of the failed fetch, when one was received.  400 is
      // load-bearing: it means the backend judged the *scenario* invalid
      // (geometry validation), which the StatusBar renders as a red
      // input error rather than a neutral "verification unavailable".
      httpStatus?: number;
      // #224 phase 2: the 400's machine-readable ``detail.error`` when
      // the backend sent one (the first is "site_scan_unavailable") and
      // the scan provenance that rode with it.  Absent on every other
      // 400 — those keep matching by scenario predicate (#180).
      code?: string;
      siteScan?: SiteScanProvenance;
      lastReady: AuditResponse | null;
      forScenario?: unknown;
    };

/**
 * #224 phase 1 — ``sections.site_scan`` / the refusal's ``detail.site_scan``
 * (src/api/site_scan.py SiteScanProvenance).  Loose on purpose: the panel
 * reads status, error, measured_at, proceeded_anyway and the disclosure
 * string; everything else is provenance the audit PDF and phase 3 own.
 */
export interface SiteScanProvenance {
  status: "ok" | "unavailable" | "not_run";
  reason?: string | null;
  error?: string | null;
  mode?: string | null;
  measured_at?: string | null;
  duration_ms?: number | null;
  budget_s?: number | null;
  memo_hit?: boolean;
  proceeded_anyway?: boolean;
  flags?: Record<string, boolean>;
  disclosure?: string | null;
  /** #224 phase 4 — the operator's corrections as the backend applied
   *  them (src/api/site_scan.py SiteScanCorrection), wire order. */
  corrections?: SiteScanCorrection[];
  [key: string]: unknown;
}

/** One correction as disclosed on the provenance: what the scan said at
 *  apply time, whether it applied or was moot, and the ONE
 *  backend-composed sentence every surface prints verbatim. */
export interface SiteScanCorrection {
  flag: string;
  action: "dismiss" | "assert";
  reason?: string | null;
  note?: string | null;
  recorded_at?: string;
  status: "applied" | "moot";
  scan_detected?: boolean | null;
  disclosure: string;
}

/**
 * One refusal, one voice (issue #180): the view-model for a backend gate
 * 400 — the tool DECLINING for a stated reason, distinct from invalid
 * input (client schema-bounds) and from broken (network/5xx, which stay
 * on their existing error paths, never reframed).
 *
 * ``pointer`` is non-null when the refusal has a matching confirm
 * affordance on screen (matchRefusalAffordance): the banner then renders
 * the short pointer and the full 400 text renders NOWHERE — the row's
 * own note is the primary voice.  ``pointer`` null means no affordance
 * exists; the banner renders ``message`` (the full 400) exactly once.
 */
export interface Refusal {
  message: string;
  pointer: string | null;
  /** #224 phase 2: the 400's ``detail.error`` when the backend sent one. */
  code?: string | null;
}
