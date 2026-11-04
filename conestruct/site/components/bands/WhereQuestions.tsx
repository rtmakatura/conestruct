"use client";

// #439 (UX group 3, Option B) — the WHERE band's CONFIRM card: the side,
// then the kind, one question at a time.
//
// Authority: validation-artifacts/committed/ux-group3-where/rulings.md,
// rulings 4-6 and the R145 calls W1-W8.  The card is #437's component
// (`QuestionSteps`, W1); this adapter only maps the two questions onto it.
//
// Suggest-never-set is unchanged (Rule 8, #289): the kind starts unchosen
// and only a click on its row chooses it; the backend's proposal marks a
// row and never selects it.  The side's choices, their words and which
// are built are the backend's `side_options` (#290); a click writes the
// option's `meta.work` verbatim and no direction is composed here (Rule 3).

import type { ReactNode } from "react";

import type { Scenario, ScenarioKind, ScenarioMeta } from "@/lib/scenarios";
import { SCENARIO_KINDS, isScenarioKindEnabled } from "@/lib/scenarios";
import { kindCitation, kindLabel } from "@/lib/scenarios/band-facts";
import { selectedSideOption, type GeometryFetch, type SideOption } from "@/lib/corridor-geometry";
import { symClass } from "@/lib/design/symbols";
import { QuestionSteps, type StepQuestion } from "../QuestionSteps";

export const SIDE_QUESTION = "Which side of the road is the work on?";
export const KIND_QUESTION = "What kind of work is it?";
/** W3: traces to `_side_options` (each option is the right edge of the
 *  traffic beside it) and the pin model (the corridor is laid out from the
 *  work start, ahead of that traffic). */
export const SIDE_WHY =
  "The plan draws the work on this edge and lays the signs out ahead of the traffic beside it.";
export const CONFIRM_LABEL = "Confirm and lay out the plan";

/** Ruling 6's plain labels for the three live kinds (W4).  Any other kind
 *  falls back to the table's label. */
const KIND_QUESTION_LABEL: Partial<Record<ScenarioKind, string>> = {
  shoulder: "Shoulder work",
  flagger_lane_closure: "Lane closure with flaggers",
  near_intersection: "Lane closure near an intersection",
};

export function kindQuestionLabel(kind: ScenarioKind): string {
  return KIND_QUESTION_LABEL[kind] ?? kindLabel(kind);
}

/** W2: the backend's "<Compass> side · <bound> traffic" as two lines.
 *  A rendering split of the backend's words; nothing is computed. */
