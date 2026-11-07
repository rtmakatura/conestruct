// #443: the three sections as one data model (X4).  Every row reads a field
// of `deriveTierSources` and the breakdown; the frontend adds words, never
// values (Rule 3).  Rows of "Checked and passed" and "Not checked yet" are
// one-for-one with the ledger's facts (lib/tiering.ts), and a test pins it.

import type { ReactNode } from "react";

import { SITE_ADJUSTMENT_DETAIL, type ItemSpec } from "@/components/AuditTrail";
import type { DeviceBreakdownState } from "@/components/DeviceBreakdown";
import { HoursBars } from "@/components/JurisdictionSection";
import { zoneGeometryRows } from "@/components/ResultsHero";
import { deltaCite, deltaDetail, deltaImpact, deltaTitle, statusWords } from "@/lib/delta-words";
import {
  dayLabel,
  deriveBandRows,
  dollars,
  fmtDate,
  hhmm,
  leadNoticeLabel,
  meterRateLabel,
  startNoLaterThan,
  type JurisdictionBlock,
  type StreetClass,
  type WorkScheduleInput,
} from "@/lib/jurisdiction";
import { referenceSummary } from "@/lib/reference-summary";
import type { SiteAdjustmentRecord } from "@/lib/render-types";
import type { RowDetail } from "@/lib/row-detail";
import { resultValue } from "@/lib/row-detail";
import type { SiteConditionFlag } from "@/lib/scenarios";
import type { TierSources } from "@/lib/tier-sources";
import { SCAN_BUCKET_TO_FLAG, SCAN_KEYED_BUCKETS, scanEvidence } from "@/lib/tiering";

export type RowGlyph = "✓" | "◌" | "▲" | "⚠" | "i";

export interface RefRow {
  id: string;
  glyph: RowGlyph;
  title: string;
  result?: string;
  /** A number: drawn right-aligned in mono (X7). */
  resultMono?: boolean;
  /** A failing check keeps its `--fail` ink (X21). */
  failed?: boolean;
  /** A failed device schedule opens so its Retry shows (X2). */
  startOpen?: boolean;
  detail: RowDetail;
}

export interface RefGroup {
  label?: string;
  rows: RefRow[];
  /** Rows shown before "Show N more checks" (ruling 4, X3). */
  firstRows?: number;
}

export type SectionId = "checked" | "pending" | "reference";

export interface RefSection {
  id: SectionId;
  glyph: RowGlyph;
  name: string;
  summary: string;
  intro: string[];
  groups: RefGroup[];
}

export interface SectionInput {
  sources: TierSources;
  streetClass: StreetClass | null;
  schedule: WorkScheduleInput | null;
  verifying: boolean;
  breakdown: DeviceBreakdownState;
  cited: boolean;
  checkedCount: number | null;
  pendingCount: number | null;
  jurisdictionLoading: boolean;
  showAudit: boolean;
  /** Rendering the model can't draw itself (a jump link, a Retry). */
  signpost: (text: "Correct in setup ↑" | "Assert in setup ↑") => ReactNode;
  retry: ReactNode;
}

/** X11: the row's shorter name.  `ItemSpec.title` stays for its other readers. */
const SHOWN_TITLE: Record<string, string> = {
  "Taper length calculation": "Taper length",
  "Buffer space calculation": "Buffer space",
  "Channelizing device spacing": "Device spacing",
  "Advance warning sign set": "Warning signs",
  "Flagger station sight distance": "Flagger sight distance",
};

function shownTitle(title: string): string {
  if (SHOWN_TITLE[title]) return SHOWN_TITLE[title];
  return / · S-630-\d reference$/.test(title) ? "Standard plan" : title;
}

function fromItem(id: string, item: ItemSpec, glyph: RowGlyph, mono = false): RefRow {
  return {
    id,
    glyph,
    title: shownTitle(item.title),
    // The ▲ / ⚠ that lead these wire words are the row's glyph now.
    result: resultValue(item.result).replace(/^[▲⚠✕]\s*/, ""),
    resultMono: mono,
    detail: { ...item.detail, source: item.detail.source ?? item.cite },
  };
}

