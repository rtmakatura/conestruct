// #224 phase 2 (s2-arc16) — the in-generate site scan's wire opt-in.
//
// The backend runs ``detect_along_corridor`` inside generation when the
// scenario carries ``site_scan`` (src/api/site_scan.py, phase 1).  The
// shell sets it at the Generate click and on every post-generate request
// (audit, breakdown, all downloads, the quote) — the results zone IS the
// scanned plan, so the plan the user downloads must be the plan the
// panel describes.  Pre-generate requests never carry it: the debounced
// verification loop stays scan-free (a scan is a Generate-time
// commitment, and every cold scan is 3–15 s measured on prod).
//
// ``proceed_if_unavailable`` is the explicit acknowledgement after a
// refused scan (ruling 1: per-input, shell-held, never persisted).  The
// wire scenario is derived, never stored: ``scenario`` stays the user's
// document (saved plans, the #198 identity, the setup forms).

import type { Scenario } from "./types";

export interface SiteScanRequest {
  proceed_if_unavailable: boolean;
  /** #307 (R151): the Generate's scan, signed by the backend; carried only
   *  by downloads (``withScanToken``), never by the audit itself. */
  token?: string;
}

/** The backend 400's ``detail.error`` for a refused scan (site_scan.py). */
export const SITE_SCAN_UNAVAILABLE_CODE = "site_scan_unavailable";

export function withSiteScan(scenario: Scenario, proceed: boolean): Scenario {
  return { ...scenario, site_scan: { proceed_if_unavailable: proceed } };
}

/** #307 (R151): a download's wire scenario, carrying its Generate's signed
 *  scan so the backend builds from that answer instead of scanning again.
 *  A scenario without ``site_scan`` (pre-generate) is returned as is. */
export function withScanToken(scenario: Scenario, token: string): Scenario {
  if (!scenario.site_scan) return scenario;
  return { ...scenario, site_scan: { ...scenario.site_scan, token } };
}

export function carriesSiteScan(scenario: Scenario): boolean {
  return scenario.site_scan != null;
}
