"use client";

// Jurisdiction layer — the five app components from the design handoff
// (docs/design/design_handoff_jurisdiction_layer), recreated in the
// codebase's own patterns (TSX + Tailwind + the workbench role tokens).
//
// Every number, verdict, citation, tier, and dollar figure renders from
// the backend's evaluated ``jurisdiction`` block (rule 3 — the frontend
// computes nothing but presentation).  Band segments are derived here
// from the semantic hours windows (spec §1.1 #3), and that is the only
// derivation in the file.
//
// Color system (CLAUDE.md): interactive = --act cyan · generated output
// and count-affecting = --dim orange · warning = --warn amber + glyph ·
// pass/fail = --pass/--fail · no verdict = chromaless --none.  No signal
// relies on hue alone — every state carries a glyph or a word.

import { type ReactNode } from "react";
import { ReferenceChip } from "./ReferenceChip";
import {
  activeBandRow,
  dayLabel,
  deriveBandRows,
  dollars,
  fmtDate,
  hhmm,
  hourTick,
  rowBoundaries,
  leadNoticeLabel,
  meterRateLabel,
  normalizeChainLink,
  startNoLaterThan,
  type ChainLink,
  type JurisdictionSuggestion,
  JURISDICTION_OPTIONS,
  type AppliedDelta,
  type Chip,
  type JurisdictionBlock,
  type StreetClass,
  type TriggerStatus,
  type WorkScheduleInput,
} from "@/lib/jurisdiction";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SourceLine({ source }: { source: AppliedDelta["source"] }) {
  return (
    <div className="font-mono text-[10px] tracking-[0.02em] text-[color:var(--ink-faint)] mt-1">
      <span aria-hidden>✓ </span>
      {source.doc}
      {source.section ? ` · §${source.section}` : ""}
      {source.date ? ` · ${source.date}` : ""}
      {source.status !== "verified" && (
        <span className="uppercase"> · {source.status}</span>
      )}
    </div>
  );
}

export function ProvisionalBadge({ label = "Provisional" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-1 border border-[color:var(--warn)] text-[color:var(--warn)]">
      <span aria-hidden>◐</span> {label}
    </span>
  );
}

export function ConflictFootnote({
  conflict,
}: {
  conflict: {
    label: string;
    rendered: string;
    sources: { doc: string; value: string }[];
    verdict: string;
  } | null;
}) {
  if (!conflict) return null;
  return (
    <div className="mt-4 pl-3 border-l-2 border-[color:var(--warn)]">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--warn)] mb-1.5">
        † Two adopted sources disagree. Showing the conservative value.
      </div>
      {conflict.sources.map((s) => (
        <div
          key={s.doc}
          className="flex items-baseline justify-between gap-4 text-[12px] text-[color:var(--ink-mute)] py-0.5"
        >
          <span>{s.doc}</span>
          <span className="font-mono">{s.value}</span>
        </div>
      ))}
      <div className="text-[12px] text-[color:var(--ink)] mt-1.5">{conflict.verdict}</div>
    </div>
  );
}

const STATUS_LABEL: Record<TriggerStatus, string | null> = {
  fires: null,
  conditional: "conditional: shown here, not applied automatically",
  unknown: "needs input (set the street class)",
};

function StatusFlag({ status }: { status: TriggerStatus }) {
  const label = STATUS_LABEL[status];
  if (!label) return null;
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--none)]">
      ◌ {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 1 · The evidence behind the two guesses (R108)
// ---------------------------------------------------------------------------
//
// R108 (2026-10-07): "No confirm step for guesses. Street class (from the
// road) and jurisdiction (from the pin) are prefilled like Road type
// already is ... There are no confirm, dismiss or suggestion rows."  The
// proposal rows, the ✓/× records and their Undo (#227), the agree / differ
// rows and the "N to confirm" count are gone with the confirm step
// (checkpoint §3 lists every ruling this overrides).
//
// What is NOT gone is the evidence (Rule 10, checkpoint D4): the lookup's
// reason, its boundary warnings, the TIGER caveat and the classification
// map caveat.  They are the field's details now — the popover behind its
// marker — and the boundary warnings stay on show in the cell (P3).  The
// sentences are the slots' own, unchanged.

/** The pin's boundary lookup, as the shell holds it (R108). */
export interface JurisdictionLookup {
  status: "idle" | "loading" | "ready" | "error";
  data: JurisdictionSuggestion | null;
}

function jurisdictionLabel(key: string): string {
  return JURISDICTION_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

/** The lookup's boundary warnings (near a boundary, an unsupported area):
 *  the one part of the evidence that stays on show in the cell, because
 *  it tells the operator to check something now (P3). */
export function JurisdictionWarnings({ lookup }: { lookup: JurisdictionLookup }) {
  const warnings = lookup.status === "ready" ? (lookup.data?.warnings ?? []) : [];
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w) => (
        <span
          key={`${w.kind}:${w.message}`}
          className="tr-prov is-amber warnrow"
          data-testid="jurisdiction-warning"
        >
          <span aria-hidden>⚠ </span>
          {w.message}
        </span>
      ))}
    </>
  );
}

