# Rule 5 prediction: `r126-speed-guess` (R126 speed + R127 Q1–Q3, Q7, the 20 mph option)

Written 2026-10-10, before any code on `r126-speed-guess` (off `e8a9483`, stacked on
`issue-301-cross-street-entry`). Lane: normal, `frontend-only: no`. Authority: `rulings.md` (R126, R127).

## Deliberate behaviour changes

1. **A road with no readable posted speed gets the class estimate as its speed (R126; Q2).**
   - Covers a missing or unreadable `maxspeed`.
   - The estimate is snapped to the kind's range (Q3: motorway on flagger shows 55).
   - Prefilled at the shell's normalizer, `lib/scenarios/guesses.ts` `withCurrentGuesses`, when the
     road at the pin is new, as R108 prefills street class.
   - Marked "⚠ from the road", with the wire record `guesses.speed: {highwayClass}`.
   - **Every such plan's speed, and so its sign spacing, tapers and device counts, moves**
     (checkpoint §3).
2. **The speed record holds only while it is true.**
   - The operator's write (WHAT, or a staged S7 correction through `setSpeed`) marks "speed"
     operator-set and drops the record.
   - A new road, a moved pin or a tagged road drops it.
   - A kind switch re-guesses the speed at the new kind's snap.
   - A detection never overwrites an operator-set speed (R110 Q4, via `applyClassification`).
3. **No measured, guessed or operator speed at a pin means "◌ not set" (Q1 (b)).**
   - The WHAT select shows "Not set".
   - The live checks hold, as for an unset side (`GeneratorShell` `checksArmed` / `fetchArmed`).
   - The rail gains a blocker rank after the side: "Set the speed in Step 2", pointing at the road
     group.
   - With no pin at all, the location blocker stands as before.
4. **R123 Q2 is retired:**
   - no Use N mph, no estimate line;
   - no `speed_estimate` (frontend type, backend `SpeedEstimate` field);
   - no `input_estimates`, no "Estimated inputs" block.
   - A saved plan carrying `speed_estimate` loses the key (pydantic ignores it).
5. **The handoff notes' UX-02 low-confidence pair is retired.**
   - `skipped_low_confidence` ("…not applied…") would now be false, because the normalizer applies
     the guess.
   - `accepted_low_confidence` would now fire on a kind switch whose carried speed equals the
     fallback.
   - The ⚠ marker says it instead.
6. **The audit (Q7):**
   - `input_guesses` gains `{field: "speed", value, label "N mph", source: "road_class", evidence,
     operator_confirmed: false}`.
   - Evidence: "OSM highway=X; no readable posted speed on the road", plus "; estimated E mph,
     capped at N mph for this kind" when the snap moved it.
   - The audit PDF's "Guessed inputs" block gets "Speed: N mph. Guessed from the road class (…). The
     operator did not confirm it. Confirm the posted speed on site."
   - A stale record is 400 `guess_stale`.
7. **The other outputs (Q7):**
   - The XLSX "Speed (mph)" row and the crew sheet's speed line gain "(guessed from the road class,
     not confirmed)".
   - The plan sheet's notes box gains one line when the speed is guessed: "SPEED GUESSED FROM THE
     ROAD CLASS. CONFIRM THE POSTED SPEED ON SITE." These are the ruling's words, set in the box's
     own capitals like the box's other disclosures.
8. **The 20 mph option.** WHAT's speed options start at 20 for the kinds whose schema allows it:
   shoulder, flagger and work-beyond-shoulder. The others keep 25.

## Not changing (proved at the build)

- Plans whose road carries a readable `maxspeed`, and plans with an operator-set speed:
  byte-identical on every output.
- Every backend baseline: fixtures carry an explicit speed and no `guesses.speed`.
- Street class and jurisdiction guesses: unchanged records and wording.
- R126's layout items (labels, one marker per row, the footer windows line, the header) belong to
  `r126-step2-layout`, except the speed row's own marker.

## Predicted test churn

**Backend:**
- `tests/test_speed_estimate.py` (11) is rewritten as `tests/test_speed_guess.py`:
  - the table mirror (kept);
  - the guess record, with its capped evidence;
  - the PDF line;
  - the stale 400 on five paths;
  - the XLSX and crew qualifier;
  - the plan-sheet notes line;
  - no record means byte-identical.
- `tests/test_r108_guesses.py`: unchanged, since no speed record appears there.
- Expected: about 14 tests in the new file, and no other backend test moves.

**Frontend, deleted or rewritten:**
- `lib/scenarios/speed-estimate.test.ts` (8) → guess tests (about 10): the prefill, an unreadable
  tag, the snapped value, the drop rules, the kind switch's re-guess, and an operator speed never
  overwritten.
