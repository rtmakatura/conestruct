"use client";

// #288 Phase 1 (s2-arc33) — the NEEDS YOU shell.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// (Ryan, 2026-09-21, clause b: "the NEEDS YOU shell" is NEW; clause d:
// ACKNOWLEDGE renders no button).  Spec: #281 comment 1, rules 72–79,
// with rulings 185 and 186.
//
// THE BLOCK, COMPLETE.  The shell landed first; the Phase 1 finish
// ruling's clause 1 gave it the corrections block's rows and its one
// write (components/NeedsYouConditions.tsx — the MOVE, verbatim from
// SetupStrip).  The block now carries, in this order:
//   · the ▲/⚠ tier rows, with their citations and — per ruling d — no
//     buttons, because the wire carries nothing for them to write;
//   · the five scanned site-condition rows and the two manual keys,
//     with Dismiss / Assert / Undo on one right edge (rules 76–77);
//   · rule 78's Apply row, the last data line, with its standing
//     sentence and its disabled-at-zero button;
//   · the scan's own provenance line.
//
// It is also the jump target the reference's read-only signposts point
// at (rule 129: "Correct in setup ↑", which jumps to NEEDS YOU) — the
// anchor moved with the block, so the pointer still lands (Rule 10).
//
// The component decides nothing (the #228 deriveRail idiom): tiers come
// from lib/tiering.ts, ordering and counts from lib/needs-you.ts, and
// every string below is either fixed copy from the spec or a value the
// wire carried.

import type { ReactNode } from "react";

import { SITE_CORRECTIONS_ANCHOR } from "@/lib/scenarios/site-corrections";
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
  inFlight = false,
}: {
  model: NeedsYouModel;
  /** Clause 1's rows — the moved corrections block, rendered as item
   *  rows of this block's list.  `null` when the plan carries no scan
   *  for them to read (Rule 10). */
  conditions?: ReactNode;
  /** Spec 34: a re-generation is in flight for the scenario on screen. */
  inFlight?: boolean;
}) {
  // Rule 10: nothing to show, no block.  An empty NEEDS YOU would assert
  // that the plan was examined and found to want something, which is
  // exactly what nothing does not say.
  //
  // DECLARED BEHAVIOUR CHANGE (Rule 5), from clause 1: the gate is no
  // longer the tier count alone.  A clean plan with a served scan still
  // has seven conditions the operator can correct, and rule 78 says the
  // Apply row is always present post-scan — so the block mounts on its
  // conditions even when nothing changed the plan.  The count stays
  // ruling 185's sum of ▲ + ⚠ and is honest at zero: it is a statement
  // about the two consequence tiers, not about the block's row count.
  if (model.count === 0 && conditions === null) return null;
  const decomposition = countProvenance(model);
  return (
    <section
      id={SITE_CORRECTIONS_ANCHOR}
      tabIndex={-1}
      aria-busy={inFlight || undefined}
      className="needs-you jump-anchor outline-none"
      aria-labelledby="needs-you-h"
    >
      {/* Rule 73: section header → provenance → count, count last and
          pushed right.  Ruling 186: always expanded, so the header is
          not a disclosure control and carries no caret. */}
      <div className="ny-head">
        <h3 id="needs-you-h" className="ny-title tr-section">
          NEEDS YOU
        </h3>
        <p className="ny-sub tr-prov">
          changed the plan, or waiting on your word
          {decomposition ? ` · ${decomposition}` : ""}
        </p>
        {/* Ruling 185: the header number is the SUM.  The decomposition
            above is provenance and is never a second numeral here. */}
        <span className="ny-count tr-step">{model.count}</span>
      </div>
      <ul className="ny-items">
        {model.items.map((item) => (
          <Item key={item.id} item={item} />
        ))}
        {conditions}
      </ul>
    </section>
  );
}

function Item({ item }: { item: NeedsYouItem }) {
  return (
    <li className={`ny-item is-${item.tier}`}>
      {/* Rule 74's three tracks: 20px glyph / body / auto actions. */}
      <span className="ny-glyph tr-field" aria-hidden="true">
        {TIER_GLYPH[item.tier]}
      </span>
      <div className="ny-mid">
        <span className="ny-body tr-field">{item.title}</span>{" "}
        <span className="ny-result tr-step">{item.result}</span>
        {/* Rule 75: the provenance names the tier in words, then the
            evidence the wire carried — and nothing it did not. */}
        <p className="ny-prov tr-prov">{itemProvenance(item)}</p>
      </div>
      <div className="ny-right">
        <span className="ny-cite tr-step">{item.cite}</span>
        {/* Ruling d: an action that would write nothing does not render
            as a button.  The row still shows — an honest item without a
            control beats a control that writes nothing. */}
        {item.action ? <Actions action={item.action} /> : null}
      </div>
    </li>
  );
}

function Actions({ action }: { action: NeedsYouAction }) {
  // Rule 77: one button per row unless the row offers a true pair.
  return (
    <span className="ny-acts">
      <ActionButton action={action} />
      {action.pair ? <ActionButton action={action.pair} /> : null}
    </span>
  );
}

function ActionButton({ action }: { action: NeedsYouAction }) {
  // The .act control, rule 133.  data-write declares the write for the
  // write-lock honesty test — every control in this block writes, or it
  // would not have rendered (ruling d).
  return (
    <button type="button" className="act" data-write={action.kind}>
      {action.label}
    </button>
  );
}
