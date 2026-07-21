// Jurisdiction layer — frontend types + presentation derivation.
//
// The types mirror the backend's evaluated ``jurisdiction`` block on
// /render/device-breakdown (src/rules/jurisdiction.py evaluate()) —
// snake_case, verbatim (spec §1.1 #1: the frontend adapts).  This module
// contains NO rule math: verdicts, violations, exposure estimates, tier
// suggestions, and fee figures all arrive computed from the backend
// (CLAUDE.md rule 3).  What lives here is presentation derivation only —
// band segments computed from the semantic hours windows (spec §1.1 #3:
// presentation data is derived, never stored) and display formatting.

export type StreetClass = "local" | "collector" | "arterial";

export interface SourceRef {
  doc: string;
  section?: string;
  date?: string;
  status: "verified" | "provisional" | "conflict";
}

export interface ConflictBlock {
  label: string;
  rendered: string;
  sources: { doc: string; value: string }[];
  verdict: string;
}

export interface HoursWindow {
  kind: "ban" | "work";
  days: "weekday" | "weekend" | "all";
  classes: StreetClass[] | null;
  start: number;
  end: number;
  note?: string;
  source: SourceRef;
}

export interface JurisdictionHours {
  shape:
    | "ban_windows"
    | "work_window"
    | "nested_envelope"
    | "noise_conditioned"
    | "none";
  windows: HoursWindow[];
  holiday_rule: "none" | "holidays_banned" | "holidays_and_eves_banned";
  override_note?: string;
  condition_note?: string;
  conflict: ConflictBlock | null;
}

export interface HoursViolation {
  kind: "ban_window_overlap" | "outside_work_window";
  window: { start: number; end: number; days: string };
  overlap_hours?: number;
  outside_hours?: number;
  note?: string | null;
  source: SourceRef;
}

export interface HoursEval {
  status: "inside" | "outside" | "unknown";
  violations: HoursViolation[];
  exposure_estimate_cents?: number;
  note?: string;
}

export type TriggerStatus = "fires" | "unknown" | "conditional";

export interface AppliedDelta {
  severity: "count" | "op" | "admin";
  rule: string;
  baseline?: string;
  effect: { op: string; device?: string; qty?: number; note?: string };
  status: TriggerStatus;
  source: SourceRef;
  conflict?: ConflictBlock;
}

export interface Meter {
  kind: string;
  unit: string;
  amount_cents?: number;
  amount_cents_min?: number;
  amount_cents_max?: number;
  escalated_amount_cents?: number;
  escalation_trigger?: string;
  classes?: StreetClass[] | null;
  trigger?: string;
  note?: string;
  source: SourceRef;
}

export interface Chip {
  rule: string;
  status: TriggerStatus;
  source: SourceRef;
  gate?: string;
  meter_kind?: string;
  meter?: Meter;
}

export interface FeeItem {
  label: string;
  amount_cents: number;
  per?: string;
  provisional?: boolean;
  effective?: string;
  note?: string;
  source: SourceRef;
}

export interface Fees {
  model: "flat" | "formula" | "degradation_indexed" | "post_approval" | "unpublished";
  items: FeeItem[];
  formula: { inputs: string[]; note: string; source: SourceRef } | null;
  note?: string;
}

export interface Lead {
  label: string;
  lead_days: number;
  lead_unit: "calendar_days" | "business_days" | "hours";
  note?: string;
  source: SourceRef;
}

export interface Notice {
  audience: string;
  rule: string;
  lead_days?: number;
  lead_unit?: string;
  source: SourceRef;
}

export interface PermitTier {
  label: string;
  definition?: string;
  source: SourceRef;
}

export interface PermitBlock {
  tier_suggested: string | null;
  tier_reason: string;
  tiers: PermitTier[];
  notes: { rule: string; source: SourceRef }[];
  multi_agency: { rule: string; source: SourceRef }[];
  fee_estimate_cents?: number;
  leads: Lead[];
  notices: Notice[];
  onsite: { items: { rule: string; source: SourceRef }[]; digital_ok: boolean | null };
}

export interface JurisdictionBlock {
  key: string;
  name: string;
  tcp_term: string;
  row_term: string;
  authority: string;
  chain: string[];
  class_required: boolean;
  classification_map_url: string | null;
  hours: JurisdictionHours;
  fees: Fees;
  meters: Meter[];
  applied_deltas: AppliedDelta[];
  chips: { personnel: Chip[]; device: Chip[]; hazard: Chip[] };
  hours_eval: HoursEval;
  permit: PermitBlock;
  conflicts: ConflictBlock[];
  provisional: boolean;
}

export interface WorkScheduleInput {
  date_mode: "single" | "range" | "tbd";
  work_date?: string;
  work_date_end?: string;
  start_time?: number;
  end_time?: number;
}

/** The jurisdictions the UI offers — the full spec §6 launch-8 ship
 *  list, every record authored from the research corpus. */
export const JURISDICTION_OPTIONS: { key: string; label: string }[] = [
  { key: "cdot", label: "CDOT (state highway)" },
  { key: "denver", label: "Denver" },
  { key: "lakewood", label: "Lakewood" },
  { key: "englewood", label: "Englewood" },
  { key: "littleton", label: "Littleton" },
  { key: "centennial", label: "Centennial" },
  { key: "parker", label: "Parker" },
  { key: "e470", label: "E-470" },
];

// ---------------------------------------------------------------------------
// Presentation derivation — hours bands
// ---------------------------------------------------------------------------

export interface BandSegment {
  t: "ok" | "ban";
  startH: number;
  endH: number;
}

