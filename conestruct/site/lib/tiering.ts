// s2-arc7 (Refs #219) — the tier classifier for section 03's
// triage-by-consequence restructure.
//
// Pure derivation ONLY (rule 3): every fact's tier is read off a status
// the backend already computed and shipped — nothing here evaluates a
// rule, recomputes a verdict, or invents a count.  The mapping is the
// ruled table of the s2-arc7 GO (2026-08-24, flags a–k as recommended):
//
//   ▲ changed   — fired count/op deltas · site adjustments that added or
//                 modified devices · Fines Double applicable
//   ⚠ attention — conditional/unknown deltas · personnel + device
//                 mandate chips (obligations the tool cannot discharge)
//                 · Colorado check FAILs · corridor warnings · geometry
//                 violations · signalized approaches · hours OUTSIDE
//   ✓ checked   — the trace items (taper/buffer/spacing/advance) · the
//                 case match · passing Colorado checks + info items ·
//                 flagger SSD · zero-device site adjustments · corridor
//                 checked-and-clean · Fines Double not-applicable ·
//                 non-signalized approaches · hours INSIDE
//   ◌ pending   — every pending-verification item · hours UNKNOWN
//                 (schedule not set / not finished — Setup pointer)
//   i reference — admin deltas · standing hazard meters (contingent
//                 penalties describe the jurisdiction, not this plan;
//                 the worst-$ token stays named in the section) ·
//                 scanned buckets that map to no rule (#224 phase 3).
//
// #224 phase 3 (s2-arc17, GO 2026-09-03): the in-generate site scan's
// own facts, read off ``sections.site_scan`` (src/api/site_scan.py):
//   · status ok, key DETECTED — no fact here: the detection fired an
//     ``audit:site:<flag>`` adjustment record above, and its evidence
//     attaches to that row (one fact per condition, never two).
//   · status ok, key ABSENT   — ``audit:scan:<flag>`` ✓ checked: the
//     scanned-and-clean named pass (the corridor flag-h precedent).
//   · status ok, keyless bucket (railroad_crossings, hospitals,
//     road_curvature) — ``audit:scan:<bucket>`` i reference, uncounted:
//     a measurement with no rule consequence.
//   · unavailable + proceeded_anyway — ONE ``audit:scan:not_checked`` ⚠
//     (counted; phase 2's uncounted item retired with the pin's growth).
//   · not_run — nothing: no scan is not a finding.
//                 Reference is deliberately UNCOUNTED: the ledger's
//                 reference token is unnumbered by ruling (flag k keeps
//                 the other four tokens always rendered, zeros incl.).
//
// The Python mirror is src/rendering/tier_ledger.py (the audit-PDF
// cover line, Refs #220); both implementations are pinned to the same
// committed expectation file (tests/fixtures/tiering/
// tiering-expectations.json) so neither can drift alone.

import type { JurisdictionBlock } from "./jurisdiction";
import type { AuditResponse } from "./render-types";

// Scan bucket → site-condition flag.  MIRROR of src/api/site_scan.py
// DETECTION_TO_FLAG (the backend owns the mapping; this copy only
// decides which wire bucket names which fact id — no verdict computed).
// Insertion order is the row order section 03 renders.
export const SCAN_BUCKET_TO_FLAG: ReadonlyArray<readonly [string, string]> = [
  ["intersections", "adjacent_intersection"],
  ["interchanges", "adjacent_interchange"],
  ["sidewalks", "pedestrian_facility"],
  ["bike_facilities", "bicycle_facility"],
  ["schools", "school_zone"],
];
export const SCAN_KEYED_BUCKETS: ReadonlySet<string> = new Set(
  SCAN_BUCKET_TO_FLAG.map(([b]) => b),
);

/** One scan bucket as the wire carries it (src/api/site_scan.py
 *  SiteScanBucket).  The rows print these fields as sent — count, the
 *  feet twin, the relevant-only detail lines — and never ``features``
 *  (the first five Overpass elements, relevant or not). */
export interface ScanBucketWire {
  detected?: boolean;
  count?: number;
  nearest_distance_m?: number | null;
  nearest_distance_ft?: number | null;
  details?: string[];
}
export interface ScanWire {
  status?: string;
  proceeded_anyway?: boolean;
  measured_at?: string | null;
  buckets?: Record<string, ScanBucketWire>;
}

