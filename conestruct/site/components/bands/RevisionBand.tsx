"use client";

// #289 Phase 2, S7 — the re-opened field.
//
// Rule 190: "CHANGE ONE THING re-opens ONE field, in place, with its
// consequence shown."  So S7 is not the band stack with a panel bolted
// under it — it is one field and its consequence.  The column's other
// three bands are not the question being asked, and rendering them would
// be the panel-era answer to a question the design already answered.
//
// WHAT IS WRITTEN HERE: nothing.  §1.1 — "nothing is written until
// APPLY".  The editor stages into the shell's one staged list (ruling e)
// and fires a preview, which is a read; the scenario changes at APPLY
// and at no other moment.  That is what makes Escape free.
//
// THE COMMIT RULE (rule 95.2): a preview fires on blur or Enter, never
// per keystroke.  A SELECT has no such window — choosing an option IS
// the commit, and there is no intermediate state to protect — so the
// select commits on change and the typed field commits on blur/Enter.
// Stated because it is a judgement about the rule's intent rather than
// its letter: the rule exists to stop a request per keystroke, and a
// select cannot produce one.

import type { ReactNode } from "react";
import type { Scenario } from "@/lib/scenarios";
import type { StagedFieldKey } from "@/lib/scenarios/types";
import type { SetupSegmentKey } from "@/lib/scenarios/band-facts";
import { roadTypeLabel } from "@/lib/scenarios/band-facts";
import { JURISDICTION_OPTIONS } from "@/lib/jurisdiction";
import {
  WHAT_CELLS,
  laneWidthOptions,
  speedOptions,
} from "@/lib/scenarios/what-cells";
import { OpenBand } from "./BandPrimitives";

/** #289 hand-check, 2026-09-23, defect 2 — which setup-line values open
 *  S7, and on which staged field.  The rest (kind, location, extent,
 *  dates) have no staged writer and open their band in the column
 *  instead; rulings.md, "D2", records that as a flagged deviation. */
export const STAGED_FIELD_OF: Partial<Record<SetupSegmentKey, StagedFieldKey>> = {
  speed: "speed",
  lanes: "lanes",
  laneWidth: "laneWidth",
  roadType: "roadType",
  jurisdiction: "jurisdiction_key",
};

/** The value the plan on screen has for a staged field — the "was" of
 *  the staged record and the editor's value before anything is staged.
 *  Read by `in`, because lanes and lane width are per-kind fields. */
export function fieldCurrentValue(
  scenario: Scenario,
  field: StagedFieldKey,
): string | number | undefined {
  switch (field) {
    case "speed":
      return scenario.speed;
    case "lanes":
      return "lanes" in scenario ? (scenario.lanes as number) : undefined;
    case "laneWidth":
      return "laneWidth" in scenario
        ? (scenario.laneWidth as number)
        : undefined;
    case "roadType":
      return scenario.roadType as string;
    case "jurisdiction_key":
      return scenario.jurisdiction_key ?? "";
  }
}

/** The editor's options, from the SAME tables the WHAT grid's cells
 *  read (what-cells.ts, JURISDICTION_OPTIONS), so the revision can never
 *  offer a value the grid would not. */
function fieldOptions(
  scenario: Scenario,
  field: StagedFieldKey,
): Array<{ v: string | number; l: string }> {
  switch (field) {
    case "speed":
      return speedOptions(scenario.kind).map((s) => ({ v: s, l: `${s} mph` }));
    case "lanes":
      return (WHAT_CELLS[scenario.kind].lanes ?? []).map((n) => ({
        v: n,
        l: String(n),
      }));
    case "laneWidth":
      return laneWidthOptions(scenario.kind).map((w) => ({ v: w, l: `${w} ft` }));
    case "roadType":
      return WHAT_CELLS[scenario.kind].roadTypes.map((r) => ({ v: r.v, l: r.l }));
    case "jurisdiction_key":
      // #260 / #257: "Not set" is the one word for an unset jurisdiction.
      return [
        { v: "", l: "Not set — MUTCD + CDOT only" },
        ...JURISDICTION_OPTIONS.map((o) => ({ v: o.key, l: o.label })),
      ];
  }
}

