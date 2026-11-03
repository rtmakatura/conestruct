"use client";

// #437 (UX group 2, Option B) — NEEDS YOU as one question at a time.
//
// Authority: validation-artifacts/committed/ux-group2-needs-you/rulings.md,
// rulings 3, 5, 6 and 7 with Ryan's checkpoint rulings S1-S5.  Design:
// OptionB.dc.html on the "Tool page: Needs you" canvas.
//
// The component decides nothing about WHICH questions there are or their
// order: both come from `buildQuestions` (lib/needs-you-items.ts, ruling
// 4).  It holds one piece of view state, the question on screen, and
// stages every answer through the shell's one staged list (#254): a radio
// click stages "Yes" (`confirmMarker`, S1) or "No" (`notThereMarker`, S2);
// the last question's button is the block's one write, Apply.

import { useState } from "react";

import type { NeedsYouQuestion, QuestionAnswer } from "@/lib/needs-you-items";
import { scanEvidence } from "@/lib/tiering";
import { symClass } from "@/lib/design/symbols";
import type { SiteScanProvenance } from "@/lib/render-types";
import {
  confirmMarker,
  fmtScanDuration,
  fmtScanStamp,
  notThereMarker,
  stage,
  unstage,
} from "@/lib/scenarios/site-corrections";
import type { StagedCorrection } from "@/lib/scenarios/types";

export interface QuestionFlowProps {
  questions: readonly NeedsYouQuestion[];
  staged: StagedCorrection[];
  setStaged: (next: StagedCorrection[]) => void;
  /** The block's one write (the staged set into the scenario). */
  onApply: () => void;
  /** The scan the questions came from, for Details' time and duration. */
  siteScan: SiteScanProvenance | null;
  /** Spec 34: a re-generation is in flight; every write is disabled. */
  inFlight: boolean;
  /** #288 clause 3: read from the one derivation, never decided here. */
  ownsPrimary: boolean;
}

/** The question the card opens on: the first one with no answer. */
function firstOpen(questions: readonly NeedsYouQuestion[]): string | null {
  return questions.find((q) => q.answer === null)?.flag ?? null;
}

