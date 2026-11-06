"use client";

// #439 (UX group 3, Option B) — the WHERE band's CONFIRM card, one
// question at a time.  #440 (UX group 4, Option A) adds the cross street
// for "Lane closure near an intersection" only, and its ruling 2 sets the
// order: the kind, then the cross street, then the side (ux-group4-cross-
// street/rulings.md, rulings 1-6, X6-X11, X20-X21).
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

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { Scenario, ScenarioKind, ScenarioMeta } from "@/lib/scenarios";
import { SCENARIO_KINDS, isScenarioKindEnabled } from "@/lib/scenarios";
import { kindCitation, kindLabel } from "@/lib/scenarios/band-facts";
import {
  selectedSideOption,
  type CorridorGeometry,
  type GeometryFetch,
  type SideOption,
} from "@/lib/corridor-geometry";
import { symClass } from "@/lib/design/symbols";
import type { CrossStreetTag } from "@/lib/cross-street-tag";
import type { CrossStreetMark } from "@/lib/cross-street-mark";
import { crossStreetLabel } from "@/lib/road-detection/labels";
import {
  focusWasDropped,
  REVEAL_WAIT_MS,
  scrollAerialPartIn,
  scrollCrossRowIn,
} from "@/lib/cross-street-reveal";
import { QuestionSteps, type StepQuestion } from "../QuestionSteps";

export const SIDE_QUESTION = "Which side of the road is the work on?";
export const KIND_QUESTION = "What kind of work is it?";
/** W3: traces to `_side_options` (each option is the right edge of the
 *  traffic beside it) and the pin model (the corridor is laid out from the
 *  work start, ahead of that traffic). */
export const SIDE_WHY =
  "The plan draws the work on this edge and lays the signs out ahead of the traffic beside it.";
export const CONFIRM_LABEL = "Confirm and lay out the plan";
/** #440 ruling 1.  X23 (Ryan, 2026-11-04; supersedes X1's second
 *  sentence): page 1 doesn't draw the cross street (#117 Option C,
 *  plan_sheet.py:4993), but every count does carry its signs (page 1's
 *  summary, the device XLSX, the quote: #372), so the line says both. */
export const CROSS_QUESTION = "Which intersection is the work near?";
export const CROSS_WHY =
  "Tap where the two streets cross on the map above. The plan counts signs for the cross street. The sheet points to CDOT's standard drawing for where they go.";
/** #440 ruling 6. */
export const CROSS_FINDING = "Finding the street name…";
/** #440 X8. */
export const CROSS_NONE = "No cross street found there. Tap closer to where the two streets cross.";
export const CROSS_FAILED = "The street lookup didn't answer.";
/** #440 ruling 4. */
export const BIG_MAP_LABEL = "Use the big map instead";
/** #440 ruling 2 (X21), verbatim. */
export const SIDES_CHANGED = "The sides changed with the new kind of work.";

/** #440 ruling 2 / X20: clears an answered side when a kind change changes
 *  the backend's built side options, and reports that it did, until the
 *  side is answered again.  Nothing is derived here: the labels compared
 *  are the backend's `side_options`, before and after (Rule 3).  The
 *  "after" is the first ready geometry object that is not the one on
 *  screen when the kind changed.  Called by GeneratorSidebar, which owns
 *  the geometry read and stays mounted while the bands open and close. */
