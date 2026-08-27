"use client";

// Schedule entry — a first-class Setup step (gen2 inc-8).  The
// design-phase move of schedule inputs onto the jurisdiction hours card
// left pre-generation with no visible way to set a time at all; entry
// now lives here.  The post-generation strip inline-edits the SAME
// scenario.schedule fields, and the Zone 3 hours chip READS them (it no
// longer hosts inputs) — one fact, one home, everywhere in sync.

import {
  activeBandRow,
  dayLabel,
  deriveBandRows,
  hhmm,
  type BandRow,
  type HoursEval,
  type JurisdictionBlock,
} from "@/lib/jurisdiction";
import type { Scenario } from "@/lib/scenarios";
import { ChipRow, Field, FieldGroup, LabelRow } from "./GeneratorFormPrimitives";

type Sched = NonNullable<Scenario["schedule"]>;
type DateMode = Sched["date_mode"];

const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 0.5);

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  step: number;
  /** #222: pre-pin, this kind's steps render pending (dim + inert +
   *  focusable summary) until a location exists. */
  stepsPending?: boolean;
  /** #227: the selected jurisdiction's evaluated block (device-breakdown
   *  response) — the reference block renders its REAL window set.  Null
   *  when none is selected or the block is in flight. */
  jurisdiction?: JurisdictionBlock | null;
}

