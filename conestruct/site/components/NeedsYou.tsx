"use client";

// #288 Phase 1 (s2-arc33) — the NEEDS YOU shell.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// (Ryan, 2026-09-21, clause b: "the NEEDS YOU shell" is NEW; clause d:
// ACKNOWLEDGE renders no button).  Spec: #281 comment 1, rules 72–79,
// with rulings 185 and 186.
//
// #437 (UX group 2, Option B; validation-artifacts/committed/
// ux-group2-needs-you/rulings.md) — the block now carries, in this order:
//   · the question flow (components/NeedsYouQuestion.tsx): one detected
//     site condition at a time, with its own header row ("NEEDS YOU",
//     "Question k of N", the segment bar);
//   · "Also on this plan": the ▲/⚠ tier rows, with their citations and,
//     per ruling d, a button only where the wire carries a write (S5);
//   · the condition records that are not questions (applied or staged
//     asserts, asserted manual keys), each with Undo;
//   · the backend's verify advisory, once (D9).
// The scan footer and the old Apply row are gone (D9, ruling 6).
//
// It is also the jump target the reference's read-only signposts point
// at (rule 129: "Correct in setup ↑", which jumps to NEEDS YOU; D10).
//
// The component decides nothing (the #228 deriveRail idiom): tiers come
// from lib/tiering.ts, ordering and counts from lib/needs-you.ts and
// lib/needs-you-items.ts, and every string below is either fixed copy from
// the spec or a value the wire carried.

import type { ReactNode } from "react";

import { SITE_CORRECTIONS_ANCHOR } from "@/lib/scenarios/site-corrections";
import type { PrimaryOwner } from "@/lib/results-primary";
import {
  countProvenance,
  itemProvenance,
  type NeedsYouAction,
  type NeedsYouItem,
  type NeedsYouModel,
} from "@/lib/needs-you";

/** Rule 18's symbols, as text not icons (rule 17). */
const TIER_GLYPH = { changed: "▲", attention: "⚠" } as const;

export function NeedsYou({
  model,
  conditions = null,
  flow = null,
  advisory = null,
  inFlight = false,
  primary = "needs-you",
  onAction,
  applyRow = null,
}: {
  /** #297: a row's control was pressed.  The shell stages the intent;
   *  nothing here writes. */
  onAction?: (id: string, kind: NeedsYouAction["kind"]) => void;
  /** #297: an Apply row for staged intents when no question flow is
   *  mounted to carry the write.  Same one write. */
  applyRow?: ReactNode;
  model: NeedsYouModel;
  /** #288 clause 3 — read, never decided here (lib/results-primary.ts). */
  primary?: PrimaryOwner;
  /** The listed condition rows that are not questions (records with
   *  Undo).  `null` when there are none (Rule 10). */
  conditions?: ReactNode;
  /** #437 ruling 3: the question flow, which carries its own header row.
   *  `null` with no question. */
  flow?: ReactNode;
  /** D9: the backend's verify advisory, once, under the questions. */
  advisory?: string | null;
  /** Spec 34: a re-generation is in flight for the scenario on screen. */
  inFlight?: boolean;
}) {
  // Rule 10: nothing to show, no block.
  // #437 (Rule 5, declared): the block mounts on a question, a
  // non-question condition record, a tier item or a staged Apply.  The
  // header numeral (ruling 185's sum) is gone: with questions the count is
  // "Question k of N" in words and the verdict strip says it once more
  // (P2: not a third time).
  if (model.items.length === 0 && conditions === null && flow === null && applyRow === null) {
    return null;
  }
  const decomposition = countProvenance(model);
  const hasList = model.items.length > 0 || conditions !== null || applyRow !== null;
  return (
    <section
      id={SITE_CORRECTIONS_ANCHOR}
      tabIndex={-1}
      aria-busy={inFlight || undefined}
      className={`needs-you jump-anchor outline-none${
        primary === "needs-you" ? " owns-primary" : ""
      }${flow ? " has-questions" : ""}`}
      aria-labelledby="needs-you-h"
    >
      {flow ?? (
        <div className="ny-head">
          <h2 id="needs-you-h" className="ny-title tr-section">
            NEEDS YOU
          </h2>
          <p className="ny-sub tr-prov">
            changed the plan, or waiting on your word
            {decomposition ? ` · ${decomposition}` : ""}
          </p>
        </div>
      )}
      {flow && (model.items.length > 0 || conditions !== null) ? (
        <p className="ny-also tr-prov">Also on this plan</p>
      ) : null}
      {hasList ? (
        <ul className="ny-items">
          {model.items.map((item) => (
            <Item key={item.id} item={item} onAction={onAction} locked={inFlight} />
          ))}
          {conditions}
          {applyRow}
        </ul>
      ) : null}
      {advisory ? <p className="ny-advisory tr-note">{advisory}</p> : null}
    </section>
  );
}

function Item({
  item,
  onAction,
  locked,
}: {
  item: NeedsYouItem;
  onAction?: (id: string, kind: NeedsYouAction["kind"]) => void;
  locked: boolean;
}) {
  return (
    <li className={`ny-item is-${item.tier}`}>
      {/* Rule 74's three tracks: 20px glyph / body / auto actions. */}
      <span className="ny-glyph tr-field" aria-hidden="true">
        {TIER_GLYPH[item.tier]}
      </span>
      <div className="ny-mid">
        <span className="ny-body">{item.title}</span>
        {/* Rule 75: the provenance names the tier in words, then the
            evidence the wire carried (#289 F4: no result tag). */}
        <p className="ny-prov tr-note">{itemProvenance(item)}</p>
      </div>
      <div className="ny-right">
        <span className="ny-cite">{item.cite}</span>
        {/* Ruling d: an action that would write nothing does not render
            as a button. */}
        {item.action ? (
          <Actions
            action={item.action}
            locked={locked}
            press={(kind) => onAction?.(item.id, kind)}
          />
        ) : null}
      </div>
    </li>
  );
}

function Actions({
  action,
  locked,
  press,
}: {
  action: NeedsYouAction;
  locked: boolean;
  press: (kind: NeedsYouAction["kind"]) => void;
}) {
  // Rule 77: one button per row unless the row offers a true pair.
  return (
    <span className="ny-acts">
      <ActionButton action={action} locked={locked} press={press} />
      {action.pair ? <ActionButton action={action.pair} locked={locked} press={press} /> : null}
    </span>
  );
}

function ActionButton({
  action,
  locked,
  press,
}: {
  action: NeedsYouAction;
  locked: boolean;
  press: (kind: NeedsYouAction["kind"]) => void;
}) {
  // The .act control, rule 133.  #297: it stages; Apply writes.  #457
  // rulings 1-3: an Undo is the one shared link instead (U1).
  return (
    <button
      type="button"
      className={action.kind === "undo" ? "undo-link" : "act"}
      data-write={action.kind}
      disabled={locked}
      onClick={() => press(action.kind)}
    >
      {action.label}
    </button>
  );
}
