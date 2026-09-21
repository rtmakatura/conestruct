"use client";

// Zone 2's pricing quote — Part 1 §8.11: "kept as a disclosure directly
// under the downloads, with the 'not a permit fee' framing in its summary
// line."  #288 Phase 1 clause 4 makes it a rule-87 disclosure ROW, the
// same primitive the tier rows and the reference use, instead of the
// bespoke `.price` head it had.
//
// WHAT IS UNCHANGED, and it is everything that matters: the panel stays
// MOUNTED while collapsed (`hidden`), so its preview and edit state
// survive collapse cycles; the last previewed backend total is the only
// number shown and no mock estimate ever renders (before any preview the
// row says so in words — rule 14: a value that is not known renders as a
// word, never a placeholder).
//
// RULE 89's count slot is EMPTY here, deliberately.  The quote is not a
// counted tier — it has no ledger and nothing to count — so it renders
// no numeral rather than a zero, exactly as the uncounted reference tier
// does.  The total is not a count; it rides the provenance line, which is
// where rule 88 puts the row's own words.

import { useState, type ComponentProps } from "react";
import { QuotePanel } from "./QuotePanel";
import { DisclosureRow } from "./DisclosureRow";

const fmtTotal = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** §8.11's framing, kept verbatim — the summary line's standing half. */
const FYI = "FYI · contractor estimate — not a permit fee";

type QuotePanelProps = Omit<
  ComponentProps<typeof QuotePanel>,
  "embedded" | "onTotalChange"
>;

export function PricingCard(props: QuotePanelProps) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  return (
    <DisclosureRow
      symbol="i"
      name="Pricing quote"
      count={null}
      // The framing first, then the last previewed total — or, before any
      // preview, the words that say there is none.  The total is its own
      // element, not spliced into the sentence: it is a VALUE, and a
      // value findable only as a substring is not measurable (#185 asserts
      // the collapsed headline shows the number).
      provenance={
        <>
          {FYI} ·{" "}
          {total != null ? (
            <b className="quote-total">{fmtTotal(total)}</b>
          ) : (
            "expand to configure & preview"
          )}
        </>
      }
      open={open}
      onToggle={() => setOpen((o) => !o)}
      // The panel stays MOUNTED while collapsed.  Its state — duration,
      // flagger count, rate edits, the previewed breakdown — is written
      // nowhere else, so unmounting it on collapse discards the
      // operator's work (the #74 clobber class).  A tier row takes the
      // default and drops its panel from the DOM, because a tier body is
      // derived from the wire and loses nothing.
      keepMounted
    >
      <QuotePanel {...props} embedded onTotalChange={setTotal} />
    </DisclosureRow>
  );
}
