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
  leadNoticeLabel,
  meterRateLabel,
  startNoLaterThan,
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
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 border border-[color:var(--warn)] text-[color:var(--warn)]">
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
        † Two adopted sources disagree — conservative value rendered
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
  conditional: "conditional — surfaced, not auto-applied",
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
// 1 · Context Bar (slate) — jurisdiction picker + street class + chain
// ---------------------------------------------------------------------------

interface ContextBarProps {
  jurisdiction: JurisdictionBlock | null;
  jurisdictionKey: string | null;
  setJurisdictionKey: (k: string | null) => void;
  streetClass: StreetClass | null;
  setStreetClass: (c: StreetClass) => void;
}

const STREET_CLASSES: [StreetClass, string][] = [
  ["local", "Local"],
  ["collector", "Collector"],
  ["arterial", "Arterial"],
];

// Statewide floor shown when no jurisdiction is selected — the mandate
// every jurisdiction chain opens with.
const BASELINE_CHAIN = [
  "MUTCD 11th Ed. + Colorado Supplement",
  "CDOT Standard Specifications §630",
];

export function JurisdictionContextBar({
  jurisdiction,
  jurisdictionKey,
  setJurisdictionKey,
  streetClass,
  setStreetClass,
}: ContextBarProps) {
  const chain = jurisdiction ? jurisdiction.chain : BASELINE_CHAIN;
  return (
    <div className="jbar">
      <div className="jbar-main">
        <div className="jbar-cell">
          <label htmlFor="jl-jurisdiction" className="k">
            Jurisdiction
          </label>
          <select
            id="jl-jurisdiction"
            value={jurisdictionKey ?? ""}
            onChange={(e) => setJurisdictionKey(e.target.value || null)}
          >
            <option value="">None — baseline (MUTCD + CDOT) only</option>
            {JURISDICTION_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {jurisdiction ? (
            <div className="jbar-auth">
              <b>{jurisdiction.name}</b> ·{" "}
              {jurisdiction.authority.replace("_", " & ")} · calls this plan a{" "}
              <span className="term">{jurisdiction.tcp_term}</span>, the ROW{" "}
              <span className="term">{jurisdiction.row_term}</span>
            </div>
          ) : (
            <div className="jbar-auth">
              Statewide baseline — MUTCD + Colorado Supplement only.
            </div>
          )}
        </div>

        <div className="jbar-cell">
          <span className="k">Street classification</span>
          <div
            role="group"
            aria-label="Street classification"
            className="classpick"
          >
            {STREET_CLASSES.map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={streetClass === v}
                onClick={() => setStreetClass(v)}
                className={streetClass === v ? "on" : ""}
              >
                {l}
              </button>
            ))}
          </div>
          {jurisdiction?.class_required &&
            (jurisdiction.classification_map_url ? (
              <span className="mapchip">
                <span aria-hidden>◎ </span>
                <a
                  href={jurisdiction.classification_map_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  per {jurisdiction.name} functional classification map
                </a>
              </span>
            ) : (
              <span className="mapchip">
                ◎ {jurisdiction.name} classifies via its published map — look
                the street up before submitting
              </span>
            ))}
        </div>

        <div className="jbar-cell">
          <span className="k">Governing spec chain</span>
          <div className="chain">
            {chain.map((seg, i) => (
              <span key={seg} className="contents">
                {i > 0 && (
                  <span className="sep" aria-hidden>
                    ›
                  </span>
                )}
                <span
                  className={`seg${i === chain.length - 1 && jurisdiction ? " local" : ""}`}
                >
                  {seg}
                </span>
              </span>
            ))}
          </div>
          {jurisdiction && (
            <span className="chain-note">
              local override rendered last &amp; strongest
            </span>
          )}
        </div>
      </div>

      {/* Reserved Endeavor-B seam: pin-based jurisdiction suggestion +
          boundary warnings land here.  Deliberate inert space — A
          guarantees the slot; B owns the behavior. */}
      <div className="jbar-suggest reserved">
        <span className="tag">reserved</span>
        <span>
          Pin-based jurisdiction suggestion &amp; boundary warnings — Endeavor B
        </span>
      </div>
    </div>
  );
}

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
    if (d.effect.op === "swap_device") return { main: "→ swap", unit: d.effect.device };
    const qty = d.effect.qty ?? 1;
    return { main: `+${qty}`, unit: qty === 1 ? "device" : "devices" };
  }
  return { main: d.severity === "op" ? "method" : "admin" };
}

