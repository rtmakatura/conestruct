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
import { speedOptions } from "@/lib/scenarios/what-cells";
import { OpenBand } from "./BandPrimitives";

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
    default:
      return String(value);
  }
}

export function RevisionBand({
  scenario,
  field,
  stagedTo,
  onStage,
  onDiscard,
  onOpenColumn,
  stepIndex,
  panel,
}: {
  scenario: Scenario;
  field: StagedFieldKey;
  /** The staged value, when one is staged — the field shows what the
   *  operator asked for, not what the plan still says. */
  stagedTo: string | number | boolean | undefined;
  onStage: (to: string | number) => void;
  onDiscard: () => void;
  /** #289 S7 — the way back to the whole column.
   *
   *  Rule 190 re-opens ONE field, and rule 119 collapses setup to ONE
   *  fact line, so between them the pin, the extent and the kind have no
   *  post-generate route: every one of them lives in a band this state
   *  does not render.  Part 1 §5.6 says DISCARD re-collapses the band,
   *  so DISCARD is not that route either.
   *
   *  This link is, and it is named rather than inferred: a revision is
   *  "change one thing", and changing something else is a different
   *  request.  Flagged in the ship report — if the design wants the
   *  fact line to grow a CHANGE per value instead, this link retires. */
  onOpenColumn: () => void;
  stepIndex: string;
  /** The before/after panel, built by the shell (it owns the preview
   *  state and the staged list). */
  panel: ReactNode;
}): ReactNode {
  const current = field === "speed" ? scenario.speed : undefined;
  const value = stagedTo ?? current;

  return (
    <OpenBand
      stepIndex={stepIndex}
      // Rule 190's header: the band says which field it re-opened.
      head={`REVISING · ${FIELD_LABEL[field].toUpperCase()}`}
      provenance="nothing is written until you apply"
      question="What should it be?"
      questionProvenance="The plan below is unchanged until you apply this."
      // Rule 61's revision variant — the accent border, which has been
      // waiting in BandPrimitives for the state that mounts it.
      revising
    >
      <div className="a-grid">
        <div className="a-cell" data-testid="cell-revise-speed">
          <label className="tr-field" htmlFor="revise-speed">
            {FIELD_LABEL[field]}
          </label>
          <select
            id="revise-speed"
            className="a-fld"
            data-write=""
            value={String(value ?? "")}
            onChange={(e) => onStage(Number(e.target.value))}
          >
            {speedOptions(scenario.kind).map((s) => (
              <option key={s} value={s}>
                {s} mph
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

      {panel}

      <div className="a-revise-foot">
        {/* Part 1 §5.6: DISCARD un-stages and asks nothing.  No dialog. */}
        <button
          type="button"
          className="a-lk"
          data-testid="revise-discard"
          onClick={onDiscard}
        >
          DISCARD
        </button>
        <button
          type="button"
          className="a-lk"
          data-testid="revise-open-column"
          onClick={onOpenColumn}
        >
          CHANGE SOMETHING ELSE
        </button>
      </div>
    </OpenBand>
  );
}
