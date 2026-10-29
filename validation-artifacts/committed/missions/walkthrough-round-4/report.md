# Mission walkthrough-round-4 (#433): report

Six items built on `walkthrough-round-3-prod-check` (`afb8b4c`), one stacked chain. Each item passed the diff-verifier and an independent reviewer before it was committed. Nothing was parked. Ryan's rulings for #425, #402, #429 and #432 are quoted in `walkthrough-round-3/ryan-rulings.md`.

## Questions for Ryan

Nothing is parked. These calls are open for a look, each with my recommendation:

1. **#425's line says "check" twice:** "check failed: the check didn't answer; the option shown stands". Only the verb moved, so the reason clause still repeats it. Recommendation: keep it for now and look at it in the browser check. If it reads badly, "check failed: no answer; the option shown stands" is the one-line change.
2. **#418's known gap is filed as #434 (priority-low).** A count of 2 kept from an earlier road (or 1 on an undivided plan) still reads "default". A legacy or pre-#397 count now reads "⚠ from an earlier road", which names the wrong source. Recommendation: leave it until #434. The reviewer suggested "⚠ not from this road" as wording that is true in every case without a new meta record. That's worth a ruling on #434.
3. **#410:** "Conestruct finds the road and the direction" is true. The picker shows each road's direction, and the work's direction is derived from the road plus the side you pick. The issue's Action keeps that claim. Recommendation: keep it.
4. **Browser checks** of the visible changes: #425 (gray "◌ check failed"), #402 (the picker sentence), #429 (plain "yours" over the cap), #432 ("Use whole feet"), #410 (landing step 1) and #418 (Lanes row).

## Ready to ship

Top branch: **`issue-418-lanes-row`**. CI is green on `e955287` (Python tests and Frontend tests), and this report's commit sits on top of it.

The chain, base first:
- `walkthrough-round-3-prod-check` `afb8b4c`: the pending #431 production check and Ryan's rulings
- `issue-425-check-failed` `74cb1b5`
- `issue-402-side-sentence` `2490b73`
- `issue-429-refused-length-marker` `e536579`
- `issue-432-whole-feet` `28b2d17`
- `issue-410-landing-extent` `8fc833d`
- `issue-418-lanes-row` `e955287`, then this report (top)

One go ships the whole chain through a single `ship.ps1` run on `issue-418-lanes-row`.

## Filed

- #433, mission tracking: https://github.com/rtmakatura/conestruct/issues/433
- #434, a kept lane count of 2 (or 1 undivided) still reads "default", and a legacy count names the wrong source: https://github.com/rtmakatura/conestruct/issues/434

## Calls I made (R145 self-ruled; each one is in its item's rulings.md)

- **#425:**
  - The failed check takes the marker "◌ check failed" in chromaless `--none` gray. Rule 13 makes a state with no verdict gray, and ◌ means "unevaluated" (DESIGN-SPACING.md:143). The full line sits behind the marker.
  - A pin guess keeps "⚠ from the pin", with the failed line in its details.
  - Only the verb moved.
  - The cell state is renamed `check-failed`.
  - The "not checked" lines for a check that never ran are left as they are.
- **#402:**
  - The sentence carries Ryan's period on both the overlay and the panel. The panel's own appended "." is removed.
  - `SIDE_BLOCKER` (band, Generate blocker, BandAerial) keeps the #290 wording, per "in the picker only".
- **#429:**
  - "Refused" comes from `validateWorkZone`, through the new `workLenIsRefused`. No limits are copied (Rule 3).
  - The manual panel has no marker, so none is added.
  - 20,000 ft keeps "✓ yours".
  - DESIGN-SPACING.md records the plain "yours" for the work-zone length only.
- **#432:**
  - The message reads "Use whole feet for the work zone length.". It opens with Ryan's words and names the field, because it doubles as the Generate blocker.
  - This is a frontend product rule; the backend takes a float (`src/api/schemas.py:592`).
  - Bounds are checked first, so -0.5 and 20000.5 keep their own messages.
  - Both doors now use `parseFloat`.
- **#410:**
  - The issue named no copy, so I wrote: "Drop a pin where the work starts. Conestruct finds the road and the direction. You enter the work zone length."
  - No other public page makes the claim.
  - The step art is left as it is.
- **#418:**
  - A count kept from an earlier road is marked "⚠ from an earlier road" and counted in the header, rather than reset.
  - A kept count is detected by its value; the residual is #434.
  - The turn-lane reason shows only when the map reads more lanes than the plan.
  - The no-count default line is cut to one clause.
  - The new marker can also appear with no road read: a moved pin, a pin saved unpicked, a legacy migration, or a count typed before #397. The behaviour change states this.
- **Left unfixed:** a stale docblock at `GeneratorShell.class-stability.test.tsx:228` still lists `not-evaluated`, a reviewer nit on #425. It isn't worth a re-gate. It can be folded into the next branch that touches that file.