export function useSideClearOnKindChange(
  scenario: Scenario,
  setMeta: (m: ScenarioMeta) => void,
  geometry: GeometryFetch,
): boolean {
  const options = (geometry.geometry?.side_options ?? []).filter((o) => o.built);
  const selected = selectedSideOption(options, scenario.meta.work);
  const [changed, setChanged] = useState(false);
  // The kind and the labels the answered side was chosen from.
  const basis = useRef<{ kind: ScenarioKind; labels: string } | null>(null);
  // The kind changed to, and the geometry object on screen at that moment.
  const pending = useRef<{ kind: ScenarioKind; stale: CorridorGeometry | null } | null>(null);
  const ready = geometry.state === "ready" ? geometry.geometry : null;
  const labels = options
    .map((o) => o.label)
    .sort()
    .join("\n");
  const kind = scenario.kind;
  const meta = scenario.meta;
  useEffect(() => {
    const b = basis.current;
    if (b && b.kind !== kind) {
      if (!pending.current || pending.current.kind !== kind) {
        pending.current = { kind, stale: geometry.geometry };
      }
      if (ready && ready !== pending.current.stale) {
        pending.current = null;
        if (meta.work && labels !== b.labels) {
          // W6's unsided state: nothing is written in the side's place.
          const { work: _drop, ...rest } = meta;
          void _drop;
          basis.current = null;
          setChanged(true);
          setMeta(rest);
        } else {
          basis.current = meta.work ? { kind, labels } : null;
        }
      }
      return;
    }
    pending.current = null;
    if (selected && ready) basis.current = { kind, labels };
    else if (!meta.work) basis.current = null;
    if (selected && changed) setChanged(false);
  }, [kind, meta, ready, geometry.geometry, labels, selected, changed, setMeta]);
  return changed;
}

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
  sidesChanged = false,
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
  /** #440 ruling 2 / X20: a kind change cleared the side
   *  (`useSideClearOnKindChange`, in GeneratorSidebar); the side question
   *  says why until it is answered again. */
  sidesChanged?: boolean;
  locked: boolean;
}) {
  const g = geometry.geometry;
  // Only BUILT sides render (#290 hand-check ruling): the backend sends no
  // other; the filter keeps an older backend's from showing.
  const options: SideOption[] = (g?.side_options ?? []).filter((o) => o.built);
  const selected = selectedSideOption(options, scenario.meta.work);
  const refused = g?.side_refused ?? null;

  // #446 ruling 3: a tap that found a street focuses the ✓ row's heading,
  // then brings the row and "Next question" into view, once per tap.  A
  // mark made any other way moves nothing (T6).  T15: the scroll waits for
  // the read that lengthens the lines above the button, so it runs once, to
  // the right place.  Move, Undo or the picker opening before then call it
  // off (ruling 5, T21).
  const sectionRef = useRef<HTMLElement | null>(null);
  const foundCount = crossMark?.foundCount ?? 0;
  const foundSeen = useRef(foundCount);
  const scrollOwed = useRef(false);
  const crossingName = scenario.meta.intersection?.name;
  const hasCrossing = Boolean(scenario.meta.intersection);
  const readIn = hasCrossing && crossTag?.marked?.name === crossingName;
  const revealOwed = crossMark?.revealOwed ?? false;
  const cardPart = <T extends HTMLElement>(selector: string) =>
    sectionRef.current?.querySelector<T>(selector) ?? null;
  const aerialPart = (selector: string) =>
    sectionRef.current?.closest(".wq-stack")?.querySelector<HTMLElement>(selector) ?? null;
  // #446 T26: the card's Try again leaves with the retry.  If it fails again,
  // focus comes back to the new one; if it answers "no street" there's no new
  // one, so focus goes to that answer's line, where the person already is (the
  // bar's big-map button can be off screen).  Found goes to the heading (T9).
  const markPhase = crossMark?.phase ?? "idle";
  const cardRetryHadFocus = useRef(false);
  useEffect(() => {
    if (cardRetryHadFocus.current && focusWasDropped()) {
      const target =
        markPhase === "error"
          ? cardPart('[data-testid="cross-retry"]')
          : markPhase === "none"
            ? cardPart('[data-testid="cross-none"]')
            : null;
      target?.focus({ preventScroll: true });
    }
    if (markPhase !== "resolving") cardRetryHadFocus.current = false;
  }, [markPhase]);
  useEffect(() => {
    if (foundCount === foundSeen.current) return;
    // Seen either way: a tap that landed with the row off the card is over,
    // and a later mark made another way must not act on it (T6).
    foundSeen.current = foundCount;
    const heading = cardPart('[data-testid="cross-row-name"]');
    if (!hasCrossing || !heading) return;
    scrollOwed.current = true;
    heading.focus({ preventScroll: true });
  }, [foundCount, hasCrossing]);
  useEffect(() => {
    if (!scrollOwed.current) return;
    const go = () => {
      scrollOwed.current = false;
      const row = cardPart('[data-testid="cross-row"]');
      const next = cardPart(".nyq-foot .wq-next");
      const frame = aerialPart('[data-testid="band-aerial-frame"]');
      if (frame && row && next) scrollCrossRowIn(frame, row, next);
    };
    if (!hasCrossing || !revealOwed) {
      scrollOwed.current = false;
      return;
    }
    if (readIn) {
      go();
      return;
    }
    const t = setTimeout(go, REVEAL_WAIT_MS);
    return () => clearTimeout(t);
  }, [foundCount, hasCrossing, readIn, revealOwed]);

  const questions: StepQuestion[] = [];
  // #440 ruling 2: the kind is pushed first, below; the side last.
  let sideQuestion: StepQuestion | null = null;
  if (showSide) {
    const sideExtra = (
      <>
        {sidesChanged && !selected && (
          <p className="tr-note wq-line" data-testid="side-changed-note" role="status">
            {SIDES_CHANGED}
          </p>
        )}
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
    sideQuestion = {
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
    };
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

  // #440 rulings 1-2 / X20: the second question, for the near-intersection
  // kind only, between the kind and the side.
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
            // Ruling 6 / P1: in place, at the row's own height.  #446 T3: the
            // aerial's bar is the one live region for the tap's answer.
            <div className="wq-cross-row" data-testid="cross-finding">
              <span className="wq-cross-body">
                <span className="wq-cross-wait tr-help">{CROSS_FINDING}</span>
              </span>
            </div>
          ) : inter ? (
            <div className="wq-cross-row" data-testid="cross-row">
              <span className={`wq-cross-glyph ${symClass("✓")}`} aria-hidden="true">
                ✓
              </span>
              <div className="wq-cross-body">
                {/* #446 T9: a real heading, one under the question's h3;
                    focus lands here after a tap finds a street. */}
                <h4 className="wq-cross-name" data-testid="cross-row-name" tabIndex={-1}>
                  Near {name}
                </h4>
                {line && (
                  <span className="wq-cross-sub tr-note" data-testid="cross-row-line">
                    {line}
                  </span>
                )}
              </div>
              {crossMark && (
                <span className="wq-cross-acts">
                  {/* X11: Move re-arms the tap; while re-armed it reads Cancel. */}
                  {crossMark.rearmed
                    ? act("Cancel", "cross-move", crossMark.cancel)
                    : act("Move", "cross-move", () => {
                        // #446 T24 (Ryan, 2026-11-06, amending ruling 5): the
                        // picture to tap comes back into view.
                        crossMark.move();
                        const frame = aerialPart('[data-testid="band-aerial-frame"]');
                        if (frame) scrollAerialPartIn(frame);
                      })}
                  {act("Undo", "cross-undo", crossMark.undo)}
                </span>
              )}
            </div>
          ) : null}
          {phase === "none" && (
            <p className="tr-note wq-line" data-testid="cross-none" tabIndex={-1}>
              {CROSS_NONE}
            </p>
          )}
          {phase === "error" && (
            <div className="wq-cross-fail" data-testid="cross-failed">
              <p className="tr-note wq-line">{CROSS_FAILED}</p>
              <span className="wq-cross-acts">
                {crossMark &&
                  act("Try again", "cross-retry", () => {
                    cardRetryHadFocus.current = true;
                    crossMark.retryFromCard();
                  })}
                {onMarkIntersection && act(BIG_MAP_LABEL, "cross-big-map", onMarkIntersection)}
              </span>
            </div>
          )}
        </>
      ),
    });
  }
  // #440 ruling 2: the side is asked last, once its options are final.
  if (sideQuestion) questions.push(sideQuestion);

  return (
    <section
      ref={sectionRef}
      className="wq"
      data-testid="where-questions"
      aria-labelledby="where-confirm-h"
    >
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
        // the side when it is asked (#440 X9 as amended by X20), else the kind.
        fallbackId={kindConfirmed ? null : showSide ? "side" : "kind"}
        onCurrentChange={onCurrentChange}
      />
    </section>
  );
}