export function ScheduleField({
  scenario,
  setScenario,
  step,
  stepsPending = false,
  jurisdiction = null,
}: Props) {
  const sched = scenario.schedule ?? null;
  // Untouched scenario: present "Not set" (#199) — the honest default
  // for a schedule nobody entered, matching what the hours card reports.
  // Display-only: nothing is written until the user interacts (the
  // payload stays unchanged).  Pre-fix this presented "Single day" as
  // chosen — an asserted shape under a caption promising that windows
  // and lead times compute from it.
  const mode: DateMode = sched?.date_mode ?? "tbd";

  const patch = (p: Partial<Sched>) =>
    setScenario({
      ...scenario,
      schedule: { date_mode: mode, ...(sched ?? {}), ...p },
    } as Scenario);

  return (
    <FieldGroup label="Schedule" step={step} anchorId="rail-step-schedule" pending={stepsPending}>
      <Field>
        <LabelRow>Work dates</LabelRow>
        <ChipRow<DateMode>
          options={[
            { v: "single", l: "Single day" },
            { v: "range", l: "Date range" },
            { v: "tbd", l: "Not set" },
          ]}
          value={mode}
          onChange={(v) => patch({ date_mode: v })}
        />
      </Field>

      {mode !== "tbd" ? (
        <>
          <Field>
            <LabelRow htmlFor="sched-date">
              {mode === "range" ? "First work day" : "Work date"}
            </LabelRow>
            <input
              id="sched-date"
              type="date"
              className="field-input"
              value={sched?.work_date ?? ""}
              onChange={(e) =>
                patch({ work_date: e.target.value || undefined })
              }
            />
            <div className="tr-prov mt-1.5">
              Jurisdiction work windows &amp; permit lead times compute from
              this
            </div>
          </Field>
          {mode === "range" && (
            <Field>
              <LabelRow htmlFor="sched-date-end">Last work day</LabelRow>
              <input
                id="sched-date-end"
                type="date"
                className="field-input"
                value={sched?.work_date_end ?? ""}
                onChange={(e) =>
                  patch({ work_date_end: e.target.value || undefined })
                }
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <LabelRow htmlFor="sched-start">Start time</LabelRow>
              <select
                id="sched-start"
                className="field-input w-full"
                value={sched?.start_time ?? ""}
                onChange={(e) => {
                  const v =
                    e.target.value === "" ? undefined : +e.target.value;
                  // end == start is rejected at the wire (ambiguous:
                  // zero-length vs 24 h wrap) — clear the end in the same
                  // patch rather than POSTing a value the select can no
                  // longer display (#188's stranded-end bug).
                  patch(
                    v != null && sched?.end_time === v
                      ? { start_time: v, end_time: undefined }
                      : { start_time: v },
                  );
                }}
              >
                <option value="">—</option>
                {HALF_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hhmm(h)}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <LabelRow htmlFor="sched-end">End time</LabelRow>
              <select
                id="sched-end"
                className="field-input w-full"
                value={sched?.end_time ?? ""}
                onChange={(e) =>
                  patch({
                    end_time:
                      e.target.value === "" ? undefined : +e.target.value,
                  })
                }
              >
                <option value="">—</option>
                {/* An end at/before the start wraps past midnight (#188):
                    every half hour stays selectable, labeled "(next day)"
                    when it lands after midnight.  Only end == start is
                    excluded (rejected at the wire as ambiguous). */}
                {HALF_HOURS.filter((h) => h !== sched?.start_time).map((h) => (
                  <option key={h} value={h}>
                    {sched?.start_time != null && h < sched.start_time
                      ? `${hhmm(h)} (next day)`
                      : hhmm(h)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </>
      ) : null}

      {/* #227: the jurisdiction-window reference block — the answer to
          "what happens when I do set dates", rendered at final widths
          so nothing reflows when data lands (PDF p.2).  Real rows from
          the #206 class-scoped window data, never invented (rule 10 —
          the PDF's four rows were the designer's placeholder). */}
      <ScheduleWindowsBlock
        scenario={scenario}
        jurisdiction={jurisdiction}
        scheduleMode={mode}
      />
    </FieldGroup>
  );
}

// One reference row's verdict — PRESENTATION OF ONE BACKEND VERDICT
// (rule 3 mirror, GO ruling 6): ``hours_eval`` is the jurisdiction
// block's evaluated answer; this join only attributes its violations to
// the window rows they name (matched by the day scope the backend
// echoed back) and renders the remaining active-scope rows with the
// verdict's own status.  No client-side time arithmetic anywhere —
// backend authoritative.
function rowVerdict(
  row: BandRow,
  active: BandRow | null,
  hoursEval: HoursEval,
  scheduleChecked: boolean,
): { glyph: string; text: string; tone: string } {
  if (!scheduleChecked || hoursEval.status === "unknown") {
    return {
      glyph: "◌",
      text: "— set dates to check",
      tone: "text-[color:var(--none)]",
    };
  }
  if (row !== active) {
    // The backend evaluates the active street class's scope; other
    // rows stay reference (a fact about scope, not a verdict).
    return {
      glyph: "◌",
      text: "— reference (other street class)",
      tone: "text-[color:var(--none)]",
    };
  }
  if (hoursEval.status === "inside") {
    return { glyph: "✓", text: "clear", tone: "text-[color:var(--pass)]" };
  }
  // outside: the evaluation is for the active scope, so the active row
  // carries it — worded with the backend's own violation facts (day
  // scope picks among multiple; the first stands in otherwise).
  const v =
    hoursEval.violations.find((x) => x.window.days === row.days) ??
    hoursEval.violations[0];
  if (!v) {
    return {
      glyph: "⚠",
      text: "conflicts with the schedule",
      tone: "text-[color:var(--warn)]",
    };
  }
  const text =
    v.kind === "ban_window_overlap"
      ? `${v.overlap_hours} h overlaps the ${hhmm(v.window.start)}–${hhmm(v.window.end)} ban`
      : `${v.outside_hours} h outside the permitted ${(v.windows ?? [v.window])
          .map((w) => `${hhmm(w.start)}–${hhmm(w.end)}`)
          .join(" / ")} ${v.windows && v.windows.length > 1 ? "windows" : "window"}`;
  return { glyph: "⚠", text, tone: "text-[color:var(--warn)]" };
}

function ScheduleWindowsBlock({
  scenario,
  jurisdiction,
  scheduleMode,
}: {
  scenario: Scenario;
  jurisdiction: JurisdictionBlock | null;
  scheduleMode: DateMode;
}) {
  const keyNamed = Boolean(scenario.jurisdiction_key);

  // No jurisdiction selected: one row, a real answer (issue #227 — the
  // PDF couldn't design this state; the ruling wrote it).
  if (!keyNamed) {
    return (
      <div className="sched-windows">
        <div className="sched-window-row">
          <span className="sw-glyph text-[color:var(--none)]" aria-hidden>
            ◌
          </span>
          <span className="text-[11px] text-[color:var(--ink-on-dark-faint)]">
            Select a jurisdiction to see its windows
          </span>
        </div>
      </div>
    );
  }
  if (!jurisdiction) {
    return (
      <div className="sched-windows">
        <div className="sched-window-row">
          <span className="sw-glyph text-[color:var(--none)]" aria-hidden>
            ◌
          </span>
          <span className="text-[11px] text-[color:var(--ink-on-dark-faint)]">
            Loading window data…
          </span>
        </div>
      </div>
    );
  }

  const rows = deriveBandRows(jurisdiction.hours);
  if (jurisdiction.hours.shape === "none" || rows.length === 0) {
    return (
      <div className="sched-windows">
        <div className="sched-window-row">
          <span className="sw-glyph text-[color:var(--none)]" aria-hidden>
            ◌
          </span>
          <span className="text-[11px] text-[color:var(--ink-on-dark-faint)]">
            {jurisdiction.name} publishes no work-hour windows — none on
            record, not none existing
          </span>
        </div>
      </div>
    );
  }

  const active = activeBandRow(rows, scenario.street_class ?? null);
  // "Checked" mirrors the hours card's reading of the SAME schedule
  // fact: a tbd/absent schedule is deliberately unchecked (#199).
  const scheduleChecked = scheduleMode !== "tbd";

  return (
    <div className="sched-windows">
      <div className="tr-step mb-1">{jurisdiction.name} windows</div>
      {rows.map((r) => {
        const v = rowVerdict(r, active, jurisdiction.hours_eval, scheduleChecked);
        return (
          <div key={`${r.scope}-${r.days}`} className="sched-window-row">
            <span className={`sw-glyph ${v.tone}`} aria-hidden>
              {v.glyph}
            </span>
            <span className="text-[11px] text-[color:var(--ink-on-dark)] leading-tight">
              {r.scope}
              <span className="tr-prov"> · {dayLabel(r.days)}</span>
            </span>
            <span className={`text-[11px] ${v.tone} text-right`}>{v.text}</span>
          </div>
        );
      })}
    </div>
  );
}