/** #450 ruling 2: a rule check's row result.  The backend's short result
 *  when it sent one, with the full sentence leading the opened detail as
 *  written; with none (an older wire), the sentence stays the result, as
 *  before (Rule 10).  The frontend never shortens a sentence itself (Rule 3). */
function shortResult(sentence: string, short: string | undefined): { result: string; lead: string[] } {
  const s = short?.trim();
  return s ? { result: s, lead: [sentence] } : { result: sentence, lead: [] };
}

const SCAN_REFERENCE_LABELS: Record<string, string> = {
  railroad_crossings: "railroad crossings",
  hospitals: "hospitals",
  road_curvature: "road curvature",
};

function joinWords(words: string[]): string {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function docLine(
  jurName: string,
  s: { doc: string; section?: string | null; date?: string | null; status?: string },
): string {
  const status = s.status && s.status !== "verified" ? ` · ${s.status}` : "";
  return `${jurName} · ${s.doc}${s.section ? ` §${s.section}` : ""}${s.date ? ` · ${s.date}` : ""}${status}`;
}

function withStatus(status: Parameters<typeof statusWords>[0], line: string): string {
  const words = statusWords(status);
  return words ? `${words} · ${line}` : line;
}

// ── hours ──

function hoursWords(jur: JurisdictionBlock, schedule: WorkScheduleInput | null, verifying: boolean) {
  const ev = jur.hours_eval;
  const tbd = schedule == null || schedule.date_mode === "tbd";
  if (verifying) {
    return {
      sentence: `Checking the schedule against ${jur.name}'s windows for the updated inputs…`,
      result: "checking…",
    };
  }
  if (ev.status === "inside") {
    return {
      sentence: `Within the permitted window for this street class.${ev.note ? ` (${ev.note})` : ""}`,
      result: "inside the window",
    };
  }
  if (ev.status === "outside") {
    return {
      sentence: `Schedule conflicts with ${jur.name}'s windows.`,
      result: "outside the window, review the schedule",
    };
  }
  return tbd
    ? {
        sentence: `Schedule marked "Not set". These windows are reference only. Choose a date mode in Setup to check a schedule against ${jur.name}'s windows.`,
        result: `${jur.name}'s windows, not checked against dates`,
      }
    : {
        sentence: `${ev.note ?? "Schedule not checked yet"}. Enter the work date and start/end times in the Setup panel's Schedule step to check them against ${jur.name}'s windows.`,
        result: "set the date and times in Setup to check",
      };
}

function hoursDetail(i: SectionInput, jur: JurisdictionBlock): RowDetail {
  const { hours, hours_eval: ev } = jur;
  const words = hoursWords(jur, i.schedule, i.verifying);
  const rows = deriveBandRows(hours);
  const none = hours.shape === "none" || rows.length === 0;
  // The meter scoped to the active street class (the backend's exposure-meter
  // selection), then an unscoped one, then the first.
  const hoursMeters = jur.meters.filter((m) => m.kind === "hours_violation");
  const meter =
    hoursMeters.find((m) => i.streetClass && m.classes?.includes(i.streetClass)) ??
    hoursMeters.find((m) => !m.classes || m.classes.length === 0) ??
    hoursMeters[0];
  const violations =
    !i.verifying && ev.status === "outside"
      ? ev.violations.map((v) =>
          v.kind === "ban_window_overlap"
            ? `${v.overlap_hours} h overlaps the ${hhmm(v.window.start)}–${hhmm(v.window.end)} ban (${dayLabel(v.window.days)})`
            : `${v.outside_hours} h falls outside the permitted ${(v.windows ?? [v.window]).map((w) => `${hhmm(w.start)}–${hhmm(w.end)}`).join(" / ")} ${v.windows && v.windows.length > 1 ? "windows" : "window"} (${dayLabel(v.window.days)})`,
        )
      : [];
  return {
    sentences: [
      words.sentence,
      ...violations,
      ...(!i.verifying && ev.status === "outside" && ev.exposure_estimate_cents != null
        ? [
            `Metered exposure estimate ≈ ${dollars(ev.exposure_estimate_cents)}${jur.provisional ? " (provisional schedule)" : ""}. Trim the schedule to avoid it.`,
          ]
        : []),
      ...(hours.override_note ? [hours.override_note] : []),
      ...(hours.condition_note ? [hours.condition_note] : []),
      ...(none
        ? [
            `${jur.name} publishes no work-hour windows. No restriction shown: none is on record. That doesn't mean none exists.`,
          ]
        : []),
      ...(hours.conflict
        ? ["† Two adopted sources disagree. Showing the conservative value.", hours.conflict.verdict]
        : []),
    ],
    pairs: [
      // X15: each scope's permitted windows, as text search can read.
      ...(none
        ? []
        : rows.map((r) => ({
            label: `${r.scope} · ${dayLabel(r.days)}`,
            value:
              r.segments
                .filter((s) => s.t !== "ban")
                .map((s) => `${hhmm(s.startH)}–${hhmm(s.endH)}`)
                .join(", ") || "banned all day",
            mono: true,
          }))),
      ...(meter
        ? [
            {
              label: "Metered",
              value: `${meterRateLabel(meter)}${meter.classes?.length ? ` ${meter.classes.join("/")}` : ""}`,
              mono: true,
            },
          ]
        : []),
      ...(hours.holiday_rule === "holidays_and_eves_banned"
        ? [{ label: "Holidays", value: "holiday-eve rule" }]
        : []),
      ...(hours.conflict
        ? hours.conflict.sources.map((c) => ({ label: c.doc, value: c.value, mono: true }))
        : []),
    ],
    extra: none ? undefined : (
      <HoursBars jurisdiction={jur} streetClass={i.streetClass} schedule={i.schedule} />
    ),
  };
}

// ── permit ──

function leadRange(jur: JurisdictionBlock): string {
  const p = jur.permit;
  const days = p.leads.filter((l) => l.lead_unit !== "hours").map((l) => l.lead_days);
  if (days.length === 0) return p.leads.length > 0 ? "see the row" : "no lead time on record";
  const lo = Math.min(...days);
  const hi = Math.max(...days);
  return `${lo === hi ? `${lo}` : `${lo} to ${hi}`} days lead time`;
}

function permitRow(jur: JurisdictionBlock, workDate: string | null): RefRow {
  const p = jur.permit;
  const f = jur.fees;
  const unpublished = f.model === "unpublished" || f.model === "post_approval";
  return {
    id: "permit",
    glyph: "i",
    title: "Permit",
    result: `${f.items.length} fee line${f.items.length === 1 ? "" : "s"}, ${leadRange(jur)}`,
    detail: {
      sentences: [
        "Courtesy reference. Fees are never quote line items.",
        p.tier_reason,
        ...(unpublished ? [f.note ?? "Fee amounts are not published for this jurisdiction."] : []),
        ...(!unpublished && f.formula ? [f.formula.note] : []),
        ...(!unpublished && f.note ? [f.note] : []),
        ...p.notices.map((x) => `${x.audience}: ${x.rule}`),
        ...p.onsite.items.map((x) => `${x.rule}${p.onsite.digital_ok ? " Digital copies accepted." : ""}`),
      ],
      pairs: [
        ...(p.tiers.length > 0
          ? [{ label: "Permit types", value: p.tiers.map((t) => t.label).join(", ") }]
          : []),
        ...(p.tier_suggested
          ? [{ label: "Suggested", value: p.tier_suggested }]
          : p.tiers.length > 0
            ? [{ label: "Suggested", value: "none" }]
            : []),
        ...(!unpublished && p.fee_estimate_cents != null
          ? [{ label: "Suggested-type fee", value: dollars(p.fee_estimate_cents), mono: true }]
          : []),
        ...(!unpublished && f.formula
          ? [
              {
                label: f.formula.source.status === "provisional" ? "Fee (provisional)" : "Fee",
                value: `f(${f.formula.inputs.join(", ")})`,
                mono: true,
              },
            ]
          : []),
        ...p.leads.map((l) => ({
          label: l.label,
          value: `${leadNoticeLabel(l)}${workDate ? `, start no later than ≈ ${fmtDate(startNoLaterThan(workDate, l))}` : ""}`,
          mono: true,
        })),
        ...(p.leads.length === 0 ? [{ label: "Lead times", value: "none on record" }] : []),
        ...(p.notices.length === 0 ? [{ label: "Notices", value: "none on record" }] : []),
        ...(p.onsite.items.length === 0 ? [{ label: "On-site requirements", value: "none on record" }] : []),
      ],
      list: unpublished
        ? undefined
        : {
            // X16: every fee line, not the first six.
            noun: { one: "fee line", many: "fee lines" },
            lines: f.items.map((x) => ({
              text: `${x.label}${x.provisional ? " (provisional)" : ""}`,
              value: `${dollars(x.amount_cents)}${x.per && x.per !== "flat" ? ` / ${x.per.replace("_", " ")}` : ""}`,
            })),
          },
    },
  };
}

// ── devices ──

function deviceRows(i: SectionInput): RefRow[] {
  const b = i.breakdown;
  if (b.state === "loading" && !b.lastReady) {
    return [{ id: "devices", glyph: "◌", title: "Device schedule", result: "loading…", detail: { sentences: ["Loading device breakdown…"] } }];
  }
  if (b.state === "error") {
    const declined = b.httpStatus === 400;
    const throttled = b.httpStatus === 429;
    const fromAudit = b.fromAudit === true;
    return [
      {
        id: "devices",
        glyph: "⚠",
        title: "Device schedule",
        failed: true,
        startOpen: true,
        result: declined
          ? "unavailable: generation declined"
          : throttled
            ? "paused: retry inside"
            : fromAudit
              ? "unavailable: retry from the audit trail"
              : "unavailable: retry inside",
        detail: {
          sentences: [
            declined
              ? "Device schedule unavailable while generation is declined. See the notice above."
              : throttled
                ? "Device schedule paused: too many updates in the last minute. Retry in a moment."
                : fromAudit
                  ? `Device breakdown failed: ${b.message.replace(/\.$/, "")}. Retry from the audit trail.`
                  : `Device breakdown failed: ${b.message}`,
          ],
          actions: declined || fromAudit ? undefined : i.retry,
        },
      },
    ];
  }
  const d = b.state === "ready" ? b.data : b.lastReady!;
  const jurName = d.jurisdiction?.name;
  const required = d.devices.some((r) => r.jurisdiction_required);
  const rows: RefRow[] = [
    {
      id: "devices",
      glyph: "i",
      title: "Device schedule",
      result: `${d.unique_types} types, ${d.total_devices} units`,
      resultMono: true,
      detail: {
        sentences:
          required && jurName
            ? [`Lines marked ${jurName} are jurisdiction-required: ${jurName}'s published rules add them on top of the MUTCD baseline.`]
            : [],
        list: {
          noun: { one: "device type", many: "device types" },
          lines: d.devices.map((r) => ({
            text: `${r.device}${r.jurisdiction_required ? ` (${jurName ?? "JR"})` : ""}`,
            value: String(r.qty),
            sub: `${r.code} · ${r.function}`,
          })),
        },
      },
    },
  ];
  const g = d.zone_geometry;
  rows.push({
    id: "zone-geometry",
    glyph: "i",
    title: "Zone geometry",
    result: g ? undefined : "unavailable",
    detail: g
      ? {
          // Rule 169: the hero's one list, so the two can't drift on a number.
          pairs: zoneGeometryRows(g).map((row) => ({ label: row.label, value: row.value, mono: true })),
        }
      : { sentences: ["Zone geometry unavailable"] },
  });
  return rows;
}

// ── the three sections ──

export function buildReferenceSections(i: SectionInput): RefSection[] {
  const s = i.sources;
  const jur = s.jur;
  const out: RefSection[] = [];

  // `short`: a passed row ("Checked and passed", #450 ruling 2) reads the
  // record's short result; the ▲ rows keep their sentence.
  const siteRow = (rec: SiteAdjustmentRecord, glyph: RowGlyph, short = false): RefRow => {
    const words = SITE_ADJUSTMENT_DETAIL[rec.flag as SiteConditionFlag];
    const action = words?.action ?? rec.action;
    const r = short ? shortResult(action, rec.short_result) : { result: action, lead: [] };
    const c = s.corrections.get(rec.flag);
    const asserted = c?.status === "applied" && c.action === "assert";
    const bucket = s.flagToBucket.get(rec.flag);
    const evidence = asserted
      ? c.disclosure
      : s.scanBuckets && bucket
        ? scanEvidence(s.scanBuckets[bucket])
        : "";
    return {
      id: `site-${rec.flag}`,
      glyph,
      title: words?.label ?? rec.flag,
      result: r.result,
      detail: {
        sentences: [...r.lead, ...(evidence ? [evidence] : [])],
        source: asserted ? "OPERATOR" : rec.citation,
        actions: s.scanBuckets ? i.signpost("Correct in setup ↑") : undefined,
      },
    };
  };

  if (i.checkedCount !== null) {
    const calculations = s.traceItems.map((it, n) => {
      const t = shownTitle(it.title);
      return fromItem(`calc-${n}-${t}`, it, "✓", t !== "Standard plan");
    });
    const checks: RefRow[] = [];
    s.deltasMet.forEach((d, n) =>
      checks.push({
        id: `met-${n}`,
        glyph: "✓",
        title: deltaTitle(d, s.jurisdictionName),
        result: deltaDetail(d, s.jurisdictionName),
        detail: { sentences: [d.rule], source: deltaCite(d) },
      }),
    );
    const coloradoRow = (
      id: string,
      glyph: RowGlyph,
      c: { label: string; detail: string; citation: string; short_result?: string },
    ): RefRow => {
      const r = shortResult(c.detail, c.short_result);
      return {
        id,
        glyph,
        title: c.label,
        result: r.result,
        detail: { ...(r.lead.length > 0 ? { sentences: r.lead } : {}), source: c.citation },
      };
    };
    s.coloradoPasses.forEach((c, n) => checks.push(coloradoRow(`pass-${n}`, "✓", c)));
    s.coloradoInfos.forEach((c, n) => checks.push(coloradoRow(`info-${n}`, "i", c)));
    if (s.corridorClean) {
      checks.push({
        id: "corridor",
        glyph: "✓",
        title: "Site corridor validation",
        result: "checked against OSM, no warnings",
        detail: { source: "OPENSTREETMAP" },
      });
    }
    s.siteAdvisory.forEach((rec) => checks.push(siteRow(rec, "✓", true)));
    if (s.scanBuckets) {
      const scannedAt = s.scan?.measured_at ? `scanned ${s.scan.measured_at}` : "scanned";
      for (const [bucket, flag] of SCAN_BUCKET_TO_FLAG) {
        const label = SITE_ADJUSTMENT_DETAIL[flag as SiteConditionFlag]?.label ?? flag;
        const b = s.scanBuckets[bucket];
        const c = s.corrections.get(flag);
        if (c?.status === "applied" && c.action === "dismiss") {
          checks.push({
            id: `scan-${flag}`,
            glyph: "✓",
            title: label,
            result: "dismissed by operator",
            detail: { sentences: [c.disclosure], source: "OPERATOR", actions: i.signpost("Correct in setup ↑") },
          });
        } else if (c?.status === "applied") {
          continue;
        } else if (b && b.detected !== true) {
          checks.push({
            id: `scan-${flag}`,
            glyph: "✓",
            title: label,
            result: "none along the corridor",
            detail: { sentences: [scannedAt], source: "OPENSTREETMAP", actions: i.signpost("Assert in setup ↑") },
          });
        }
      }
    }
    if (s.approachesSpec && !s.approachesSignalized) checks.push(fromItem("approaches", s.approachesSpec, "✓"));
    if (s.finesItem && !s.finesApplicable) checks.push(fromItem("fines-double", s.finesItem, "✓"));
    if (jur && s.hoursStatus === "inside") {
      checks.push({
        id: "hours-inside",
        glyph: "✓",
        title: "Work hours",
        result: hoursWords(jur, i.schedule, i.verifying).result,
        detail: hoursDetail(i, jur),
      });
    }
    const n = i.checkedCount;
    out.push({
      id: "checked",
      glyph: "✓",
      name: "Checked and passed",
      summary: `${n} check${n === 1 ? "" : "s"}${i.cited ? ", each cited" : ""}`,
      intro: i.showAudit
        ? ["Every number here traces to MUTCD or CDOT. Other cities may add rules not covered yet."]
        : [],
      groups: [
        { label: "CALCULATIONS", rows: calculations },
        { label: "RULE CHECKS", rows: checks, firstRows: 2 },
      ].filter((g) => g.rows.length > 0),
    });
  }

  if (i.pendingCount !== null) {
    const rows: RefRow[] = [];
    const pv = s.settled?.pending_verification;
    if (pv && pv.items && pv.items.length > 0) {
      pv.items.forEach((item, n) =>
        rows.push({
          id: `pending-${n}`,
          glyph: "◌",
          title: capitalize(item.kind.replace(/_/g, " ")),
          detail: {
            sentences: [item.label],
            links: item.tracking_issue
              ? [{ href: item.tracking_issue, label: "↗ Tracking issue" }]
              : [],
          },
        }),
      );
    } else if (s.pendingSpec) {
      rows.push({ id: "pending-0", glyph: "◌", title: s.pendingSpec.result, detail: s.pendingSpec.detail });
    }
    if (jur && s.hoursStatus === "unknown") {
      rows.push({
        id: "hours-pending",
        glyph: "◌",
        title: "Work hours not checked",
        detail: { sentences: [hoursWords(jur, i.schedule, i.verifying).sentence] },
      });
    }
    const n = i.pendingCount;
    out.push({
      id: "pending",
      glyph: "◌",
      name: "Not checked yet",
      summary: `${n} item${n === 1 ? "" : "s"} for the TCS`,
      intro: [],
      groups: rows.length > 0 ? [{ rows }] : [],
    });
  }

  // ── section 3 ──
  const rules: RefRow[] = [];
  const hoursFines: RefRow[] = [];
  const road: RefRow[] = [];
  const ruleChecks: RefRow[] = [];
  if (jur) {
    s.deltasChanged.forEach((d, n) =>
      rules.push({
        id: `delta-${n}`,
        glyph: "▲",
        title: deltaTitle(d, s.jurisdictionName),
        result: deltaDetail(d, s.jurisdictionName),
        detail: {
          sentences: [d.rule],
          pairs: [
            // #388 R5: the backend's per-plan count (Rule 3).
            { label: "This plan", value: [deltaImpact(d).main, deltaImpact(d).unit].filter(Boolean).join(" "), mono: true },
            ...(d.baseline ? [{ label: "Baseline", value: d.baseline }] : []),
          ],
          source: docLine(jur.name, d.source),
        },
      }),
    );
    const keep = [
      ...s.deltasAttention.map((d) => ({
        text: d.rule,
        sub: withStatus(d.status, docLine(jur.name, d.source)),
      })),
      ...[...jur.chips.personnel, ...jur.chips.device].map((c) => ({
        text: c.rule,
        sub: withStatus(c.status, docLine(jur.name, c.source)),
      })),
    ];
    if (keep.length > 0) {
      rules.push({
        id: "keep-in-mind",
        glyph: "⚠",
        title: `${keep.length} rule${keep.length === 1 ? "" : "s"} to keep in mind`,
        detail: { list: { noun: { one: "rule", many: "rules" }, lines: keep } },
      });
    }
    if (s.deltasAdmin.length > 0) {
      rules.push({
        id: "admin-rules",
        glyph: "i",
        title: "Administrative rules",
        result: `${s.deltasAdmin.length}`,
        resultMono: true,
        detail: {
          list: {
            noun: { one: "rule", many: "rules" },
            lines: s.deltasAdmin.map((d) => ({ text: d.rule, sub: withStatus(d.status, docLine(jur.name, d.source)) })),
          },
        },
      });
    }
  }
  s.coloradoFails.forEach((c, n) =>
    ruleChecks.push({ id: `fail-${n}`, glyph: "⚠", failed: true, title: c.label, result: c.detail, detail: { source: c.citation } }),
  );
  if (s.finesItem && s.finesApplicable) hoursFines.push(fromItem("fines-double", s.finesItem, "▲"));
  if (jur) {
    const hazards = jur.chips.hazard;
    if (hazards.length > 0) {
      const cents = (m: (typeof hazards)[number]["meter"]) => (m ? (m.amount_cents ?? m.amount_cents_max ?? 0) : 0);
      const worst = hazards.reduce((a, b) => (cents(b.meter) > cents(a.meter) ? b : a), hazards[0]);
      hoursFines.push({
        id: "hazards",
        glyph: "⚠",
        title: "Fines and hazards",
        result: `${hazards.length} on record${worst.meter ? `, worst ${meterRateLabel(worst.meter)}` : ""}`,
        detail: {
          list: {
            noun: { one: "hazard", many: "hazards" },
            lines: hazards.map((c) => ({
              text: c.rule,
              value: c.meter ? meterRateLabel(c.meter) : undefined,
              sub: withStatus(c.status, docLine(jur.name, c.source)),
            })),
          },
        },
      });
    }
    const outside = !i.verifying && s.hoursStatus === "outside";
    const inside = !i.verifying && s.hoursStatus === "inside";
    hoursFines.push({
      id: "hours",
      glyph: outside ? "⚠" : inside ? "✓" : "◌",
      failed: outside,
      title: "Work hours",
      result: hoursWords(jur, i.schedule, i.verifying).result,
      startOpen: outside,
      detail: hoursDetail(i, jur),
    });
    hoursFines.push(
      permitRow(jur, i.schedule && i.schedule.date_mode !== "tbd" ? (i.schedule.work_date ?? null) : null),
    );
  }
  s.siteChanged.forEach((rec) => road.push(siteRow(rec, "▲")));
  if (s.siteScanItem) road.push(fromItem("site-scan", s.siteScanItem, "⚠"));
  if (s.corridorItem) road.push(fromItem("corridor-warn", s.corridorItem, "⚠"));
  if (s.geometryItem) road.push(fromItem("geometry", s.geometryItem, "⚠"));
  if (s.approachesSpec && s.approachesSignalized) road.push(fromItem("approaches", s.approachesSpec, "⚠"));
  for (const c of s.corrections.values()) {
    if (c.status !== "moot") continue;
    road.push({
      id: `moot-${c.flag}`,
      glyph: "i",
      title: SITE_ADJUSTMENT_DETAIL[c.flag as SiteConditionFlag]?.label ?? c.flag,
      result: "operator correction: moot",
      detail: { sentences: [c.disclosure], source: "OPERATOR" },
    });
  }
  if (s.scanBuckets) {
    const absent: { label: string; evidence: string }[] = [];
    for (const name of Object.keys(s.scanBuckets)) {
      if (SCAN_KEYED_BUCKETS.has(name)) continue;
      const b = s.scanBuckets[name];
      if (!b) continue;
      const label = SCAN_REFERENCE_LABELS[name] ?? name;
      if (b.detected === true) {
        road.push({
          id: `measured-${name}`,
          glyph: "i",
          title: capitalize(label),
          result: "detected, no rule applies",
          detail: { sentences: [scanEvidence(b)].filter(Boolean), source: "REFERENCE" },
        });
      } else {
        absent.push({ label, evidence: scanEvidence(b) || "none along the corridor" });
      }
    }
    if (absent.length > 0) {
      // X14: the absent measurements read as one row.
      road.push({
        id: "measured-absent",
        glyph: "✓",
        title: `No ${joinWords(absent.map((a) => a.label))}`,
        detail: {
          pairs: absent.map((a) => ({ label: capitalize(a.label), value: a.evidence })),
          source: "REFERENCE",
        },
      });
    }
  }
  const devices = i.showAudit ? deviceRows(i) : [];
  out.push({
    id: "reference",
    glyph: "i",
    name: jur ? `${jur.name} rules and site facts` : "Site facts",
    summary: "For reference, never blocks the plan",
    intro: [
      // §8.31 (hand-check, 2026-09-22): which jurisdiction, which street class,
      // which spec chain.  Ruling 3 took the header's summary, so they lead the body.
      referenceSummary({ jurisdiction: jur, streetClass: i.streetClass }),
      ...(i.jurisdictionLoading ? ["Loading jurisdiction rules…"] : []),
      ...(jur?.provisional ? ["Contains provisional facts."] : []),
    ],
    groups: [
      { label: jur ? `${jur.name.toUpperCase()} RULES` : undefined, rows: rules },
      { label: "RULE CHECKS", rows: ruleChecks },
      { label: "PERMIT, HOURS AND FINES", rows: hoursFines },
      { label: "ALONG THE ROAD", rows: road },
      { label: "DEVICES", rows: devices },
    ].filter((g) => g.rows.length > 0),
  });
  return out;
}
