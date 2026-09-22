"use client";

// #288 Phase 1 → #289 Phase 2 — the results stack's reserved first row,
// and the setup fact line that occupies it.
//
// Authority: validation-artifacts/committed/issue-288-results-stack/rulings.md
// (the rule-28 ruling, Ryan, 2026-09-21) and
// validation-artifacts/committed/issue-289-band-stack/rulings.md.
//
// WHAT THIS WAS.  Until #288 the component rendered the next-steps strip
// ("NEXT — 3 STEPS", three chips) inside a reserved, pinned slot (#253,
// #249, #247, #246).  §8.29 dropped the strip: its three chips pointed at
// site conditions, pending items and downloads, and in Direction A's
// column all three are visible in the same viewport.
//
// WHAT SURVIVED, and it is the whole reason the component still exists:
//   · the RESERVED ROW — rule 28.  "The results stack's first row is a
//     reserved slot of its own height plus its gap, mounted from the
//     Generate click onward, released under a decline.  This is the
//     results-head slot's job, kept after the strip itself is dropped."
//   · the LANDING ANCHOR — the slot is the first thing inside
//     `.zone.results`, whose scroll-margin-top lands the verdict strip
//     clear of the nav (globals.css, the #250 ruling).  Ruling 184's
//     arc-28 landing carries everything below it.
//
// ─── PHASE 1'S DEVIATION, NOW CLOSED ───
//
// Phase 1 rendered null and said why: rule 28 reserves the row so the
// results do not move when its occupant forms at the settle, and in
// Phase 1 the occupant — the setup fact line — was not built.  An
// always-empty reserve prevents no movement, so it reserved nothing and
// the deviation was recorded against the rule rather than hidden inside
// it.
//
// Phase 2 builds the occupant.  Rule 119: "Setup collapsed to ONE fact
// line whose value is the whole scenario in one string, ordered: kind ·
// road and direction · extent · side · speed · jurisdiction."  Part 1
// §2.5 puts it third in the reading order, between the verdict strip and
// NEEDS YOU — which is this slot.  `setupValue()` composes the string
// (lib/scenarios/band-facts.ts), the same module the pre-generate fact
// lines read, so setup says the same thing on both sides of Generate.
//
// THE RESERVE, AND WHY IT IS A FLOOR.  `--fact-min-h` is 48 px: rule 56's
// own arithmetic, corrected (#289 R9).  The line grows past it whenever
// the scenario string wraps — measured at 60.00 px at 1440 and 97.56 at
// 380 on a local build — so the slot reserves the floor and the row takes
// what it needs.  A fixed height would have reserved the wrong amount and
// the results would still have shifted at the settle, which is the defect
// rule 28 exists to prevent.
//
// THE VERB IS "CHANGE ONE THING" (rule 58), not "CHANGE": post-generate
// the line is one row standing for a whole scenario, and the verb says
// what pressing it does.

import type { Scenario } from "@/lib/scenarios";
import { setupValue } from "@/lib/scenarios/band-facts";
import { useWriteLock } from "./WriteLock";

export function ResultsHead({
  reserve = false,
  scenario,
  jurisdictionName = null,
  settled = false,
  declined = false,
  onReopen,
}: {
  /** The shell's "post-generate and not declined" predicate.  It mounts
   *  the slot from the Generate click onward and releases it under a
   *  decline — rule 28's own words. */
  reserve?: boolean;
  scenario?: Scenario;
  jurisdictionName?: string | null;
  /** Has the answer landed?  The slot is reserved from the click; its
   *  OCCUPANT forms at the settle, which is the movement rule 28 is
   *  about.  In flight the row is empty and holds its floor. */
  settled?: boolean;
  /** Rule 120: "Setup fact line unchanged and still changeable."  A
   *  decline RELEASES the reserve — rule 28's own word, and there is no
   *  answer forming below to reserve room for — but the line itself
   *  stays, because the operator's way back into the input is the only
   *  recovery a refusal leaves them. */
  declined?: boolean;
  /** Rule 58's "CHANGE ONE THING".  Until S7 exists this re-opens the
   *  band stack — the same thing "Edit full setup" did, under the name
   *  and the shape the design gives it.  S7 makes it re-open ONE band
   *  with one field, in place. */
  onReopen?: () => void;
}) {
  // #252 (ruling b) / rule 118: the link is a write control — it leads
  // to one — so it declares itself and goes quiet under the lock.
  // `aria-disabled`, not `disabled`, so it stays focusable while the
  // working band is up.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const locked = useWriteLock();
  if (!reserve) return null;
  const occupied = (settled || declined) && scenario !== undefined;
  return (
    <div
      className={`results-head-slot${declined ? " is-released" : ""}`}
      data-testid="results-head-slot"
    >
      {occupied && (
        <div className="a-fact" data-testid="fact-setup" data-fact-state="done">
          <span className="a-sym" aria-hidden>
            {"✓"}
          </span>
          <div className="a-mid">
            <span className="tr-field">Setup</span>
            <span className="a-lead" aria-hidden />
            <span className="a-val">
              {setupValue(scenario, jurisdictionName)}
            </span>
          </div>
          {onReopen && (
            <button
              type="button"
              className="a-lk"
              data-write=""
              aria-disabled={locked || undefined}
              onClick={() => {
                if (!locked) onReopen();
              }}
              data-testid="fact-link-setup"
            >
              CHANGE ONE THING
            </button>
          )}
        </div>
      )}
    </div>
  );
}
