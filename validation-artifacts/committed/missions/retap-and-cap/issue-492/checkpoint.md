# #492 checkpoint — the NEEDS YOU map rate cap, 30 → 40

Branch `issue-492-map-cap-40`, based on `issue-493-cross-street-reuse` at `60f4a1c5` (mission `retap-and-cap`, tracking #494).

## The problem (checked in the code at 60f4a1c5)

- The cap: `conestruct/site/app/api/needs-you-map/route.ts:20`, `rateLimitOr429(req, "needs-you-map", 30)`: 30 a minute per IP, its own bucket (`lib/rate-limit.ts`, `Ratelimit.fixedWindow(perMinute, "60 s")`, prefix `ratelimit:needs-you-map`).
- Only the open card mounts: `conestruct/site/components/QuestionSteps.tsx:177-199` renders `<Card q={current} …>` for `current` only; the other questions are list rows (`:200` on). The map is the card's `media` (`components/NeedsYouQuestion.tsx:107`, `<NeedsYouMap key={q.flag} …>`), so one map, and so one soft image, is asked for before any answer.
- A soft image is asked for only at zoom step 0, before the question has shown a full picture, and not when the full one is cached (`components/NeedsYouMap.tsx:81-82`, `wantSoft = fullReq !== null && step === 0 && held.current === null && !isNeedsYouMapCached(fullReq)`).
- Zoom steps: `ZOOM_OUT_MAX = 1`, `ZOOM_IN_MAX = 3` (`lib/corridor-aerial.ts:45-46`); the route accepts −1 to 3 (`route.ts:49`). That is 5 steps, so 5 sharp images per question.
- Questions: 5 scanned flags (`lib/scenarios/types.ts:245-250`; `SCANNED_FLAG_LABELS`, `lib/scenarios/site-corrections.ts:137-143`).
- Worst case for one walk inside a minute: 5 × (1 soft + 5 sharp) = 30. At a cap of 30 the margin is 0; at 40 it is 10.
- Outside that count (recorded, not counted): a frame resize asks for new sizes (a new cache key), and the session cache holds 24 pictures (`lib/needs-you-map.ts:63`, `CACHE_MAX = 24`), so going back over all 30 pictures in the same minute can ask again. Both were outside the #483 count too (issue-483 `checkpoint.md` § 3). The cap is per IP, so the margin covers one walk per IP: two walks behind one shared IP (an office network) can reach 60 in a minute against 40 (added after the #492 gates, from the reviewer's note).

## The change

- `route.ts:20`: 30 → 40, with a `CHOSEN` comment (Rule 12) naming Ryan's approval (2026-11-10) and the worst-case count.
- A new route test, `app/api/needs-you-map/route.rate.test.ts`: the real `rateLimitOr429` under a counting stand-in for the Upstash fixed window. 40 requests from one IP in a minute are allowed; the 41st gets 429. Red-proof against 30 recorded in `red-proof.txt`.
- Not built: loading the next question's soft image early (R145 self-ruled, `rulings.md`).

## Rule 5 churn prediction (before the diff)

- Changes: `conestruct/site/app/api/needs-you-map/route.ts` (1 line changed, a 5-7 line comment added); new `conestruct/site/app/api/needs-you-map/route.rate.test.ts` (about 60 lines); this evidence folder (`checkpoint.md`, `rulings.md`, `red-proof.txt`).
- Behavior change (deliberate): a client may make 40 needs-you-map requests a minute instead of 30; the 41st is refused with 429. Mapbox spend ceiling per IP rises by a third (Ryan's approval).
- Byte-identical: `lib/rate-limit.ts`, every other route's cap, `NeedsYouMap.tsx`, `QuestionSteps.tsx`, `lib/needs-you-map.ts` (the #483 soft-then-sharp chain), the existing `route.test.ts`, backend, PDF, audit. No device count, no wire field changes.
- Actual (after the diff): `route.ts` +8 −1 (5-line comment, a `PER_MINUTE = 40` const, a blank line, the call now reads `PER_MINUTE`); `route.rate.test.ts` 75 lines (predicted about 60; the stand-in limiter took more). Nothing else in code changed.
- Other statements of 30 (historical evidence, not touched; they record the cap as it was): `validation-artifacts/committed/missions/ux-token-map-load-edit/issue-483/{checkpoint.md:61,evidence.md:61,rulings.md:53}`, `…/ux-token-map-load-edit/report.md:10`, `…/ux-columns-copy-maps/report.md:7`. No doc or code comment elsewhere states it.
