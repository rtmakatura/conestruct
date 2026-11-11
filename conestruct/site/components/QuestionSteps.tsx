"use client";

// #439 (UX group 3, R145 W1) — the one-question-at-a-time card, shared.
//
// Built for #437's NEEDS YOU (rulings 3, 5, 6 and 7 of
// validation-artifacts/committed/ux-group2-needs-you/rulings.md) and split
// out so the WHERE band's CONFIRM card is the same component, not a copy
// (validation-artifacts/committed/ux-group3-where/rulings.md, P2, P11).
//
// It decides nothing about which questions there are, their order, or
// what an answer writes: the adapter hands in the questions and the three
// callbacks.  It holds one piece of view state, the question on screen.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { symClass } from "@/lib/design/symbols";
import { useDetailsToggle } from "./InfoToggle";

export interface StepOption {
  value: string;
  label: string;
  /** The row's second line (its consequence), or null for a plain row. */
  consequence: ReactNode | null;
  testid?: string;
}

export interface StepQuestion {
  id: string;
  /** "Next: <title>" on the row of a question not yet on screen. */
  title: string;
  question: string;
  /** A sentence, or (#448) NEEDS YOU's held sentences, one shown. */
  explanation: ReactNode | null;
  options: readonly StepOption[];
  /** The chosen option's value, or null while unanswered. */
  answer: string | null;
  /** The collapsed record, while answered. */
  record: {
    className: string;
    glyph: string;
    text: string;
    /** #507 R145-12: no Undo for an answer the person didn't give and
     *  can't change (a side the backend offers alone, picked for you). */
    noUndo?: boolean;
  } | null;
  /** The card's foot, left of the button.  `details` is the Details
   *  toggle, present when the question has a `details` line. */
  foot: (details: ReactNode) => ReactNode;
  details: ReactNode | null;
  /** Lines under the radio rows (a loading line, a refusal, a note). */
  extra?: ReactNode;
  /** #447 ruling 1: between the explanation and the choices (a map). */
  media?: ReactNode;
}

export interface QuestionStepsProps {
  heading: string;
  headingId?: string;
  /** The heading's level: NEEDS YOU's h3 by default; CONFIRM is the
   *  page's first section heading after the h1, so h2 (#439 evidence, axe
   *  heading-order). */
  headingLevel?: 2 | 3;
  questions: readonly StepQuestion[];
  onAnswer: (q: StepQuestion, value: string) => void;
  onUndo: (q: StepQuestion) => void;
  /** The last open question's button: the block's one write. */
  onLast: () => void;
  lastLabel: string;
  /** Why the last button can't run (its title), or null when it can. */
  lastBlocked: string | null;
  lastTestId?: string;
  nextClass: string;
  inFlight: boolean;
  /** The question the card stays on when none is open, or null to close
   *  the card (NEEDS YOU closes it; CONFIRM keeps the last one until the
   *  kind is confirmed, W8). */
  fallbackId?: string | null;
  /** Under the rows when the card is closed (NEEDS YOU's apply row). */
  closedTail?: (open: boolean) => ReactNode;
  /** The record rows' class (NEEDS YOU's `ny-items nyq-rows`). */
  rowsClass?: string;
  /** #440: told the question on screen (its id, or null when the card is
   *  closed) — the WHERE band arms its aerial while the cross-street
   *  question is the one on screen.  The card's own behaviour is unchanged. */
  onCurrentChange?: (id: string | null) => void;
  /** #469 (Ryan 2026-11-09, Part 2 ruling 5): Details is step 2's popover
   *  (`useDetailsToggle` + the `a-info a-pop` panel, as InfoToggle and the
   *  WHAT band's markers), floating over the page, instead of a line in the
   *  card's flow.  The WHERE band sets it, and NEEDS YOU too (#479, Ryan
   *  2026-11-10); unset, Details is the line after the foot. */
  detailsTip?: boolean;
}

function firstOpen(questions: readonly StepQuestion[]): string | null {
  return questions.find((q) => q.answer === null)?.id ?? null;
}