function DeltaChip({ jurisdiction }: { jurisdiction: JurisdictionBlock }) {
  const deltas = jurisdiction.applied_deltas;
  const countN = deltas.filter((d) => d.severity === "count" && d.status === "fires").length;
  // Density contract: empty families render nothing.  (Fired deltas are
  // still surfaced in the device table regardless — collapsing or
  // omitting this chip hides detail, never the fact.)
  if (deltas.length === 0) return null;
  return (
    <ReferenceChip
      glyph="Δ"
      label={`${jurisdiction.name} deltas`}
      summary={
        <>
          <b>{deltas.length}</b> delta{deltas.length === 1 ? "" : "s"} ·{" "}
          {countN > 0 ? (
            <>
              <b>{countN}</b> affect count
            </>
          ) : (
            "none affect count"
          )}
        </>
      }
    >
        <div>
          <div className="flex gap-5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)] pb-2 mb-1 border-b border-[color:var(--paper-line-soft)]">
            <span>
              <span className="inline-block w-2 h-2 mr-1 bg-[color:var(--dim)]" aria-hidden />
              Changes device count
            </span>
            <span>
              <span className="inline-block w-2 h-2 mr-1 bg-[color:var(--act)]" aria-hidden />
              Rule / method
            </span>
            <span>
              <span className="inline-block w-2 h-2 mr-1 bg-[color:var(--none)]" aria-hidden />
              Administrative
            </span>
          </div>
          {deltas.map((d) => {
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
                    <div className="text-[11px] text-[color:var(--ink-faint)] mt-0.5">
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
          })}
        </div>
    </ReferenceChip>
  );
}

// ---------------------------------------------------------------------------
// 3 · Work-Hours Card — bands from semantic windows; verdict from hours_eval
// ---------------------------------------------------------------------------

interface WorkHoursProps {
  jurisdiction: JurisdictionBlock;
  streetClass: StreetClass | null;
  schedule: WorkScheduleInput | null;
  setSchedule: (s: WorkScheduleInput | null) => void;
}

