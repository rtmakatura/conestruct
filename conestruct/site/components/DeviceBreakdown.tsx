import type { JurisdictionBlock, SourceRef } from "@/lib/jurisdiction";

export interface DeviceBreakdownRow {
  device: string;
  code: string;
  function: string;
  qty: number;
  /** Present only on rows a jurisdiction count-delta added or topped up
   *  (backend apply_count_deltas — spec §3.2). */
  jurisdiction_required?: boolean;
  /** R117 Q1b: how many of `qty` the jurisdiction's rules added. */
  jurisdiction_added?: number;
  jurisdiction_source?: SourceRef;
}

export interface ZoneGeometry {
  taper_l_ft: number;
  buffer_b_ft: number;
  device_spacing_ft: number;
  work_len_ft: number;
}

export interface DeviceBreakdownData {
  devices: DeviceBreakdownRow[];
  total_devices: number;
  unique_types: number;
  /** Additive (spec §3.2); absent only against a pre-extension backend. */
  zone_geometry?: ZoneGeometry;
  /** Present only when the scenario named a jurisdiction_key. */
  jurisdiction?: JurisdictionBlock;
}

export type DeviceBreakdownState =
  | {
      state: "loading";
      // #192: the previous successful breakdown, carried through a
      // refetch so the results zone can dim-and-refresh in place instead
      // of unmounting (same stale-while-revalidate contract as
      // AuditState.lastReady — presented only under an explicit
      // recomputing ribbon, never as current).  Absent/null on the first
      // load and after an error.
      lastReady?: DeviceBreakdownData | null;
    }
  | { state: "ready"; data: DeviceBreakdownData }
  | {
      state: "error";
      message: string;
      // #184 — the HTTP status when the failure was an HTTP response
      // (absent on network errors).  400 = the backend declined the
      // scenario: the chip mirrors AuditTrail's declined line and offers
      // no Retry (retrying an unchanged input re-earns the same 400).
      httpStatus?: number;
      // #224 phase 2: the 400's ``detail.error`` when the backend sent one.
      code?: string;
      // #306: the failure is the audit's (the breakdown rides the audit's
      // one answer), so the audit trail owns the Retry -- one control per
      // fact; this chip names the failure and points there.
      fromAudit?: boolean;
    };