/** Everything else the lookup said, for the jurisdiction field's details. */
export function JurisdictionEvidence({ lookup }: { lookup: JurisdictionLookup }) {
  if (lookup.status === "loading") {
    return (
      <div className="jbar-suggest quiet">
        <span aria-hidden>◌</span>
        <span>Checking boundary data…</span>
      </div>
    );
  }
  if (lookup.status === "error") {
    return (
      <div className="jbar-suggest quiet">
        <span aria-hidden>◌</span>
        <span>The boundary lookup didn&apos;t answer, so nothing was filled in from the pin.</span>
      </div>
    );
  }
  const data = lookup.status === "ready" ? lookup.data : null;
  if (!data) {
    return (
      <div className="jbar-suggest quiet">
        <span aria-hidden>◌</span>
        <span>Drop a site pin to look up the jurisdiction.</span>
      </div>
    );
  }
  return (
    <div className="jbar-suggest">
      {data.suggestion && (
        <div className="sugg-reason">
          The pin is in {jurisdictionLabel(data.suggestion)}
          {data.confidence === "near_boundary" && " (near a boundary)"}.
        </div>
      )}
      <div className="sugg-reason">{data.reason}</div>
      <div className="honesty">
        Boundary data is approximate ({data.boundary_source.source},{" "}
        {data.boundary_source.vintage.split(" ")[0]}). Confirm the jurisdiction
        with the permitting authority.
      </div>
    </div>
  );
}

/** The street class's evidence: the tier it was guessed from and, where
 *  the jurisdiction classifies by an adopted map, that map — the tier is a
 *  proxy; the map governs. */
export function StreetClassEvidence({
  tier,
  jurisdiction,
}: {
  tier: string | null;
  jurisdiction: JurisdictionBlock | null;
}) {
  const map = jurisdiction?.classification_map_url ?? null;
  if (!tier && !jurisdiction?.class_required) return null;
  return (
    <div className="jbar-suggest">
      {tier && <div className="sugg-reason">detected road tier: OSM {tier}</div>}
      {jurisdiction?.class_required && (
        <span className="mapchip">
          {map ? (
            <>
              <span aria-hidden>◎ </span>
              <a href={map} target="_blank" rel="noreferrer">
                per {jurisdiction.name} functional classification map
              </a>
            </>
          ) : (
            <>
              ◎ {jurisdiction.name} classifies streets on its published map. Look
              the street up before you submit.
            </>
          )}
        </span>
      )}
      {map && tier && (
        <div className="honesty">
          Verify against{" "}
          <a href={map} target="_blank" rel="noreferrer">
            {jurisdiction?.name}&apos;s functional-classification map
          </a>
          . The road tier is a proxy; the adopted map governs.
        </div>
      )}
    </div>
  );
}

/** The street-class options, in the order the segmented control shows. */
export const STREET_CLASSES: [StreetClass, string][] = [
  ["local", "Local"],
  ["collector", "Collector"],
  ["arterial", "Arterial"],
];

// ---------------------------------------------------------------------------
// 2 · Delta Panel — what this jurisdiction changes vs. the baseline
// ---------------------------------------------------------------------------

const SEV_BAR: Record<AppliedDelta["severity"], string> = {
  count: "bg-[color:var(--dim)]",
  op: "bg-[color:var(--act)]",
  admin: "bg-[color:var(--none)]",
};