export function sideLines(label: string): { line1: string; line2: string | null } {
  const at = label.indexOf(" · ");
  if (at < 0) return { line1: label, line2: null };
  const line1 = label.slice(0, at);
  const rest = label.slice(at + 3);
  if (/^\w+bound traffic$/.test(rest)) return { line1, line2: `Next to ${rest}` };
  return { line1, line2: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

/** W5: the gated count, from the same table as the rows. */
export function gatedKindsLine(gated: number): string | null {
  if (gated <= 0) return null;
  return gated === 1
    ? "1 more kind is coming once it is checked against its standard sheet."
    : `${gated} more kinds are coming once each is checked against its standard sheet.`;
}

function warnLine(text: string, testid: string): ReactNode {
  return (
    <p className="tr-note wq-line" data-testid={testid}>
      {/* #411 (Rule 18): ⚠ in its own hue, not the line's ink. */}
      <span className={symClass("⚠")} aria-hidden="true">
        ⚠{" "}
      </span>
      {text}
    </p>
  );
}

export function WhereQuestions({
  scenario,
  setMeta,
  geometry,
  showSide,
  kindPicked,
  kindConfirmed,
  onKindChange,
  onKindCleared,
  onConfirm,
  onMarkIntersection,
  locked,
}: {
  scenario: Scenario;
  setMeta: (m: ScenarioMeta) => void;
  geometry: GeometryFetch;
  /** A work-start pin: the side is asked. */
  showSide: boolean;
  kindPicked: boolean;
  kindConfirmed: boolean;
  onKindChange: (k: ScenarioKind) => void;
  /** W6: Undo on the kind returns it to unchosen. */
  onKindCleared?: () => void;
  onConfirm: () => void;
  onMarkIntersection?: () => void;
  locked: boolean;
}) {
  const g = geometry.geometry;
  // Only BUILT sides render (#290 hand-check ruling): the backend sends no
  // other; the filter keeps an older backend's from showing.
  const options: SideOption[] = (g?.side_options ?? []).filter((o) => o.built);
  const selected = selectedSideOption(options, scenario.meta.work);
  const notMarked =
    g?.status === "intersection_not_marked" ? (g.message ?? null) : null;
  const refused = g?.side_refused ?? null;

  const questions: StepQuestion[] = [];
  if (showSide) {
    const sideExtra = (
      <>
        {notMarked !== null ? (
          <>
            {warnLine(notMarked, "side-control-not-marked")}
            {onMarkIntersection && (
              <div>
                <button
                  type="button"
                  className="act-btn"
                  data-write=""
                  aria-disabled={locked || undefined}
                  onClick={() => {
                    if (!locked) onMarkIntersection();
                  }}
                  data-testid="side-control-mark"
                >
                  Mark on map
                </button>
              </div>
            )}
          </>
        ) : options.length === 0 ? (
          // P8: one honest line while the road's sides are read; a failure
          // says so rather than offering a guessed choice.
          <p className="tr-note wq-line" data-testid="side-control-note">
            {geometry.state === "error"
              ? "the road's sides are unavailable. Reopen the map to retry"
              : "reading the road's sides…"}
          </p>
        ) : null}
        {/* #300, #315: a stored left side the backend no longer builds; the
            line is the backend's, verbatim, and nothing is reset. */}
        {refused && warnLine(refused.message, "side-control-stale")}
      </>
    );
    questions.push({
      id: "side",
      title: "which side of the road the work is on",
      question: SIDE_QUESTION,
      explanation: SIDE_WHY,
      options:
        notMarked !== null
          ? []
          : options.map((o) => {
              const lines = sideLines(o.label);
              return { value: o.label, label: lines.line1, consequence: lines.line2, testid: "side-option" };
            }),
      answer: notMarked === null && selected ? selected.label : null,
      record:
        notMarked === null && selected
          ? {
              className: "confirmed",
              glyph: "✓",
              text: `${SIDE_QUESTION.replace(/\?$/, "")}: ${sideLines(selected.label).line1}`,
            }
          : null,
      foot: () => <span className="nyq-source" />,
      details: null,
      extra: sideExtra,
    });
  }

  const live = SCENARIO_KINDS.filter((k) => isScenarioKindEnabled(k.v));
  const gated = gatedKindsLine(SCENARIO_KINDS.length - live.length);
  const proposal = g?.kind_proposal ?? null;
  const value = kindPicked ? scenario.kind : null;
  // Ryan, 2026-10-26 (amends #284): once the proposed kind is the one
  // chosen, its "⚠ proposed" and the note go; another kind chosen leaves
  // the proposal unanswered, so it shows.
  const openProposal =
    proposal !== null && value !== proposal.kind && live.some((k) => k.v === proposal.kind)
      ? proposal
      : null;
  questions.push({
    id: "kind",
    title: "what kind of work it is",
    question: KIND_QUESTION,
    explanation: null,
    options: live.map((k) => ({
      value: k.v,
      label: kindQuestionLabel(k.v),
      consequence:
        openProposal?.kind === k.v ? (
          <span data-testid="kind-proposed-mark">
            <span className={symClass("⚠")}>⚠</span> proposed
          </span>
        ) : null,
      testid: `kind-chip-${k.v}`,
    })),
    answer: value,
    record:
      value !== null
        ? {
            className: "confirmed",
            glyph: "✓",
            text: `${KIND_QUESTION.replace(/\?$/, "")}: ${kindQuestionLabel(value)}`,
          }
        : null,
    foot: (details) => <p className="nyq-source tr-note">{details}</p>,
    // Ruling 6: the sheet references, one click away (P19).
    details: live.map((k) => `${kindQuestionLabel(k.v)}: ${kindCitation(k.v)}`).join("; "),
    extra: (
      <>
        {openProposal && (
          <p className="tr-note wq-line" data-testid="kind-proposal-note">
            <span className={symClass("⚠")}>⚠</span> proposed: {openProposal.basis} Pick it to use
            it.
          </p>
        )}
        {gated && (
          <p className="tr-note wq-line" data-testid="kind-gate-note">
            {gated}
          </p>
        )}
      </>
    ),
  });

  return (
    <section className="wq" data-testid="where-questions" aria-labelledby="where-confirm-h">
      <QuestionSteps
        heading="CONFIRM"
        headingId="where-confirm-h"
        headingLevel={2}
        questions={questions}
        onAnswer={(q, v) => {
          if (locked) return;
          if (q.id === "side") {
            const o = options.find((x) => x.label === v);
            if (o && o !== selected) setMeta({ ...scenario.meta, work: { ...o.work } });
          } else {
            onKindChange(v as ScenarioKind);
          }
        }}
        onUndo={(q) => {
          if (locked) return;
          if (q.id === "side") {
            // W6: the plan's unsided state; nothing is written in its place.
            const { work: _drop, ...rest } = scenario.meta;
            void _drop;
            setMeta(rest);
          } else {
            onKindCleared?.();
          }
        }}
        onLast={() => {
          if (!locked) onConfirm();
        }}
        lastLabel={CONFIRM_LABEL}
        lastBlocked={null}
        lastTestId="where-confirm"
        nextClass="a-pri wq-next"
        undoClass="act-btn wq-undo"
        inFlight={locked}
        // W8: with every question answered and the kind not yet confirmed,
        // the card stays on the kind so Confirm is on screen.
        fallbackId={kindConfirmed ? null : "kind"}
      />
    </section>
  );
}
