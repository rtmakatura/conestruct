// #224 phase 4 (s2-arc18) — operator corrections of the scanned site
// conditions: the marker helpers the strip's Dismiss / Assert / Undo
// clicks use.  Pure functions over ``ScenarioMeta``; nothing here decides
// what the plan becomes — the backend re-generates from the markers
// (src/api/site_scan.py applies them after the scan's precedence and
// discloses each one on ``sections.site_scan.corrections``).
//
// Undo is the #179 shape: remove THE marker for the flag; when the list
// empties the key is dropped entirely so ``meta`` after correct-then-undo
// is byte-identical to before (asserted in tests).  A pin move clears
// the whole list in the same patch that resets the detection relays
// (GeneratorSidebar.onPickerSave) — the corrections' subject, this
// corridor's scan, no longer exists.

import type {
  ScannedSiteFlag,
  ScenarioMeta,
  SiteConditionOverride,
  SiteDismissReason,
} from "./types";

/** The dismiss vocabulary (backend enum; ``other`` needs a note). */
export const DISMISS_REASONS: ReadonlyArray<{ v: SiteDismissReason; l: string }> = [
  { v: "fenced", l: "Fenced off" },
  { v: "removed", l: "Removed" },
  { v: "not_in_work_zone", l: "Not in the work zone" },
  { v: "other", l: "Other (say what)" },
];

/** Row labels for the five scanned conditions — the audit table's words
 *  (src/rendering/audit_blocks.py _SCAN_CONDITION_ROWS), panel copy. */
export const SCANNED_FLAG_LABELS: Record<ScannedSiteFlag, string> = {
  adjacent_intersection: "Adjacent at-grade intersection",
  adjacent_interchange: "Adjacent interchange (highway ramps)",
  pedestrian_facility: "Pedestrian sidewalks",
  bicycle_facility: "Bike lane / cycleway",
  school_zone: "School zone",
};

export function isScannedFlag(flag: string): flag is ScannedSiteFlag {
  return flag in SCANNED_FLAG_LABELS;
}

/** True when a dismiss's reason/note pair satisfies the backend's
 *  cross-field rules (a reason; a note iff ``other``). */
export function dismissIsComplete(reason: SiteDismissReason | null, note: string): boolean {
  if (reason === null) return false;
  if (reason === "other") return note.trim().length > 0;
  return note.trim().length === 0;
}

/** One correction per condition: a new marker for a flag replaces the
 *  old one (the backend refuses duplicates with an honest 400). */
export function withSiteCorrection(
  meta: ScenarioMeta,
  marker: SiteConditionOverride,
): ScenarioMeta {
  const rest = (meta.siteConditionOverrides ?? []).filter((m) => m.flag !== marker.flag);
  return { ...meta, siteConditionOverrides: [...rest, marker] };
}

/** Undo (#179 shape): remove the flag's marker; drop the key when the
 *  list empties so ``meta`` is byte-identical to before the correction. */
export function withoutSiteCorrection(meta: ScenarioMeta, flag: ScannedSiteFlag): ScenarioMeta {
  const rest = (meta.siteConditionOverrides ?? []).filter((m) => m.flag !== flag);
  if (rest.length === 0) {
    const next = { ...meta } as Record<string, unknown>;
    delete next.siteConditionOverrides;
    return next as unknown as ScenarioMeta;
  }
  return { ...meta, siteConditionOverrides: rest };
}

/**
 * THE pin-move door (fix-224-manual-pin-move, ruling of 2026-09-05): every
 * writer of ``meta.lat`` / ``meta.lng`` on a live scenario goes through
 * here — the map picker's Save (GeneratorSidebar.onPickerSave) and the
 * Location step's manual Latitude / Longitude fields (ManualFallback).
 * Applies ``patch`` and, when the pin actually moved, clears the
 * site-condition corrections in the same object (their subject, this
 * corridor's scan, no longer exists).  A write that leaves the pin where
 * it was (a re-save, a re-typed same value) keeps them.  A writer that
 * bypasses this helper is a defect — the s2-arc18 prod J1 finding.
 */
export function withPin(
  meta: ScenarioMeta,
  patch: Partial<Pick<ScenarioMeta, "lat" | "lng">> & Partial<ScenarioMeta>,
): ScenarioMeta {
  const nextLat = patch.lat ?? meta.lat;
  const nextLng = patch.lng ?? meta.lng;
  const moved = nextLat !== meta.lat || nextLng !== meta.lng;
  const base = moved ? withoutSiteCorrections(meta) : meta;
  return { ...base, ...patch };
}

/** A pin move: the corrections' subject no longer exists — clear them
 *  all (key dropped, never an empty list). */
export function withoutSiteCorrections(meta: ScenarioMeta): ScenarioMeta {
  if (meta.siteConditionOverrides === undefined) return meta;
  const next = { ...meta } as Record<string, unknown>;
  delete next.siteConditionOverrides;
  return next as unknown as ScenarioMeta;
}

export function dismissMarker(
  flag: ScannedSiteFlag,
  reason: SiteDismissReason,
  note: string,
  now: Date = new Date(),
): SiteConditionOverride {
  const marker: SiteConditionOverride = {
    flag,
    action: "dismiss",
    reason,
    recorded_at: stamp(now),
  };
  if (reason === "other") marker.note = note.trim();
  return marker;
}

export function assertMarker(flag: ScannedSiteFlag, now: Date = new Date()): SiteConditionOverride {
  return { flag, action: "assert", recorded_at: stamp(now) };
}

/** ISO-8601 UTC to the second (the backend field caps at 32 chars). */
function stamp(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}
