"use client";

// #289 Phase 2 — the WHAT band: the 3 × 2 field grid with per-field
// provenance, and the kind's own fields beneath it.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (d) and R1 · #281 Part 1 §2.3, §8.21-§8.24 · Part 2 rules 61-66, 116,
// 136-138.
//
// WHAT THIS BAND ABSORBS, and where each piece went:
//   §8.21 jurisdiction & classification band → the jurisdiction cell
//   §8.22 per-kind form                      → the grid + the kind row
//   §8.23 detected-vs-applied block          → the provenance lines
//   §8.24 schedule section                   → the work-dates cell, with
//         the hours and the permit windows (#215, #206, #227) mounting
//         below the grid in their existing shape
//
// THE PART THAT IS DEFERRED, AND SAID SO.  The six standard cells are
// rebuilt to rule 116.  The kind's own sections, the schedule body and
// the site conditions mount INSIDE the bands in the shape they already
// have — a `FieldGroup` with its section header — rather than being
// restyled into the band's own register in this ship.  Restyling them is
// presentation with real behaviour underneath it (the flagger's four
// recovery confirms and their #177/#179 override bookkeeping, the
// near-intersection legs, #215's window rows), and moving that behaviour
// and its shape in one commit is how a redesign loses a recovery path.
// They move; they do not change; the restyle is its own commit.
//
// Rule 137 is absolute here: "Every field carries a provenance line under
// it, always, even when the value is operator-set. A field with no
// provenance line is a defect."  Every one of the six has one, and two of
// them (lane width, work dates) carry an operator-set or optional clause
// because detection reports neither.

import { useState, type ReactNode } from "react";
import type { Scenario, ScenarioMeta, RoadType } from "@/lib/scenarios";
import { JURISDICTION_OPTIONS, type JurisdictionBlock } from "@/lib/jurisdiction";
import { validateLanes } from "@/lib/scenarios/validation";
import {
  setLanes,
  setRoadType,
  setSpeed,
  setWorkDates,
} from "@/lib/scenarios/what-writes";
import {
  WHAT_CELLS,
  laneWidthOptions,
  speedOptions,
} from "@/lib/scenarios/what-cells";
import {
  deriveDetectedRows,
  detectedRow,
  clauseIsAmber,
  type DetectedModel,
  type DetectedRowLabel,
} from "@/lib/road-detection/detected-rows";
import { provenanceClause } from "@/lib/road-detection/provenance";
import { handoffNotesByCell } from "./HandoffNotes";
import { PlanDetailCells, showsDividedToggle } from "./PlanDetails";
import type { HandoffEvent } from "@/lib/scenarios/handoff-summary";
import { OpenBand } from "./BandPrimitives";
import { CellAction, FieldCell } from "./FieldCell";
import { markerOf } from "@/lib/scenarios/provenance-marker";
import type { SectionSlot } from "../JurisdictionSection";
import { useWriteLock } from "../WriteLock";

/** The three states ruling 196 gives the jurisdiction field, plus the
 *  in-flight presentation of "not yet evaluated".  Never a skeleton
 *  (rule 14) and never a height change (§8.31's reserve transfers as the
 *  provenance line's own floor, in CSS). */
export type JurisdictionCellState =
  | "unset"
  | "evaluated"
  | "evaluating"
  | "not-evaluated";

export function jurisdictionCellState(opts: {
  key: string | null;
  block: JurisdictionBlock | null;
  loading: boolean;
  errored: boolean;
}): JurisdictionCellState {
  if (!opts.key) return "unset";
  if (opts.block) return "evaluated";
  if (opts.loading) return "evaluating";
  return opts.errored ? "not-evaluated" : "evaluating";
}

/** One cell: label, control, provenance.  The provenance slot is never
 *  empty (rule 137) — a caller with nothing to say is a defect, so the
 *  prop is required rather than optional.
 *
 *  #289 WHAT density (rulings.md, "After the S4 prod run"): ONE
 *  provenance line stays under the field (the suggestion's actionable
 *  line is a `CellAction` row under the grid row); the detection lines, the handoff sentences and anything
 *  else about the field (`detail`) move behind its details toggle
 *  (FieldCell).  Same nodes, same test ids — only the container moved. */