export interface BandRow {
  scope: string;
  classes: StreetClass[] | null;
  days: "weekday" | "weekend" | "all";
  segments: BandSegment[];
}

const CLASS_LABEL: Record<string, string> = {
  local: "Local",
  collector: "Collector",
  arterial: "Arterial",
};

function scopeLabel(classes: StreetClass[] | null): string {
  if (!classes || classes.length === 0) return "All streets";
  return classes.map((c) => CLASS_LABEL[c] ?? c).join(" / ");
}

const DAY_LABEL: Record<string, string> = {
  weekday: "Weekday",
  weekend: "Sat / Sun",
  all: "All days",
};

export function dayLabel(days: string): string {
  return DAY_LABEL[days] ?? days;
}

/**
 * Derive display band rows from the semantic windows (spec §1.1 #3).
 * One row per (classes, days) group.  Ban windows subtract from an
 * all-permitted day; work windows define the permitted span on an
 * otherwise-banned day.  Groups containing BOTH kinds resolve as work
 * windows further constrained by bans (nested envelopes are cumulative;
 * a tighter inner row appears as its own class-scoped group).
 */
export function deriveBandRows(hours: JurisdictionHours): BandRow[] {
  const groups = new Map<string, { classes: StreetClass[] | null; days: HoursWindow["days"]; windows: HoursWindow[] }>();
  for (const w of hours.windows) {
    const key = `${JSON.stringify(w.classes ?? null)}|${w.days}`;
    const g = groups.get(key) ?? { classes: w.classes, days: w.days, windows: [] };
    g.windows.push(w);
    groups.set(key, g);
  }
  const rows: BandRow[] = [];
  for (const g of groups.values()) {
    const workWindows = g.windows.filter((w) => w.kind === "work");
    const banWindows = g.windows.filter((w) => w.kind === "ban");
    // Timeline of permitted spans over 0..24.
    let ok: [number, number][] = workWindows.length
      ? workWindows.map((w) => [w.start, w.end])
      : [[0, 24]];
    for (const ban of banWindows) {
      const next: [number, number][] = [];
      for (const [s, e] of ok) {
        if (ban.end <= s || ban.start >= e) {
          next.push([s, e]);
          continue;
        }
        if (ban.start > s) next.push([s, ban.start]);
        if (ban.end < e) next.push([ban.end, e]);
      }
      ok = next;
    }
    ok.sort((a, b) => a[0] - b[0]);
    const segments: BandSegment[] = [];
    let cursor = 0;
    for (const [s, e] of ok) {
      if (s > cursor) segments.push({ t: "ban", startH: cursor, endH: s });
      segments.push({ t: "ok", startH: s, endH: e });
      cursor = e;
    }
    if (cursor < 24) segments.push({ t: "ban", startH: cursor, endH: 24 });
    rows.push({
      scope: scopeLabel(g.classes),
      classes: g.classes,
      days: g.days,
      segments,
    });
  }
  // Class-scoped rows first (they are the rows a street class activates),
  // then the all-streets envelope rows.
  rows.sort((a, b) => Number(a.classes === null) - Number(b.classes === null));
  return rows;
}

/** The row the active street class highlights (design: falls back to
 *  collector, then the first row). */
export function activeBandRow(rows: BandRow[], streetClass: StreetClass | null): BandRow | null {
  if (rows.length === 0) return null;
  const byClass = (c: StreetClass) => rows.find((r) => r.classes?.includes(c));
  return (
    (streetClass ? byClass(streetClass) : undefined) ??
    byClass("collector") ??
    rows[0]
  );
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

export function hhmm(h: number): string {
  const hr = Math.floor(h);
  const m = Math.round((h - hr) * 60);
  const ap = hr < 12 || hr === 24 ? "AM" : "PM";
  const h12 = ((hr + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${ap}`;
}

export function dollars(cents: number): string {
  const d = cents / 100;
  return d % 1 === 0
    ? `$${d.toLocaleString()}`
    : `$${d.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function meterRateLabel(m: Meter): string {
  const amount =
    m.amount_cents != null
      ? dollars(m.amount_cents)
      : m.amount_cents_min != null && m.amount_cents_max != null
        ? `${dollars(m.amount_cents_min)}–${dollars(m.amount_cents_max)}`
        : "—";
  const unit: Record<string, string> = {
    half_hour: "/ ½-hr",
    hour: "/ hr",
    day: "/ day",
    occurrence: "/ occurrence",
  };
  return `${amount} ${unit[m.unit] ?? ""}`.trim();
}

export const LEAD_UNIT_LABEL: Record<string, string> = {
  calendar_days: "days",
  business_days: "business days",
  hours: "hours",
};

export function leadNoticeLabel(l: Lead): string {
  return `${l.lead_days} ${LEAD_UNIT_LABEL[l.lead_unit] ?? l.lead_unit}`;
}

/**
 * "Start no later than" back-computation for the lead-time table —
 * calendar display only (never a compliance verdict).  business_days
 * skips weekends; holidays are unknowable here, so callers prefix "≈".
 */
export function startNoLaterThan(workDateIso: string, l: Lead): Date {
  const d = new Date(`${workDateIso}T00:00:00`);
  if (l.lead_unit === "hours") {
    d.setHours(d.getHours() - l.lead_days);
    return d;
  }
  if (l.lead_unit === "business_days") {
    let remaining = l.lead_days;
    while (remaining > 0) {
      d.setDate(d.getDate() - 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) remaining -= 1;
    }
    return d;
  }
  d.setDate(d.getDate() - l.lead_days);
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
