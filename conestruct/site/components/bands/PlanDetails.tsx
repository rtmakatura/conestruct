"use client";

// #289 hand-check, 2026-09-23, correction 1 — THE SECOND GROUP.
//
// Ryan's words: "WHAT is the 3×2 grid (rules 116, 136–138) plus a second
// group for the inputs the plan needs that the grid does not hold — work
// type, night operation, speed reduction, divided, and the dates control
// — laid out as grid fields with provenance lines, under one sub-header,
// not the old SCHEDULE / ROAD / WORK sections pasted inside the band."
//
// WHAT WAS WRONG, and it was more than layout.  Phase 2 mounted the
// per-kind forms and the schedule inside the band in the shape they
// already had, and recorded that as a deliberate deferral.  The shape
// they already had is the PANEL's register: `.field-input` is
// paper-on-navy with an orange focus ring, `.chip` is orange-on-paper,
// and the band's own register is dark, `--act` cyan, 44 px.  So the
// sections did not merely sit oddly in the column — they were a
// different palette, a different type scale and a different hit-target
// rule inside one band.  They also carried their own section headers
// ("Road", "Work", "Schedule"), which is the panel's vocabulary inside a
// column that counts to four.
//
// WHAT DID NOT MOVE, and why.  The flagger's four recovery confirms
// (#136 single lane, #86 multi-lane, #158 one-way, #173 lane confidence
// — each with its #177 disputed-override record and its #179 untick) and
// the near-intersection's approach set stay in their own components.
// They are BACKEND GATES and their recovery affordances, not plan
// inputs; Ryan's list does not name them; and moving a recovery path is
// how a redesign loses one.  They render below this group, unchanged.
//
// THE WRITES ARE NOT NEW.  Work type and night are plain field sets, as
// they were.  The reduction keeps ShoulderForm's own rule (a reduction
// at or above the posted speed means "no reduction"), and the divided
// toggle keeps its lanes default — the same flip `setRoadType` performs,
// #85's single-sourcing.  Nothing here computes a compliance value
// (rule 3).

import type { ReactNode } from "react";
import type { Scenario, ScenarioKind } from "@/lib/scenarios";
import { PLAN_DETAILS } from "@/lib/scenarios/what-cells";
import { useWriteLock } from "../WriteLock";

/** Does this scenario show the explicit divided toggle?  #85: every road
 *  type but `urban_arterial` derives `divided` from itself, so the
 *  toggle is a cell only where the value is genuinely the operator's. */
export function showsDividedToggle(scenario: Scenario): boolean {
  return (
    PLAN_DETAILS[scenario.kind]?.dividedToggle === true &&
    scenario.roadType === "urban_arterial"
  );
}

/** One cell, in the band's register — the WHAT grid's `Cell` in every
 *  respect that matters (label, control, rule 137's provenance line),
 *  kept local rather than exported across files because the grid's owns
 *  an amber clause and a detection model this group has no use for. */
function Cell({
  label,
  htmlFor,
  provenance,
  line = null,
  children,
  testid,
}: {
  label: string;
  htmlFor?: string;
  provenance: string;
  /** A detection fact about THIS field (fix 3). */
  line?: { key: string; text: string; amber: boolean } | null;
  children: ReactNode;
  testid: string;
}) {
  return (
    <div className="a-cell" data-testid={`cell-${testid}`}>
      {htmlFor ? (
        <label className="tr-field" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="tr-field">{label}</span>
      )}
      {children}
      <span className="tr-prov" data-testid={`prov-${testid}`}>
        {provenance}
      </span>
      {line && (
        <span
          className={`tr-prov${line.amber ? " is-amber" : ""}`}
          data-testid={`detect-${line.key}`}
        >
          {line.amber ? `⚠ ${line.text}` : line.text}
        </span>
      )}
    </div>
  );
}

/** A two-state answer, as chips in the band's own register (rule 135's
 *  control, which is already 44 px and already declares its pressed
 *  state with `aria-pressed`).  A checkbox row would have been the
 *  panel's shape; the column asks questions and offers answers. */
