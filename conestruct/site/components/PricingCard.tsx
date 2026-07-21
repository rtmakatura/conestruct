"use client";

// Zone 2's collapsed pricing card.  Collapsed: one line — "Pricing
// quote", the FYI framing, and the last previewed backend total (or an
// explicit unset note before any preview; no mock estimate ever
// renders).  Expanded: the full existing QuotePanel — duration /
// flagger / rate inputs, breakdown preview, quote XLSX download — in
// embedded dress.  The panel stays MOUNTED while collapsed (hidden
// attribute) so its preview and edit state survive collapse cycles.

import { useState, type ComponentProps } from "react";
import { QuotePanel } from "./QuotePanel";

const fmtTotal = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

type QuotePanelProps = Omit<
  ComponentProps<typeof QuotePanel>,
  "embedded" | "onTotalChange"
>;

export function PricingCard(props: QuotePanelProps) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  return (
    <div className={`price${open ? " open" : ""}`}>
      <button
        type="button"
        className="price-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="caret" aria-hidden>
          ›
        </span>
        <span className="k">Pricing quote</span>
        <span className="fyi">FYI · contractor estimate — not a permit fee</span>
        {total != null ? (
          <span className="total">{fmtTotal(total)}</span>
        ) : (
          <span className="total unset">expand to configure &amp; preview</span>
        )}
      </button>
      <div className="price-body" hidden={!open}>
        <QuotePanel {...props} embedded onTotalChange={setTotal} />
      </div>
    </div>
  );
}
