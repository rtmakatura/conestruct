# #448 red proof

The new tests were written first and run against the unchanged source (`f5cec7d`): full vitest `7 failed | 2937 passed | 1 skipped (2945)`.

Failed, each for the reason the issue names:
- `NeedsYouMap.test.tsx` › #448 › x-map-subject: none: never 'The map shows'; the scan's finding and street level (`expected 'The map shows sidewalks 25.6 ft from …' not to contain 'The map shows'`)
- › a header the backend didn't send reads as no line
- › a failed image: no claim about the picture
- › while loading, and with no map at all: no claim about the picture
- › the intersection question with no line
- › P1: every sentence is held in the paragraph, one shown, so it never changes height
- `NeedsYouQuestion.test.tsx` › #448: every kind's three sentences (drawn, no line, scan only); drawn is today's

Passed on the old source, as it should: "drawn: the sentence stays as it is".

One test was wrong, not the code: the intersection test expected the 0-device TCS line, but its fixture has no adjustment record for the intersection, so the sentence carries no device words (Rule 10). Its expected text was corrected before the fix was written.

After the fix: full vitest `2944 passed | 1 skipped (2945)`.
