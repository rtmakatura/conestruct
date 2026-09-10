"use client";

// #253 (s2-arc26; was #249 + #247 + #246) — the results-head slot and
// the next-steps strip, one component rendered VERBATIM from the shell's
// derived ``NextSteps`` (lib/next-steps.ts — the deriveRail idiom, #228:
// the component decides nothing).
//
//   strip    a plan LANDED: three chips, in order — 01 Site conditions
//            (open of total, "· k STAGED" appended), 02 Pending items,
//            03 Download (the zip's parts) — each ONE <a>, a data-read
//            in-page link (never a write; live under the band, spec 26)
//            that jumps with scroll + focus (#193, jumpToAnchor — kept
//            over spec 10's plain anchor navigation).  Symbol + word per
//            state (P9): ▲ open work · ✓ a confirmed zero / a produced
//            artifact · ◌ nothing evaluated.  Never "done", never a
//            filled chip (spec 9).  The strip REPLACES the #249 lockup
//            (GO conflict 1: one field, one surface).
//   slot     ``reserve`` (#240, P1): from the Generate click the slot
//            (`.results-head-slot`, min-height --strip-h + the 14 px gap)
//            is mounted, empty, so the strip lands at the settle into
//            room already allocated; released under a declined plan.
//            The slot is also the pin: sticky within the results zone at
//            --nav-h / --z-strip (ruled deviation from spec 3's page-wide
//            pin), static below 520 px of the zone's width (spec 34).
//   null     pre-generate: nothing, not even the slot.
//
// Visual only (no live region — the strip never says what the system is
// doing, spec 23; the band is that voice).  Not a rail entry (#228).

import { jumpToAnchor } from "./GeneratorFormPrimitives";
import { nextStepChips, type ChipView, type NextSteps } from "@/lib/next-steps";

export function ResultsHead({
  steps,
  reserve = false,
}: {
  steps: NextSteps | null;
  reserve?: boolean;
}) {
  if (steps === null && !reserve) return null;
  return <div className="results-head-slot">{steps && <Strip steps={steps} />}</div>;
}

function Strip({ steps }: { steps: NextSteps }) {
  const chips = nextStepChips(steps);
  return (
    <nav className="ns-strip" aria-label="Next steps">
      {/* Spec 16: the header voice ("01 SETUP") — the section role. */}
      <div className="ns-label tr-section">NEXT — 3 STEPS</div>
      <div className="ns-chips">
        {chips.map((c) => (
          <Chip key={c.index} chip={c} />
        ))}
      </div>
    </nav>
  );
}

function Chip({ chip }: { chip: ChipView }) {
  // Spec 17, in order: index · glyph · name · count.  The index and the
  // count ride the step role, the name the field role; the glyph cell
  // is the one chosen size (11px, lib/design/type-exceptions.ts).
  return (
    <a
      className={`ns-chip is-${chip.state}`}
      data-read=""
      href={`#${chip.anchor}`}
      aria-disabled={chip.inert ? "true" : undefined}
      tabIndex={chip.inert ? -1 : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (chip.inert) return;
        jumpToAnchor(chip.anchor);
      }}
    >
      <span className="ns-index tr-step">{chip.index}</span>
      <span className="ns-glyph" aria-hidden="true">
        {chip.glyph}
      </span>
      <span className="ns-name tr-field">{chip.name}</span>
      <span className="ns-count tr-step">
        {chip.numeral !== null ? (
          <>
            <b className="ns-num">{chip.numeral}</b> {chip.rest}
          </>
        ) : chip.state === "none" ? (
          `◌ ${chip.rest}`
        ) : (
          chip.rest
        )}
      </span>
    </a>
  );
}