function Cell({
  label,
  htmlFor,
  provenance,
  amber = false,
  error = false,
  notes = [],
  lines = [],
  detail = null,
  record = null,
  children,
  testid,
}: {
  label: string;
  htmlFor?: string;
  provenance: string;
  /** R100: an answered suggestion's record, collapsed into the cell. */
  record?: ReactNode;
  amber?: boolean;
  error?: boolean;
  /** #289 hand-check, correction 3: the picker's handoff sentences for
   *  THIS field.  Each renders as its own ⚠ provenance line under the
   *  field's own — one text node per sentence, which is #198's
   *  byte-identity contract carried across the container change. */
  notes?: string[];
  /** #289 hand-check, 2026-09-23, fix 3: detection facts that describe
   *  THIS field, which used to sit in a loose block under the grid
   *  describing nothing in particular.  Plain provenance lines — a
   *  detected bearing is a fact, not a warning, so it carries no glyph
   *  unless its own clause is amber. */
  lines?: Array<{ key: string; text: string; amber: boolean }>;
  /** Anything else about this field, ahead of its lines and notes. */
  detail?: ReactNode;
  children: ReactNode;
  testid: string;
}) {
  const hasDetail =
    lines.length > 0 || notes.length > 0 || (detail !== null && detail !== undefined);
  return (
    <FieldCell
      label={label}
      htmlFor={htmlFor}
      testid={testid}
      provenance={
        <span
          className={`tr-prov${amber ? " is-amber" : ""}${error ? " is-error" : ""}`}
          data-testid={`prov-${testid}`}
        >
          {/* Rule 138: the amber lives on this line, never on the field's
              border — a guess is not an error. */}
          {amber ? `⚠ ${provenance}` : provenance}
        </span>
      }
      // R98: the line as one quiet marker, the line itself one click
      // away; an error keeps its line in the cell (P3).
      marker={markerOf(provenance, { amber, error })}
      record={record}
      info={
        hasDetail ? (
          <>
            {detail}
            {lines.map((l) => (
              <span
                key={l.key}
                className={`tr-prov${l.amber ? " is-amber" : ""}`}
                data-testid={`detect-${l.key}`}
              >
                {l.amber ? `⚠ ${l.text}` : l.text}
              </span>
            ))}
            {notes.map((n, i) => (
              <span
                key={i}
                className="tr-prov is-amber"
                data-testid={`handoff-${testid}`}
              >
                {/* Rule 13's second channel, and #227's reconciled mark for a
                    value the user did not set: the glyph is its own node so
                    the SENTENCE stays exactly one text node. */}
                <span aria-hidden>⚠ </span>
                {n}
              </span>
            ))}
          </>
        ) : null
      }
    >
      {children}
    </FieldCell>
  );
}

/** The clause for a field detection reports, or the operator-set clause
 *  for one it does not.  One producer (provenance.ts); this only chooses
 *  which row to ask about. */
function clauseFor(
  model: DetectedModel | null,
  label: DetectedRowLabel,
): { text: string; amber: boolean } {
  const row = detectedRow(model, label);
  if (!row) {
    // Rule 137's own example for a field with no detection behind it.
    return { text: "your change · operator-set from here on", amber: false };
  }
  return {
    text: provenanceClause({
      detectedValue: row.detected,
      detectedToken: row.detectedToken,
      appliedToken: row.appliedToken,
    }),
    amber: clauseIsAmber(row),
  };
}

/** R96 A — the two optional title-block fields behind one labelled
 *  disclosure: closed by default, saying what is inside and how many are
 *  not set (P13, P19).  A read, live under the write lock. */
function FileDetails({
  project,
  location,
  children,
}: {
  project: string;
  location?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const unset = [project, location ?? ""].filter((v) => !v).length;
  return (
    <div className="a-filedetails" data-testid="what-file-details">
      <div className="a-filedetails-head">
        <span className="tr-prov">
          File details · Project name, Location description ·{" "}
          {unset > 0 ? `◌ ${unset} not set` : "✓ both set"}
        </span>
        <button
          type="button"
          className="a-lk"
          data-read=""
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "close ‹" : "open ›"}
        </button>
      </div>
      {open && children}
    </div>
  );
}

