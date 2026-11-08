# #448 checkpoint: plan and Rule 5 churn prediction (written before the diff)

## Plan
1. **Problem.** `questionWords()` (`conestruct/site/lib/needs-you-items.ts:334`) builds "The map shows <noun> <ft> ft from the work" from the scan bucket alone; the card renders it (`components/QuestionSteps.tsx:291`) above `NeedsYouMap`, which knows `drawn` (`components/NeedsYouMap.tsx:56`) but tells nobody.
2. **Rulings.** Ryan's, cc-queue-ux.md item 4 (rulings.md); #447 rulings 4 and 7; Rule 3, Rule 10, P1.
3. **Change.** `questionWords` also returns `explanationNoLine` and `explanationScan`. `NeedsYouMap` reports its state (`loading | drawn | none | failed`) through an `onSubject` callback; `QuestionFlow` holds it per flag and renders the three sentences stacked, only the one in force visible.
4. **Proof.** Red proof (the new mounted tests fail on `f5cec7d`), mounted tests for each header and failure, a local walk at 1440 and 390 with crops of a drawn and a no-line card, axe, 44 px, and the 0 px measure.

## Rule 5 prediction
Changes:
- `conestruct/site/lib/needs-you-items.ts`: two new fields on `NeedsYouQuestion`, built in `questionWords`. `explanation` is byte-identical for every kind and every device case.
- `conestruct/site/components/NeedsYouMap.tsx`: an optional `onSubject` prop and one effect. Its rendered output is unchanged.
- `conestruct/site/components/NeedsYouQuestion.tsx`: per-flag map state and the stacked explanation.
- `conestruct/site/components/QuestionSteps.tsx`: `explanation` typed `ReactNode | null` (was `string | null`); WhereQuestions' explanations render the same.
- `conestruct/site/app/globals.css`: one rule for the stack.
- Tests: `NeedsYouMap.test.tsx` and `NeedsYouQuestion.test.tsx` gain cases; no existing assertion changes.
- Evidence under `validation-artifacts/committed/ux-no-line-text/`.

Stays byte-identical: every backend file, the audit, the PDF, device counts, the map image, the key, the label and the link; the WHERE band.

## Actual (after the build)
`git diff --stat`: the 7 predicted files, `220 insertions(+), 15 deletions(-)`, plus this evidence folder. No backend file changed; no existing assertion changed. One deviation inside the prediction: `.nyq-why` is `display: grid` for every card, the WHERE band's too; a lone sentence lays out as before (`components/bands` vitest unchanged and passing). Matches the prediction.
