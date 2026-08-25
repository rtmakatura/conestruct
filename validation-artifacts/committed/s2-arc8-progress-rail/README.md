# s2-arc8 — the rail arc (Refs #221, #222)

Direction 2A implemented: a kind-generic progress rail with jump links,
the CTA disabled-reason single-sourced with the rail, and pre-pin step
gating.  Branch `issue-221-progress-rail`; frontend-only, no wire
change.

## baseline/ — production at `0fa328e`, 2026-08-25, read-only

`s2a8-baseline.js` walked prod headless before any code:

- **S1 re-confirmed on all three kinds** (`s2a8-baseline-raw.md` P1):
  full form live pre-pin (31/29/41 enabled controls), Scenario/STEP 2
  rendering above Location/STEP 1 everywhere, the location reason only
  at the panel foot (NI: y=2,830).  `P1-ni-prepin.png`.
- **S4 measured at HEAD** (P2): Race∩Colfax hold row y=2,479 vs the
  CTA's reason line y=3,442 — 963 px top-to-top, ~875 px gap; blocker
  and pointer never co-visible at a 1,000-px viewport.  (The
  exploration's "~2,000 px" was an estimate in a differently-expanded
  panel; the fresh measurement is smaller and the stall stands.)
- **The invisible queue, live**: wz=0 stacked on the pending hold →
  the CTA reason shows ONLY "Work zone length is required." while
  three separate role=alert rows sit at y=1,872/2,355/3,319
  (`P2-queue-wz0.png`).  Multi-blocker before-state
  (`P2-multidispute-before.png`): hold ⚠ + Schedule "Not set" ◌ +
  gated CTA showing one reason.  After "Lane count is right" the CTA
  enabled (`P2-after-confirm.png`) — the hold was the sole hard gate
  at this pin; the disputes-on-both-legs + refusal stack is pinned in
  `lib/scenarios/rail.test.ts` (the s2-arc6 adversarial relay shape).

## The change (4 commits)

1. `c52a7db` — `lib/scenarios/rail.ts`: the CTA's gate + ranked reason
   chain extracted verbatim (single source); every simultaneous blocker
   mapped to its home entry.  17 unit tests; CTA suites unmodified.
2. `5422b36` — ProgressRail (sticky, jump links, one ⚠ per blocker,
   Rule-13 text beside every glyph) + FieldGroup anchors + #193-armed
   jump focus.  Mounted single-source equality suite.
3. `f5664bf` — #222: pending = dim 0.35 + `inert` + focusable summary;
   Scenario relabeled STEP 1 / Location STEP 2 (order now matches
   numbers, no DOM reorder).
4. this commit — evidence.

Live checks after ship: S1/S4 measured gone, the multi-blocker stack
visible on the rail, one-voice live, shoulder clean-kind control, axe
vs the recorded baseline.