export function WhatBand({
  scenario,
  setScenario,
  jurisdictionBlock,
  jurisdictionLoading,
  jurisdictionErrored,
  stepIndex,
  kindFields,
  scheduleCells,
  scheduleWindows,
  jurisdictionSuggest,
  classificationFields,
  setMeta,
  handoff = [],
}: {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  jurisdictionBlock: JurisdictionBlock | null;
  jurisdictionLoading: boolean;
  jurisdictionErrored: boolean;
  stepIndex: string;
  /** R1 — the kind's own fields, as a third grid row.  Rendered only for
   *  kinds that have one; `near_intersection`'s carries the
   *  approach-confirm hold, which is a rail blocker, so it is never put
   *  behind a disclosure (rule 139's chain has to stay visible). */
  kindFields?: ReactNode;
  /** Correction 1 — the dates control's cells, rendered INSIDE the
   *  second group's grid (bands/PlanDetails), and its window block under
   *  that grid.  §8.24's "schedule section" is retired: a section
   *  pasted into a band was the thing the hand-check called out. */
  scheduleCells?: ReactNode;
  scheduleWindows?: ReactNode;
  /** #201 — the pin suggestion, inside the jurisdiction cell: proximity
   *  is how a user knows which control a confirm applies to.  #289 WHAT
   *  density: asked for in parts — the action line under the field, the
   *  evidence and the TIGER caveat behind its details toggle. */
  jurisdictionSuggest?: SectionSlot;
  /** §8.21's other half — the street-class field and its own suggestion
   *  slot.
   *
   *  #289 hand-check, 2026-09-23, correction 1: "The street-class
   *  suggestion is the road-type field's own suggestion record (#198
   *  strings byte-identical in the new container)."  So it rides the
   *  ROAD-TYPE cell, exactly as the pin suggestion rides the
   *  jurisdiction cell (#201: a confirm sits beside the control it
   *  applies to) — rather than as a row of its own below the grid,
   *  which is what a band with no cell for it had to do.
   *
   *  The component is unchanged, which is what keeps the strings
   *  byte-identical: `JurisdictionControls` with `omitJurisdictionField`
   *  renders the same chips, the same map chip and the same
   *  `ClassSuggestSlot` it always did.  Only its container moved.
   *
   *  #289 WHAT density (Ryan, 2026-09-24) moves it again: "Street
   *  classification becomes its own cell in the second group, out of the
   *  road-type cell."  Passed on to PlanDetails, which asks for the chips,
   *  the action line and the detail separately. */
  classificationFields?: SectionSlot;
  /** The title-block metadata, as grid cells (see the third row). */
  setMeta: (m: ScenarioMeta) => void;
  /** The picker → form handoff events.  Correction 3 retires their box
   *  in WHERE; the sentences ride the cells they describe. */
  handoff?: HandoffEvent[];
}): ReactNode {
  const locked = useWriteLock();
  const table = WHAT_CELLS[scenario.kind];
  const detected = deriveDetectedRows(scenario);
  const lanesValidation = validateLanes(scenario);
  // Correction 3: which cell each surviving handoff sentence belongs
  // under.  The producer is the one that used to feed the box, so the
  // strings are unchanged (#198).
  const notes = handoffNotesByCell(scenario, handoff);

  // #289 hand-check, 2026-09-23, fix 3: "the four loose provenance lines
  // move under the fields they describe … bearing and the #214 sentence
  // under road type; divided under the Divided control."
  //
  // The rows are `deriveDetectedRows`' own and their clause is
  // `provenanceClause`'s — the same producers the block used, so the
  // words do not change with the container (the same discipline
  // correction 3 applied to the picker's notes).  One-way rides the
  // road-type cell with divided when there is no Divided control to sit
  // under: it is the fact that MAKES a road divided or not in detection,
  // and rule 10 says a fact with no home renders somewhere true rather
  // than nowhere.
  const detectLine = (label: DetectedRowLabel) => {
    const r = detectedRow(detected, label);
    if (!r) return null;
    return {
      key: label.toLowerCase().replace(/\s+/g, "-"),
      text: `${r.label} ${r.applied ?? "—"} · ${provenanceClause({
        detectedValue: r.detected,
        detectedToken: r.detectedToken,
        appliedToken: r.appliedToken,
      })}`,
      amber: clauseIsAmber(r),
    };
  };
  const dividedLine = detectLine("Divided");
  const showsDivided = showsDividedToggle(scenario);
  // #290: the "Bearing" line and #214's caveat retire with the typed
  // bearing (FLOW.md §5a) — the direction is the WHERE band's side now.
  const roadTypeLines = [
    detectLine("One-way"),
    showsDivided ? null : dividedLine,
  ].filter((l): l is { key: string; text: string; amber: boolean } => l !== null);

  const jState = jurisdictionCellState({
    key: scenario.jurisdiction_key ?? null,
    block: jurisdictionBlock,
    loading: jurisdictionLoading,
    errored: jurisdictionErrored,
  });
  // #276, ruled 196: the static option label is what the operator PICKED.
  // It is a legitimate thing to show; what is forbidden is showing it as
  // though the evaluation had returned it.  So the value falls back to
  // the label and the provenance line says which of the two you are
  // looking at.
  const pickedLabel = scenario.jurisdiction_key
    ? (JURISDICTION_OPTIONS.find((o) => o.key === scenario.jurisdiction_key)
        ?.label ?? scenario.jurisdiction_key)
    : "Not set";
  const jurisdictionValue =
    jState === "evaluated" ? (jurisdictionBlock as JurisdictionBlock).name : pickedLabel;
  const jurisdictionProv =
    jState === "unset"
      ? "MUTCD + Colorado Supplement only"
      : jState === "evaluated"
        ? `evaluated · ${(jurisdictionBlock as JurisdictionBlock).authority.replace("_", " & ")} · calls this plan a ${(jurisdictionBlock as JurisdictionBlock).tcp_term}`
        : jState === "evaluating"
          ? "evaluating: the option you picked, not yet confirmed for this plan"
          : "not evaluated: the check didn't answer; the option you picked stands";

  const schedule = scenario.schedule ?? null;
  // Fix 1: the dates ARE the mode, so the cell reads them directly.
  const workDate = schedule?.work_date ?? "";
  const workDateEnd = schedule?.work_date_end ?? "";

  const speedClause = clauseFor(detected, "Speed limit");
  const lanesClause = clauseFor(detected, "Lanes per direction");
  const roadTypeClause = clauseFor(detected, "Road type");

  return (
    <OpenBand
      stepIndex={stepIndex}
      head="WHAT"
      provenance={
        detected
          ? "prefilled from the road · guesses marked"
          : "nothing detected; every value here is yours"
      }
      question="Anything we got wrong?"
      questionProvenance={
        detected
          ? "Everything here came off the road you confirmed. Change what is wrong; ignore what is right."
          : "No confirmed road at this pin, so nothing was prefilled. Set what the plan needs."
      }
    >
      {/* R96 A (R101, mockups/what.html) — TWO GROUPS named for the
          user's question (P20): the road, then the job.  Each is one
          fixed 3-track grid (P4, P6); PlanDetailCells puts the rest of
          each group's inputs into the same grid. */}
      <div className="a-group" data-testid="what-group-road">
      <span className="tr-section a-group-head">The road</span>
      <div className="a-grid">
        <Cell
          label="Speed limit"
          htmlFor="what-speed"
          provenance={speedClause.text}
          amber={speedClause.amber}
          notes={notes["speed"]}
          testid="speed"
        >
          <select
            id="what-speed"
            className="a-fld"
            data-write=""
            disabled={locked}
            value={scenario.speed}
            onChange={(e) => setScenario(setSpeed(scenario, +e.target.value))}
          >
            {speedOptions(scenario.kind).map((s) => (
              <option key={s} value={s}>
                {s} mph
              </option>
            ))}
          </select>
        </Cell>

        {table.lanes ? (
          <Cell
            label="Lanes per direction"
            htmlFor="what-lanes"
            provenance={
              lanesValidation.ok ? lanesClause.text : (lanesValidation.message ?? "")
            }
            amber={lanesValidation.ok && lanesClause.amber}
            error={!lanesValidation.ok}
            notes={notes["lanes"]}
          testid="lanes"
          >
            <select
              id="what-lanes"
              className="a-fld"
              data-write=""
              disabled={locked}
              aria-invalid={!lanesValidation.ok || undefined}
              value={(scenario as { lanes: number }).lanes}
              onChange={(e) => setScenario(setLanes(scenario, +e.target.value))}
            >
              {table.lanes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Cell>
        ) : (
          // #209's read-only-with-reason.  The kind has no lane count;
          // the cell says which count the plan uses and why, rather than
          // vanishing (rule 10, rule 136).
          <Cell
            label="Lanes per direction"
            provenance={table.lanesReason ?? "not taken by this kind"}
            notes={notes["lanes"]}
          testid="lanes"
          >
            <input
              className="a-fld"
              readOnly
              aria-readonly="true"
              data-read=""
              value="1"
              aria-label="Lanes per direction (fixed by this plan kind)"
            />
          </Cell>
        )}

        <Cell
          label="Lane width"
          htmlFor="what-lane-width"
          // Detection never reports a lane WIDTH: the classifier carries
          // `laneWidthFt` as a derived default, not a measurement, and the
          // ledger never had a row for it.  Rule 137's own operator-set
          // clause is the honest line here.
          provenance="your change · operator-set from here on"
          notes={notes["lane-width"]}
          testid="lane-width"
        >
          <select
            id="what-lane-width"
            className="a-fld"
            data-write=""
            disabled={locked}
            value={(scenario as { laneWidth: number }).laneWidth}
            onChange={(e) =>
              setScenario({
                ...scenario,
                laneWidth: +e.target.value,
              } as Scenario)
            }
          >
            {laneWidthOptions(scenario.kind).map((w) => (
              <option key={w} value={w}>
                {w} ft
              </option>
            ))}
          </select>
        </Cell>
        <Cell
          label="Road type"
          htmlFor="what-road-type"
          // WHAT density: one provenance line — source · value · method.
          // The kind's case note (e.g. "CDOT Cases 18/19 …") is detail.
          provenance={roadTypeClause.text}
          amber={roadTypeClause.amber}
          notes={notes["road-type"]}
          lines={roadTypeLines}
          detail={
            table.roadTypeNote ? (
              <span className="tr-prov" data-testid="road-type-note">
                {table.roadTypeNote}
              </span>
            ) : null
          }
          testid="road-type"
        >
          <select
            id="what-road-type"
            className="a-fld"
            data-write=""
            disabled={locked}
            value={scenario.roadType as string}
            onChange={(e) =>
              setScenario(setRoadType(scenario, e.target.value as RoadType))
            }
          >
            {table.roadTypes.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
        </Cell>
        <PlanDetailCells
          group="road"
          scenario={scenario}
          setScenario={setScenario}
          dividedLine={showsDivided ? dividedLine : null}
          streetClass={classificationFields}
        />
      </div>
      </div>

      <div className="a-group" data-testid="what-group-job">
      <span className="tr-section a-group-head">The job</span>
      <div className="a-grid">
        <PlanDetailCells group="job" scenario={scenario} setScenario={setScenario} />

        <Cell
          label="Jurisdiction"
          htmlFor="what-jurisdiction"
          provenance={jurisdictionProv}
          error={jState === "not-evaluated"}
          record={jurisdictionSuggest?.("record")}
          detail={
            jurisdictionSuggest ||
            (jState === "evaluated" && jurisdictionValue !== pickedLabel) ? (
              <>
                {/* The evaluated name, when it differs from the option
                    label — so a reader sees what the check actually
                    returned and never has to infer it from the picker's
                    wording. */}
                {jState === "evaluated" && jurisdictionValue !== pickedLabel && (
                  <span className="tr-prov">evaluated as {jurisdictionValue}</span>
                )}
                {jurisdictionSuggest?.("detail")}
              </>
            ) : null
          }
          testid="jurisdiction"
        >
          <select
            id="what-jurisdiction"
            className={`a-fld${jState === "unset" ? " is-unset" : ""}`}
            data-write=""
            data-jurisdiction-state={jState}
            disabled={locked}
            value={scenario.jurisdiction_key ?? ""}
            onChange={(e) =>
              setScenario({
                ...scenario,
                jurisdiction_key: e.target.value || null,
              } as Scenario)
            }
          >
            {/* #260 / #257: "Not set" is the one word every surface uses
                for an unset jurisdiction. */}
            <option value="">Not set: MUTCD + CDOT only</option>
            {JURISDICTION_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Cell>

        {/* #289 hand-check, 2026-09-23, fix 1: ONE control for one
            answer.  The mode chips are gone and the mode is derived from
            the dates (lib/scenarios/what-writes.ts:setWorkDates) — a
            schedule nobody entered reads "Not set" because there is no
            date, which is #199's point stated by the field itself rather
            than by a chip beside it.  The end date appears once a start
            stands, because a range with no beginning is not a range. */}
        <Cell
          label="Work dates"
          htmlFor="what-date"
          provenance={
            workDate
              ? workDateEnd
                ? "operator-set · a range · permit lead times read this"
                : "operator-set · one day · permit lead times read this"
              : "not set · windows and permit lead times need a date"
          }
          testid="work-dates"
        >
          <input
            id="what-date"
            type="date"
            className={`a-fld${workDate ? "" : " is-unset"}`}
            data-write=""
            disabled={locked}
            aria-label="Work date, or the first day of a range"
            value={workDate}
            onChange={(e) =>
              setScenario(setWorkDates(scenario, { start: e.target.value }))
            }
          />
          {workDate && (
            <input
              id="what-date-end"
              type="date"
              className={`a-fld${workDateEnd ? "" : " is-unset"}`}
              data-write=""
              disabled={locked}
              aria-label="Last work day, for a range"
              min={workDate}
              value={workDateEnd}
              onChange={(e) =>
                setScenario(setWorkDates(scenario, { end: e.target.value }))
              }
            />
          )}
        </Cell>
        {/* The dates' time cells (ScheduleField), once a date stands. */}
        {scheduleCells}
        {/* The jurisdiction suggestion still WAITING, spanning the band
            under the row (rulings.md, "The suggestion row spans the
            band"); answered, it is the cell's record (R100). */}
        {jurisdictionSuggest && (
          <CellAction label="Jurisdiction" testid="jurisdiction">
            {jurisdictionSuggest("action")}
          </CellAction>
        )}
      </div>
      {/* #227's window reference block: a table, not a field, so it sits
          under the group's grid rather than in it (a cell would grow one
          row per window and break the shared row height, P6). */}
      {scheduleWindows}
      </div>

      {/* THE TITLE-BLOCK FIELDS (#289 correction 2: they survive because
          the deliverables print them) — R96 A: behind "File details", a
          disclosure that says what it holds and how many are unset
          (P13).  Optional, so not in the way of the job. */}
      <FileDetails project={scenario.meta.project} location={scenario.meta.locationDescription}>
      <div className="a-grid">
        <Cell
          label="Project name"
          htmlFor="what-project"
          provenance="operator-set · names the file and the title block"
          testid="project"
        >
          <input
            id="what-project"
            className={`a-fld${scenario.meta.project ? "" : " is-unset"}`}
            data-write=""
            disabled={locked}
            placeholder="Not set"
            value={scenario.meta.project}
            onChange={(e) =>
              setMeta({ ...scenario.meta, project: e.target.value })
            }
          />
        </Cell>
        <Cell
          label="Location description"
          htmlFor="what-location-description"
          provenance={
            scenario.meta.locationDescription
              ? "operator-set · the title block's LOCATION row"
              : // Rule 10: the fallback is real and the surface says so
                // rather than leaving an empty field to be read as a gap.
                "optional · the address stands in when this is empty"
          }
          testid="location-description"
        >
          <input
            id="what-location-description"
            className={`a-fld${scenario.meta.locationDescription ? "" : " is-unset"}`}
            data-write=""
            disabled={locked}
            placeholder="Not set"
            value={scenario.meta.locationDescription ?? ""}
            onChange={(e) =>
              setMeta({
                ...scenario.meta,
                locationDescription: e.target.value,
              })
            }
          />
        </Cell>
      </div>
      </FileDetails>

      {/* #289 hand-check, 2026-09-23, fix 3: §8.23's remainder — the
          loose detection block — is GONE.  Every line it carried is now
          under the field it describes: the source and way id on the
          WHERE band's provenance (lib/scenarios/band-facts.ts), bearing,
          one-way and #214's caveat on the road-type cell, and divided on
          the Divided control when there is one.  "The separate block is
          gone; nothing it said is gone" — this is the second half of
          that sentence finally landing. */}
      {/* R1 — the kind's own fields.  Never behind a disclosure: the
          near-intersection hold is a rail blocker and rule 139 keeps the
          chain visible. */}
      {kindFields && <div className="a-kindrow">{kindFields}</div>}
    </OpenBand>
  );
}