- `components/WhatBand.speed-estimate.test.tsx` (3) → the "⚠ from the road" row, the "◌ not set"
  row, and a tagged road's "✓ measured".
- `handoff-summary.test.ts`: the two UX-02 cases go (`accepted_low_confidence` ×2,
  `skipped_low_confidence` ×1).
- `HandoffNotes` note tests, if any pin the low-confidence strings: about 1–2.

**Frontend, moved by the speed hold** (a located plan with no road and no operator speed now
blocks). Every suite whose picker stub saves `classification: null`, or a classification with no
`speedLimitMph`, and then expects checks or Generate:
- about 10 GeneratorShell / GeneratorSidebar suites;
- `picker-reapply` (`SAVE_NULL_PIN_C`), `near-intersection` (the manual-entry case), `no-location`,
  `kind-confirm`, `pin-model-wire`, `corridor-bar`, and others found at the build.

Each gets an operator speed (one WHAT pick) or a tagged classification. A suite whose stub has no
tag and whose road is new now sees the guess instead, and any speed assertion there moves to the
estimate. Enumerated in the outcome table.

**Frontend, other:**
- `what-cells` speed options: `speedOptions` tests and stub `<option>` lists move (+20).
- `rail.test` gains the speed blocker.
- **New:** about 3 tests for the rail rank and the check hold, plus the 20 mph option.

**Copy:**
- "Not set" in the select;
- "Set the speed in Step 2";
- the guess line "guessed, not confirmed · OSM highway=X · from the road" (marker "⚠ from the
  road");
- the audit, XLSX and crew clause;
- the plan-sheet notes line.

## Outcome (the build, `ba671fa`, and the cite fix after it)

| Prediction | Outcome |
|---|---|
| Behaviour changes 1–8 | As predicted. Local stack (`speed-guess-ba671fa/`), at 1440 and 390, no sideways scroll, no page errors:<br>- **N Cherry St:** 25 mph, "⚠ from the road", header "4 guesses".<br>- **N Broadway SB:** 30, "✓ measured", header "3 guesses".<br>- **Ferril Lake (no road):** "Not set", "◌ not set", Generate blocked with "Set the speed in Step 2".<br>- **Plan sheet:** the notes box carries the line only when the speed is guessed (`notes-guessed.png` / `notes-not-guessed.png`). |
| Not changing | Held: no backend test or baseline moved. Backend 2688 → 2703 passed; the new tests are all in `tests/test_speed_guess.py` (15). |
| Backend churn: `test_speed_estimate.py` → `test_speed_guess.py` | As predicted (15 tests). |
| Frontend: `speed-estimate.test.ts` → guess tests (about 10) | `lib/scenarios/speed-guess.test.ts`: 12 (adds the 20 mph option). |
| `WhatBand.speed-estimate.test.tsx` → 3 | `components/WhatBand.speed-guess.test.tsx`: 3. |
| `handoff-summary.test`: 3 UX-02 cases go | **2** went; the third (an out-of-domain clamp) still passes and stays. |
| `HandoffNotes` note tests: about 1–2 | **None:** no test pinned those strings. |
| **The speed hold: about 10 suites** | **Deviation, badly undercounted.** The first full run had **202 failing tests**. The mechanism was the predicted one: a located test pin with no confirmed road now holds at "◌ not set". The count missed that most suites pin through the shared `pinned()` fixture. That fixture now marks the speed operator-set, mirroring what #290 did for the side, which cleared 162. The remaining 40 were per-file fixes:<br>- the same operator speed inline or through a new `withOperatorSpeed()` in `refusal-voice`, `class-stability`, `error-honesty`, `suggest-contract`, `corridor-bar`, `fact-strip`, `manual-pin-move`, `near-intersection` and `no-location` (PINNED);<br>- `handoff-provenance` family 6;<br>- `rail.test` (its own `pinned()`, plus the guard for a partial `confirmedRoad`);<br>- one ruled rewrite: `no-location`'s typed-coordinates case now meets "Set the speed in Step 2" and picks 35 before Generate.<br>`picker-reapply`, `kind-confirm` and `pin-model-wire` were named in the prediction and needed nothing. |
| `what-cells` option tests move (+20) | None existed; the 20 mph test is new, in `speed-guess.test.ts`. |
| `rail.test` gains the speed blocker | 1 new rank test. |
| Not predicted | `auto-apply.ts` changed: `applyClassification` protects an operator speed, as R110 Q4's road type is protected. The prediction stated the behaviour (change 2) but didn't list the file. |

**Frontend:** 2064 → 2084 passed (199 files). `tsc` clean.
