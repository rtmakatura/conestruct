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
import { deriveBands, type BandId } from "@/lib/scenarios/band-facts";
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
  /** The backend's corridor zone lengths, for the extent field's rows. */
  corridorSpecLengths?: CorridorSpecLengths | null;
  jurisdictionBlock: JurisdictionBlock | null;
  jurisdictionLoading: boolean;
  jurisdictionErrored: boolean;
  jurisdictionName: string | null;
  /** The kind's own fields and the schedule body, in the shape they
   *  already have (see WhatBand's header). */
  kindFields?: ReactNode;
  scheduleFields?: ReactNode;
  jurisdictionSuggest?: ReactNode;
  classificationFields?: ReactNode;
  /** R6 — the pre-generate site conditions. */
  siteConditions?: ReactNode;
  /** The optional project metadata (§8.16's demoted disclosure). */
  projectDetails?: ReactNode;
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
    corridorSpecLengths,
    jurisdictionBlock,
    jurisdictionLoading,
    jurisdictionErrored,
    jurisdictionName,
    kindFields,
    scheduleFields,
    jurisdictionSuggest,
    classificationFields,
    siteConditions,
    projectDetails,
  } = props;

  // Rule 65: ONE id.  `null` hands the choice back to the column, which
  // is the load path and what every confirm does — the user stops
  // steering and the column moves on.
  const [openOverride, setOpenOverride] = useState<BandId | null>(null);
  const model = deriveBands({
    scenario,
    jurisdictionName,
    openOverride,
    blockerReason,
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
          onKindChange={onKindChange}
          onConfirm={() => setOpenOverride("what")}
          handoff={handoff}
          corridorSpecLengths={corridorSpecLengths}
          stepIndex={model.stepIndex}
          projectDetails={projectDetails}
        />
      );
    }
    return (
      <WhatBand
        scenario={scenario}
        setScenario={setScenario}
        jurisdictionBlock={jurisdictionBlock}
        jurisdictionLoading={jurisdictionLoading}
        jurisdictionErrored={jurisdictionErrored}
        stepIndex={model.stepIndex}
        kindFields={kindFields}
        scheduleFields={scheduleFields}
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
      data-open-band={model.open}
    >
      {model.facts.map((fact) =>
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
            siteConditions={siteConditions}
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
