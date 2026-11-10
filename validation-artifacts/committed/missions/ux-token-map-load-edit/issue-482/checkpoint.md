# #482 checkpoint: the plan and the Rule 5 prediction (written before the diff)

Baseline on `e2c8a3f` (this worktree, `issue-481-gate-token-never-printed`): `GeneratorShell.generate-wait.test.tsx` 9 passed. Baseline walk (stub, one-question fixture, `HOLD_MS=16000`, before the diff): CLS 0.0001 / 0.0001 / 0.0002, outline check PASS (refs top −2 / −2 / −1); outline gap 40, settled gap 39 at every width; the note past 14 s reads the 20-second sentence.

## The plan

1. **The problem.** Past 14 s two slow sentences speak at once (strip: "up to 30 seconds"; outline note: "stops after 20 seconds"). The outline's reference group stands 40 px (a token sum) under Downloads.
2. **The rulings.** Ryan 2026-11-10 (a) and (b), verbatim in rulings.md; R145-1 to R145-4.
3. **The change.** The note is empty past 14 s; the reference group stands 24 (`--space-section`) under Downloads, outline and settled (R145-3).
4. **Rule 5 churn prediction** (below).
5. **The proof.** Red-proved vitest in `GeneratorShell.generate-wait.test.tsx` (the note past 14 s is empty; the outline and settled gap rules are the one token); that file plus `GeneratorShell.disclosures.test.tsx`, `GeneratorShell.wait-cues.test.tsx`, `controls-fidelity.test.tsx`, `GeneratorShell.ux-group1.test.tsx`; the stub walk at 1440/1198/390 (CLS, outline check with every top checked, measured gaps), crops of the outline after 14 s and the reference-group gap at 1440 and 390.

## Rule 5: predicted churn

**Changes:**
- `conestruct/site/components/ResultsOutline.tsx`: `ROAD_SLOW_NOTE` removed; the note renders `COLD_START_NOTE` for `"cold"` and nothing otherwise; the `is-slow` class on the note goes; comments. The `WaitSlow` type and `slow` prop stay.
- `conestruct/site/app/globals.css`: `.ro-refs` `margin-top: var(--space-section)` and its comment; `.ro-note.is-slow` removed; `.tier-cue` `min-height`/`line-height` `var(--space-section)`, `margin: 0`; two new rules: `#downloads > .dl-sec` bottom margin 0 and `.results-stack > :has(> .tier-cue) + .results-disc` top margin 0.
- `conestruct/site/components/GeneratorShell.generate-wait.test.tsx`: the 14 s assertion expects an empty note; a new CSS case pins the four spacing rules.
- Evidence: this folder (rulings.md, checkpoint.md, evidence.md, walk output, crops).

**Byte-identical:** the backend; every request body; device counts; `StatusBar.tsx` (the strip's 14 s sentence); `GeneratorShell.tsx`; `OutputCards.tsx`; `scripts/verify-generate-cls.mjs`; every user-facing string except the removed note.
