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

import type { ReactNode } from "react";
import type { Scenario, RoadType } from "@/lib/scenarios";
import { JURISDICTION_OPTIONS, type JurisdictionBlock } from "@/lib/jurisdiction";
import { validateLanes } from "@/lib/scenarios/validation";
import { setLanes, setRoadType, setSpeed } from "@/lib/scenarios/what-writes";
import {
  WHAT_CELLS,
  laneWidthOptions,
  speedOptions,
} from "@/lib/scenarios/what-cells";
import {
  bearingCaveat,
  deriveDetectedRows,
  detectedRow,
  clauseIsAmber,
  type DetectedModel,
  type DetectedRowLabel,
} from "@/lib/road-detection/detected-rows";
import { provenanceClause } from "@/lib/road-detection/provenance";
import { OpenBand } from "./BandPrimitives";
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
 *  prop is required rather than optional. */
function Cell({
  label,
  htmlFor,
  provenance,
  amber = false,
  error = false,
  children,
  testid,
}: {
  label: string;
  htmlFor?: string;
  provenance: string;
  amber?: boolean;
  error?: boolean;
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
      <span
        className={`tr-prov${amber ? " is-amber" : ""}${error ? " is-error" : ""}`}
        data-testid={`prov-${testid}`}
      >
        {/* Rule 138: the amber lives on this line, never on the field's
            border — a guess is not an error. */}
        {amber ? `⚠ ${provenance}` : provenance}
      </span>
    </div>
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

export function WhatBand({
  scenario,
  setScenario,
  jurisdictionBlock,
  jurisdictionLoading,
  jurisdictionErrored,
  stepIndex,
  kindFields,
  scheduleFields,
  jurisdictionSuggest,
  classificationFields,
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
  /** §8.24 — the hours and the permit windows, which the dates cell
   *  summarises but does not replace. */
  scheduleFields?: ReactNode;
  /** #201 — the pin suggestion, inside the jurisdiction cell: proximity
   *  is how a user knows which control a confirm applies to. */
  jurisdictionSuggest?: ReactNode;
  /** §8.21's other half — the street-class field and its own suggestion
   *  slot, which the 3 × 2 grid has no cell for. */
  classificationFields?: ReactNode;
}): ReactNode {
  const locked = useWriteLock();
  const table = WHAT_CELLS[scenario.kind];
  const detected = deriveDetectedRows(scenario);
  const lanesValidation = validateLanes(scenario);

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
          ? "evaluating — the option you picked, not yet confirmed for this plan"
          : "not evaluated — the check did not answer; the option you picked stands";

  const schedule = scenario.schedule ?? null;
  const workDate =
    schedule && schedule.date_mode !== "tbd" ? (schedule.work_date ?? "") : "";

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
          : "nothing detected — every value here is yours"
      }
      question="Anything we got wrong?"
      questionProvenance={
        detected
          ? "Everything here came off the road you confirmed. Change what is wrong; ignore what is right."
          : "No confirmed road at this pin, so nothing was prefilled. Set what the plan needs."
      }
    >
      {/* Rule 116's first row: speed / lanes / lane width. */}
      <div className="a-grid">
        <Cell
          label="Speed limit"
          htmlFor="what-speed"
          provenance={speedClause.text}
          amber={speedClause.amber}
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
      </div>

      {/* Rule 116's second row: road type / jurisdiction / work dates. */}
      <div className="a-grid">
        <Cell
          label="Road type"
          htmlFor="what-road-type"
          provenance={
            table.roadTypeNote
              ? `${roadTypeClause.text} · ${table.roadTypeNote}`
              : roadTypeClause.text
          }
          amber={roadTypeClause.amber}
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

        <Cell
          label="Jurisdiction"
          htmlFor="what-jurisdiction"
          provenance={jurisdictionProv}
          error={jState === "not-evaluated"}
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
            <option value="">Not set — MUTCD + CDOT only</option>
            {JURISDICTION_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {/* The evaluated name, when it differs from the option label —
              so a reader sees what the check actually returned and never
              has to infer it from the picker's wording. */}
          {jState === "evaluated" && jurisdictionValue !== pickedLabel && (
            <span className="tr-prov">evaluated as {jurisdictionValue}</span>
          )}
          {jurisdictionSuggest}
        </Cell>

        <Cell
          label="Work dates"
          htmlFor="what-date"
          provenance={
            workDate
              ? "operator-set · permit lead times read this"
              : "optional · permit lead times need it"
          }
          testid="work-dates"
        >
          <input
            id="what-date"
            type="date"
            className={`a-fld${workDate ? "" : " is-unset"}`}
            data-write=""
            disabled={locked}
            value={workDate}
            onChange={(e) =>
              setScenario({
                ...scenario,
                schedule: {
                  date_mode: "single",
                  ...(schedule ?? {}),
                  work_date: e.target.value,
                },
              } as Scenario)
            }
          />
        </Cell>
      </div>

      {/* §8.23's remainder: the detection facts with no cell of their own.
          "The separate block is gone; nothing it said is gone."  #214's
          caveat is the last line — restyled, never deleted. */}
      {detected && (
        <div className="a-detect" data-testid="what-detection">
          <span className="tr-prov">
            OSM detection · {detected.roadName} · way {detected.wayId} ·{" "}
            {detected.method === "auto_single"
              ? "sole match auto-adopted"
              : "operator pick"}
          </span>
          {detected.rows
            .filter((r) => r.label === "Bearing" || r.label === "Divided" || r.label === "One-way")
            .map((r) => (
              <span
                key={r.label}
                className={`tr-prov${clauseIsAmber(r) ? " is-amber" : ""}`}
                data-testid={`detect-${r.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {r.label} {r.applied ?? "—"} ·{" "}
                {provenanceClause({
                  detectedValue: r.detected,
                  detectedToken: r.detectedToken,
                  appliedToken: r.appliedToken,
                })}
              </span>
            ))}
          <span className="tr-prov" data-testid="bearing-caveat">
            {bearingCaveat(detected.geomDrives)}
          </span>
        </div>
      )}

      {/* §8.21's other half: street classification, with its own
          suggestion slot.  The 3 × 2 grid has no cell for it — rule 116
          fixes the six — so it rides the band below the grid rather than
          being dropped or crammed in. */}
      {classificationFields && (
        <div className="a-kindrow">{classificationFields}</div>
      )}

      {/* §8.24 — the hours and the permit windows (#215, #206, #227),
          in the shape they already have. */}
      {scheduleFields && <div className="a-kindrow">{scheduleFields}</div>}

      {/* R1 — the kind's own fields.  Never behind a disclosure: the
          near-intersection hold is a rail blocker and rule 139 keeps the
          chain visible. */}
      {kindFields && <div className="a-kindrow">{kindFields}</div>}
    </OpenBand>
  );
}
