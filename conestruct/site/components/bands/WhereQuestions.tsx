"use client";

// #439 (UX group 3, Option B) — the WHERE band's CONFIRM card: the side,
// then the kind, one question at a time.  #440 (UX group 4, Option A) adds
// the third, the cross street, for "Lane closure near an intersection"
// only (ux-group4-cross-street/rulings.md, rulings 1-6, X2, X6-X11).
//
// Authority: validation-artifacts/committed/ux-group3-where/rulings.md,
// rulings 4-6 and the R145 calls W1-W8.  The card is #437's component
// (`QuestionSteps`, W1); this adapter only maps the questions onto it.
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
import type { CrossStreetTag } from "@/lib/cross-street-tag";
import type { CrossStreetMark } from "@/lib/cross-street-mark";
import { crossStreetLabel } from "@/lib/road-detection/labels";
import { QuestionSteps, type StepQuestion } from "../QuestionSteps";

export const SIDE_QUESTION = "Which side of the road is the work on?";
export const KIND_QUESTION = "What kind of work is it?";
/** W3: traces to `_side_options` (each option is the right edge of the
 *  traffic beside it) and the pin model (the corridor is laid out from the
 *  work start, ahead of that traffic). */
export const SIDE_WHY =
  "The plan draws the work on this edge and lays the signs out ahead of the traffic beside it.";
export const CONFIRM_LABEL = "Confirm and lay out the plan";
/** #440 ruling 1.  X1: the second sentence holds — the layout lays an
 *  advance warning set on every cross-street leg (layout.py:1953). */
export const CROSS_QUESTION = "Which intersection is the work near?";
export const CROSS_WHY =
  "Tap where the two streets cross on the map above. The plan lays out signs on the cross street too.";
/** #440 ruling 6. */
export const CROSS_FINDING = "Finding the street name…";
/** #440 X8. */
export const CROSS_NONE = "No cross street found there. Tap closer to where the two streets cross.";
export const CROSS_FAILED = "The street lookup didn't answer.";
/** #440 ruling 4. */
export const BIG_MAP_LABEL = "Use the big map instead";

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

/** #440 ruling 5 / X6: the ✓ row's second line, every value off the wire —
 *  the legs (`approaches.length`, 2 or 1) and the nearest-intersection
 *  read's `offset_ft` and `cross_direction` for the marked pin.  A value
 *  the wire has not carried (the read pending or failed, or an answer for
 *  another crossing) is left out, never computed here (Rule 3). */
