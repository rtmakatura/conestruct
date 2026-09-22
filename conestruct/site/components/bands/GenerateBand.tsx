"use client";

// #289 Phase 2 — the GENERATE slot: the framed primary at the foot of
// the band stack.
//
// Authority: validation-artifacts/committed/issue-289-band-stack/rulings.md
// (R6) · #281 Part 1 §8.25, §8.26 · Part 2 rules 116 (the generate frame),
// 130-131, 139.
//
// NOT A BAND, and that is Part 1's own shape rather than a shortcut.
// §2.3 (S3) draws the WHAT band OPEN with the generate frame beneath it,
// which rule 65's one-open invariant would forbid if the frame were a
// band.  It is not: it asks no question, so it carries no step question
// (role 5) and nothing to be "open" about.  What it has is the pending
// FACT LINE before there is a pin — "◌ Generate · pending", §2.1 item 5 —
// and the frame once there is one.
//
// §8.26: "Generate footer — became the framed primary at the foot of the
// band stack.  The disabled reason still comes from the same blocker
// chain and still matches the verdict strip's string."  That last clause
// is rule 139, and it is kept by construction: this component takes the
// reason as a prop from `deriveRail().blocker`, the same value the verdict
// strip reads.  Nothing here derives a reason.
//
// R6, ruled 2026-09-22: the site conditions the operator asserts BEFORE a
// plan exists live here.  §8.25 moved the block into NEEDS YOU, and
// Phase 1 built that — but NEEDS YOU does not exist before a plan does, so
// the pre-generate half had no band.  This one is the last question before
// the button, which is exactly what "anything we already know about the
// site" is, and it was the emptiest band in the column.

import type { ReactNode } from "react";
import { GenerateButton } from "../GeneratorFormPrimitives";
import { useWriteLock } from "../WriteLock";

export function GenerateFrame({
  onGenerate,
  generating,
  blockerReason,
  siteConditions,
}: {
  onGenerate: () => void;
  generating: boolean;
  /** Rule 139: the blocker chain's string, single-sourced.  Null means
   *  nothing is blocking.  This component never asks why. */
  blockerReason: string | null;
  /** R6 — "Site conditions you assert", in the shape it already has. */
  siteConditions?: ReactNode;
}): ReactNode {
  const locked = useWriteLock();
  // `generating` is GenerateButton's own busy input; the lock and the
  // blocker are what DISABLE it.  Keeping them separate is what lets the
  // busy label and the disabled reason both be true at once without one
  // overwriting the other.
  const disabled = blockerReason !== null || locked;
  return (
    <div data-testid="generate-slot">
      {/* R6 — the site conditions the operator asserts before a plan
          exists.  The last question before the button, which is what
          "anything we already know about the site" is. */}
      {siteConditions}
      {/* Rule 116's generate frame, and §8.26: "the framed primary at
          the foot of the band stack".  Rule 131's XL sizing is CSS on
          `.a-genframe .generate-btn`, not a second button — the button
          itself is `GenerateButton`, unchanged.

          Reused rather than rebuilt ON PURPOSE.  It already carries
          every clause rule 130 asks for: the disabled reason on `title`,
          the busy label swapped to the present participle with the
          motion on the spinner and not on the label, and the
          `cta-reason` alert that puts the blocker in text as well as on
          a title (rule 142).  A new button would have had to re-earn all
          of that, and the first thing it would have lost is the string —
          "Generate plan" is what every caller, every suite and every
          screen reader knows this control by, and the design's caps are
          a text-transform. */}
      <div className="a-genframe mt-4" data-testid="generate-frame">
        <GenerateButton
          generating={generating}
          onGenerate={onGenerate}
          disabled={disabled}
          disabledReason={blockerReason ?? undefined}
        />
        <div className="tr-prov a-gencap" data-testid="generate-caption">
          Output requires TCS review · every dimension cited to MUTCD or CDOT
        </div>
      </div>
    </div>
  );
}
