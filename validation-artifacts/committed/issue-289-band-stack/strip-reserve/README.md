# #289 — the verdict strip's reserved height, re-measured

`--status-h` is the strip's reserved height: `.status-slot` and `.status-bar` both take it as
`min-height`, so the first verdict's arrival moves nothing below the strip (#250 f2, #260).
It was **52 px at 1440 and 70 px at ≤480**, measured on the dev server at 224feb9 (51.59 and
69.19 with the pill), before Part 2's strip.  The fidelity pass changed the strip twice:
F5 (rules 50–53: padding 13 16, a bordered 9.5 px pill with padding 6 10) and the follow-up's
rule 165 (at 380 the pill drops to its own line at 8.5 px).

## Method

`measure-strip.cjs` drives prod `/sandbox` at `19076b3` (healthz == `origin/main`; the served
bundle carried rule 165's `min-width:calc(100% - 24px)`) along the audit rig's route:
S1 → S2 → S3 → Generate → S5 → S7.  Every 100 ms it lifts the reserve (min-height 0 on the
bar and the slot, restored at once), reads the strip's **natural** height, and keeps the
tallest reading per distinct strip text.  Run 2026-09-24T04:55:47Z; `strip.json`.

## Measured

| strip | 380 natural | 1440 natural |
|---|---|---|
| ✓ VERIFIED · 0 validation warnings + READY FOR TCS REVIEW | **79.25** | **56.25** |
| ⚠ VERIFIED · 2 plan flags + REVIEW FLAGS | **79.25** | **56.25** |
| ◌ AWAITING LOCATION · no site chosen | 61 | 44.5 |
| ◌ VERIFYING · taper · buffer · spacing · sign placement | 61 | 44.5 |
| ◌ AWAITING KIND OF WORK | 44.5 | 44.5 |
| **reserve** | 70 | 52 |

The pill states overflow the reserve at both widths: by 9.25 px at 380 and 4.25 px at 1440.
The no-verdict states fit.  Not sampled: the cold-start "waking the verification server"
VERIFYING copy (it shows only on a slow server).

## Done

**380: 70 → 80** (79.25, next whole pixel — #250's own rule), on `issue-289-strip-reserve`.
The 380 post-generate landing is `calc(var(--nav-h) + 8px + var(--status-h) + 24px)`, which
ruling 4 of `s2-arc26-landing/GO-rulings.md` restated as "the formula's 154" *because* the
reserve was the measured 70; with the measured 80 it is **164**.

## Open — 1440

The measured fix at 1440 is **57** (56.25).  But ruling 1 of the same file fixes the 1440
landing at **"136 ±1"**, and 57 would land it at 141.  Not changed: either raise the reserve
and restate ruling 1 to 141 (the ruling-4 pattern), or hold 52 and accept a 4.25 px shift
at the first verdict.  That is a choice between two ruled figures.
