"use client";

// #289 Phase 2 → R107 (setup-what-redesign, 2026-10-07) — the WHAT band.
//
// Authority: validation-artifacts/committed/setup-what-redesign/rulings.md
// and design-refs/WhatC5.dc.html (the layout Ryan picked).
//   R107: "Step 2 (WHAT) becomes the two-column layout in WhatC5.dc.html:
//         The road on the left, The job on the right, and the label (with
//         its marker under it) beside each control.  Every control is
//         44 px tall."
//   R108: "No confirm step for guesses.  Street class (from the road) and
//         jurisdiction (from the pin) are prefilled like Road type already
//         is, each marked '⚠ from the road' / '⚠ from the pin' ... The
//         header reads 'N guesses marked ⚠ · change any that are wrong',
//         with N counted from the actual guesses."
//   R110 Q5: "Nothing guessed: the header reads 'prefilled from the road'."
//   R110 Q7: "Two markers in the Lanes row (lanes measured; lane width its
//         own source)."
//
// What stands from #289 and R96 A, unchanged: rule 137 as amended by R98
// (every field's provenance line, as a marker with the full line one
// click away), #198's byte-identical handoff sentences under the fields
// they describe, ruling 196's jurisdiction states, the kind's own fields
// below the band (rule 139's chain stays visible), and FileDetails (R96 A).
//
// THE COUNT.  N is the number of ⚠ markers the band actually shows — the
// two guesses when untouched, and any road value detection only inferred
// (road type, speed, lanes).  It is computed from the same lines the rows
// render, through the same `markerOf`, so the header can never count a
// marker the rows do not show (P2).