/** The evidence line a section-03 row prints for a detected bucket —
 *  the wire's numbers, joined; nothing invented, nothing converted
 *  (rule 3).  Empty when the bucket carries no evidence. */
export function scanEvidence(b: ScanBucketWire | undefined): string {
  if (!b || b.detected !== true) return "";
  const parts: string[] = [];
  if (typeof b.count === "number") parts.push(`${b.count} found`);
  if (typeof b.nearest_distance_ft === "number") {
    parts.push(`nearest ${b.nearest_distance_ft} ft from anchor`);
  }
  if (b.details && b.details.length > 0) parts.push(b.details[0]);
  return parts.join(" · ");
}

export type Tier = "changed" | "attention" | "checked" | "pending" | "reference";

export interface TierFact {
  /** Stable id — shared with the Python mirror and the expectation file. */
  id: string;
  tier: Tier;
  /** The status that placed it (provenance for tests + row chrome). */
  reason: string;
}

export interface Ledger {
  changed: number;
  attention: number;
  checked: number;
  pending: number;
}

export interface TierModel {
  facts: TierFact[];
  ledger: Ledger;
}

export interface TieringInput {
  jurisdiction: JurisdictionBlock | null;
  audit: AuditResponse | null;
  /** True when the audit fetch for the input on screen failed or was
   *  declined — adds the one ⚠ "verification unavailable" fact so the
   *  tier that hosts the Retry can never be empty-and-collapsed
   *  (rule 10; the strip's "retry below" must land on a visible row).
   *  The PDF path never sets this (it renders from a successful
   *  projection only), so it is excluded from the cross-surface pin. */
  auditFailed?: boolean;
}

function fact(id: string, tier: Tier, reason: string): TierFact {
  return { id, tier, reason };
}

