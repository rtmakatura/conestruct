# Mission walkthrough-round-3 (#431): report

2026-10-28. Five items built (six issues: #406 rides with #425). One issue was parked before work, and one sub-finding inside #402 was parked. Every commit passed the diff-verifier and an independent reviewer.

## Questions for Ryan

1. **#429 (parked before work): what marker does a refused work-zone length carry?** The issue asks for a ruling on DESIGN-SPACING.md § One glyph vocabulary. You last ruled on that table on 2026-10-26 (#411). There are now three refused cases, because #428 extended #403's marker to a typed 0. A negative length and a typed 0 read a plain "yours" with no glyph. A length over the 20,000 ft cap still reads "✓ yours". The scope note is on #429: https://github.com/rtmakatura/conestruct/issues/429#issuecomment-6477801702.
   **Recommendation:** record glyphless "yours" in the table as "the operator's value, refused by the form", and give the over-cap case the same marker, with a mounted test that types 99999.

2. **#402, sub-finding 3 (parked): may the picker's side sentence change?** The picker shows "Say which side is occupied to lay out the work" (`SIDE_SENTENCE`, `LocationPickerModal.tsx:2269` on `90ab1fb`), but the picker has no side control. That exact sentence is your 2026-09-25 ruling (`validation-artifacts/committed/issue-290-pin-work/rulings.md:243-257`), so changing it reverses a ruling.
   **Recommendation:** in the picker's two places, the map overlay and the panel, read "Save, then say which side is occupied." The band's copy, beside the real side control, stays as ruled. #402 stays open for this.

3. **#425 / #406: self-ruled calls you may want to overturn.** You had #425 down for a ruling. I treated it as wording and state display inside Rule 10 and P2, so it was self-ruled and flagged.
   - One verb for the band's "no answer" lines: "not checked". This also changes a failed check (5xx or network) from "not evaluated: the check didn't answer…" to "not checked: the check didn't answer…". It overrides #406's acceptance line, which quoted "not evaluated".
   - The new declined line reads "not checked: the plan was declined; the option shown stands". It is not red, and its marker is "◌ not checked".
   - A pin guess keeps "⚠ from the pin" and moves the declined line into its details.
   - The post-generate panels keep "unavailable while generation is declined".
   - The live path shows the declined guess only. The operator-picked "◌ not checked" cell is covered by the mounted test only.

4. **#426: one edge of "spelled out once".** The long form lands in the working band's label: "Method of Handling Traffic (MHT) package ZIP". A screen-reader user whose plan has no device counts hears "Plan generated. MHT package ready." first. They have already heard the hidden page heading "Method of Handling Traffic plan generator" (`GeneratorShell.tsx:1668-1670`).
   **Recommendation:** keep it. No fixed placement can be both the only use and the first use for every reader.

5. **#402, Enter on a plan that already has a pin.** Enter does exactly what "Pick on map" does. On a plan with no pin, the picker searches the typed text. On a plan with a pin, the picker opens on the saved pin with the text in the box, not yet searched, because searching would move a saved pin.
   **Recommendation:** keep it, and say so in #402's close comment. Not filed.

## Ready to ship

Top branch: **`issue-402-picker-states`** at `a0c761e` (CI green on that commit before this report: Python tests and Frontend tests). The chain is linear and pushed:

| Branch | Commit | What |
|---|---|---|
| `walkthrough-followups-prod-check` | `bda17e5` | pending evidence from #423 (base) |
| `issue-430-preview-refusal` | `5661100` | #430 |
| `issue-426-mht-spelled-out` | `a0c666d` | #426 |
| `issue-425-declined-jurisdiction` | `1a0f7d1` | #425, #406 |
| `issue-428-typed-zero-length` | `90ab1fb` | #428 |
| `issue-402-picker-states` | `877b93b` | #402 (3 of 4) |
| `issue-402-picker-states` | `a0c761e` | production-env.txt cites (end-of-mission fix) |
| `issue-402-picker-states` | (this commit) | this report |

Worktrees: `.claude/worktrees/issue-430`, `issue-426`, `issue-425`, `issue-428`, `issue-402` (top), and `walkthrough-prod-check`.

## Filed

- #431, the tracking issue: https://github.com/rtmakatura/conestruct/issues/431
- #432, a typed decimal in the work-zone length box is dropped (`512.5` becomes `512` with "✓ yours"). It needs a ruling on keeping the decimal or rounding with a notice. Filed by the #428 item: https://github.com/rtmakatura/conestruct/issues/432
- A comment on #429 widening its scope to the typed 0: https://github.com/rtmakatura/conestruct/issues/429#issuecomment-6477801702

## Calls I made

All are recorded as R145 self-ruled in each item's `rulings.md`.

- **Mission scope:**
  - #429 parked before work, since its acceptance says "by ruling".
  - #425 and #406 run as one item, since they share one cause.
  - #410 and #418 left for the next round (the cap).
- **#430:**
  - Both of the issue's options are built. (a) The preview runs the shell's own jurisdiction rule (`reconcileJurisdiction`). It doesn't run the whole normalizer, because re-guessing speed would move the preview's lengths.
  - (b) A 400 reads "Corridor preview declined: <the backend's message> You can still save; the plan is validated when generated.".
  - With no readable message, the line reads "Corridor preview declined." and names no answerer: the site's own route sends 400s before the backend is called.
  - `asSentence()` ends an unpunctuated message with a period.
  - A 429 still reads "couldn't reach" (not filed).
  - No shots.
- **#426:**
  - The long form goes in the band label.
  - The zip keeps the name `<base>_package.zip`. Putting MHT back into the filename would widen the ruling.
- **#425 / #406:** see Questions 3.
- **#428:**
  - The operator's `workLen` record tells a typed 0 from an emptied box (new `clearWorkLen`, one predicate `workLenIsEmpty`).
  - The manual-entry panel follows the same rule.
  - A draft the box can't parse is treated as an emptied box.
  - A typed 0 takes #403's existing marker form, so #429's question is unchanged in kind and wider in scope.
  - Stated: a plan saved before this branch with an emptied box now opens as a typed 0.
  - **Correction to its write-up** (reviewer note, not a defect): call 3 says that in the gated kinds' forms "an emptied box there would read as a typed 0". That is true only when a `workLen` record already exists. With no record, both read "required" while the box shows `0`, as on the base. Those forms can't be reached (Rule 8).
- **#402:**
  - ✓ marks the answered road question: "✓ Road picked · N detected", the form the single-match card already uses. The selected row itself gets no glyph, which keeps #407.
  - The picked line wraps rather than putting the direction first.
  - Enter does what the button does.
  - The CHANGE button's colour comment at `LocationPickerModal.tsx:2189-2191` still mentions the amber card, which the picked card no longer has. It's a stale comment, not filed.
- **End of mission:**
  - The full pytest run caught `scripts/production-env.txt` citing `LocationPickerModal.tsx:320`, which #430's import moved to `:322`.
  - Folded in under R154, same file: four more cites that were already stale on main `0de3917` (`WhereBand.tsx:532` to `:573`, `render-proxy.ts:101/102` to `:134/135`, `ComingSoon.tsx:60` to `:61`).
  - Reviewer's minor note: three explanation cites after `--` (`.env.example:24/39/44`) point at comments, not at the variable; the test doesn't read them.

## Flakes

- `GeneratorShell.value-links.test.tsx`: 9 failures in a full run on `a0c666d`, the first a 5 s timeout (#425's baseline). All 13 tests passed when run alone. The names are in `425/full-run-fails.txt`.
  #426's baseline on `5661100` also had 9 failures in one file, which weren't saved before the green re-run. That is a recorded miss (`426/rulings.md`), and very likely the same file.
- `GeneratorShell.a11y-announce.test.tsx`: 1 failure in #428's first full run. It passed alone (9 of 9) and in the next full run, as on #403. Saved in `428/full-run-fails.txt`.
- No flake in the end-of-mission runs, local or CI.

## Per item

### #430: the preview refusal read as an outage, `5661100`

The cause was that the picker's preview skipped the shell's rule that drops a jurisdiction guess made at an old pin. The backend refused it with `400 guess_stale`, and the hook showed that 400 as "Couldn't reach the layout service". Now the moved pin lays out, and a 400 reads as a refusal. Every other failure keeps the "Couldn't reach" line.

**Tests:** vitest 2649 passed, 1 skipped; tsc clean. 6 tests red on `bda17e5`, with 4 controls green.

**Gates:** two repair cycles, then one write-up-only round.
- Diff-verifier, final round: "VERDICT: PASS"
- Independent reviewer, final round: "PASS"
- The rounds before:
  1. The reviewer failed the fallback line for crediting the layout service.
  2. The reviewer failed a run-on sentence and a stale red proof.
  3. The reviewer failed off-by-one cites (`route.ts:30,35`, `schemas.py:1351-1367`). That round was write-up only and used no cycle.

### #426: MHT spelled out once, `a0c666d`

While the zip renders, the band reads "Method of Handling Traffic (MHT) package ZIP" (was "MHT package ZIP"). The announcement and the filename are unchanged. At 390 the band wraps to two lines (+18.12 px) while it shows.

**Tests:** vitest 2650 passed, 1 skipped; tsc clean. 2 tests red on `5661100`.

**Gates:**
- Diff-verifier: "VERDICT: PASS"
- Independent reviewer: "PASS"

### #425 + #406: the Jurisdiction cell on a declined plan, `1a0f7d1`

A 400 decline gets its own `declined` state, from the same source as #398's windows line. A pin guess keeps "⚠ from the pin" in amber at 10.17:1. An operator pick reads "◌ not checked". A failed check stays red at 6.82:1 and takes the shared verb. On a declined plan the cell is 37.5 px shorter, so content below it moves up.

**Tests:** vitest 2656 passed, 1 skipped; tsc clean. 5 of 5 red on `a0c666d`.

**Gates:**
- Diff-verifier: "VERDICT: PASS"
- Independent reviewer: "PASS". Its minor notes: cite DESIGN-SPACING.md:143 by line; no test asserts the ⚠ count coming back; a stale "not evaluated" remains in a CSS comment at `app/globals.css:5322`.

### #428: a typed 0 in the work-zone length box, `90ab1fb`

A typed 0 stays in the box. The field and Generate both read "Work zone length must be more than 0 ft.". An emptied box still reads "Work zone length is required." with "◌ not set". The manual-entry panel matches. The box sizes are unchanged.

**Tests:** vitest 2659 passed, 1 skipped; tsc clean. 4 tests red on `1a0f7d1`.

**Gates:**
- Diff-verifier: "The diff for #428 passes", with the marker written from the issue-428 worktree (23 code files, hash 04fd3fa73b8b).
- Independent reviewer: "PASS"

### #402: picker and WHERE band states (3 of 4), `877b93b`

- The head after a pick reads "✓ Road picked · N detected" on a neutral frame (was amber "⚠ Which road?").
- The picked road line wraps, so the direction shows: 2 lines at 1440, 3 at 390.
- Enter in the address field opens the picker, as the button does.
- The side sentence is parked (Questions 2).

**Tests:** vitest 2665 passed, 1 skipped; tsc clean. 3 tests red on `90ab1fb`, with 3 controls green.

**Gates:**
- Diff-verifier: "VERDICT: PASS"
- Independent reviewer: "PASS"

### End of mission: the `scripts/production-env.txt` cites, `a0c761e`

One cite moved by #430 and four that were already stale on main, +4/-4.

**Tests:**
- pytest 3612 passed, 2 skipped; mypy clean; ruff clean.
- On the top branch: vitest 2665 passed, 1 skipped; tsc clean.
- CI green on `a0c761e`.
- The failing test's name was saved before the re-run (`end-run-fails.txt`): it failed alone (1 failed, 13 passed) and passed after the fix (14 passed).

**Gates:**
- Diff-verifier: "VERDICT: PASS"
- Independent reviewer: "PASS"

## After the ship

Production checks at 1440 and 390:
- #430: E Colfax & Williams with the pin moved. The corridor lays out, with no outage line.
- #426: the band label while the zip renders.
- #425: the Colfax & Williams flagger decline. The Jurisdiction cell shows "⚠ from the pin", not the red "didn't answer" line.
- #428: type 0, then clear the box.
- #402: the picked head and the wrapped road line, then Enter in the address field.

Browser checks for Ryan: #426, #425, #428 and #402 are visible changes. #430's line isn't reached on the issue's own path.