## Flakes

None. No full run failed during the mission.

## Leftover processes

None found after any item. One `git push` hung on Git Credential Manager (two github.com accounts). I stopped it, along with its `git-credential-manager` process, and pushed through `gh auth git-credential`.

## Per item

Each verdict below is the final round's line, quoted verbatim.

### #425: a check that ran and failed reads "◌ check failed", gray, not red (`74cb1b5`)
- **Change:** a breakdown 5xx or network failure reads "◌ check failed" behind the marker, no longer the red "not checked: the check didn't answer; …". A decline keeps "◌ not checked". A pin guess keeps "⚠ from the pin". The windows line and the boundary-lookup line move to "check failed" too.
- **Tests:** vitest 2667 passed, 1 skipped; tsc clean. 3 red on the base, 4 controls green.
- **Diff-verifier:** "VERDICT: PASS" (both rounds).
- **Independent reviewer:** "FAIL" in round 1 (the "-open" shots were clipped and left out the popover; evidence only, no cycle). "PASS" in round 2.

### #402: the picker reads "Save, then say which side is occupied." (`2490b73`)
- **Change:** `SIDE_SENTENCE` in `LocationPickerModal.tsx` is now Ryan's sentence, on the map overlay and the panel. `SIDE_BLOCKER` is unchanged.
- **Tests:** vitest 2668 passed, 1 skipped; tsc clean. 1 red on the base.
- **Diff-verifier:** "VERDICT: PASS" (both rounds).
- **Independent reviewer:** "FAIL" in round 1 (three cites; one of them was in the new test file's header comment, so I counted this as repair cycle 1). "PASS" in round 2.

### #429: a refused work-zone length reads a plain "yours", over-cap too (`e536579`)
- **Change:** the new `workLenIsRefused` drives the WHERE band marker, so 99999 reads "yours" (was "✓ yours"). DESIGN-SPACING.md records it.
- **Tests:** vitest 2672 passed, 1 skipped; tsc clean. 3 red on the base, control green.
- **Diff-verifier:** "VERDICT: PASS" (both rounds).
- **Independent reviewer:** "FAIL" in round 1 (the DESIGN-SPACING sentence read as panel-wide; doc only, no cycle). "PASS" in round 2.

### #432: a typed decimal stays and is refused with "Use whole feet" (`28b2d17`)
- **Change:** `parseFloat` in both doors. `validateWorkZone` refuses a non-integer with "Use whole feet for the work zone length.". The marker reads "yours".
- **Tests:** vitest 2677 passed, 1 skipped; tsc clean. 4 red on the base, control green.
- **Diff-verifier:** "VERDICT: PASS".
- **Independent reviewer:** "PASS".

### #410: landing step 1 says the operator enters the length (`8fc833d`)
- **Change:** `Landing.tsx:163` changes, plus a mounted landing test.
- **Tests:** vitest 2678 passed, 1 skipped; tsc clean. 1 red on the base.
- **Diff-verifier:** "VERDICT: REPAIR" in round 1 (cite `ryan-rulings.md:24` should be `:20`; write-up only, no cycle). "VERDICT: PASS" in round 2.
- **Independent reviewer:** "FAIL" in round 1 (the same cite). "PASS" in round 2.

### #418: Lanes row (`e955287`)
- **Change:** a shoulder count kept from an earlier road reads "⚠ from an earlier road" and counts in the WHAT header. The turn-lane reason shows only when the map reads more lanes than the plan. The no-count line reads "default · the map has no count here; set the real count".
- **Tests:** vitest 2686 passed, 1 skipped; tsc clean. 5 red on the base, 4 controls green.
- **Diff-verifier:** "VERDICT: PASS" (all three rounds).
- **Independent reviewer:**
  - Round 1, "FAIL": a cite, the header quote, the "one helper" claim, an unstated no-road case, and the gap not filed. Write-up only; #434 filed.
  - Round 2, "FAIL": the divided-plan-holding-1 wording, the header change not stated, a line range, and the ruling's attribution. Write-up only.
  - Round 3, "PASS".

## End-of-mission run (top branch `e955287`)
- pytest: 3612 passed, 2 skipped
- mypy: "Success: no issues found in 49 source files"
- ruff: "All checks passed!"
- vitest: 2686 passed, 1 skipped; tsc clean
- CI on `e955287`: Python tests and Frontend tests green

## After the ship
Production checks at 1440 and 390, read-only:
- #425: provoke a failed check where possible; otherwise record it as N/A, as #430's was.
- #402: the picker with a pin dropped.
- #429: type 99999.
- #432: type 512.5.
- #410: landing step 1.
- #418: re-pick from a road with 4 per side; a near-intersection road where the map reads fewer lanes.

Then close #425, #402, #429, #432, #410, #418 and #433, and leave #434 open.
