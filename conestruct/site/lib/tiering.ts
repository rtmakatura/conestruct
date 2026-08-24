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
//                 the worst-$ token stays named in the section) .
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