function TwoWay({
  id,
  on,
  off,
  value,
  onChange,
  locked,
}: {
  id: string;
  on: string;
  off: string;
  value: boolean;
  onChange: (next: boolean) => void;
  locked: boolean;
}) {
  return (
    <div className="a-chips a-chips-inline" role="group" aria-label={id}>
      {[
        { v: false, l: off },
        { v: true, l: on },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className="a-chip a-chip-flat"
          data-write=""
          aria-pressed={value === o.v}
          aria-disabled={locked || undefined}
          onClick={() => {
            if (!locked && value !== o.v) onChange(o.v);
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function PlanDetails({
  scenario,
  setScenario,
  scheduleCells,
  windows,
  dividedLine = null,
}: {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  /** #289 hand-check, 2026-09-23, fix 3: "divided under the Divided
   *  control."  Detection's own row for the field, derived by the WHAT
   *  band (one producer) and rendered here, under the control it is
   *  about.  Null when detection has nothing to say, or when there is no
   *  Divided control to sit under — the road-type cell takes it then. */
  dividedLine?: { key: string; text: string; amber: boolean } | null;
  /** The dates control's own cells — ScheduleField's, rendered into this
   *  grid rather than pasted below it as a section. */
  scheduleCells?: ReactNode;
  /** #227's window reference block, which is a reference table and not a
   *  field, so it sits under the grid rather than in it. */
  windows?: ReactNode;
}): ReactNode {
  const locked = useWriteLock();
  const table = PLAN_DETAILS[scenario.kind as ScenarioKind];
  if (!table) return null;

  const set = <K extends keyof Scenario>(key: K, value: Scenario[K]) =>
    setScenario({ ...scenario, [key]: value } as Scenario);

  const wz = "workZoneSpeed" in scenario ? scenario.workZoneSpeed : undefined;
  const delta = wz !== undefined ? scenario.speed - wz : 0;

  return (
    <div className="a-subgroup" data-testid="plan-details">
      <span className="tr-section">The rest of this plan</span>
      <span className="tr-prov">
        inputs the grid has no cell for — every one of them changes the plan
      </span>

      <div className="a-grid">
        <Cell
          label="Work type"
          htmlFor="pd-work-type"
          provenance="your change · operator-set from here on"
          testid="work-type"
        >
          <select
            id="pd-work-type"
            className="a-fld"
            data-write=""
            disabled={locked}
            value={(scenario as { workType: string }).workType}
            onChange={(e) =>
              set("workType" as keyof Scenario, e.target.value as never)
            }
          >
            {table.workTypes.map((w) => (
              <option key={w.v} value={w.v}>
                {w.l}
              </option>
            ))}
          </select>
        </Cell>

        <Cell
          label="Night operation"
          provenance="night work adds retroreflective devices"
          testid="night"
        >
          <TwoWay
            id="Night operation"
            off="Daytime"
            on="Night"
            value={scenario.night}
            onChange={(v) => set("night" as keyof Scenario, v as never)}
            locked={locked}
          />
        </Cell>

        {table.speedReduction && (
          <Cell
            label="Work-zone speed reduction"
            provenance="a lower limit through the zone"
            testid="reduction"
          >
            <TwoWay
              id="Work-zone speed reduction"
              off="No reduction"
              on="Reduced"
              value={wz !== undefined}
              onChange={(v) =>
                // The deleted ShoulderForm's own default, carried whole:
                // the first reduction is 10 mph below the posted speed,
                // with 25 as the floor (components/ShoulderForm.tsx:104
                // at ccef2ee, the commit before it was deleted).
                set(
                  "workZoneSpeed" as keyof Scenario,
                  (v ? Math.max(25, scenario.speed - 10) : undefined) as never,
                )
              }
              locked={locked}
            />
          </Cell>
        )}

        {table.speedReduction && wz !== undefined && (
          <Cell
            label="Work-zone speed limit"
            htmlFor="pd-wz-speed"
            // The deleted ShoulderForm's sentence, carried verbatim
            // (components/ShoulderForm.tsx:132-133 at ccef2ee): the
            // stepped-installation count is S-630-1 Sheet 2 Note 3's,
            // and it is the one number on this surface that cites a
            // sheet, so it keeps its wording exactly.
            provenance={
              delta > 15
                ? `Δ${delta} mph · S-630-1 Sheet 2 Note 3: ${Math.ceil(delta / 15)} stepped sign installations`
                : `Δ${delta} mph · S-630-1 Sheet 2 Note 3: 1 advance sign`
            }
            testid="wz-speed"
          >
            <input
              id="pd-wz-speed"
              type="number"
              className="a-fld"
              data-write=""
              disabled={locked}
              min={20}
              max={scenario.speed}
              value={wz}
              onChange={(e) =>
                set("workZoneSpeed" as keyof Scenario, (+e.target.value || 0) as never)
              }
            />
          </Cell>
        )}

        {showsDividedToggle(scenario) && (
          <Cell
            label="Divided highway"
            provenance="median present · every other road type sets this itself (#85)"
            line={dividedLine}
            testid="divided"
          >
            <TwoWay
              id="Divided highway"
              off="Undivided"
              on="Divided"
              value={Boolean((scenario as { divided?: boolean }).divided)}
              onChange={(v) =>
                // The deleted ShoulderForm's flip, carried whole
                // (components/ShoulderForm.tsx:56-63 at ccef2ee): the
                // divided-ness change drags the lane default with it,
                // exactly as `setRoadType` does.
                setScenario({
                  ...scenario,
                  divided: v,
                  lanes: v ? 2 : 1,
                } as Scenario)
              }
              locked={locked}
            />
          </Cell>
        )}

        {scheduleCells}
      </div>

      {windows}
    </div>
  );
}
