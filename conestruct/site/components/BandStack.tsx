"use client";

// #289 Phase 2 — the band stack: the column itself.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// · #281 Part 1 §1.1-§1.4 · Part 2 rules 26, 33, 61-66, 114-116.
//
// WHAT THIS COMPONENT IS RESPONSIBLE FOR, and nothing else:
//   · the column order — collapsed facts above, one open band, pending
//     lines below (rule 65's one-open invariant, which arrives already
//     enforced: `deriveBands()` returns a single `open` id, so a
//     multi-open state is unrepresentable rather than merely avoided);
//   · rule 33's programmatic focus target, tabIndex -1, never in the tab
//     order — the one that replaces Zone 1's (§8.28, ruling 192);
//   · ruling 184's landing: "every collapse lands the next band at a
//     computed spot — the arc-28 landing machinery applies to every
//     collapse, not only Generate."
//
// It decides no content.  Every string it renders came from
// `lib/scenarios/band-facts.ts`.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { JurisdictionBlock } from "@/lib/jurisdiction";
import type { CorridorSpecLengths } from "@/lib/render-types";
import type { Scenario, ScenarioKind, ScenarioMeta } from "@/lib/scenarios";
import type { HandoffEvent } from "@/lib/scenarios/handoff-summary";
import {
  deriveBands,
  type BandId,
  type KindState,
} from "@/lib/scenarios/band-facts";
import { FactLine } from "./bands/BandPrimitives";
import { WhereBand } from "./bands/WhereBand";
import { WhatBand } from "./bands/WhatBand";
import { GenerateFrame } from "./bands/GenerateBand";
import { armLandingCheck, type LandingCheck } from "@/lib/landing";

export interface BandStackProps {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  setMeta: (m: ScenarioMeta) => void;
  onOpenPicker: () => void;
  onKindChange: (k: ScenarioKind) => void;
  onGenerate: () => void;
  generating: boolean;
  /** Rule 139's string, from `deriveRail().blocker`.  The stack passes it
   *  through; it never derives one. */
  blockerReason: string | null;
  handoff: HandoffEvent[];
  /** Rule 60 / rule 117 — S4.  In flight, the whole stack collapses:
   *  every band is a fact line at opacity .5 with the word "locked" in
   *  place of its link, no band is open, and the generate frame unmounts
   *  with the rest of the writes.  §2.4: "Disappeared: the What band's
   *  fields, the generate frame, the CHANGE links." */
  locked?: boolean;
  /** The backend's corridor zone lengths, for the extent field's rows. */
  corridorSpecLengths?: CorridorSpecLengths | null;
  jurisdictionBlock: JurisdictionBlock | null;
  jurisdictionLoading: boolean;
  jurisdictionErrored: boolean;
  jurisdictionName: string | null;
  /** The kind's own fields, in the shape they already have (see
   *  WhatBand's header). */
  kindFields?: ReactNode;
  /** Correction 1 — the dates control's cells, for the second group. */
  scheduleCells?: ReactNode;
  /** #227's window reference block, under that group's grid. */
  scheduleWindows?: ReactNode;
  jurisdictionSuggest?: ReactNode;
  classificationFields?: ReactNode;
  /** #289 hand-check, 2026-09-23, defect 1 — the shell's record of the
   *  kind choice.  Defaults to "confirmed" for a caller that does not
   *  track it. */
  kindState?: KindState;
  /** A chip click happened — the only way to `picked`. */
  onKindPicked?: () => void;
  /** The WHERE primary was pressed — the only way to `confirmed`. */
  onKindConfirmed?: () => void;
  /** Defect 2: the band a setup-line value link asked for.  `n` counts
   *  presses, so a second press on a value whose band is already asked
   *  for still re-opens it after the user has steered elsewhere.  Null =
   *  the column decides. */
  openRequest?: OpenRequest | null;
}

export interface OpenRequest {
  band: BandId;
  n: number;
}

