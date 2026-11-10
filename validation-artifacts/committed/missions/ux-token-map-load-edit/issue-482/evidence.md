# #482 evidence

Branch `issue-482-wait-copy-gap`, stacked on `issue-481-gate-token-never-printed` (`e2c8a3f`). Rulings: rulings.md (Ryan 2026-11-10 (a) and (b), R145-1 to R145-4). Plan and Rule 5 prediction: checkpoint.md.

## The change

1. **(a) The 20-second note is gone.** `ROAD_SLOW_NOTE` and `.ro-note.is-slow` are removed. Past 14 s the NEEDS YOU outline's note is empty and its line stays reserved (41 px before and after at every width), so only the strip's sentence speaks. From 2 s to 14 s the cold-start note is unchanged. If the road check does stop, the scan refusal and its Retry scan still say so (R145-2).
2. **(b) The reference group stands 24 under Downloads, outline and settled.** The outline: `.ro-refs` `margin-top: var(--space-section)` (was the 40 px sum). Settled (R145-3): `#downloads > .dl-sec` bottom margin 0; the `.tier-cue` row is the 24 (`min-height`/`line-height` `var(--space-section)`, `margin: 0`), with the #187 cue's reserved line inside it; the group's 12 top margin drops only after that row.

## Prediction vs actual

As predicted in checkpoint.md: `ResultsOutline.tsx`, `globals.css` and `GeneratorShell.generate-wait.test.tsx`, plus this folder. Nothing else changed. A formatter pass (`npx prettier`) was tried and undone: the repo has no prettier config, so it reflowed whole files and changed their line endings.

## Tests

- Red proof (`red-proof.txt`): the two new assertions failed on the old sources (`2 failed | 8 passed`).
- `GeneratorShell.generate-wait.test.tsx`: 10 passed.
- Every vitest file that reads `globals.css` or `ResultsOutline` (53 files, including disclosures, wait-cues, controls-fidelity, ux-group1, scan-refusal, OutputCards): `53 passed`, `540 passed`.

## The stub walk (`scripts/verify-generate-cls.mjs`, local `next dev` on :3482 against `verify-generate-cls-stub.py` on :8482, Overpass replayed)

| Run | 1440x900 | 1198x930 | 390x844 | File |
|---|---|---|---|---|
| Before the diff, 1 question, held 16 s | CLS 0.0001, refs −2/0, gap 40 outline / 39 settled | 0.0001, −2/0, 40 / 39 | 0.0002, −1/0, 40 / 39 | `walk/probe-before-slow.txt` |
| After, 1 question, held 16 s | CLS 0, refs −1/0, **gap 24 / 24** | 0.0001, −1/0, 24 / 24 | 0.0002, 0/0, 24 / 24 | `walk/probe-after-slow.txt` |
| After, 1 question (every top checked), the permanent check as shipped | CLS 0, outline check PASS | 0, PASS | 0, PASS | `walk/verify-generate-cls-signals.txt` |
| After, 3 questions (recorded) | CLS 0, PASS (sections +89, refs +88: downward growth) | 0, PASS | 0, PASS (+51) | `walk/verify-generate-cls-recorded.txt` |

Outlines left after the settle: 0 in every run. Past 14 s the strip reads "⚠ This is taking longer than usual. The first plan after a quiet spell can take up to 30 seconds." and the note reads "" (after) vs the 20-second sentence (before). The probe is the permanent check plus the gap measures and crops; it was built from the script and is not committed.

Not walked: the cue row with "◌ previous answer, refreshing…" in it (an APPLY refetch). The vitest disclosures case pins the slot and the cue; the row is 24 px with the cue on a 24 px line, so it fits without growing.

## Crops for Ryan's hand check (`crops/`)

- `1440x900-outline-after-14s.png`, `390x844-outline-after-14s.png`: the strip's 14 s sentence and the outline with an empty note (before: `before-*-outline-after-14s.png`).
- `1440x900-reference-gap.png`, `390x844-reference-gap.png`: Downloads' last row to the reference group, 24 px (before: `before-*-reference-gap.png`, 39 px).
