"use client";

// #288 Phase 1 (s2-arc33) step 4 — the disclosure row.
//
// Authority: rulings.md clause b ("the disclosure row" is NEW) with
// #281 comment 1 rules 87–89, and rule 129 (the reference never writes).
//
// Rule 87  flex · align-items center · gap 12 · min-height 48 ·
//          padding 0 16 · 1 px border · ground.  Nested inside an open
//          disclosure the ground lifts.
// Rule 88  symbol → name → count → provenance → caret "›", caret pushed
//          right.
// Rule 89  a COUNTED tier shows a number; the UNCOUNTED reference tier
//          shows a list of what is inside and no number.  Opening
//          expands downward, IN PLACE, inside the column: nothing above
//          the header moves, and the panel never scrolls independently
//          (rule 32 — the page is the only scroll container).
//
// The control is a `data-read`.  Rule 129: the reference never writes,
// and disclosing is not a write — the disclose-never-writes contract is
// the half of section 03 that clause b transfers intact.

import type { ReactNode } from "react";

export interface DisclosureRowProps {
  /** Rule 17's text symbol — ✓ ◌ i ▲ ⚠, never an icon. */
  symbol: string;
  name: string;
  /** Rule 89: a number for a counted tier.  `null` for the uncounted
   *  reference tier, which says what is inside instead. */
  count: number | null;
  /** The uncounted tier's "what is inside" list, or a counted tier's
   *  provenance.  Absent renders nothing — never an empty element.
   *
   *  ReactNode, not string: the quote row's provenance carries a VALUE
   *  (the last previewed total) alongside its words, and a value that is
   *  findable on the page only as a substring of a sentence is not
   *  really on the page — #185's "the collapsed headline shows the
   *  number" stopped being measurable the moment it was concatenated. */
  provenance?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Nested inside an already-open disclosure (rule 87's lifted ground). */
  nested?: boolean;
  /** Keep the panel MOUNTED while closed, hidden rather than absent.
   *
   *  Off by default, and the default is the rule: a closed tier's panel
   *  is not in the DOM at all, because a hidden panel that still occupies
   *  the DOM is the kind of thing that later grows its own scroll
   *  container (rule 32).
   *
   *  The one opt-in is the pricing quote (#288 clause 4, Part 1 §8.11).
   *  Its panel holds operator state that has not been written anywhere —
   *  duration, flagger count, rate edits, the previewed breakdown — and
   *  unmounting on collapse discards it, which is the #74 clobber class
   *  the panel was lifted out of the shell to avoid.  A tier body has no
   *  such state: it is derived from the wire every render, so it loses
   *  nothing by being absent.  Found by QuotePanel.invalidation.test.tsx
   *  failing the moment the quote became a row. */
  keepMounted?: boolean;
  children: ReactNode;
}

export function DisclosureRow({
  symbol,
  name,
  count,
  provenance,
  open,
  onToggle,
  nested = false,
  keepMounted = false,
  children,
}: DisclosureRowProps) {
  const panelId = `disc-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={`disc${nested ? " is-nested" : ""}${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="disc-head"
        data-read=""
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="disc-glyph tr-field" aria-hidden="true">
          {symbol}
        </span>
        <span className="disc-name">{name}</span>
        {/* Rule 89: a number only where the tier is counted.  The
            uncounted reference tier renders no numeral at all rather
            than a zero — a zero would read as "nothing in here". */}
        {count !== null && <span className="disc-count tr-step">{count}</span>}
        {provenance ? <span className="disc-prov tr-prov">{provenance}</span> : null}
        <span className="disc-caret" aria-hidden="true">
          ›
        </span>
      </button>
      {/* Expands downward in place.  Rendered only when open by default:
          a hidden panel that still occupies the DOM is the kind of thing
          that later grows its own scroll container.  `keepMounted` is the
          documented exception for a panel holding unwritten state. */}
      {keepMounted ? (
        <div className="disc-panel" id={panelId} hidden={!open}>
          {children}
        </div>
      ) : (
        open && (
          <div className="disc-panel" id={panelId}>
            {children}
          </div>
        )
      )}
    </div>
  );
}