export function QuestionSteps({
  heading,
  headingId,
  headingLevel = 3,
  questions,
  onAnswer,
  onUndo,
  onLast,
  lastLabel,
  lastBlocked,
  lastTestId,
  nextClass,
  inFlight,
  fallbackId = null,
  closedTail,
  rowsClass = "ny-items nyq-rows",
  onCurrentChange,
  detailsTip = false,
}: QuestionStepsProps) {
  // `undefined` = follow the first open one; an id = the operator moved to
  // it (Next, or a click on its row); null = the operator closed the card.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const byId = new Map(questions.map((q) => [q.id, q] as const));
  const currentId =
    chosen !== undefined && chosen !== null && byId.has(chosen)
      ? chosen
      : (firstOpen(questions) ?? (chosen === null ? null : fallbackId));
  const current = currentId ? (byId.get(currentId) ?? null) : null;
  const n = questions.length;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const k = current ? questions.indexOf(current) + 1 : 0;
  const currentKey = current?.id ?? null;
  useEffect(() => {
    onCurrentChange?.(currentKey);
  }, [currentKey, onCurrentChange]);

  const open = (id: string) => {
    setChosen(id);
    setDetailsOpen(false);
  };
  const answer = (q: StepQuestion, value: string) => {
    // The card stays on the question just answered until Next.
    setChosen(q.id);
    onAnswer(q, value);
  };
  const undo = (q: StepQuestion) => {
    onUndo(q);
    open(q.id);
  };
  const others = current ? questions.filter((q) => q !== current && q.answer === null) : [];
  const isLast = current !== null && others.length === 0;
  const next = () => {
    if (!current || current.answer === null) return;
    if (isLast) {
      setChosen(null);
      onLast();
      return;
    }
    const after = questions.slice(questions.indexOf(current) + 1).find((q) => q.answer === null);
    open((after ?? others[0]).id);
  };
  const buttonDisabled =
    inFlight || current === null || current.answer === null || (isLast && lastBlocked !== null);

  return (
    <>
      <div className="ny-head nyq-head">
        <Heading id={headingId} className="ny-title tr-section">
          {heading}
        </Heading>
        <p className="nyq-count tr-note">
          {current ? `Question ${k} of ${n}` : `${n} of ${n} answered`}
        </p>
        {/* One segment per question, filled when answered or current.
            aria-hidden: "Question k of N" says it in words. */}
        <span className="nyq-segs" aria-hidden="true">
          {questions.map((q) => (
            <span
              key={q.id}
              className={`nyq-seg${q === current ? " is-current" : q.answer !== null ? " is-done" : ""}`}
            />
          ))}
        </span>
      </div>
      {current ? (
        <Card
          q={current}
          headingLevel={headingLevel}
          inFlight={inFlight}
          nextClass={nextClass}
          buttonDisabled={buttonDisabled}
          title={
            current.answer === null
              ? "choose an answer first"
              : isLast && lastBlocked !== null
                ? lastBlocked
                : undefined
          }
          label={isLast ? lastLabel : "Next question"}
          testid={isLast ? lastTestId : undefined}
          detailsOpen={detailsOpen}
          setDetailsOpen={setDetailsOpen}
          detailsTip={detailsTip}
          onAnswer={(v) => answer(current, v)}
          onNext={next}
        />
      ) : null}
      <ul className={rowsClass}>
        {questions
          .filter((q) => q !== current)
          .map((q) =>
            q.answer === null || q.record === null ? (
              <li key={q.id} className="nyq-row nyq-next">
                <button
                  type="button"
                  className="nyq-row-btn"
                  data-read=""
                  data-testid={`step-next-${q.id}`}
                  onClick={() => open(q.id)}
                >
                  <span className={`nyq-glyph ${symClass("◌")}`} aria-hidden>
                    ◌
                  </span>
                  <span className="nyq-row-text tr-help">Next: {q.title}</span>
                </button>
              </li>
            ) : (
              <li key={q.id} className={`nyq-row nyq-answered ${q.record.className}`}>
                <button
                  type="button"
                  className="nyq-row-btn"
                  data-read=""
                  onClick={() => open(q.id)}
                >
                  <span className={`nyq-glyph ${symClass(q.record.glyph)}`} aria-hidden>
                    {q.record.glyph}
                  </span>
                  <span className="nyq-row-text tr-help">{q.record.text}</span>
                </button>
                {/* #457 rulings 1-3: every answered row's Undo is the one
                    shared link (U1); no caller hands it another look. */}
                {!q.record.noUndo && (
                  <button
                    type="button"
                    className="undo-link"
                    data-write=""
                    data-testid={`step-undo-${q.id}`}
                    disabled={inFlight}
                    onClick={() => undo(q)}
                  >
                    Undo
                  </button>
                )}
              </li>
            ),
          )}
        {closedTail ? closedTail(current !== null) : null}
      </ul>
    </>
  );
}