export function QuestionFlow({
  questions,
  staged,
  setStaged,
  onApply,
  siteScan,
  inFlight,
  ownsPrimary,
}: QuestionFlowProps) {
  // The question on screen.  `undefined` = follow the first open one;
  // a flag = the operator moved to it (Next, or a click on its row);
  // null = the operator closed the card on an answered set.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const byFlag = new Map(questions.map((q) => [q.flag as string, q] as const));
  const currentFlag =
    chosen !== undefined && chosen !== null && byFlag.has(chosen) ? chosen : firstOpen(questions);
  const current = currentFlag ? (byFlag.get(currentFlag) ?? null) : null;
  const n = questions.length;
  const k = current ? questions.indexOf(current) + 1 : 0;

  const open = (flag: string) => {
    setChosen(flag);
    setDetailsOpen(false);
  };
  const answer = (q: NeedsYouQuestion, a: QuestionAnswer) => {
    // Choosing the answer the plan already carries (an applied record the
    // operator undid, then answered the same way) un-stages instead of
    // staging a duplicate write.
    const appliedAnswer =
      q.record && q.record.status !== "moot"
        ? q.record.action === "confirm"
          ? "yes"
          : q.record.action === "dismiss"
            ? "no"
            : null
        : null;
    // The card stays on the question just answered until Next.
    setChosen(q.flag);
    if (appliedAnswer === a) {
      setStaged(unstage(staged, q.flag));
      return;
    }
    const marker = a === "yes" ? confirmMarker(q.flag) : notThereMarker(q.flag);
    setStaged(stage(staged, { flag: q.flag, marker }));
  };
  const undo = (q: NeedsYouQuestion) => {
    if (q.answerSource === "staged") setStaged(unstage(staged, q.flag));
    else if (q.answerSource === "applied") setStaged(stage(staged, { flag: q.flag, marker: null }));
    open(q.flag);
  };
  // Ruling 6: "Next question" on all but the last; the last is Apply.
  const others = current ? questions.filter((q) => q !== current && q.answer === null) : [];
  const isLast = current !== null && others.length === 0;
  const next = () => {
    if (!current || current.answer === null) return;
    if (isLast) {
      setChosen(null);
      onApply();
      return;
    }
    const after = questions.slice(questions.indexOf(current) + 1).find((q) => q.answer === null);
    open((after ?? others[0]).flag);
  };
  const buttonDisabled =
    inFlight || current === null || current.answer === null || (isLast && staged.length === 0);

  return (
    <>
      <div className="ny-head nyq-head">
        <h3 id="needs-you-h" className="ny-title tr-section">
          NEEDS YOU
        </h3>
        <p className="nyq-count tr-note">
          {current ? `Question ${k} of ${n}` : `${n} of ${n} answered`}
        </p>
        {/* Ruling 3: one segment per question, filled when answered or
            current.  aria-hidden: "Question k of N" says it in words. */}
        <span className="nyq-segs" aria-hidden="true">
          {questions.map((q) => (
            <span
              key={q.flag}
              className={`nyq-seg${q === current ? " is-current" : q.answer !== null ? " is-done" : ""}`}
            />
          ))}
        </span>
      </div>
      {current ? (
        <Card
          q={current}
          inFlight={inFlight}
          ownsPrimary={ownsPrimary}
          isLast={isLast}
          buttonDisabled={buttonDisabled}
          stagedCount={staged.length}
          detailsOpen={detailsOpen}
          setDetailsOpen={setDetailsOpen}
          siteScan={siteScan}
          onAnswer={(a) => answer(current, a)}
          onNext={next}
        />
      ) : null}
      <ul className="ny-items nyq-rows">
        {questions
          .filter((q) => q !== current)
          .map((q) =>
            q.answer === null ? (
              <li key={q.flag} className="nyq-row nyq-next">
                <button
                  type="button"
                  className="nyq-row-btn"
                  data-read=""
                  onClick={() => open(q.flag)}
                >
                  <span className={`nyq-glyph ${symClass("◌")}`} aria-hidden>
                    ◌
                  </span>
                  <span className="nyq-row-text tr-help">Next: {q.title}</span>
                </button>
              </li>
            ) : (
              <li
                key={q.flag}
                className={`nyq-row nyq-answered ${q.answer === "yes" ? "confirmed" : "dismissed"}`}
              >
                <button
                  type="button"
                  className="nyq-row-btn"
                  data-read=""
                  onClick={() => open(q.flag)}
                >
                  <span
                    className={`nyq-glyph ${symClass(q.answer === "yes" ? "✓" : "×")}`}
                    aria-hidden
                  >
                    {q.answer === "yes" ? "✓" : "×"}
                  </span>
                  <span className="nyq-row-text tr-help">
                    {q.question.replace(/\?$/, "")}: {q[q.answer].label}
                    {q.answerSource === "staged" ? " · not applied yet" : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="act tr-step nyq-undo"
                  data-write=""
                  disabled={inFlight}
                  onClick={() => undo(q)}
                >
                  Undo
                </button>
              </li>
            ),
          )}
        {/* Every question answered and the card closed, with something
            still staged (an Undo elsewhere, a manual key): the same one
            write, as a plain row. */}
        {current === null && staged.length > 0 ? (
          <li className="nyq-row nyq-apply">
            <span className="nyq-row-text tr-help">Answers ready to apply.</span>
            <button
              type="button"
              className={`act nyq-next-btn${ownsPrimary ? " is-on" : ""}`}
              data-write=""
              disabled={inFlight}
              onClick={onApply}
            >
              Apply answers
            </button>
          </li>
        ) : null}
      </ul>
    </>
  );
}

function Card({
  q,
  inFlight,
  ownsPrimary,
  isLast,
  buttonDisabled,
  stagedCount,
  detailsOpen,
  setDetailsOpen,
  siteScan,
  onAnswer,
  onNext,
}: {
  q: NeedsYouQuestion;
  inFlight: boolean;
  ownsPrimary: boolean;
  isLast: boolean;
  buttonDisabled: boolean;
  stagedCount: number;
  detailsOpen: boolean;
  setDetailsOpen: (v: boolean) => void;
  siteScan: SiteScanProvenance | null;
  onAnswer: (a: QuestionAnswer) => void;
  onNext: () => void;
}) {
  const name = `nyq-${q.flag}`;
  const evidence = scanEvidence(q.bucket ?? undefined, { details: false, anchorSuffix: false });
  const stamp = siteScan?.measured_at ?? null;
  const duration = fmtScanDuration(siteScan?.duration_ms);
  const detailsId = `${name}-details`;
  return (
    <div className="nyq-card" data-flag={q.flag}>
      <div className="nyq-text">
        <h4 className="nyq-q">{q.question}</h4>
        <p className="nyq-why tr-help">{q.explanation}</p>
      </div>
      {/* Ruling 5: two radio rows, each stating its consequence.  A native
          radio group (one Tab stop, arrow keys); the 14 px square marker
          is fill + inset + border when chosen, outline when not (Rule 13:
          never hue alone). */}
      <fieldset className="nyq-answers">
        <legend className="sr-only">{q.question}</legend>
        {(["yes", "no"] as const).map((a) => {
          const chosen = q.answer === a;
          return (
            <label key={a} className={`nyq-answer${chosen ? " chosen" : ""}`}>
              <input
                type="radio"
                className="nyq-radio"
                name={name}
                value={a}
                data-write=""
                disabled={inFlight}
                checked={chosen}
                onChange={() => onAnswer(a)}
              />
              <span className="nyq-mark" aria-hidden />
              <span className="nyq-answer-text">
                <span className="nyq-label">{q[a].label}</span>
                <span className="nyq-consequence tr-note">{q[a].consequence}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="nyq-foot">
        <p className="nyq-source tr-note">
          Source: {q.citation ? `${q.citation} · ` : ""}map data from OpenStreetMap ·{" "}
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
        </p>
        <button
          type="button"
          className={`act nyq-next-btn${ownsPrimary ? " is-on" : ""}`}
          data-write=""
          disabled={buttonDisabled}
          title={
            q.answer === null
              ? "choose an answer first"
              : isLast && stagedCount === 0
                ? "nothing to apply"
                : undefined
          }
          onClick={onNext}
        >
          {isLast ? "Apply answers" : "Next question"}
        </button>
      </div>
      {/* Ruling 7 (P19, one click): the detail the default view leaves
          out.  Every value is a wire field; a missing one drops its part
          (Rule 10). */}
      <p id={detailsId} className="nyq-details tr-note" hidden={!detailsOpen}>
        {[
          evidence || null,
          q.citation,
          "OpenStreetMap",
          siteScan?.mode ? `${siteScan.mode} scan` : "site scan",
        ]
          .filter(Boolean)
          .join(" · ")}
        {stamp ? " · " : ""}
        {stamp ? (
          <time className="sc-time" dateTime={stamp} title={stamp}>
            {fmtScanStamp(stamp)}
          </time>
        ) : null}
        {duration ? ` · ${duration}` : ""}
      </p>
    </div>
  );
}
