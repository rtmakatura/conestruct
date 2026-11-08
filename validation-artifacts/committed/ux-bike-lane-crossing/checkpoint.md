# #449 checkpoint: Rule 5 churn prediction

Written 2026-11-08, before any code diff. Branch `issue-449-bike-lane-crossing`, on `issue-451-pdf-not-checked-count` `0cd02e8`.

## The change (wording only; investigation.md says why)

The bike lane NEEDS YOU question stops saying "along". The scan keeps one point per way (`out center tags`), so it can't tell a lane that crosses the end of the work from one that runs beside it, and the words claim neither (Rule 10).

- `question`: "Is there a bike lane along the work zone?" becomes "Is there a bike lane at or near the work zone?"
- `title`: "a bike lane along the work zone" becomes "a bike lane at or near the work zone"

## Prediction

What changes:
- `conestruct/site/lib/needs-you-items.ts`: the two strings above in `FLAG_WORDS.bicycle_facility`, plus a comment of about 4 lines saying why. About 6 lines.
- `conestruct/site/components/NeedsYouQuestion.test.tsx`: one new test (red before the fix, green after) on the bike lane question's `question` and `title`, and on the mounted heading and "Next:" line. About 25 lines added, 0 existing assertions changed (no existing test asserts the bike lane question or title).
- On the page: the NEEDS YOU heading for the bike lane question, and the "Next: …" line when it is the next question. Nothing else.

What stays byte-identical:
- Every backend file. pytest count unchanged; 0 backend snapshots move.
- Device counts, spacing and sign placement: the bike lane adjustment still adds the same 2 M4-9a signs (`src/rules/site_adjustments.py:305-323`), and Yes/No still keep or remove them.
- The explanation sentences, Yes/No labels and consequences for the bike lane question (they never said "along").
- The sidewalk and school zone questions (finding recorded in investigation.md; filed, not changed).
- The audit PDF, crew sheet and plan sheet (they don't read these strings).
- Vitest: existing tests unchanged; count goes up by the new test(s) only.

## Actual (after the diff)

- `needs-you-items.ts`: +5 / -2 (the two strings and a 3-line comment). Predicted about 6 lines; matches.
- `NeedsYouQuestion.test.tsx`: +35 / -0 (one describe, two tests). Predicted about 25 added, 0 changed; larger by the second mounted render, no existing assertion changed.
- Backend: 0 files. Snapshots: 0 moved.
- Vitest: 2944 passed + 2 red before the fix (`evidence/red-vitest-before-fix.txt`), 2946 passed | 1 skipped after; +2 tests, as predicted.
- Page: the bike lane heading and the "Next:" line only (`evidence/walk/evidence.md`).