export function BandStack(props: BandStackProps) {
  const {
    scenario,
    setScenario,
    setMeta,
    onOpenPicker,
    onKindChange,
    onGenerate,
    generating,
    blockerReason,
    handoff,
    locked = false,
    corridorSpecLengths,
    jurisdictionBlock,
    jurisdictionLoading,
    jurisdictionErrored,
    jurisdictionName,
    kindFields,
    scheduleCells,
    scheduleWindows,
    jurisdictionSuggest,
    classificationFields,
    kindState = "confirmed",
    onKindPicked,
    onKindConfirmed,
    openRequest = null,
  } = props;

  // Rule 65: ONE id.  `null` hands the choice back to the column, which
  // is the load path and what every confirm does — the user stops
  // steering and the column moves on.
  const [openOverride, setOpenOverride] = useState<BandId | null>(
    openRequest?.band ?? null,
  );
  // Defect 2: a value link pressed while the stack is already mounted.
  // Keyed on the press count, not the band, so the same band asked for
  // twice is two requests.  The mount-time request is already in the
  // initial state above; re-applying it here is a no-op.
  const requestN = openRequest?.n ?? 0;
  useEffect(() => {
    if (openRequest) setOpenOverride(openRequest.band);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestN]);
  const model = deriveBands({
    scenario,
    jurisdictionName,
    openOverride,
    blockerReason,
    kindConfirmed: kindState === "confirmed",
  });

  const stackRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef<HTMLDivElement | null>(null);
  const landingRef = useRef<LandingCheck | null>(null);
  useEffect(() => () => landingRef.current?.cancel(), []);

  // Ruling 184.  Every change of which band is open is a collapse and a
  // re-open, so every one of them lands — the same `armLandingCheck` the
  // Generate settle uses, with #289 R8's reachability predicate inside it
  // so a column shorter than the viewport reports a landing rather than a
  // failure.  Measured per transition in
  // validation-artifacts/committed/issue-289-band-stack/prototype/.
  //
  // Skipped on the FIRST render: S1 is not a transition, and scrolling a
  // freshly-loaded page to a band that is already at the top would be
  // movement the user did not ask for (P1).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Nothing is open under the lock, so there is nothing to land on.
    if (locked) return;
    const el = openRef.current;
    if (!el) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Rule 34: under prefers-reduced-motion the transition is instant.
    const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
    el.scrollIntoView({ behavior, block: "start" });
    landingRef.current?.cancel();
    landingRef.current = armLandingCheck(el, behavior);
    // Rule 33: "a CHANGE link focuses the band it re-opens."
    el.focus({ preventScroll: true });
    // `locked` is READ here, never depended on: the landing belongs to a
    // band TRANSITION (ruling 184), and re-running it when the lock
    // released would move the page for a request settling, which is the
    // movement P1 forbids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.open]);

  const openBand = useCallback((id: BandId) => setOpenOverride(id), []);

  const body = (id: BandId): ReactNode => {
    if (id === "where") {
      return (
        <WhereBand
          scenario={scenario}
          setScenario={setScenario}
          setMeta={setMeta}
          onOpenPicker={onOpenPicker}
          // Defect 1: the chip writes the kind AND records that a person
          // chose it.  Re-picking the kind already on the scenario (the
          // default's own chip) is a choice too — `onKindChange` returns
          // early for an unchanged kind, so the record is a separate call
          // rather than a side effect of the write.
          onKindChange={(k) => {
            onKindChange(k);
            onKindPicked?.();
          }}
          kindPicked={kindState !== "none"}
          kindConfirmed={kindState === "confirmed"}
          onConfirm={() => {
            onKindConfirmed?.();
            setOpenOverride("what");
          }}
          handoff={handoff}
          corridorSpecLengths={corridorSpecLengths}
          stepIndex={model.stepIndex}
          // Correction 3: "Found the spot" names road + direction +
          // jurisdiction, and the jurisdiction is the EVALUATED name the
          // stack already holds for the fact lines — one string, one
          // source, never a second lookup.
          jurisdictionName={jurisdictionName}
        />
      );
    }
    return (
      <WhatBand
        scenario={scenario}
        setScenario={setScenario}
        setMeta={setMeta}
        // Correction 3: the picker's handoff sentences ride the cells
        // they describe, so the WHAT band takes the same events the
        // WHERE band's retired box used to hold.
        handoff={handoff}
        jurisdictionBlock={jurisdictionBlock}
        jurisdictionLoading={jurisdictionLoading}
        jurisdictionErrored={jurisdictionErrored}
        stepIndex={model.stepIndex}
        kindFields={kindFields}
        scheduleCells={scheduleCells}
        scheduleWindows={scheduleWindows}
        jurisdictionSuggest={jurisdictionSuggest}
        classificationFields={classificationFields}
      />
    );
  };

  return (
    <div
      ref={stackRef}
      tabIndex={-1}
      className="band-stack"
      data-testid="band-stack"
      data-open-band={locked ? "none" : model.open}
      data-locked={locked || undefined}
    >
      {model.facts.map((fact) =>
        // Rule 60, the in-flight variant: the row at opacity .5 and the
        // link replaced by the provenance word "locked".  It comes
        // BEFORE the generate branch, because in flight there is no
        // frame either (§2.4).
        locked ? (
          <FactLine key={fact.id} fact={fact} locked />
        ) :
        // The GENERATE row is always the frame.
        //
        // §2.1 item 5 draws a pending fact line before there is a pin,
        // and this build cannot have one: #260 (ruled, with a browser
        // leg behind it) makes the disabled primary's `cta-reason` alert
        // the ONE live region that carries the gate sentence — "the CTA
        // reason is the ONE live region carrying the instruction; the
        // strip names the state without repeating it".  A pending line
        // in its place would unmount the only speaker and leave the
        // column saying "pending" without saying why.
        //
        // Rule 5: a stated deviation from §2.1, not a slip.  The frame
        // reads as unfinished work either way — the primary is disabled
        // with its reason under it — and rule 139's chain stays whole.
        fact.id === "generate" ? (
          <GenerateFrame
            key={fact.id}
            onGenerate={onGenerate}
            generating={generating}
            blockerReason={blockerReason}
          />
        ) : fact.id === model.open ? (
          // The open band carries the stack's landing target and the
          // focus rule 33 gives a re-opened band.  tabIndex -1 keeps it
          // out of the tab order; the controls inside it are the tab
          // order.
          <div
            key={fact.id}
            ref={openRef}
            tabIndex={-1}
            className="outline-none"
            style={{ scrollMarginTop: "calc(var(--nav-h) + 8px)" }}
          >
            {body(fact.id)}
          </div>
        ) : (
          <FactLine
            key={fact.id}
            fact={fact}
            onOpen={fact.verb ? openBand : undefined}
          />
        ),
      )}
      {/* The GENERATE band is reachable from its own fact line like any
          other, so no separate affordance exists — which is rule 65 doing
          its job: there is one way to open a band, and it is the line. */}
    </div>
  );
}