export function crossLine(legs: number, tag: CrossStreetTag | null, name: string | null): string {
  const parts: string[] = [];
  if (legs === 2) parts.push("Two-way street");
  else if (legs === 1) parts.push("One-way street");
  const m = tag?.marked;
  if (m && m.name === name) {
    if (m.at) parts.push("at where the work starts");
    else if (m.crossDirection) {
      parts.push(`${m.offsetFt.toLocaleString("en-US")} ft ${m.crossDirection} of where the work starts`);
    }
  }
  return parts.join(" · ");
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
  crossMark,
  crossTag = null,
  onCurrentChange,
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
  /** #440 ruling 4: "Use the big map instead" — the picker, armed. */
  onMarkIntersection?: () => void;
  /** #440: the cross-street mark's state (GeneratorSidebar owns it). */
  crossMark?: CrossStreetMark;
  /** #440 X6: the nearest-intersection read, for the ✓ row's distance. */
  crossTag?: CrossStreetTag | null;
  /** #440: the question on screen, so the band arms its aerial. */
  onCurrentChange?: (id: string | null) => void;
  locked: boolean;
}) {
  const g = geometry.geometry;
  // Only BUILT sides render (#290 hand-check ruling): the backend sends no
  // other; the filter keeps an older backend's from showing.
  const options: SideOption[] = (g?.side_options ?? []).filter((o) => o.built);
  const selected = selectedSideOption(options, scenario.meta.work);
  const refused = g?.side_refused ?? null;

  const questions: StepQuestion[] = [];
  if (showSide) {
    const sideExtra = (
      <>
        {/* #440 X2: the side options do not read the crossing, so they show
            while it is unmarked; the not-marked line and its Mark on map
            left this question (ruling 7). */}
        {options.length === 0 ? (
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
      options: options.map((o) => {
        const lines = sideLines(o.label);
        return { value: o.label, label: lines.line1, consequence: lines.line2, testid: "side-option" };
      }),
      answer: selected ? selected.label : null,
      record: selected
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

  // #440 ruling 1 / X2: the third question, for the near-intersection kind
  // only, after the kind (the side options never read the crossing).
  const crossAsked = showSide && kindPicked && scenario.kind === "near_intersection";
  if (crossAsked) {
    const inter = scenario.meta.intersection ?? null;
    const phase = crossMark?.phase ?? "idle";
    const resolving = phase === "resolving";
    const name = inter ? crossStreetLabel(inter.name) : null;
    const legs = scenario.kind === "near_intersection" ? (scenario.approaches?.length ?? 0) : 0;
    const line = inter ? crossLine(legs, crossTag, inter.name) : "";
    const act = (label: string, testid: string, run: () => void) => (
      <button
        type="button"
        className="wq-link"
        data-write=""
        aria-disabled={locked || undefined}
        onClick={() => {
          if (!locked) run();
        }}
        data-testid={testid}
      >
        {label}
      </button>
    );
    questions.push({
      id: "cross",
      title: "which intersection the work is near",
      question: CROSS_QUESTION,
      explanation: CROSS_WHY,
      options: [],
      answer: inter && !resolving ? name : null,
      record:
        inter && !resolving
          ? {
              className: "confirmed",
              glyph: "✓",
              text: `${CROSS_QUESTION.replace(/\?$/, "")}: ${name}`,
            }
          : null,
      foot: () => <span className="nyq-source" />,
      details: null,
      extra: (
        <>
          {resolving ? (
            // Ruling 6 / P1: in place, at the row's own height.
            <div className="wq-cross-row" data-testid="cross-finding" role="status">
              <span className="wq-cross-body">
                <span className="wq-cross-wait tr-help">{CROSS_FINDING}</span>
              </span>
            </div>
          ) : inter ? (
            <div className="wq-cross-row" data-testid="cross-row">
              <span className={`wq-cross-glyph ${symClass("✓")}`} aria-hidden="true">
                ✓
              </span>
              <span className="wq-cross-body">
                <span className="wq-cross-name" data-testid="cross-row-name">
                  Near {name}
                </span>
                {line && (
                  <span className="wq-cross-sub tr-note" data-testid="cross-row-line">
                    {line}
                  </span>
                )}
              </span>
              {crossMark && (
                <span className="wq-cross-acts">
                  {/* X11: Move re-arms the tap; while re-armed it reads Cancel. */}
                  {crossMark.rearmed
                    ? act("Cancel", "cross-move", crossMark.cancel)
                    : act("Move", "cross-move", crossMark.move)}
                  {act("Undo", "cross-undo", crossMark.undo)}
                </span>
              )}
            </div>
          ) : null}
          {phase === "none" && (
            <p className="tr-note wq-line" data-testid="cross-none" role="status">
              {CROSS_NONE}
            </p>
          )}
          {phase === "error" && (
            <div className="wq-cross-fail" data-testid="cross-failed" role="status">
              <p className="tr-note wq-line">{CROSS_FAILED}</p>
              <span className="wq-cross-acts">
                {crossMark && act("Try again", "cross-retry", crossMark.retry)}
                {onMarkIntersection && act(BIG_MAP_LABEL, "cross-big-map", onMarkIntersection)}
              </span>
            </div>
          )}
        </>
      ),
    });
  }

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
          } else if (q.id === "kind") {
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
          } else if (q.id === "cross") {
            // X7 (P15): the mark's own Undo.
            crossMark?.undo();
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
        // the card stays on the last question so Confirm is on screen —
        // the cross street when it is asked (#440 X9), else the kind.
        fallbackId={kindConfirmed ? null : crossAsked ? "cross" : "kind"}
        onCurrentChange={onCurrentChange}
      />
    </section>
  );
}