import { useState, type ReactNode } from "react";
import type { Scenario, ScenarioMeta, RoadType } from "@/lib/scenarios";
import { JURISDICTION_OPTIONS, type JurisdictionBlock } from "@/lib/jurisdiction";
import { validateLanes } from "@/lib/scenarios/validation";
import {
  setLaneWidth,
  setLanes,
  setRoadType,
  setSpeed,
  setWorkDates,
  takeSpeedEstimate,
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
import {
  isGuessed,
  isOperatorSet,
  setJurisdictionByOperator,
  speedEstimateOffer,
} from "@/lib/scenarios/guesses";
import { handoffNotesByCell } from "./HandoffNotes";
import { PlanDetailCells, showsDividedToggle, streetClassProvenance } from "./PlanDetails";
import type { HandoffEvent } from "@/lib/scenarios/handoff-summary";
import { OpenBand } from "./BandPrimitives";
import { FieldCell, type ExtraMarker } from "./FieldCell";
import { markerOf } from "@/lib/scenarios/provenance-marker";
import {
  JurisdictionEvidence,
  JurisdictionWarnings,
  type JurisdictionLookup,
} from "../JurisdictionSection";
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

/** A second field's line in the same row (R110 Q7). */
interface ExtraLine {
  label: string;
  provenance: string;
  amber?: boolean;
  testid: string;
}

/** One row: label and marker, control, and the popover (FieldCell).  The
 *  provenance slot is never empty (rule 137) — a caller with nothing to
 *  say is a defect, so the prop is required rather than optional. */
function Cell({
  label,
  htmlFor,
  provenance,
  amber = false,
  error = false,
  notes = [],
  lines = [],
  detail = null,
  alert = null,
  extra = null,
  children,
  testid,
}: {
  label: string;
  htmlFor?: string;
  provenance: string;
  amber?: boolean;
  error?: boolean;
  /** #289 hand-check, correction 3: the picker's handoff sentences for
   *  THIS field.  Each renders as its own ⚠ line in the field's details —
   *  one text node per sentence, #198's byte-identity contract. */
  notes?: string[];
  /** #289 hand-check, fix 3: detection facts that describe THIS field. */
  lines?: Array<{ key: string; text: string; amber: boolean }>;
  /** Anything else about this field, ahead of its lines and notes. */
  detail?: ReactNode;
  /** On show under the control whatever the marker says (P3). */
  alert?: ReactNode;
  /** R110 Q7: a second control's line and marker in the same row. */
  extra?: ExtraLine | null;
  children: ReactNode;
  testid: string;
}) {
  const extraMarker = extra ? markerOf(extra.provenance, { amber: extra.amber }) : null;
  const extraMarkers: ExtraMarker[] =
    extra && extraMarker ? [{ marker: extraMarker, label: extra.label, testid: extra.testid }] : [];
  const hasDetail =
    extra !== null ||
    lines.length > 0 ||
    notes.length > 0 ||
    (detail !== null && detail !== undefined);
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
      // away; an error keeps its line under the control (P3).
      marker={markerOf(provenance, { amber, error })}
      extraMarkers={extraMarkers}
      alert={alert}
      info={
        hasDetail ? (
          <>
            {extra && (
              <span
                className={`tr-prov${extra.amber ? " is-amber" : ""}`}
                data-testid={`prov-${extra.testid}`}
              >
                {extra.amber ? `⚠ ${extra.provenance}` : extra.provenance}
              </span>
            )}
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

/** R108's header.  N > 0: "N guesses marked ⚠ · change any that are
 *  wrong"; nothing guessed off a road: R110 Q5's "prefilled from the
 *  road"; nothing detected at all: the band's own honest line. */
export function whatHeader(guesses: number, detected: boolean): string {
  if (guesses > 0) {
    return `${guesses} ${guesses === 1 ? "guess" : "guesses"} marked ⚠ · change any that are wrong`;
  }
  return detected ? "prefilled from the road" : "nothing detected; every value here is yours";
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
  jurisdictionLookup = { status: "idle", data: null },
  stepIndex,
  kindFields,
  scheduleCells,
  scheduleWindows,
  setMeta,
  handoff = [],
}: {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  jurisdictionBlock: JurisdictionBlock | null;
  jurisdictionLoading: boolean;
  jurisdictionErrored: boolean;
  /** R108: the pin's boundary lookup — the jurisdiction row's evidence
   *  and warnings.  The guess itself is already the scenario's value. */
  jurisdictionLookup?: JurisdictionLookup;
  stepIndex: string;
  /** R1 — the kind's own fields, below the band.  `near_intersection`'s
   *  carries the approach-confirm hold, which is a rail blocker, so it is
   *  never put behind a disclosure (rule 139's chain has to stay
   *  visible). */
  kindFields?: ReactNode;
  /** Correction 1 — the dates control's time rows, in "The job" under
   *  the work dates, and its window block under the columns. */
  scheduleCells?: ReactNode;
  scheduleWindows?: ReactNode;
  /** The title-block metadata (FileDetails). */
  setMeta: (m: ScenarioMeta) => void;
  /** The picker → form handoff events; the sentences ride the rows they
   *  describe (correction 3). */
  handoff?: HandoffEvent[];
}): ReactNode {
  const locked = useWriteLock();
  const table = WHAT_CELLS[scenario.kind];
  const detected = deriveDetectedRows(scenario);
  const lanesValidation = validateLanes(scenario);
  // Correction 3: which row each surviving handoff sentence belongs
  // under.  The producer is the one that used to feed the box, so the
  // strings are unchanged (#198).
  const notes = handoffNotesByCell(scenario, handoff);

  // #289 hand-check, fix 3: detection facts move under the fields they
  // describe — one-way (and divided, when there is no Divided control)
  // under road type; divided under the Divided control.
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
  // #276, ruled 196: the static option label is what the operator (or the
  // pin) PICKED; the provenance line says which of the two you are looking
  // at and whether the evaluation has answered.
  const pickedLabel = scenario.jurisdiction_key
    ? (JURISDICTION_OPTIONS.find((o) => o.key === scenario.jurisdiction_key)
        ?.label ?? scenario.jurisdiction_key)
    : "Not set";
  const jurisdictionValue =
    jState === "evaluated" ? (jurisdictionBlock as JurisdictionBlock).name : pickedLabel;
  const evaluatedLine =
    jState === "evaluated"
      ? `evaluated · ${(jurisdictionBlock as JurisdictionBlock).authority.replace("_", " & ")} · calls this plan a ${(jurisdictionBlock as JurisdictionBlock).tcp_term}`
      : null;
  const jurisdictionGuessed = isGuessed(scenario, "jurisdiction_key");
  // R108: an untouched pin guess reads as one — its own line, "⚠ from the
  // pin" — unless the evaluation failed, which needs the operator now and
  // keeps its error line (P3).  The evaluation's sentence moves to the
  // row's details then, so nothing it said is lost.
  const jurisdictionProv =
    jState === "not-evaluated"
      ? "not evaluated: the check didn't answer; the option you picked stands"
      : jurisdictionGuessed
        ? "guessed, not confirmed · from the pin"
        : jState === "unset"
          ? jurisdictionLookup.status === "loading"
            ? "checking the pin's boundary data"
            : "MUTCD + Colorado Supplement only"
          : jState === "evaluated"
            ? (evaluatedLine as string)
            : "evaluating: the option you picked, not yet confirmed for this plan";
  const jurisdictionAmber = jurisdictionGuessed && jState !== "not-evaluated";

  const schedule = scenario.schedule ?? null;
  // Fix 1: the dates ARE the mode, so the row reads them directly.
  const workDate = schedule?.work_date ?? "";
  const workDateEnd = schedule?.work_date_end ?? "";

  // R123 Q2 (#301): the road-class estimate for a road with no posted
  // speed, offered on the row with "Use N mph" until the operator takes it.
  // Nothing is prefilled; the click is the record (`speed_estimate`).
  const speedOffer = speedEstimateOffer(scenario);
  const speedTaken = Boolean(scenario.speed_estimate) && speedOffer !== null;
  const speedClause = speedTaken
    ? {
        text: `your change · the road-class estimate (highway=${speedOffer?.highwayClass}); the road has no posted speed`,
        amber: false,
      }
    : clauseFor(detected, "Speed limit");
  const lanesClause = clauseFor(detected, "Lanes per direction");
  const roadTypeClause = clauseFor(detected, "Road type");
  // R110 Q7: lane width's own source.  Detection never measures a width
  // (the classifier carries `laneWidthFt` as the kind's standard lane, not
  // a measurement); the plan starts from that default until the operator
  // picks one.
  const laneWidthProv = isOperatorSet(scenario, "laneWidth")
    ? "your change · operator-set from here on"
    : "default · the plan's standard lane; detection doesn't measure width";
  const classProv = streetClassProvenance(scenario);

  // R108's N: the ⚠ markers on show, from the rows' own lines.
  const warnMarkers = [
    markerOf(speedClause.text, { amber: speedClause.amber }),
    table.lanes && lanesValidation.ok
      ? markerOf(lanesClause.text, { amber: lanesClause.amber })
      : null,
    markerOf(roadTypeClause.text, { amber: roadTypeClause.amber }),
    markerOf(classProv.text, { amber: classProv.amber }),
    markerOf(jurisdictionProv, { amber: jurisdictionAmber, error: jState === "not-evaluated" }),
  ].filter((m) => m?.glyph === "⚠").length;

  return (
    <OpenBand
      stepIndex={stepIndex}
      head="WHAT"
      provenance={whatHeader(warnMarkers, detected !== null)}
      question="Anything we got wrong?"
      questionProvenance={
        detected
          ? "Everything here came off the road you confirmed. Change what is wrong; ignore what is right."
          : "No confirmed road at this pin, so nothing was prefilled. Set what the plan needs."
      }
    >
      {/* R107 (WhatC5.dc.html) — TWO COLUMNS named for the user's
          question (P20): the road on the left, the job on the right; each
          row is the label with its marker under it, beside a 44 px
          control (P4, P6). */}
      <div className="a-cols">
        <div className="a-col" data-testid="what-group-road">
          <span className="tr-section a-group-head">The road</span>
          <Cell
            label="Speed limit"
            htmlFor="what-speed"
            provenance={speedClause.text}
            amber={speedClause.amber}
            notes={notes["speed"]}
            testid="speed"
            alert={
              speedOffer && !speedTaken ? (
                <span className="tr-prov is-amber warnrow" data-testid="speed-estimate">
                  <span aria-hidden>⚠ </span>
                  no posted speed on this road · its class suggests {speedOffer.mph} mph{" "}
                  <button
                    type="button"
                    className="act-btn"
                    data-write=""
                    aria-disabled={locked || undefined}
                    onClick={() => {
                      if (!locked) setScenario(takeSpeedEstimate(scenario));
                    }}
                    data-testid="speed-estimate-use"
                  >
                    Use {speedOffer.mph} mph
                  </button>
                </span>
              ) : null
            }
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

          {/* R110 Q7: one row, two controls, two markers — the lane count
              as detection reports it, the width from its own source. */}
          <Cell
            label="Lanes"
            htmlFor={table.lanes ? "what-lanes" : "what-lane-width"}
            provenance={
              table.lanes
                ? lanesValidation.ok
                  ? lanesClause.text
                  : (lanesValidation.message ?? "")
                : (table.lanesReason ?? "not taken by this kind")
            }
            amber={Boolean(table.lanes) && lanesValidation.ok && lanesClause.amber}
            error={Boolean(table.lanes) && !lanesValidation.ok}
            notes={[...(notes["lanes"] ?? []), ...(notes["lane-width"] ?? [])]}
            extra={{ label: "Lane width", provenance: laneWidthProv, testid: "lane-width" }}
            testid="lanes"
          >
            <div className="a-pair">
              {table.lanes ? (
                <select
                  id="what-lanes"
                  className="a-fld"
                  data-write=""
                  disabled={locked}
                  aria-label="Lanes per direction"
                  aria-invalid={!lanesValidation.ok || undefined}
                  value={(scenario as { lanes: number }).lanes}
                  onChange={(e) => setScenario(setLanes(scenario, +e.target.value))}
                >
                  {table.lanes.map((n) => (
                    <option key={n} value={n}>
                      {n} per side
                    </option>
                  ))}
                </select>
              ) : (
                // #209's read-only-with-reason: the kind has no lane
                // count; the row says which count the plan uses and why,
                // rather than vanishing (rule 10, rule 136).
                <input
                  className="a-fld"
                  readOnly
                  aria-readonly="true"
                  data-read=""
                  value="1 per side"
                  aria-label="Lanes per direction (fixed by this plan kind)"
                />
              )}
              <select
                id="what-lane-width"
                className="a-fld"
                data-write=""
                disabled={locked}
                aria-label="Lane width"
                value={(scenario as { laneWidth: number }).laneWidth}
                onChange={(e) => setScenario(setLaneWidth(scenario, +e.target.value))}
              >
                {laneWidthOptions(scenario.kind).map((w) => (
                  <option key={w} value={w}>
                    {w} ft
                  </option>
                ))}
              </select>
            </div>
          </Cell>

          <Cell
            label="Road type"
            htmlFor="what-road-type"
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
            jurisdictionBlock={jurisdictionBlock}
          />
        </div>

        <div className="a-col" data-testid="what-group-job">
          <span className="tr-section a-group-head">The job</span>
          <PlanDetailCells group="job" scenario={scenario} setScenario={setScenario} />

          <Cell
            label="Jurisdiction"
            htmlFor="what-jurisdiction"
            provenance={jurisdictionProv}
            amber={jurisdictionAmber}
            error={jState === "not-evaluated"}
            alert={<JurisdictionWarnings lookup={jurisdictionLookup} />}
            detail={
              <>
                {/* The evaluation's own sentence, when the row's line is
                    the guess's; and the evaluated name, when it differs
                    from the option label, so a reader sees what the check
                    actually returned. */}
                {jurisdictionGuessed && evaluatedLine && (
                  <span className="tr-prov">{evaluatedLine}</span>
                )}
                {jState === "evaluated" && jurisdictionValue !== pickedLabel && (
                  <span className="tr-prov">evaluated as {jurisdictionValue}</span>
                )}
                <JurisdictionEvidence lookup={jurisdictionLookup} />
              </>
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
                // R108: the operator's pick, a guess replaced included;
                // never overwritten by a later pin answer (R110 Q4).
                setScenario(setJurisdictionByOperator(scenario, e.target.value || null))
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

          {/* #289 hand-check, fix 1: ONE control for one answer — the mode
              derives from the dates (what-writes.ts `setWorkDates`); the
              end date appears once a start stands. */}
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
          {/* The dates' time rows (ScheduleField), once a date stands. */}
          {scheduleCells}
        </div>
      </div>
      {/* #227's window reference block: a table, not a field, so it sits
          under the columns rather than in one. */}
      {scheduleWindows}

      {/* THE TITLE-BLOCK FIELDS (#289 correction 2: they survive because
          the deliverables print them) — R96 A: behind "File details". */}
      <FileDetails project={scenario.meta.project} location={scenario.meta.locationDescription}>
        <div className="a-cols">
          <div className="a-col">
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
          </div>
          <div className="a-col">
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
        </div>
      </FileDetails>

      {/* R1 — the kind's own fields.  Never behind a disclosure: the
          near-intersection hold is a rail blocker and rule 139 keeps the
          chain visible. */}
      {kindFields && <div className="a-kindrow">{kindFields}</div>}
    </OpenBand>
  );
}
