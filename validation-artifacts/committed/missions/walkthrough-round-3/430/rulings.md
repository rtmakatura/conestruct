# #430 rulings (mission walkthrough-round-3, tracking #431)

Branch `issue-430-preview-refusal`, stacked on `walkthrough-followups-prod-check` (`bda17e5`).

## Baseline (bda17e5)
- vitest: 2639 passed, 1 skipped
- pytest: 3612 passed, 2 skipped

## Cause (confirmed by reading the code on bda17e5)
- The picker's preview scenario (`components/LocationPickerModal.tsx:481-503`) copies the band's scenario and swaps in the live pin. It never runs the shell's normalizer, so a jurisdiction guess made at the old pin rides along. The shell runs every write through `withCurrentGuesses` (`GeneratorShell.tsx:225`), whose `reconcileJurisdiction` drops a guess "guessed at a pin the plan no longer has ... in the same write that moved it" (`lib/scenarios/guesses.ts:141-146`). The preview skipped that, so the backend's check at `src/api/render_api.py:587-590` answered `400 guess_stale`.
- `useCorridorGeometry` turns every non-OK answer into `{ state: "error" }` (`lib/corridor-geometry.ts:264-266`), the same state a thrown fetch gets (`:271-272`), and the picker prints "Couldn't reach the layout service" for it (`LocationPickerModal.tsx:2292-2297`). The backend's message is dropped.

## Calls

### Call 1 (R145 self-ruled): do both (a) and (b)
The issue offers (a) and (b) and says "(b) is the Rule 10 floor either way. Both may be wanted." Both are done:
- (a) The preview drops a jurisdiction guess whose pin isn't the preview's pin, with the shell's own rule (the same function, exported), so the preview asks the question Save & Close will write. The `guess_stale` guard in `input_guesses` is untouched (no backend change), so Generate's guard is unchanged.
- (b) The hook keeps an HTTP answer apart from a thrown fetch: `{ state: "error" }` gains optional `httpStatus` and `message`, the `DeviceBreakdown` precedent the issue names. The picker shows a 400 as the backend's refusal, with its message.

### Call 2 (R145 self-ruled): the jurisdiction rule only, not the whole normalizer
`withCurrentGuesses` also re-guesses street class, speed and road type when the road is new. Running the preview through all of it would move the preview's lengths (speed feeds the taper) on a road change, a behaviour change this issue doesn't ask for. Only the jurisdiction reconcile runs. Dropping the key changes no geometry: the backend reads `jurisdiction_key` for the plan's printed name only (`src/api/schemas.py:1351-1367` `_jurisdiction_name`, used at `:1575`); the engine's buffer table switch is the fixed `jurisdiction="CDOT"` (`:1356`, `:1611`). Not investigated: whether the preview differs from Save on a road change with a guessed speed. Not filed, since it isn't shown to be a gap.