/** Numeric fields stage numbers; the two enums stage strings. */
const NUMERIC: ReadonlySet<StagedFieldKey> = new Set(["speed", "lanes", "laneWidth"]);

/** How each field names itself, and how its value reads on screen — the
 *  enumerating sentence, the panel's header note and the REVISING header
 *  all say the same words because they read the same table. */
export const FIELD_LABEL: Record<StagedFieldKey, string> = {
  speed: "Speed limit",
  lanes: "Lanes per direction",
  laneWidth: "Lane width",
  roadType: "Road type",
  jurisdiction_key: "Jurisdiction",
};

export function fieldValueLabel(
  field: StagedFieldKey,
  value: string | number | boolean | undefined,
): string {
  if (value === undefined || value === "") return "Not set";
  switch (field) {
    case "speed":
      return `${value} mph`;
    case "lanes":
      return `${value} lane${Number(value) === 1 ? "" : "s"}`;
    case "laneWidth":
      return `${value} ft`;
    case "roadType":
      return roadTypeLabel(String(value));
    case "jurisdiction_key":
      return (
        JURISDICTION_OPTIONS.find((o) => o.key === value)?.label ?? String(value)
      );
    default:
      return String(value);
  }
}

export function RevisionBand({
  scenario,
  field,
  stagedTo,
  onStage,
  stepIndex,
  panel,
}: {
  scenario: Scenario;
  field: StagedFieldKey;
  /** The staged value, when one is staged — the field shows what the
   *  operator asked for, not what the plan still says. */
  stagedTo: string | number | boolean | undefined;
  onStage: (to: string | number) => void;
  // #289 — CHANGE SOMETHING ELSE, RETIRED (Ryan, 2026-09-23: "retire it,
  // the value links replace it").  It was the post-generate route to the
  // pin, the extent and the kind, which rule 190's one field and rule
  // 119's one fact line left with none.  The setup line's values are now
  // each a link (defect 2), and they stay on screen under this band —
  // kind, location and extent open the column on WHERE, keeping the
  // staged set exactly as this link did.  One route per value; the
  // second route to the same place is gone.
  stepIndex: string;
  /** The before/after panel, built by the shell (it owns the preview
   *  state and the staged list). */
  panel: ReactNode;
}): ReactNode {
  // Defect 2: the field the operator picked.  Was `field === "speed" ?
  // scenario.speed : undefined` — S7 knew one field.
  const current = fieldCurrentValue(scenario, field);
  const value = stagedTo ?? current;
  // Kept for speed so the suites and the prod rig that drive
  // `#revise-speed` keep meaning what they meant.
  const editorId = `revise-${field}`;

  return (
    <OpenBand
      stepIndex={stepIndex}
      // Rule 190's header: the band says which field it re-opened.
      // #289 fidelity F4 (X10): the step index is "REVISING" (rule 4 —
      // the shell passes it), so the section header (rule 62, role 1) is
      // the FIELD.  It read "REVISING · SPEED LIMIT" after a "REVISING"
      // index: the word twice in one line.
      head={FIELD_LABEL[field].toUpperCase()}
      provenance="nothing is written until you apply"
      question="What should it be?"
      questionProvenance="The plan below is unchanged until you apply this."
      // Rule 61's revision variant — the accent border, which has been
      // waiting in BandPrimitives for the state that mounts it.
      revising
    >
      <div className="a-grid">
        <div className="a-cell" data-testid={`cell-revise-${field}`}>
          <label className="tr-field" htmlFor={editorId}>
            {FIELD_LABEL[field]}
          </label>
          <select
            id={editorId}
            className="a-fld"
            data-write=""
            value={String(value ?? "")}
            onChange={(e) =>
              onStage(
                NUMERIC.has(field) ? Number(e.target.value) : e.target.value,
              )
            }
          >
            {fieldOptions(scenario, field).map((o) => (
              <option key={String(o.v)} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
          <span className="tr-prov" data-testid="prov-revise">
            {stagedTo === undefined
              ? "the value on the plan"
              : `staged · was ${fieldValueLabel(field, current)}`}
          </span>
        </div>
      </div>

      {/* #289 fidelity F7: DISCARD is rule 94's — the panel footer's
          ghost, beside APPLY — so it lives in the footer the shell
          builds, not under the panel as a link. */}
      {panel}
    </OpenBand>
  );
}