function Card({
  q,
  headingLevel,
  inFlight,
  nextClass,
  buttonDisabled,
  title,
  label,
  testid,
  detailsOpen,
  setDetailsOpen,
  detailsTip,
  onAnswer,
  onNext,
}: {
  q: StepQuestion;
  /** The card's heading level; the question title sits one below it. */
  headingLevel: 2 | 3;
  inFlight: boolean;
  nextClass: string;
  buttonDisabled: boolean;
  title: string | undefined;
  label: string;
  testid: string | undefined;
  detailsOpen: boolean;
  setDetailsOpen: (v: boolean) => void;
  detailsTip: boolean;
  onAnswer: (value: string) => void;
  onNext: () => void;
}) {
  const QHeading = headingLevel === 2 ? "h3" : "h4";
  const name = `nyq-${q.id}`;
  const detailsId = `${name}-details`;
  // Keyed by question: moving to another question closes the popover, as
  // `open()` closes the in-flow line.
  const toggle =
    q.details !== null && detailsTip ? (
      <DetailsTip key={q.id} id={detailsId}>
        {q.details}
      </DetailsTip>
    ) : q.details !== null ? (
      <button
        type="button"
        className="nyq-details-btn"
        data-read=""
        aria-expanded={detailsOpen}
        aria-controls={detailsId}
        onClick={() => setDetailsOpen(!detailsOpen)}
      >
        Details
      </button>
    ) : null;
  return (
    <div className="nyq-card" data-flag={q.id}>
      <div className="nyq-text">
        <QHeading className="nyq-q">{q.question}</QHeading>
        {q.explanation !== null ? <p className="nyq-why tr-help">{q.explanation}</p> : null}
      </div>
      {q.media ?? null}
      {/* Radio rows, each with its consequence when it has one.  A native
          radio group (one Tab stop, arrow keys); the 14 px square marker
          is fill + inset + border when chosen, outline when not (Rule 13:
          never hue alone). */}
      {q.options.length > 0 ? (
        <fieldset className="nyq-answers">
          <legend className="sr-only">{q.question}</legend>
          {q.options.map((o) => {
            const chosen = q.answer === o.value;
            return (
              <label key={o.value} className={`nyq-answer${chosen ? " chosen" : ""}`}>
                <input
                  type="radio"
                  className="nyq-radio"
                  name={name}
                  value={o.value}
                  data-write=""
                  data-testid={o.testid}
                  disabled={inFlight}
                  checked={chosen}
                  onChange={() => onAnswer(o.value)}
                />
                <span className="nyq-mark" aria-hidden />
                <span className="nyq-answer-text">
                  <span className="nyq-label">{o.label}</span>
                  {o.consequence !== null ? (
                    <span className="nyq-consequence tr-note">{o.consequence}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {q.extra ?? null}
      <div className="nyq-foot">
        {q.foot(toggle)}
        <button
          type="button"
          className={nextClass}
          data-write=""
          data-testid={testid}
          disabled={buttonDisabled}
          title={title}
          onClick={onNext}
        >
          {label}
        </button>
      </div>
      {q.details !== null && !detailsTip ? (
        <p id={detailsId} className="nyq-details tr-note" hidden={!detailsOpen}>
          {q.details}
        </p>
      ) : null}
    </div>
  );
}

/** #469 (Part 2 ruling 5): the Details toggle and its text as one box, step
 *  2's popover pattern (InfoToggle.tsx `useDetailsToggle`; FieldCell.tsx):
 *  opens on click, tap, Enter or Space, never on hover (rules 141, 142);
 *  closes on a click outside or Esc, focus back on the toggle (R101).  The
 *  panel overlays the page (`.a-info.a-pop`), so nothing in the card or the
 *  band moves when it opens (P1).  Spans throughout: the caller's foot is a
 *  `<p>`.  The toggle keeps the card's own 44 px text button. */
function DetailsTip({ id, children }: { id: string; children: ReactNode }) {
  const { open, setOpen, boxRef, triggerRef } = useDetailsToggle<HTMLSpanElement>();
  return (
    <span ref={boxRef} className="nyq-tip-box">
      <button
        ref={triggerRef}
        type="button"
        className="nyq-details-btn"
        data-read=""
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        Details
      </button>
      <span id={id} className="a-info a-pop tr-note nyq-details" role="group" aria-label="Details" hidden={!open}>
        {children}
      </span>
    </span>
  );
}
