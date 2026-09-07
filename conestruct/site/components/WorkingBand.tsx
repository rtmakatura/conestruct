"use client";

// #252 (s2-arc23) — the global working band: ONE fixed bottom band,
// mounted iff a request for the generated scenario is open, rendered
// VERBATIM from the shell's ``deriveWorkingBand`` (the deriveRail idiom,
// #228: the component decides nothing).  Spec A "docked band", as ruled:
//
//   · symbol ◌ (pending, --none: one glyph, one meaning, one colour —
//     DESIGN-SPACING) · verb · object · "⚠ CONTROLS LOCKED".  No stage
//     line (the backend emits no stage events and the verb already
//     says it — spec 16's gerund fallback rejected); no CANCEL (spec
//     38's fallback: aborting a fetch does not roll back the wire
//     scenario, rule 10).  Symbol and word always travel together.
//   · the 2 px track above the row is the only motion; it encodes
//     "alive", never percent done; static under reduced motion.
//   · the content row is the page's ONE working live region
//     (role=status, polite): the sentence is the visible text in DOM
//     order.  The strip's region speaks verdicts, the refusal container
//     speaks refusals, the #193 region speaks the package — no event
//     has two speakers.
//   · never a timer, never a failure state: the request closing is the
//     unmount, whatever the answer was.

import type { WorkingBandState } from "@/lib/working-band";

export const CONTROLS_LOCKED = "⚠ CONTROLS LOCKED";

export function WorkingBand({ state }: { state: WorkingBandState | null }) {
  if (state === null) return null;
  return (
    <div className="working-band">
      <div className="wb-track" aria-hidden="true" />
      <div className="wb-row" role="status" aria-live="polite">
        <span className="wb-glyph" aria-hidden="true">
          ◌
        </span>
        <span className="wb-verb">{state.verb}</span>
        <span className="wb-object">
          {state.lead}
          {state.named !== null ? <span className="wb-named">{state.named}</span> : null}
        </span>
        <span className="wb-lock">{CONTROLS_LOCKED}</span>
      </div>
    </div>
  );
}
