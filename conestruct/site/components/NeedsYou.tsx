"use client";

// #288 Phase 1 (s2-arc33) — the NEEDS YOU shell.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// (Ryan, 2026-09-21, clause b: "the NEEDS YOU shell" is NEW; clause d:
// ACKNOWLEDGE renders no button).  Spec: #281 comment 1, rules 72–79,
// with rulings 185 and 186.
//
// THE SHELL ONLY.  This commit builds the block, its header and its item
// rows.  What it deliberately does NOT yet carry:
//   · rule 78's Apply row — it belongs to the corrections block, which
//     NEEDS YOU absorbs whole (Part 1 §8.5).  That absorb moves the
//     staging contract, the standing sentence, the disabled-at-zero
//     button and the dismiss picker verbatim, and it is its own commit.
//   · the mount.  The block lands in the results stack at rule 27's
//     position (setup fact line → NEEDS YOU, 16 px); the stack container
//     is the commit that mounts it.  Rule 28's reserved first row has no
//     defined height while the next-steps strip still occupies the slot,
//     which is an open question on the record — see LEG1/README.
//
// The component decides nothing (the #228 deriveRail idiom): tiers come
// from lib/tiering.ts, ordering and counts from lib/needs-you.ts, and
// every string below is either fixed copy from the spec or a value the
// wire carried.

import {
  countProvenance,
  itemProvenance,
  type NeedsYouAction,
  type NeedsYouItem,
  type NeedsYouModel,
} from "@/lib/needs-you";

/** Rule 18's symbols, as text not icons (rule 17). */
const TIER_GLYPH = { changed: "▲", attention: "⚠" } as const;

export function NeedsYou({ model }: { model: NeedsYouModel }) {
  // Rule 10: no items, no block.  An empty NEEDS YOU would assert that
  // the plan was examined and found to want something, which is exactly
  // what zero items does not say.
  if (model.count === 0) return null;
  const decomposition = countProvenance(model);
  return (
    <section className="needs-you" aria-labelledby="needs-you-h">
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
