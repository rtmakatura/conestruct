"use client";

// #289 Phase 2 — C3 (the open band) and C4 (the collapsed fact line).
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (Ryan, 2026-09-22) · #281 Part 2 rules 56-66, 134.
//
// Both components DECIDE NOTHING.  Every string, verb and glyph they
// render arrives as a prop from `lib/scenarios/band-facts.ts`, which is
// #228's rule carried into this phase by #281's contract list: "the rail
// is replaced; its derived-entry contract moves to the move ledger and
// the fact lines".  A component that computes its own state is the defect
// the rail's sentinel test exists to catch.

import type { ReactNode } from "react";
import type { BandFact } from "@/lib/scenarios/band-facts";

/**
 * C4 — the collapsed fact line (rules 56-60).
 *
 * Three tracks: symbol / label + leader + value / the link or a
 * provenance word.  Rule 134: "No disabled state: a fact line either
 * offers a link or offers a provenance word" — so `onOpen` is required
 * exactly when `fact.verb` is non-null, and the two cannot disagree
 * because the model produces them together.
 */
export function FactLine({
  fact,
  onOpen,
  locked = false,
}: {
  fact: BandFact;
  onOpen?: (id: BandFact["id"]) => void;
  /** Rule 60's in-flight variant: the whole row at .5 and the link
   *  replaced by the provenance word "locked".  Mounted by the S4
   *  commit; the prop exists here because rule 60 is this component's
   *  rule and splitting it across two files would be the drift this
   *  file's header is about. */
  locked?: boolean;
}) {
  const pending = fact.value === null;
  const showLink = !locked && fact.verb !== null && onOpen !== undefined;
  return (
    <div
      className={`a-fact${pending ? " is-pending" : ""}`}
      style={locked ? { opacity: 0.5 } : undefined}
      data-testid={`fact-${fact.id}`}
      data-fact-state={locked ? "locked" : pending ? "pending" : "done"}
    >
      <span className="a-sym" aria-hidden>
        {fact.glyph}
      </span>
      <div className="a-mid">
        <span className="tr-field">{fact.label}</span>
        {/* Rule 57's leader renders only beside a value: a pending line
            has nothing to lead to (rule 59 drops it explicitly). */}
        {!pending && <span className="a-lead" aria-hidden />}
        {!pending && <span className="a-val">{fact.value}</span>}
      </div>
      {showLink ? (
        <button
          type="button"
          className="a-lk"
          onClick={() => onOpen(fact.id)}
          data-testid={`fact-link-${fact.id}`}
        >
          {fact.verb}
        </button>
      ) : (
        <span className="tr-prov a-fact-prov">
          {locked ? "locked" : fact.pending}
        </span>
      )}
    </div>
  );
}

/**
 * C3 — the open band (rules 61-66).
 *
 * Rule 62's header is step index (role 4) · section header (role 1) ·
 * a right-aligned provenance string.  Rule 64's body order — question
 * (role 5) → its provenance paragraph → the producers → the primary —
 * is the caller's DOM order; what this component owns is the shell.
 *
 * Rule 66: a band never scrolls, it grows.  There is no overflow rule
 * here and that is deliberate, not an omission.
 */
export function OpenBand({
  stepIndex,
  head,
  provenance,
  question,
  questionProvenance,
  revising = false,
  children,
}: {
  stepIndex: string;
  head: string;
  provenance: string;
  question: string;
  questionProvenance: string;
  /** Rule 61's revision variant — the accent border. Mounted by the S7
   *  commit. */
  revising?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`a-open${revising ? " is-revising" : ""}`}
      data-testid={`band-${head.toLowerCase().replace(/\s+/g, "-")}`}
      aria-label={`${stepIndex} ${head}`}
    >
      <div className="a-head">
        <span className="tr-step">{stepIndex}</span>
        <span className="tr-section">{head}</span>
        <span className="tr-prov a-prov">{provenance}</span>
      </div>
      <div className="a-body">
        {/* Type role 5, the step question (#283, ruling 180).  The
            ruling: "tr-question is used on band questions only —
            nowhere else, asserted."  This is the only element in the
            product that carries the class. */}
        <p className="tr-question a-question">{question}</p>
        <p className="tr-prov a-question-prov">{questionProvenance}</p>
        {children}
      </div>
    </section>
  );
}