### Call 3 (R145 self-ruled): wording
A 400 is the backend refusing the preview's question. The line reads:
- with a message: "Corridor preview declined: <the backend's message> You can still save; the plan is validated when generated."
- without one: "Corridor preview declined. You can still save; the plan is validated when generated." (amended in repair cycle 1; it was "declined by the layout service", which named an answerer the panel does not know)
The message comes from `detail.message` (the `{error, message}` refusals) or a string `detail` (HTTPException strings and the proxy's 422 mapping, `lib/render-proxy.ts:69-104`). Plain-text bodies from the Next route ("Invalid scenario") aren't shown, since they're the proxy's words, not the layout service's. Same style and colour token as the existing error line (`--none`), plus a `data-testid`. Unslop: no em dashes, one claim per sentence. "Declined" matches the app's word for a 400 (`DeviceBreakdown.tsx:81` `declined`).
Every other non-OK status (502, 503, 429, 413) and a thrown fetch keep "Couldn't reach the layout service" exactly as on bda17e5. 429 saying "couldn't reach" is also not quite true; it's out of this issue's acceptance and left as is (call 4).

### Call 4 (R145 self-ruled): 429 not folded
A 429 (rate limit, `app/api/render/corridor-geometry/route.ts:18-19`) still prints "Couldn't reach the layout service". Changing it needs its own wording and a claim about retry behaviour the hook doesn't make (it refetches only when the scenario changes). Low value and not in the acceptance; recorded here, not filed.

## Plan (5 bullets)
1. Problem: the picker's preview carries a jurisdiction guess for the old pin (`LocationPickerModal.tsx:481-503`), the backend refuses it (`render_api.py:587-590`), and the hook and panel turn the refusal into "Couldn't reach the layout service" (`corridor-geometry.ts:264-272`, `LocationPickerModal.tsx:2292-2297`).
2. Rulings: Rule 10 (honest refusal beats silent substitution); R108/R110 Q1 (a guess exists only at its own pin, `guesses.ts:1-35`); Rule 3 (the backend keeps the guard). Calls 1-4 above.
3. Change: export the jurisdiction reconcile from `guesses.ts` and run the preview scenario through it; the hook's error state carries `httpStatus` and the backend's `message`; the picker gets a "declined" status that prints the refusal.
4. Rule 5 prediction (written before the diff):
   - `lib/scenarios/guesses.ts` ~+6/-1 (export the reconcile under a name, comment)
   - `lib/corridor-geometry.ts` ~+30/-4 (error carries httpStatus + message; a small reader for the body)
   - `components/LocationPickerModal.tsx` ~+30/-4 (preview through the reconcile; "declined" status; the line)
   - new `components/LocationPickerModal.preview-refusal.test.tsx` ~+190
   - Stated behaviour changes: (i) a picker preview at a moved pin no longer carries `jurisdiction_key` or `guesses.jurisdiction_key` when they were a guess at the old pin (an operator-set jurisdiction, and a guess at the preview's own pin, are sent as before); (ii) a 400 from the preview shows "Corridor preview declined: ..." instead of "Couldn't reach the layout service". Byte-identical: the preview payload for an unmoved pin; every non-400 failure's line; WhereBand, GeneratorSidebar and BandAerial (they read `state` only); every backend answer (no backend change).
   - Amendment, written after the first full run and before this diff (full-run-fails.txt): the new line's `text-[10px]` is counted by the #263 type census, which the prediction above missed (a Rule 5 miss, recorded). `lib/design/type-exceptions.ts` ~+2/-2: the picker's `text-[10px]` row 29 -> 30 and `tsxUses` 205 -> 206, each with a "#430: +1, the declined-preview line" note. Same register as the existing error line, so no new size or class.
5. Proof: a mounted test of the real modal with a fetch stub that applies the backend's pin check (Rule 11): moving the pin no longer shows the outage line and the moved-pin payload has no stale guess; a 400 shows the backend's message; a thrown fetch and a 502 still show "Couldn't reach"; an unmoved pin still sends the guess. Red proof on bda17e5. Evidence in this folder.

### Call 5 (R145 self-ruled): no screenshots
The only visible change is one line of text in the picker's Corridor extent panel, in the same register, colour and box as the "Couldn't reach" line it replaces for a 400. With call 1's (a), the issue's own path (a moved pin with a guessed jurisdiction) no longer gets a 400, so showing the new line on a dev server would take a stubbed backend refusal; the mounted test already reads the rendered text from the real modal. No layout box changes size class. The production check after ship covers the issue's real path (E Colfax & Williams, pin moved 27 ft: the corridor lays out, no outage line).

## Actual churn (predicted -> actual)
- `lib/scenarios/guesses.ts` ~+6/-1 -> +5/-1
- `lib/corridor-geometry.ts` ~+30/-4 -> +25/-2 (+32/-2 after repair cycle 2)
- `components/LocationPickerModal.tsx` ~+30/-4 -> +37/-4 (+38/-4 after repair cycle 1, +39/-4 after cycle 2)
- `lib/design/type-exceptions.ts` (amended prediction) ~+2/-2 -> +2/-2
- new `components/LocationPickerModal.preview-refusal.test.tsx` ~+190 -> +292, 313 after repair cycle 2 (over: the stub that applies the backend pin check, and five refusal/outage cases where three were planned)

## Repair cycle 1 (independent reviewer FAIL)
Finding: the no-message line "Corridor preview declined by the layout service." names an answerer the panel doesn't know. The Next route's own 400s ("Invalid JSON", "Invalid scenario", `app/api/render/corridor-geometry/route.ts:30,35`) come before the layout service is called (Rule 10).
Call 3 amended (R145 self-ruled): the no-message line reads "Corridor preview declined. You can still save; the plan is validated when generated." It names no answerer. The message form is unchanged: it shows only the backend's JSON message (`detail.message` or a string `detail`).
Prediction (written before this diff): `LocationPickerModal.tsx` ~+1/-1 (the string), and the comment above it ~+2/-2 so it no longer says the layout service always answered; `LocationPickerModal.preview-refusal.test.tsx` ~+2/-2 (the test name and the expected line). No other file changes.
Actual (predicted -> actual): `LocationPickerModal.tsx` string ~+1/-1 -> +1/-1, comment ~+2/-2 -> +3/-2 (whole file now +38/-4 against bda17e5); the test ~+2/-2 -> +2/-2 (file stays 292 lines).

## Repair cycle 2 (independent reviewer FAIL)
Finding: "Corridor preview declined: ${declined}" runs on into " You can still save; ..." when the backend's message has no closing punctuation (an `UnknownJurisdictionError` string detail, `src/rules/jurisdiction.py:91-94`; the proxy's 422 mapping, `lib/render-proxy.ts:85-96`).
Call 6 (R145 self-ruled): a pure helper `asSentence()` in `lib/corridor-geometry.ts` ends the quoted message with a period when it doesn't already end in ".", "!" or "?" (trailing space trimmed); the picker quotes `asSentence(declined)`. The backend's words are otherwise unchanged.
Finding 2: red-proof.txt named the pre-rename test. The renamed and changed tests are re-run red on bda17e5 from a `git archive` of the base with this branch's test file copied in, and red-proof.txt is updated.
Prediction (written before this diff): `lib/corridor-geometry.ts` ~+8/-0 (the helper and its comment); `LocationPickerModal.tsx` ~+2/-1 (import, the call); `LocationPickerModal.preview-refusal.test.tsx` ~+20/-1 (the string-detail test asserts the whole line; unit tests for the helper); `red-proof.txt` rewritten for the new run. No other file changes.
Actual (predicted -> actual, against the cycle-1 state): `lib/corridor-geometry.ts` ~+8/-0 -> +7/-0; `LocationPickerModal.tsx` ~+2/-1 -> +2/-1 (whole file +39/-4 against bda17e5); the test ~+20/-1 -> +23/-2 (the import line, the whole-line assertion, two helper tests; file 313 lines); red-proof.txt rewritten (6 failed | 4 passed (10) on bda17e5).
