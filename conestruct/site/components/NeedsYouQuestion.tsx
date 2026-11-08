"use client";

// #437 (UX group 2, Option B) — NEEDS YOU as one question at a time.
//
// Authority: validation-artifacts/committed/ux-group2-needs-you/rulings.md,
// rulings 3, 5, 6 and 7 with Ryan's checkpoint rulings S1-S5.  Design:
// OptionB.dc.html on the "Tool page: Needs you" canvas.
//
// #439 W1: the card is `QuestionSteps`, shared with the WHERE band's
// CONFIRM card; this adapter maps the questions and stages the answers.
//
// The component decides nothing about WHICH questions there are or their
// order: both come from `buildQuestions` (lib/needs-you-items.ts, ruling
// 4).  It holds one piece of view state, the question on screen, and
// stages every answer through the shell's one staged list (#254): a radio
// click stages "Yes" (`confirmMarker`, S1) or "No" (`notThereMarker`, S2);
// the last question's button is the block's one write, Apply.

import type { NeedsYouQuestion, QuestionAnswer } from "@/lib/needs-you-items";
import { scanEvidence } from "@/lib/tiering";
import type { Scenario } from "@/lib/scenarios";
import { useState } from "react";

import { NeedsYouMap, type MapSubject } from "./NeedsYouMap";
import { QuestionSteps, type StepQuestion } from "./QuestionSteps";
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

/** #438 item 2: the answer label mid-sentence ("Yes, they're there" →
 *  "yes, they're there" after the topic). */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

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
  /** #447: the plan each question's map is of.  Absent: no map. */
  scenario?: Scenario | null;
}

export function QuestionFlow({
  questions,
  staged,
  setStaged,
  onApply,
  siteScan,
  inFlight,
  ownsPrimary,
  scenario = null,
}: QuestionFlowProps) {
  const byFlag = new Map(questions.map((q) => [q.flag as string, q] as const));
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
  };
  // #448: what each question's map said about its subject (the backend's
  // header, relayed by NeedsYouMap).  No map: nothing is said about one.
  const [subjects, setSubjects] = useState<Record<string, MapSubject>>({});
  const onSubject = (flag: string) => (s: MapSubject) =>
    setSubjects((prev) => (prev[flag] === s ? prev : { ...prev, [flag]: s }));
  const nextClass = `act nyq-next-btn${ownsPrimary ? " is-on" : ""}`;
  // #439 W1: the card itself is the shared one-question-at-a-time component.
  const steps: StepQuestion[] = questions.map((q) => ({
    id: q.flag,
    title: q.title,
    question: q.question,
    explanation: (
      <Explanation q={q} subject={scenario ? (subjects[q.flag] ?? "loading") : "failed"} />
    ),
    // Keyed by the flag: each question opens on its own frame and step.
    media: scenario ? (
      <NeedsYouMap
        key={q.flag}
        scenario={scenario}
        flag={q.flag}
        label={q.mapLabel}
        keyLabel={q.mapKey}
        topic={q.topic}
        onSubject={onSubject(q.flag)}
      />
    ) : null,
    options: (["yes", "no"] as const).map((a) => ({
      value: a,
      label: q[a].label,
      consequence: q[a].consequence,
    })),
    answer: q.answer,
    record:
      q.answer === null
        ? null
        : {
            className: q.answer === "yes" ? "confirmed" : "dismissed",
            glyph: q.answer === "yes" ? "✓" : "×",
            text: `${q.topic}: ${lowerFirst(q[q.answer].label)}${
              q.answerSource === "staged" ? " · not applied yet" : ""
            }`,
          },
    foot: (details) => (
      <p className="nyq-source tr-note">
        Source: {q.citation ? `${q.citation} · ` : ""}map data from OpenStreetMap · {details}
      </p>
    ),
    details: <Details q={q} siteScan={siteScan} />,
  }));
  return (
    <QuestionSteps
      heading="NEEDS YOU"
      headingId="needs-you-h"
      // #438 item 5: a results section title, h2 under the page h1.
      headingLevel={2}
      questions={steps}
      onAnswer={(s, v) => {
        const q = byFlag.get(s.id);
        if (q) answer(q, v as QuestionAnswer);
      }}
      onUndo={(s) => {
        const q = byFlag.get(s.id);
        if (q) undo(q);
      }}
      onLast={onApply}
      lastLabel="Apply answers"
      lastBlocked={staged.length === 0 ? "nothing to apply" : null}
      nextClass={nextClass}
      inFlight={inFlight}
      // Every question answered and the card closed, with something still
      // staged (an Undo elsewhere, a manual key): the same one write, as a
      // plain row.
      closedTail={(open) =>
        !open && staged.length > 0 ? (
          <li className="nyq-row nyq-apply">
            <span className="nyq-row-text tr-help">Answers ready to apply.</span>
            <button
              type="button"
              className={nextClass}
              data-write=""
              disabled={inFlight}
              onClick={onApply}
            >
              Apply answers
            </button>
          </li>
        ) : null
      }
    />
  );
}

/** #448 (Ryan's ruling, cc-queue-ux.md item 4): the sentence says what the
 *  picture shows.  All three are in the paragraph, in one grid cell, so it is
 *  always as tall as the longest and nothing under it moves when the map
 *  answers or fails (P1); the two not in force are hidden from sight and
 *  from screen readers. */
function Explanation({ q, subject }: { q: NeedsYouQuestion; subject: MapSubject }) {
  const on = subject === "drawn" ? 0 : subject === "none" ? 1 : 2;
  return (
    <>
      {[q.explanation, q.explanationNoLine, q.explanationScan].map((text, i) => (
        <span key={i} data-on={i === on || undefined} aria-hidden={i === on ? undefined : true}>
          {text}
        </span>
      ))}
    </>
  );
}

/** Ruling 7 (P19, one click): the detail the default view leaves out.
 *  Every value is a wire field; a missing one drops its part (Rule 10). */
function Details({ q, siteScan }: { q: NeedsYouQuestion; siteScan: SiteScanProvenance | null }) {
  const evidence = scanEvidence(q.bucket ?? undefined, { details: false, anchorSuffix: false });
  const stamp = siteScan?.measured_at ?? null;
  const duration = fmtScanDuration(siteScan?.duration_ms);
  return (
    <>
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
    </>
  );
}
