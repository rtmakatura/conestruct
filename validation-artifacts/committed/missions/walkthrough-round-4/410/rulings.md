# #410 (round 4): landing step 1 stops claiming Conestruct finds the extent

Mission `walkthrough-round-4` (tracking #433). Branch `issue-410-landing-extent`, stacked on `issue-432-whole-feet` (28b2d17). Light lane (copy on `/`, CLAUDE.md § Session protocol), worked as a mission item.

## The ruling

No Ryan ruling on the wording. Ryan's round-3 rulings (`validation-artifacts/committed/missions/walkthrough-round-3/ryan-rulings.md:20`) only schedule it: "Next round: #402 (the side sentence), #429, #432, the #425 failed-check line, then #410 and #418, built on `walkthrough-round-3-prod-check`." The issue's Action: "Rewrite the step 1 body so it claims only the road and the direction, and says the operator enters the length, per docs/style.md." It proposes no exact copy, so the wording is self-ruled (call 1).

## Plan (written before the diff)

1. **Problem.** `conestruct/site/components/landing/Landing.tsx:163` on 28b2d17: `body="Drop a pin where the work starts. Conestruct finds the road, the direction and the extent."` The product doesn't find the extent. The picker has no length control (#290), the length starts at the CHOSEN 1,000 ft default (`lib/scenarios/index.ts`), and the operator types the real one in the WHERE band's "Work zone length (ft)" (`components/bands/WhereBand.tsx`), marked "default" until then (#397). A factual claim on a public page the product contradicts (Rule 10).
2. **Ruling.** None on the wording; the issue's Action, quoted above.
3. **Change.** Step 1's body reads "Drop a pin where the work starts. Conestruct finds the road and the direction. You enter the work zone length." One string in Landing.tsx.
4. **Rule 5 churn prediction.** Stated behaviour change: the HOW IT WORKS band's step 1 paragraph on `/` reads the new sentence (was "... Conestruct finds the road, the direction and the extent."). It may change the paragraph's line count at 390 and 1440; measured, not assumed. Unchanged: the step's title "Mark the work.", its picture (StepArt.tsx, call 3), steps 2 and 3, every other band, /terms, /privacy, /404, the coming-soon copy (call 2), the app, the backend, every payload. Files: `Landing.tsx` ~+1/-1; `Landing.test.tsx` ~+12.
5. **Proof.** A mounted test of `/` (Rule 11) reads step 1's rendered paragraph: it says the operator enters the work zone length and doesn't say "extent". Red on 28b2d17 via a git archive of the base. Before/after shots of the step at 1440 and 390, `script/shoot.mjs`. Everything in this folder.

## Calls

1. **R145 self-ruled: "Drop a pin where the work starts. Conestruct finds the road and the direction. You enter the work zone length."** It keeps the first sentence and the verb, drops "and the extent", and adds the operator's part in the field's own words ("Work zone length (ft)", WhereBand.tsx), so the landing and the form name the same thing. "The direction" stays: the picker reports the direction of each detected road (`CandidateCaption`, `LocationPickerModal.tsx`, e.g. "eastbound"), and the issue keeps that claim. Unslop check (docs/style.md): no em dash, no antithesis, no triad (the old line's "road, direction and extent" triad becomes a pair), three sentences of different lengths, each a real claim. "You enter" rather than "you type": it covers the box and the manual panel alike and doesn't name a control.
2. **R145 self-ruled: no other public page makes the claim.** Searched `conestruct/site/app` (which holds /terms, /privacy and the 404) and `components/landing` for "extent": the only hit on a public page is Landing.tsx:163. The coming-soon copy (`lib/coming-soon-copy.ts:94`, "Conestruct finds the road, which way it runs, and whose road it is.") makes no length claim, and `/` no longer renders it (`app/page.tsx` renders `<Landing />`); untouched.
3. **R145 self-ruled: step 1's picture is untouched.** `StepPin` (StepArt.tsx) drops the pin, draws a line and fades in "1,000 FT". It is `aria-hidden` art and doesn't say who sets the length. Next to the new copy it reads as the length you entered. The issue scopes this to copy only.
4. **Recorded: no test or snapshot pinned the old sentence.** Searched `conestruct/site` for "the direction and", "finds the road" and "Mark the work": Landing.test.tsx pins the h1 and h2s, not step bodies; ComingSoon.test.tsx pins the coming-soon copy (call 2). No snapshot files hold it.
5. **Recorded: churn, predicted -> actual.** `Landing.tsx` ~+1/-1 -> +1/-1; `Landing.test.tsx` ~+12 -> +11.

## Measurements (shots/text-before.json, shots/text-after.json)

Local `next dev`, Chromium DPR 2, reduced motion, `/` scrolled to HOW IT WORKS (`script/shoot.mjs`). Before: a `git archive` of 28b2d17 on port 3410. After: this worktree on port 3411.

| | before | after |
|---|---|---|
| step 1 paragraph | "... Conestruct finds the road, the direction and the extent." | "... Conestruct finds the road and the direction. You enter the work zone length." |
| paragraph, 1440 | 360 x 51.19, 2 lines | 360 x 76.78, 3 lines |
| paragraph, 390 | 340 x 51.19, 2 lines | 340 x 76.78, 3 lines |
| step 1 box, 1440 | 360 x 339.66 | 360 x 339.66 (the row's height is set by a taller step, so nothing below moves) |
| step 1 box, 390 | 340 x 302.81 | 340 x 328.41 (one line, 25.6 px; the steps stack, so the content below moves down 25.6 px) |
| ink | rgb(200, 209, 221) | rgb(200, 209, 221), unchanged |

Shots: `shots/before-step1-1440.png`, `shots/after-step1-1440.png`, `shots/before-step1-390.png`, `shots/after-step1-390.png`.