function WorkHoursCard({ jurisdiction, streetClass, schedule, setSchedule }: WorkHoursProps) {
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

  const sched = schedule ?? { date_mode: "tbd" as const };
  const hoursKnown =
    sched.date_mode !== "tbd" && sched.start_time != null && sched.end_time != null;

  const patch = (p: Partial<WorkScheduleInput>) => setSchedule({ ...sched, ...p });

  // The chip's collapsed verdict is the backend's hours_eval — never
  // recomputed (rule 3).  Auto-expand is reserved for the ONE
  // plan-invalidating state (schedule outside the window).
  const status = hoursEval.status;
  const summary =
    status === "outside" ? (
      <span className="verdict-bad">outside window · review schedule</span>
    ) : status === "inside" ? (
      <span className="verdict-ok">inside window ✓</span>
    ) : (
      <>
        windows shown · <b>not checked</b>
      </>
    );

  return (
    <ReferenceChip
      glyph="◷"
      label={`Work hours — ${jurisdiction.name}`}
      sev={status === "outside" ? "warn" : "info"}
      autoExpand={status === "outside"}
      summary={summary}
      badge={
        hours.conflict ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 border border-[color:var(--warn)] text-[color:var(--warn)] whitespace-nowrap">
            † source conflict
          </span>
        ) : undefined
      }
    >
      <div className="flex gap-2 flex-wrap mb-2 empty:hidden">
        {hours.holiday_rule === "holidays_and_eves_banned" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 border border-[color:var(--warn)] text-[color:var(--warn)]">
            ◐ holiday-eve rule
          </span>
        )}
        {meter && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 bg-[color:var(--dim-soft)] border border-[color:var(--dim)] text-[color:var(--dim)]">
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
          ◌ {jurisdiction.name} publishes no work-hour windows — no restriction
          shown because none is on record, not because none exists.
        </div>
      ) : (
        <div>
          {rows.map((r) => {
            const isActive = active === r;
            return (
              <div
                key={`${r.scope}-${r.days}`}
                className="grid grid-cols-[130px_1fr] gap-2 items-center mb-1"
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
                  {isActive && hoursKnown && (
                    <div
                      aria-hidden
                      className="absolute top-0 bottom-0 border-x-2 border-[color:var(--act)] bg-[color:var(--act-glow)]"
                      style={{
                        left: `${((sched.start_time as number) / 24) * 100}%`,
                        width: `${(((sched.end_time as number) - (sched.start_time as number)) / 24) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-[130px_1fr] gap-2">
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

      {/* Schedule inputs (design deviation: the prototype hosts these in
          the sidebar; they live on the card pending a design pass). */}
      <fieldset className="mt-4 border-t border-[color:var(--paper-line-soft)] pt-3">
        <legend className="sr-only">Work schedule</legend>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] text-[color:var(--ink-faint)]">
            Work date
            <input
              type="date"
              value={sched.work_date ?? ""}
              onChange={(e) =>
                patch({
                  work_date: e.target.value || undefined,
                  date_mode: e.target.value ? "single" : "tbd",
                })
              }
              className="block mt-1 bg-[color:var(--paper-deep)] border border-[color:var(--paper-line)] text-[12px] text-[color:var(--ink)] px-2 py-1 focus:border-[color:var(--act)] outline-none"
            />
          </label>
          <label className="text-[11px] text-[color:var(--ink-faint)]">
            Start
            <input
              type="time"
              value={sched.start_time != null ? toTimeInput(sched.start_time) : ""}
              onChange={(e) => patch({ start_time: fromTimeInput(e.target.value) })}
              className="block mt-1 bg-[color:var(--paper-deep)] border border-[color:var(--paper-line)] text-[12px] text-[color:var(--ink)] px-2 py-1 focus:border-[color:var(--act)] outline-none"
            />
          </label>
          <label className="text-[11px] text-[color:var(--ink-faint)]">
            End
            <input
              type="time"
              value={sched.end_time != null ? toTimeInput(sched.end_time) : ""}
              onChange={(e) => patch({ end_time: fromTimeInput(e.target.value) })}
              className="block mt-1 bg-[color:var(--paper-deep)] border border-[color:var(--paper-line)] text-[12px] text-[color:var(--ink)] px-2 py-1 focus:border-[color:var(--act)] outline-none"
            />
          </label>
        </div>
      </fieldset>

      {/* Plan tie — the verdict comes from the backend hours_eval, never
          recomputed here (rule 3 / rule 10: VERIFYING-style honesty is
          handled upstream by the section's loading state). */}
      <div className="mt-3">
        {hoursEval.status === "unknown" && (
          <div className="text-[12px] text-[color:var(--none)]">
            ◌ {hoursEval.note ?? "Schedule not checked yet"} — set a date and
            start/end times to check them against {jurisdiction.name}&apos;s
            windows.
          </div>
        )}
        {hoursEval.status === "inside" && (
          <div className="text-[12px] text-[color:var(--pass)]">
            ✓ Within the permitted window for this street class.
            {hoursEval.note ? ` (${hoursEval.note})` : ""}
          </div>
        )}
        {hoursEval.status === "outside" && (
          <div className="pl-3 border-l-2 border-[color:var(--warn)]">
            <div className="text-[12px] text-[color:var(--warn)]">
              ⚠ Schedule conflicts with {jurisdiction.name}&apos;s windows:
            </div>
            <ul className="m-0 mt-1 pl-4 text-[12px] text-[color:var(--ink-mute)]">
              {hoursEval.violations.map((v) => (
                <li key={`${v.kind}-${v.window.start}`}>
                  {v.kind === "ban_window_overlap"
                    ? `${v.overlap_hours} h overlaps the ${hhmm(v.window.start)}–${hhmm(v.window.end)} ban (${dayLabel(v.window.days)})`
                    : `${v.outside_hours} h falls outside the ${hhmm(v.window.start)}–${hhmm(v.window.end)} window (${dayLabel(v.window.days)})`}
                </li>
              ))}
            </ul>
            {hoursEval.exposure_estimate_cents != null && (
              <div className="text-[12px] text-[color:var(--warn)] mt-1">
                Metered exposure estimate ≈{" "}
                <span className="font-mono">{dollars(hoursEval.exposure_estimate_cents)}</span>
                {jurisdiction.provisional ? " (provisional schedule)" : ""} — trim the
                schedule to avoid it.
              </div>
            )}
          </div>
        )}
      </div>

      <ConflictFootnote conflict={hours.conflict} />
    </ReferenceChip>
  );
}

function toTimeInput(h: number): string {
  const hr = Math.floor(h);
  const m = Math.round((h - hr) * 60);
  return `${hr.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function fromTimeInput(v: string): number | undefined {
  if (!v) return undefined;
  const [hr, m] = v.split(":").map(Number);
  return hr + m / 60;
}

// ---------------------------------------------------------------------------
// 4 · Permit & Fees FYI — courtesy reference, never a checkout
// ---------------------------------------------------------------------------

function PermitFYI({
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
      label={`Permit — ${jurisdiction.name}`}
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
        Courtesy reference — <b>FYI</b> · fees are never quote line items
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
                )}{" "}
                — {p.tier_reason}
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

function FactRows({
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
          className={`flex gap-2.5 px-3 py-2.5 mb-1.5 last:mb-0 border-l-2 bg-[color:var(--canvas)] ${tone}`}
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
            <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-[color:var(--ink-on-dark-faint)] mt-0.5">
              {jurName.toUpperCase()} · {x.source.doc}
              {x.source.section ? ` §${x.source.section}` : ""}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// Density contract: one chip per compliance family; empty families
// render nothing.  CONDITIONAL rows carry the surfaced-not-auto-applied
// flag (StatusFlag) and never change counts.
function PersonnelChip({ jurisdiction }: { jurisdiction: JurisdictionBlock }) {
  const chips = jurisdiction.chips.personnel;
  if (chips.length === 0) return null;
  const cond = chips.filter((x) => x.status === "conditional").length;
  return (
    <ReferenceChip
      glyph="◈"
      label="Personnel gates"
      summary={
        <>
          <b>{chips.length}</b>
          {cond > 0 && (
            <>
              {" "}
              · <b>{cond}</b> conditional
            </>
          )}
        </>
      }
    >
      <FactRows
        chips={chips}
        icon="◈"
        tone="border-[color:var(--act)]"
        jurName={jurisdiction.name}
      />
    </ReferenceChip>
  );
}

function DeviceMandatesChip({ jurisdiction }: { jurisdiction: JurisdictionBlock }) {
  const chips = jurisdiction.chips.device;
  if (chips.length === 0) return null;
  return (
    <ReferenceChip
      glyph="▮"
      label="Device mandates"
      summary={
        <>
          <b>{chips.length}</b> mandate{chips.length === 1 ? "" : "s"}
        </>
      }
    >
      <FactRows
        chips={chips}
        icon="▮"
        tone="border-[color:var(--dim)]"
        jurName={jurisdiction.name}
      />
    </ReferenceChip>
  );
}

function meterWorstCents(m: Chip["meter"]): number {
  if (!m) return 0;
  return m.amount_cents ?? m.amount_cents_max ?? 0;
}

function HazardChip({ jurisdiction }: { jurisdiction: JurisdictionBlock }) {
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
              {" "}
              — worst:{" "}
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

// ---------------------------------------------------------------------------
// The section — DeltaPanel + WorkHoursCard + (PermitFYI | ComplianceChips)
// ---------------------------------------------------------------------------

interface SectionProps {
  jurisdiction: JurisdictionBlock | null;
  loading: boolean;
  streetClass: StreetClass | null;
  schedule: WorkScheduleInput | null;
  setSchedule: (s: WorkScheduleInput | null) => void;
}

export function JurisdictionSection({
  jurisdiction,
  loading,
  streetClass,
  schedule,
  setSchedule,
}: SectionProps) {
  if (!jurisdiction && !loading) return null;
  return (
    <section className="mt-9" aria-label="Jurisdiction rules">
      <div className="flex items-baseline justify-between mb-1 pb-3 border-b border-[color:var(--rule)]">
        <h2 className="text-[20px] font-bold tracking-[-0.005em] text-white m-0">
          {jurisdiction ? `${jurisdiction.name} — jurisdiction rules` : "Jurisdiction rules"}
        </h2>
        {jurisdiction?.provisional && <ProvisionalBadge label="Contains provisional facts" />}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-on-dark-faint)] mt-0 mb-4">
        informational · sourced corpus · never blocks generation
      </p>

      {loading || !jurisdiction ? (
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-6">
          Loading jurisdiction rules…
        </div>
      ) : (
        /* Density contract: one collapsed summary chip per family; empty
           families render nothing. */
        <div className="ref-stack">
          <DeltaChip jurisdiction={jurisdiction} />
          <PersonnelChip jurisdiction={jurisdiction} />
          <DeviceMandatesChip jurisdiction={jurisdiction} />
          <HazardChip jurisdiction={jurisdiction} />
          <WorkHoursCard
            jurisdiction={jurisdiction}
            streetClass={streetClass}
            schedule={schedule}
            setSchedule={setSchedule}
          />
          <PermitFYI
            jurisdiction={jurisdiction}
            workDate={schedule?.work_date ?? null}
          />
        </div>
      )}
    </section>
  );
}
