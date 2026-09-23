"use client";

// Schedule entry — a first-class Setup step (gen2 inc-8).
//
// #289 hand-check, 2026-09-23, correction 1: the SECTION is gone.  Its
// controls are cells in the WHAT band's second group (bands/PlanDetails)
// and its window block sits under that group, because "the dates
// control" is one of the inputs the 3 × 2 grid does not hold.  What
// moved is the container and the register; the LOGIC is untouched, and
// deliberately so — #199's display-only "Not set" default, #188's
// overnight wrap (every half hour offered, `(next day)` labels, `end ==
// start` excluded as ambiguous at the wire) and the stranded-end clear
// are all behaviours a rewrite would have quietly dropped.  The
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

type Sched = NonNullable<Scenario["schedule"]>;
type DateMode = Sched["date_mode"];

const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 0.5);

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  // #289 correction 1: `step` and `stepsPending` retired with the
  // section.  The band header carries the index (ruling 198's four
  // steps), and the pre-pin gate is the COLUMN's now — the WHAT band
  // does not open before there is a pin, so a per-section pending state
  // has nothing left to describe.
  /** #227: the selected jurisdiction's evaluated block (device-breakdown
   *  response) — the reference block renders its REAL window set.  Null
   *  when none is selected or the block is in flight. */
  jurisdiction?: JurisdictionBlock | null;
  /** #152 D, re-earned for this surface (#289 hand-check 2026-09-23,
   *  correction 2).  True while a breakdown for the SAME jurisdiction is
   *  in flight — the held block is content, which may stay on screen,
   *  but `hours_eval` is a VERDICT, and a verdict for inputs the backend
   *  has not answered yet may not render as current (rule 10).  The
   *  reference panel's own HoursVerdictBlock has taken this flag since
   *  #152 D; pre-generate the window rows are the only surface carrying
   *  the verdict, so they take it too. */
  verifying?: boolean;
}

export function ScheduleField({
  scenario,
  setScenario,
  jurisdiction = null,
  verifying = false,
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
    <>
      {/* Correction 1: three cells in the band's own register, inside the
          second group's grid.  The chips are rule 135's control (44 px,
          `aria-pressed`), so #199's assertions read the same way they
          always have — a default that is DISPLAY-ONLY until the operator
          picks a mode. */}
      <div className="a-cell" data-testid="cell-date-mode">
        <span className="tr-field">Work dates</span>
        <div className="a-chips a-chips-inline" role="group" aria-label="Work dates">
          {[
            { v: "single" as DateMode, l: "Single day" },
            { v: "range" as DateMode, l: "Date range" },
            { v: "tbd" as DateMode, l: "Not set" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              className="a-chip a-chip-flat"
              data-write=""
              aria-pressed={mode === o.v}
              onClick={() => {
                if (mode !== o.v) patch({ date_mode: o.v });
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
        <span className="tr-prov" data-testid="prov-date-mode">
          jurisdiction work windows &amp; permit lead times compute from this
        </span>
      </div>

      {mode !== "tbd" && (
        <>
          <div className="a-cell" data-testid="cell-work-date">
            <label className="tr-field" htmlFor="sched-date">
              {mode === "range" ? "First work day" : "Work date"}
            </label>
            <input
              id="sched-date"
              type="date"
              className="a-fld"
              data-write=""
              value={sched?.work_date ?? ""}
              onChange={(e) => patch({ work_date: e.target.value || undefined })}
            />
            <span className="tr-prov">operator-set · the day the plan is for</span>
          </div>

          {mode === "range" && (
            <div className="a-cell" data-testid="cell-work-date-end">
              <label className="tr-field" htmlFor="sched-date-end">
                Last work day
              </label>
              <input
                id="sched-date-end"
                type="date"
                className="a-fld"
                data-write=""
                value={sched?.work_date_end ?? ""}
                onChange={(e) =>
                  patch({ work_date_end: e.target.value || undefined })
                }
              />
              <span className="tr-prov">operator-set · the range&apos;s last day</span>
            </div>
          )}

          <div className="a-cell" data-testid="cell-start-time">
            <label className="tr-field" htmlFor="sched-start">
              Start time
            </label>
            <select
              id="sched-start"
              className="a-fld"
              data-write=""
              value={sched?.start_time ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? undefined : +e.target.value;
                // #188: end == start is rejected at the wire (ambiguous:
                // zero-length vs 24 h wrap) — clear the end in the same
                // patch rather than POSTing a value the select can no
                // longer display (the stranded-end bug).
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
            <span className="tr-prov">operator-set · local time</span>
          </div>

          <div className="a-cell" data-testid="cell-end-time">
            <label className="tr-field" htmlFor="sched-end">
              End time
            </label>
            <select
              id="sched-end"
              className="a-fld"
              data-write=""
              value={sched?.end_time ?? ""}
              onChange={(e) =>
                patch({
                  end_time:
                    e.target.value === "" ? undefined : +e.target.value,
                })
              }
            >
              <option value="">—</option>
              {/* #188: an end at/before the start wraps past midnight —
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
            <span className="tr-prov">
              crosses midnight when it is earlier than the start
            </span>
          </div>
        </>
      )}
    </>
  );
}

/** #227's window reference block — a reference table, not a field, so it
 *  sits under the second group's grid rather than inside it. */
export function ScheduleWindows({
  scenario,
  jurisdiction = null,
  verifying = false,
}: {
  scenario: Scenario;
  jurisdiction?: JurisdictionBlock | null;
  verifying?: boolean;
}) {
  const mode: DateMode = scenario.schedule?.date_mode ?? "tbd";
  return (
    <ScheduleWindowsBlock
      scenario={scenario}
      jurisdiction={jurisdiction}
      scheduleMode={mode}
      verifying={verifying}
    />
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
  verifying: boolean,
): { glyph: string; text: string; tone: string } {
  // #152 D (correction 2): a refetch is in flight for these inputs, so
  // the last answer is not an answer to THIS question yet.  Chromeless
  // and in a word — never the previous verdict, never a skeleton.
  if (verifying) {
    return {
      glyph: "◌",
      text: "— checking these inputs",
      tone: "text-[color:var(--none)]",
    };
  }
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
  verifying,
}: {
  scenario: Scenario;
  jurisdiction: JurisdictionBlock | null;
  scheduleMode: DateMode;
  verifying: boolean;
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
        const v = rowVerdict(
          r,
          active,
          jurisdiction.hours_eval,
          scheduleChecked,
          verifying,
        );
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
