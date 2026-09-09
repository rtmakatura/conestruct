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
  StagedCorrection,
} from "./types";
import type { SiteScanProvenance } from "@/lib/render-types";
import { SCAN_BUCKET_TO_FLAG, type ScanBucketWire } from "@/lib/tiering";

export type { StagedCorrection } from "./types";

/** The dismiss vocabulary (backend enum; ``other`` needs a note). */
/** #246 — the DOM id of the strip's "Site conditions — scanned" block:
 *  the jump target of the results-head line and the section 03
 *  signposts (jumpToAnchor; a missing anchor is a no-op). */
export const SITE_CORRECTIONS_ANCHOR = "site-corrections";

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

// ---------------------------------------------------------------------------
// #249 (s2-arc21) — the ledger's two pure helpers.
// ---------------------------------------------------------------------------

/** Spec 46: only a DETECTED row may enter the dismiss-reason state.  The
 *  guard reads the served bucket for the flag (the backend's
 *  DETECTION_TO_FLAG mirror decides which bucket names it); a missing
 *  bucket, an absent row, or a null scan all refuse.  Nothing here
 *  decides a verdict — it only gates a picker. */
export function dismissAllowed(
  buckets: Record<string, ScanBucketWire> | null | undefined,
  flag: ScannedSiteFlag,
): boolean {
  if (!buckets) return false;
  const bucketName = SCAN_BUCKET_TO_FLAG.find(([, f]) => f === flag)?.[0];
  return bucketName !== undefined && buckets[bucketName]?.detected === true;
}

// ---------------------------------------------------------------------------
// #254 (s2-arc26) — staging.  A Dismiss / Assert / Undo click is an intent
// the shell holds; Apply folds the whole set into ONE scenario write, so
// one request opens and the band mounts once.  Pure functions; the
// existing marker helpers above do the folding, so Apply's meta is
// exactly what N single writes would have produced.
// ---------------------------------------------------------------------------

/** Stage an intent: one entry per flag — a new intent for a flag
 *  replaces the old one in place (the backend refuses duplicate flags). */
export function stage(staged: readonly StagedCorrection[], entry: StagedCorrection): StagedCorrection[] {
  const i = staged.findIndex((s) => s.flag === entry.flag);
  if (i === -1) return [...staged, entry];
  const next = staged.slice();
  next[i] = entry;
  return next;
}

/** Undo on a staged row: the intent leaves the set — no request. */
export function unstage(staged: readonly StagedCorrection[], flag: ScannedSiteFlag): StagedCorrection[] {
  return staged.filter((s) => s.flag !== flag);
}

/** Apply: fold the staged set through withSiteCorrection /
 *  withoutSiteCorrection in staged order.  Nothing staged ⇒ the same
 *  meta object back (no spurious write); the key drops when the list
 *  empties (the #179 shape, byte-identical after correct-then-undo). */
export function applyStaged(meta: ScenarioMeta, staged: readonly StagedCorrection[]): ScenarioMeta {
  let next = meta;
  for (const s of staged) {
    next = s.marker === null ? withoutSiteCorrection(next, s.flag) : withSiteCorrection(next, s.marker);
  }
  return next;
}

export interface CorrectionsStanding {
  /** Keyed buckets on the wire (the "of N checked" total; rule 12). */
  total: number;
  /** Of those, detected. */
  detected: number;
  /** Detected rows with no server correction of any status — the rows
   *  still open to a Dismiss (B's chip 1). */
  open: number;
  /** Server records with status applied (the plan was built to them). */
  applied: number;
  /** The staged set's size. */
  staged: number;
}

/** One derivation the block's Apply row and the results-head chip share
 *  (P2).  Counts the SERVED scan + the staged set; without an ok scan
 *  the buckets contribute nothing (rule 10) and only the records and
 *  the staged set count. */
export function deriveCorrectionsStanding(
  scan: SiteScanProvenance | null,
  staged: readonly StagedCorrection[],
): CorrectionsStanding {
  const out: CorrectionsStanding = { total: 0, detected: 0, open: 0, applied: 0, staged: staged.length };
  if (!scan) return out;
  const corrections = (scan.corrections ?? []).filter((c) => isScannedFlag(c.flag));
  const recorded = new Set(corrections.map((c) => c.flag));
  out.applied = corrections.filter((c) => c.status === "applied").length;
  if (scan.status !== "ok") return out;
  const buckets = (scan.buckets as Record<string, ScanBucketWire> | undefined) ?? {};
  for (const [bucketName, flag] of SCAN_BUCKET_TO_FLAG) {
    const b = buckets[bucketName];
    if (!b) continue;
    out.total += 1;
    if (b.detected === true) {
      out.detected += 1;
      if (!recorded.has(flag)) out.open += 1;
    }
  }
  return out;
}

/** The staged count in words — the Apply row's label and the chip's
 *  suffix share it (one voice). */
export function stagedSentence(n: number): string {
  if (n === 0) return "no corrections staged";
  return `${n} correction${n === 1 ? "" : "s"} staged · not yet applied`;
}

const MONTHS_LOWER = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** GO ruling e (a′): the footer stamp ``3 sep · 23:14 utc`` from the
 *  wire's ISO-8601 ``measured_at`` (src/api/site_scan.py:
 *  ``datetime.now(UTC).isoformat(timespec="seconds")``) by PURE SLICING
 *  — no ``Date``, no clock, no arithmetic (rule 3), so it is honest
 *  under ``memo_hit`` and a stale tab (#242) by construction.  Anything
 *  that is not a UTC ISO stamp (another offset, a bare date, garbage)
 *  prints VERBATIM: no conversion is ever attempted (rule 10). */
export function fmtScanStamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|\+00:00)$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS_LOWER[Number(m[2]) - 1];
  if (!month) return iso;
  // Number(...) only drops the day's leading zero ("03" → "3").
  return `${Number(m[3])} ${month} · ${m[4]}:${m[5]} utc`;
}

/** #251 (s2-arc22, GO ruling d): the footer's ``2.7 s`` from the wire's
 *  integer ``duration_ms`` — display formatting only (ms → s, one
 *  decimal; rule 3: the number is the backend's, this is its unit).
 *  Anything that is not a finite number prints nothing: the caller
 *  omits the segment rather than invent a duration (rule 10). */
export function fmtScanDuration(ms: unknown): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return `${(ms / 1000).toFixed(1)} s`;
}