function deltaImpact(d: AppliedDelta): { main: string; unit?: string } {
  if (d.severity === "count") {
    // R116: never a raw key -- the backend's label (or the id read as
    // words on an older wire).
    if (d.effect.op === "swap_device")
      return { main: "→ swap", unit: d.device_label ?? d.effect.device?.replace(/_/g, " ") };
    const qty = d.effect.qty ?? 1;
    return { main: `+${qty}`, unit: qty === 1 ? "device" : "devices" };
  }
  return { main: d.severity === "op" ? "method" : "admin" };
}

// #219 — one delta row, extracted verbatim from the retired DeltaChip
// so the tier containers render the identical body (severity bar,
// baseline, status flag, source line, impact column).
export function DeltaRowView({ d }: { d: AppliedDelta }) {
  const impact = deltaImpact(d);
  return (
    <div
      key={d.rule}
      className="grid grid-cols-[3px_1fr_auto] gap-3 py-3 border-b border-[color:var(--paper-line-soft)] last:border-b-0"
    >
      <span className={SEV_BAR[d.severity]} aria-hidden />
      <div>
        <div className="text-[13px] text-[color:var(--ink)] leading-snug">{d.rule}</div>
        {d.baseline && (
          <div className="text-[11px] text-[color:var(--ink-faint)] mt-1">
            baseline: <b>{d.baseline}</b>
          </div>
        )}
        <StatusFlag status={d.status} />
        <SourceLine source={d.source} />
      </div>
      <div className="text-right min-w-[64px]">
        <span
          className={`font-mono text-[15px] ${
            d.severity === "count" && d.status === "fires"
              ? "text-[color:var(--dim)]"
              : "text-[color:var(--ink-faint)]"
          }`}
        >
          {impact.main}
        </span>
        {impact.unit && (
          <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
            {impact.unit}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3 · Work-Hours Card — bands from semantic windows; verdict from hours_eval
// ---------------------------------------------------------------------------

/** Same-day overlay segments for the schedule band; end < start wraps
 *  past midnight (#188), matching the backend's segment convention. */
function scheduleOverlaySegments(
  start: number,
  end: number,
): [number, number][] {
  return end > start
    ? [[start, end]]
    : [
        [start, 24],
        [0, end],
      ];
}

interface WorkHoursProps {
  jurisdiction: JurisdictionBlock;
  streetClass: StreetClass | null;
  schedule: WorkScheduleInput | null;
  /** #152 D: true while a same-jurisdiction refetch is in flight (e.g. a
   *  street-class switch).  The card's CONTENT stays rendered — the
   *  windows and bands are jurisdiction facts — but ``hours_eval`` is a
   *  verdict computed for the previous input, so every verdict surface
   *  presents as checking instead (rule 10: a stale verdict may never
   *  display as current). */
  verifying?: boolean;
}

// #219 — the verdict block, extracted from WorkHoursCard so the tier
// containers and the Reference-tier card render the SAME single-sourced
// ``hours_eval`` (one backend verdict feeding both surfaces — never
// recomputed; the ruled hours split keeps the band chart in Reference
// while the verdict rides its tier).
export function HoursVerdictBlock({
  jurisdiction,
  schedule,
  verifying,
}: {
  jurisdiction: JurisdictionBlock;
  schedule: WorkScheduleInput | null;
  verifying: boolean;
}) {
  const hoursEval = jurisdiction.hours_eval;
  const scheduleTbd = schedule == null || schedule.date_mode === "tbd";
  return (
    <div>
      {verifying && (
        <div className="text-[12px] text-[color:var(--none)]">
          ◌ Checking the schedule against {jurisdiction.name}&apos;s windows
          for the updated inputs…
        </div>
      )}
      {!verifying &&
        hoursEval.status === "unknown" &&
        (scheduleTbd ? (
          <div className="text-[12px] text-[color:var(--none)]">
            ◌ Schedule marked &ldquo;Not set&rdquo;. The windows above are
            reference only. Choose a date mode in Setup to check a
            schedule against {jurisdiction.name}&apos;s windows.
          </div>
        ) : (
          <div className="text-[12px] text-[color:var(--none)]">
            ◌ {hoursEval.note ?? "Schedule not checked yet"}. Enter the
            work date and start/end times in the Setup panel&apos;s
            Schedule step to check them against {jurisdiction.name}&apos;s
            windows.
          </div>
        ))}
      {!verifying && hoursEval.status === "inside" && (
        <div className="text-[12px] text-[color:var(--pass)]">
          ✓ Within the permitted window for this street class.
          {hoursEval.note ? ` (${hoursEval.note})` : ""}
        </div>
      )}
      {!verifying && hoursEval.status === "outside" && (
        <div className="pl-3 border-l-2 border-[color:var(--warn)]">
          <div className="text-[12px] text-[color:var(--warn)]">
            ⚠ Schedule conflicts with {jurisdiction.name}&apos;s windows:
          </div>
          <ul className="m-0 mt-1 pl-4 text-[12px] text-[color:var(--ink-mute)]">
            {hoursEval.violations.map((v) => (
              <li key={`${v.kind}-${v.window.start}`}>
                {v.kind === "ban_window_overlap"
                  ? `${v.overlap_hours} h overlaps the ${hhmm(v.window.start)}–${hhmm(v.window.end)} ban (${dayLabel(v.window.days)})`
                  : `${v.outside_hours} h falls outside the permitted ${(v.windows ?? [v.window]).map((w) => `${hhmm(w.start)}–${hhmm(w.end)}`).join(" / ")} ${v.windows && v.windows.length > 1 ? "windows" : "window"} (${dayLabel(v.window.days)})`}
              </li>
            ))}
          </ul>
          {hoursEval.exposure_estimate_cents != null && (
            <div className="text-[12px] text-[color:var(--warn)] mt-1">
              Metered exposure estimate ≈{" "}
              <span className="font-mono">{dollars(hoursEval.exposure_estimate_cents)}</span>
              {jurisdiction.provisional ? " (provisional schedule)" : ""}. Trim the
              schedule to avoid it.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * #215 — the boundary labels under one hours row.  Each sits at its
 * hour's own position on the 24-h bar.  Even-indexed labels take the
 * first line and odd-indexed the second, so two adjacent boundaries are
 * never on the same line; a label within an hour of either end is pinned
 * inside the bar instead of centred off its edge.  The row renders no
 * strip when it has no interior boundary (a whole-day window).
 */
export function BoundaryLabels({ hours }: { hours: number[] }) {
  if (hours.length === 0) return null;
  return (
    <div
      className={`relative ${hours.length > 1 ? "h-[22px]" : "h-[11px]"} font-mono text-[9px] leading-[11px] text-[color:var(--ink-faint)]`}
      data-testid="hours-boundaries"
    >
      {hours.map((h, i) => {
        const pin = h < 1 ? "translateX(0)" : h > 23 ? "translateX(-100%)" : "translateX(-50%)";
        return (
          <span
            key={h}
            className="absolute whitespace-nowrap"
            data-boundary-hour={h}
            data-boundary-line={i % 2}
            style={{ left: `${(h / 24) * 100}%`, top: i % 2 ? "11px" : "0", transform: pin }}
          >
            {hourTick(h)}
          </span>
        );
      })}
    </div>
  );
}

export function WorkHoursCard({
  jurisdiction,
  streetClass,
  schedule,
  verifying = false,
}: WorkHoursProps) {
  const hours = jurisdiction.hours;
  const hoursEval = jurisdiction.hours_eval;
  const rows = deriveBandRows(hours);
  const active = activeBandRow(rows, streetClass);
  // Prefer the hours meter scoped to the active street class (matches the
  // backend's exposure-meter selection); fall back to the first hours meter.
  const hoursMeters = jurisdiction.meters.filter((m) => m.kind === "hours_violation");
  const meter =
    hoursMeters.find((m) => streetClass && m.classes?.includes(streetClass)) ??
    hoursMeters.find((m) => !m.classes || m.classes.length === 0) ??
    hoursMeters[0];

  const sched = schedule ?? null;
  const hoursKnown =
    sched != null &&
    sched.date_mode !== "tbd" &&
    sched.start_time != null &&
    sched.end_time != null;
  // #199: an absent schedule and an explicit "Not set" read the same —
  // Setup now PRESENTS "Not set" for an untouched scenario, so the card
  // must speak the same words.  A single/range schedule with missing
  // times is different: that one is mid-entry ("set date & times…").
  const scheduleTbd = sched == null || sched.date_mode === "tbd";

  // The chip's collapsed verdict is the backend's hours_eval — never
  // recomputed (rule 3).  Auto-expand is reserved for the ONE
  // plan-invalidating state (schedule outside the window).
  const status = hoursEval.status;
  const summary = verifying ? (
    <>◌ checking…</>
  ) : status === "outside" ? (
    <span className="verdict-bad">outside window · review schedule</span>
  ) : status === "inside" ? (
    <span className="verdict-ok">inside window ✓</span>
  ) : scheduleTbd ? (
    <>
      windows shown · <b>not checked</b>
    </>
  ) : (
    <>set date &amp; times in Setup to check</>
  );

  return (
    <ReferenceChip
      glyph="◷"
      label={`Work hours: ${jurisdiction.name}`}
      sev={!verifying && status === "outside" ? "warn" : "info"}
      autoExpand={!verifying && status === "outside"}
      summary={summary}
      badge={
        hours.conflict ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-1 border border-[color:var(--warn)] text-[color:var(--warn)] whitespace-nowrap">
            † source conflict
          </span>
        ) : undefined
      }
    >
      <div className="flex gap-2 flex-wrap mb-2 empty:hidden">
        {hours.holiday_rule === "holidays_and_eves_banned" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-1 border border-[color:var(--warn)] text-[color:var(--warn)]">
            ◐ holiday-eve rule
          </span>
        )}
        {meter && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-1 bg-[color:var(--dim-soft)] border border-[color:var(--dim)] text-[color:var(--dim)]">
            Metered {meterRateLabel(meter)}
            {meter.classes?.length ? ` ${meter.classes.join("/")}` : ""}
          </span>
        )}
      </div>

      {hours.override_note && (
        <p className="text-[12px] text-[color:var(--ink-mute)] mb-3 max-w-[640px]">
          {hours.override_note}
        </p>
      )}
      {hours.condition_note && (
        <p className="text-[12px] text-[color:var(--ink-mute)] mb-3 max-w-[640px]">
          <span className="text-[color:var(--warn)]" aria-hidden>
            ⚠{" "}
          </span>
          {hours.condition_note}
        </p>
      )}

      {hours.shape === "none" || rows.length === 0 ? (
        <div className="text-[12px] text-[color:var(--none)] py-2">
          ◌ {jurisdiction.name} publishes no work-hour windows. No
          restriction shown: none is on record. That doesn&apos;t mean none
          exists.
        </div>
      ) : (
        <div>
          {rows.map((r) => {
            const isActive = active === r;
            return (
              <div
                key={`${r.scope}-${r.days}`}
                // #215: at phone width the scope stacks above its bar, so
                // the bar — and its boundary labels — get the column.
                className="grid grid-cols-[130px_1fr] max-md:grid-cols-1 gap-2 items-center mb-1"
                data-testid="hours-row"
              >
                <div
                  className={`text-[11px] leading-tight ${
                    isActive
                      ? "text-[color:var(--ink)] font-semibold"
                      : "text-[color:var(--ink-faint)]"
                  }`}
                >
                  {r.scope}
                  <span className="block font-mono text-[9px] uppercase tracking-[0.06em] font-normal">
                    {dayLabel(r.days)}
                  </span>
                </div>
                <div>
                <div
                  className={`relative flex h-6 overflow-hidden ${
                    isActive ? "outline outline-1 outline-[color:var(--act)]" : ""
                  }`}
                >
                  {r.segments.map((s) => (
                    <div
                      key={`${s.startH}-${s.endH}`}
                      style={{ width: `${((s.endH - s.startH) / 24) * 100}%` }}
                      className={`flex items-center justify-center font-mono text-[8px] uppercase tracking-[0.1em] ${
                        s.t === "ban"
                          ? "bg-[repeating-linear-gradient(45deg,var(--paper-deep),var(--paper-deep)_4px,var(--paper-line-soft)_4px,var(--paper-line-soft)_8px)] text-[color:var(--ink-faint)]"
                          : "bg-[color:var(--pass-soft)] text-[color:var(--pass)]"
                      }`}
                    >
                      {s.endH - s.startH >= 3 ? (s.t === "ban" ? "banned" : "ok") : ""}
                    </div>
                  ))}
                  {isActive &&
                    hoursKnown &&
                    sched &&
                    // An overnight schedule (#188: end < start wraps past
                    // midnight) overlays as two segments, mirroring how the
                    // window bands themselves split at midnight.
                    scheduleOverlaySegments(
                      sched.start_time as number,
                      sched.end_time as number,
                    ).map(([a, b]) => (
                      <div
                        key={`sched-${a}`}
                        aria-hidden
                        className="absolute top-0 bottom-0 border-x-2 border-[color:var(--act)] bg-[color:var(--act-glow)]"
                        style={{
                          left: `${(a / 24) * 100}%`,
                          width: `${((b - a) / 24) * 100}%`,
                        }}
                      />
                    ))}
                </div>
                {/* #215: every window boundary labelled where it falls, so
                    no end time is inferred from an unlabeled gap.  The
                    hours are the data's (rowBoundaries), formatted as the
                    axis formats them (hourTick).  Labels alternate between
                    two lines, so neighbouring boundaries never sit on top
                    of each other at the column's width or at 380; the
                    first and last are pinned inside the bar's edges. */}
                <BoundaryLabels hours={rowBoundaries(r)} />
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-[130px_1fr] max-md:grid-cols-1 gap-2">
            <div />
            <div className="flex justify-between font-mono text-[9px] text-[color:var(--ink-faint)]">
              <span>12a</span>
              <span>4a</span>
              <span>8a</span>
              <span>12p</span>
              <span>4p</span>
              <span>8p</span>
              <span>12a</span>
            </div>
          </div>
        </div>
      )}

      {/* Plan tie — the verdict comes from the backend hours_eval, never
          recomputed here (rule 3 / rule 10: VERIFYING-style honesty is
          handled upstream by the section's loading state).  Schedule
          ENTRY lives in Setup (ScheduleField) and the post-gen strip —
          this chip only reads.  An unknown verdict distinguishes the
          user's deliberate "Not set" from a schedule they simply
          haven't finished entering. */}
      <div className="mt-3">
        <HoursVerdictBlock
          jurisdiction={jurisdiction}
          schedule={sched}
          verifying={verifying}
        />
      </div>

      <ConflictFootnote conflict={hours.conflict} />
    </ReferenceChip>
  );
}

// ---------------------------------------------------------------------------
// 4 · Permit & Fees FYI — courtesy reference, never a checkout
// ---------------------------------------------------------------------------

export function PermitFYI({
  jurisdiction,
  workDate,
}: {
  jurisdiction: JurisdictionBlock;
  workDate: string | null;
}) {
  const p = jurisdiction.permit;
  const fees = jurisdiction.fees;
  let n = 0;
  const num = () => String(++n).padStart(2, "0");
  const anyProvisionalFee = fees.items.some((i) => i.provisional) || fees.formula?.source.status === "provisional";

  const Section = ({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) => (
    <div className="py-3 border-b border-[color:var(--paper-line-soft)] last:border-b-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[10px] text-[color:var(--ink-faint)]">{num()}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--ink-mute)]">
          {title}
        </span>
        {badge}
      </div>
      {children}
    </div>
  );

  // Density-contract summary: tiers + fee-line count + lead range.
  const dayLeads = p.leads.filter((l) => l.lead_unit !== "hours");
  const leadRange =
    dayLeads.length > 0
      ? (() => {
          const dd = dayLeads.map((l) => l.lead_days);
          const lo = Math.min(...dd);
          const hi = Math.max(...dd);
          return lo === hi ? `${lo} days` : `${lo}–${hi} days`;
        })()
      : p.leads.length > 0
        ? "see below"
        : "—";

  return (
    <ReferenceChip
      glyph="i"
      label={`Permit: ${jurisdiction.name}`}
      summary={
        <>
          {p.tiers.length > 0 ? (
            <>
              <b>{p.tiers.length}</b> permit type{p.tiers.length === 1 ? "" : "s"}
            </>
          ) : (
            "no published tiers"
          )}{" "}
          · <b>{fees.items.length}</b> fee line{fees.items.length === 1 ? "" : "s"} ·
          lead <b>{leadRange}</b>
        </>
      }
      badge={anyProvisionalFee ? <ProvisionalBadge /> : undefined}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-on-dark-faint)] mb-2">
        <b>FYI</b>: courtesy reference. Fees are never quote line items.
      </div>
      <div>
        <Section title="Permit type / tier">
          {p.tiers.length > 0 ? (
            <>
              <div className="flex gap-1.5 mb-1.5" aria-label="Permit tiers">
                {p.tiers.map((t) => (
                  <span
                    key={t.label}
                    className={`px-2 py-1 text-[11px] border ${
                      t.label === p.tier_suggested
                        ? "border-[color:var(--dim)] text-[color:var(--dim)]"
                        : "border-[color:var(--paper-line)] text-[color:var(--ink-faint)]"
                    }`}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
              <div className="text-[12px] text-[color:var(--ink-mute)]">
                {p.tier_suggested ? (
                  <>
                    suggested: <b className="text-[color:var(--ink)]">{p.tier_suggested}</b>
                  </>
                ) : (
                  <span className="text-[color:var(--none)]">◌ no tier suggested</span>
                )}
                {" "}({p.tier_reason})
              </div>
            </>
          ) : (
            <div className="text-[12px] text-[color:var(--ink-mute)]">{p.tier_reason}</div>
          )}
        </Section>

        <Section title="Fee reference" badge={anyProvisionalFee ? <ProvisionalBadge /> : null}>
          {fees.model === "unpublished" || fees.model === "post_approval" ? (
            <div className="text-[12px] text-[color:var(--none)]">
              ◌ {fees.note ?? "Fee amounts are not published for this jurisdiction."}
            </div>
          ) : (
            <>
              {fees.formula && (
                <div className="font-mono text-[12px] text-[color:var(--ink)] mb-2 leading-relaxed">
                  fee = f({fees.formula.inputs.join(", ")})
                  <div className="font-sans text-[11px] text-[color:var(--ink-faint)] mt-1 max-w-[520px]">
                    {fees.formula.note}
                  </div>
                </div>
              )}
              {p.fee_estimate_cents != null && (
                <div className="text-[12px] text-[color:var(--ink-mute)] mb-2">
                  suggested-tier fee:{" "}
                  <span className="font-mono text-[color:var(--dim)]">
                    {dollars(p.fee_estimate_cents)}
                  </span>
                </div>
              )}
              {fees.items.slice(0, 6).map((f) => (
                <div
                  key={f.label}
                  className="flex items-baseline justify-between gap-4 text-[12px] py-0.5"
                >
                  <span className="text-[color:var(--ink-mute)]">
                    {f.label}
                    {f.provisional && (
                      <span className="text-[color:var(--warn)]" aria-hidden>
                        {" "}
                        ◐
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[color:var(--ink)]">
                    {dollars(f.amount_cents)}
                    {f.per && f.per !== "flat" ? ` / ${f.per.replace("_", " ")}` : ""}
                  </span>
                </div>
              ))}
              {fees.note && (
                <div className="text-[11px] text-[color:var(--ink-faint)] mt-1.5">{fees.note}</div>
              )}
            </>
          )}
        </Section>

        <Section title="Lead times">
          {p.leads.length === 0 ? (
            <div className="text-[12px] text-[color:var(--none)]">◌ none on record</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--ink-faint)] text-left">
                  <th className="font-normal pb-1">Item</th>
                  <th className="font-normal pb-1">Notice</th>
                  <th className="font-normal pb-1">Start no later than</th>
                </tr>
              </thead>
              <tbody>
                {p.leads.map((l) => (
                  <tr key={l.label} className="border-t border-[color:var(--paper-line-soft)]">
                    <td className="py-1 pr-3 text-[color:var(--ink-mute)]">{l.label}</td>
                    <td className="py-1 pr-3 font-mono text-[color:var(--ink)]">
                      {leadNoticeLabel(l)}
                    </td>
                    <td className="py-1 font-mono text-[color:var(--ink)]">
                      {workDate ? `≈ ${fmtDate(startNoLaterThan(workDate, l))}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Notices">
          {p.notices.length === 0 ? (
            <div className="text-[12px] text-[color:var(--none)]">◌ none on record</div>
          ) : (
            p.notices.map((x) => (
              <div key={x.rule} className="text-[12px] text-[color:var(--ink-mute)] py-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--ink-faint)]">
                  {x.audience}
                </span>
                <div>{x.rule}</div>
              </div>
            ))
          )}
        </Section>

        <Section title="On-site requirements">
          {p.onsite.items.length === 0 ? (
            <div className="text-[12px] text-[color:var(--none)]">◌ none on record</div>
          ) : (
            p.onsite.items.map((x) => (
              <div key={x.rule} className="text-[12px] text-[color:var(--ink-mute)] py-1">
                ▤ {x.rule}
                {p.onsite.digital_ok && (
                  <span className="text-[color:var(--pass)]"> ✓ digital copies accepted</span>
                )}
              </div>
            ))
          )}
        </Section>
      </div>
    </ReferenceChip>
  );
}

// ---------------------------------------------------------------------------
// 5 · Compliance Chips — evaluated by the backend, three fixed groups
// ---------------------------------------------------------------------------

export function FactRows({
  chips,
  icon,
  tone,
  jurName,
  showMeter,
}: {
  chips: Chip[];
  icon: string;
  tone: string;
  jurName: string;
  showMeter?: boolean;
}) {
  return (
    <>
      {chips.map((x) => (
        <div
          key={x.rule}
          className={`flex gap-2 px-3 py-2 mb-1.5 last:mb-0 border-l-2 bg-[color:var(--canvas)] ${tone}`}
        >
          <span aria-hidden className="text-[13px]">
            {icon}
          </span>
          <div>
            <div className="text-[12px] text-[color:var(--ink-on-dark)] leading-snug">
              {x.rule}
              {showMeter && x.meter && (
                <span className="font-mono text-[color:var(--fail)]"> {meterRateLabel(x.meter)}</span>
              )}
            </div>
            <StatusFlag status={x.status} />
            <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-1">
              {jurName.toUpperCase()} · {x.source.doc}
              {x.source.section ? ` §${x.source.section}` : ""}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// (#219 — the PersonnelChip / DeviceMandatesChip family wrappers are
// retired: their FactRows now render inside the ⚠ NEEDS ATTENTION tier
// as obligations, per the ruled mapping.  FactRows itself is exported
// above, byte-preserved.)

function meterWorstCents(m: Chip["meter"]): number {
  if (!m) return 0;
  return m.amount_cents ?? m.amount_cents_max ?? 0;
}

// #219: standing hazard meters are REFERENCE by ruling (they describe
// the jurisdiction, not this plan) — the chip survives whole, nested
// inside the i tier, worst-$ still named in its summary.
export function HazardChip({ jurisdiction }: { jurisdiction: JurisdictionBlock }) {
  const chips = jurisdiction.chips.hazard;
  if (chips.length === 0) return null;
  const worst = chips.reduce(
    (a, b) => (meterWorstCents(b.meter) > meterWorstCents(a.meter) ? b : a),
    chips[0],
  );
  return (
    <ReferenceChip
      glyph="⚠"
      label={`${jurisdiction.name} hazards`}
      sev="hazard"
      summary={
        <>
          <b>{chips.length}</b> hazard{chips.length === 1 ? "" : "s"}
          {worst.meter && (
            <>
              , worst:{" "}
              <span className="font-mono text-[color:var(--fail)]">
                {meterRateLabel(worst.meter)}
              </span>
            </>
          )}
        </>
      }
    >
      <FactRows
        chips={chips}
        icon="⚠"
        tone="border-[color:var(--fail)]"
        jurName={jurisdiction.name}
        showMeter
      />
    </ReferenceChip>
  );
}

// (#219 — the flat JurisdictionSection stack is retired: Zone 3 now
// renders TieredReference, which composes the exported pieces above —
// DeltaRowView, FactRows, HazardChip, WorkHoursCard/HoursVerdictBlock,
// PermitFYI — into the ruled consequence tiers.  JurisdictionControls
// and JurisdictionContextBar, Zone 1's and the top strip's surfaces,
// are untouched.)