export function assignTiers({ jurisdiction, audit, auditFailed = false }: TieringInput): TierModel {
  const facts: TierFact[] = [];

  if (jurisdiction) {
    jurisdiction.applied_deltas.forEach((d, i) => {
      const id = `jur:delta:${i}`;
      if (d.status === "conditional" || d.status === "unknown") {
        facts.push(fact(id, "attention", `delta ${d.status}`));
      } else if (d.severity === "admin") {
        facts.push(fact(id, "reference", "admin delta"));
      } else {
        // fires, count or op — changed the plan (count) or its method (op).
        facts.push(fact(id, "changed", `delta fires (${d.severity})`));
      }
    });
    jurisdiction.chips.personnel.forEach((c, i) =>
      facts.push(
        fact(
          `jur:personnel:${i}`,
          "attention",
          c.status === "fires" ? "obligation" : `personnel ${c.status}`,
        ),
      ),
    );
    jurisdiction.chips.device.forEach((c, i) =>
      facts.push(
        fact(
          `jur:device:${i}`,
          "attention",
          c.status === "fires" ? "obligation" : `mandate ${c.status}`,
        ),
      ),
    );
    // Standing hazard meters describe the jurisdiction, not this plan —
    // reference regardless of status (ruled flag c; an always-open ⚠
    // on every metered jurisdiction would destroy the tier's meaning).
    jurisdiction.chips.hazard.forEach((_c, i) =>
      facts.push(fact(`jur:hazard:${i}`, "reference", "standing hazard meter")),
    );
    const hs = jurisdiction.hours_eval.status;
    facts.push(
      fact(
        "jur:hours",
        hs === "outside" ? "attention" : hs === "inside" ? "checked" : "pending",
        `hours ${hs}`,
      ),
    );
  }

  if (audit) {
    const s = audit.sections;
    for (const key of ["taper", "buffer", "spacing", "advance"] as const) {
      if (s[key]) facts.push(fact(`audit:${key}`, "checked", "trace"));
    }
    if (s.case) facts.push(fact("audit:case", "checked", "case match"));
    const checks = (s.colorado?.checks as Array<{ pass: boolean }> | undefined) ?? [];
    checks.forEach((c, i) =>
      facts.push(
        fact(
          `audit:colorado:check:${i}`,
          c.pass ? "checked" : "attention",
          c.pass ? "colorado pass" : "colorado FAIL",
        ),
      ),
    );
    const infos = (s.colorado?.info_items as unknown[] | undefined) ?? [];
    infos.forEach((_x, i) =>
      facts.push(fact(`audit:colorado:info:${i}`, "checked", "colorado info")),
    );
    if (typeof (s.flagger as Record<string, unknown> | undefined)?.sight_distance_ft === "number") {
      facts.push(fact("audit:flagger_ssd", "checked", "trace"));
    }
    for (const r of s.site_adjustments ?? []) {
      const moved = r.devices_added > 0 || (r.devices_modified ?? 0) > 0;
      facts.push(
        fact(
          `audit:site:${r.flag}`,
          moved ? "changed" : "checked",
          moved ? "site adjustment added/modified devices" : "site adjustment advisory",
        ),
      );
    }
    const corridor = s.corridor_validation as
      | { checked?: boolean; warnings?: unknown[] }
      | undefined;
    if (corridor?.checked === true) {
      const warnings = corridor.warnings ?? [];
      if (warnings.length > 0) {
        warnings.forEach((_w, i) =>
          facts.push(fact(`audit:corridor:warning:${i}`, "attention", "corridor warning")),
        );
      } else {
        // Ruled flag h: the silent pass becomes a named pass — the
        // ``checked`` field already exists on the wire (surfacing, not
        // computing).
        facts.push(fact("audit:corridor:clean", "checked", "corridor checked, no warnings"));
      }
    }
    const geoViolations =
      ((s.geometry_validation as { violations?: unknown[] } | undefined)?.violations as
        | unknown[]
        | undefined) ?? [];
    geoViolations.forEach((_v, i) =>
      facts.push(fact(`audit:geometry:${i}`, "attention", "geometry violation")),
    );
    const fd = s.fines_double as { applicable?: boolean } | undefined;
    if (fd) {
      facts.push(
        fact(
          "audit:fines_double",
          fd.applicable === true ? "changed" : "checked",
          fd.applicable === true ? "fines double envelope added" : "fines double carve-out",
        ),
      );
    }
    const approaches = s.approaches as
      | { approaches?: Array<{ signalized?: boolean }> }
      | undefined;
    if (approaches) {
      const anySignal = (approaches.approaches ?? []).some((a) => a.signalized === true);
      facts.push(
        fact(
          "audit:approaches",
          anySignal ? "attention" : "checked",
          anySignal ? "signalized — signal operation review required" : "approaches",
        ),
      );
    }
    const pendingItems = audit.pending_verification.items;
    if (pendingItems && pendingItems.length > 0) {
      pendingItems.forEach((_p, i) =>
        facts.push(fact(`audit:pending:${i}`, "pending", "pending verification")),
      );
    } else if (audit.pending_verification.count > 0) {
      // Pre-items flat shape: one rollup fact so the count never vanishes.
      facts.push(fact("audit:pending:0", "pending", "pending verification"));
    }
    // #224 phase 3 — the scan's own facts (header table).  A bucket
    // missing from the wire yields nothing: absence of signal is not
    // absence of a feature (rule 10).
    const scan = s.site_scan as ScanWire | undefined;
    if (scan?.status === "ok") {
      const buckets = scan.buckets ?? {};
      for (const [bucket, flag] of SCAN_BUCKET_TO_FLAG) {
        const b = buckets[bucket];
        if (b && b.detected !== true) {
          facts.push(fact(`audit:scan:${flag}`, "checked", "scanned — none along the corridor"));
        }
      }
      for (const bucket of Object.keys(buckets)) {
        if (!SCAN_KEYED_BUCKETS.has(bucket)) {
          facts.push(fact(`audit:scan:${bucket}`, "reference", "scanned bucket with no rule"));
        }
      }
    } else if (scan?.status === "unavailable" && scan.proceeded_anyway === true) {
      facts.push(fact("audit:scan:not_checked", "attention", "site scan not checked"));
    }
  }

  if (auditFailed) {
    facts.push(fact("audit:unavailable", "attention", "audit failed/declined"));
  }

  const ledger: Ledger = { changed: 0, attention: 0, checked: 0, pending: 0 };
  for (const f of facts) {
    if (f.tier !== "reference") ledger[f.tier] += 1;
  }
  return { facts, ledger };
}

/** The ledger line, exactly as the audit-PDF cover renders it (#220) —
 *  all four counted tokens always present, zeros included (flag k);
 *  the reference token is unnumbered by ruling. */
export function ledgerLine(l: Ledger): string {
  return (
    `${l.changed} change${l.changed === 1 ? "" : "s"} · ` +
    `${l.attention} needs attention · ` +
    `${l.checked} checked · ` +
    `${l.pending} pending · reference`
  );
}
