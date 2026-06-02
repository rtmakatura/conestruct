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
}

export interface PendingVerification {
  count: number;
  note: string;
  tracking_issue: string | null;
}

export interface AuditResponse {
  summary: AuditSummary;
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
  | { state: "ready"; data: AuditResponse }
  | { state: "error"; message: string; lastReady: AuditResponse | null };
