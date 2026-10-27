# #411: one meaning per mark on the sandbox form (ruled items, plus Surface B's hues)

Mission `form-marks` (#413), finished in mission `finish-marks` (#417). Branch `issue-411-mark-meanings`. Base: `ca80d16` for cycles 1–2; `issue-397-untouched-provenance` `04b76f5` from repair cycle 3 (below).

## Rulings that govern it
- Ryan, 2026-10-26 (re-scope comment on #411, and recorded on #284):
  1. "'✓ default' becomes plain 'default', with no mark." This amends R110 Q8 (`validation-artifacts/committed/setup-what-redesign/rulings.md:26`).
  2. "'✓ proposed' becomes '⚠ proposed'." This amends #284.
  3. "After both, ✓ means only 'measured' or 'yours', matching Ryan's #407 ruling."
- Ryan, 2026-10-25 (#407): "No exception to Rule 18 … ✓ stays a provenance mark only."
- Rule 18 (`conestruct/site/lib/design/symbols.ts:5-7`): "A symbol never changes hue by context." Also Rule 13 (a second channel, AA measured), Rule 5, and P9.

## Plan (5 bullets, before the diff)
1. **Problem.** `markerOf` maps every "default …" line to ✓ (`lib/scenarios/provenance-marker.ts:66`), used on Hours, Speed reduction and Carriageway (`components/bands/PlanDetails.tsx:231,252,346`). The proposed kind reads "✓ proposed" (`components/bands/WhereBand.tsx:431,439`). The marker draws ✓, ◌ and i in the trigger's faint ink (`.a-mark`, `app/globals.css`), and the side-control ⚠ lines are faint (`WhereBand.tsx:296,366`).
2. **Rulings.** As above.
3. **Change.** Add a `plainDefault` option to `markerOf` (glyph `null`, tone `plain`). `FieldCell` renders a null glyph as the word alone, and a glyph in its own `symClass` span. `PlanDetails`' `Cell` passes `plainDefault` on its three rows. "⚠ proposed" goes on the chip and the note, with ⚠ in `symClass`. The two side-control ⚠ spans take `symClass("⚠")`. DESIGN-SPACING and P9 record the ruling.
4. **Rule 5 churn prediction.** Sources: `provenance-marker.ts`, `FieldCell.tsx`, `PlanDetails.tsx`, `WhereBand.tsx`, plus a one-line comment fix in `lib/scenarios/types.ts:415` ("✓ default" → plain "default"; amended in repair cycle 1, before that diff); docs: `DESIGN-SPACING.md`, `DESIGN-PRINCIPLES.md` (P9). Tests amended: declutter, step2-layout, PlanDetails, kind-proposal, left-side, no-crossing, provenance-marker. One new file: `FieldCell.marks.test.tsx`. About 150 lines.
   Stated behaviour changes:
   - Hours, Speed reduction and Carriageway read `default` (was `✓ default`). The marker is 1 glyph and 1 space shorter. Measured trigger width 62.05 → 47.05 px. At 390 it is right-aligned in the row head: the left edge moves right 15 px (296.95 → 311.95) and the word stays put. At 1440 it is left-aligned under the label: the left edge stays (x 736), the word starts 15 px further left (it takes the glyph's place), and the right edge comes in 15 px.
   - On the kind chip and the proposal note, the text after the glyph ("proposed", "proposed: …") moves right because ⚠ is wider than ✓: measured +1.20 px on the chip and +1.19 px on the note, at 1440 and 390 (the cycle-1 estimate was ~1.5). The glyph's own left edge moves 0.01 px or less. (Stated in repair cycle 1, measured in cycle 2; `measurements-after.json` → `xShiftAfterGlyph`. Missed in the first prediction.)
   - Every marker ✓ is green (`--pass`) and every marker i is blue (`--act`). Marker ◌ is unchanged in hue (`--none` = `--ink-faint` = `#93a0b0`). *Corrected in gate repair 2: ◌ now has the glyph span too (`FieldCell.tsx`), so it moves by the same sub-pixel amount as every glyph marker (0.031 px measured on ✓ and ⚠: the word right at 1440, the glyph left at 390, per width as in § Results (cycle 3) as corrected in cycle 4; ◌ not measured separately).*
   - The proposed kind reads `⚠ proposed` in amber.
   - The two side-control ⚠ glyphs are amber.
   - The WHAT header's guess count is unchanged ("⚠ proposed" is in WHERE, and the count reads only the WHAT rows).
   Byte-identical: the backend, every other TSX and CSS file, the ink and type censuses (no new hex, no new size), and #397's rows' default handling.
5. **Proof.** Red-on-base vitest (`red-proof.txt`), before/after shots at 1440 and 390 with contrast (`measurements-before.json`, `measurements-after.json`), the inventory (`mark-inventory.md`), and the full suites.

## Calls
1. **R145 self-ruled: `plainDefault` is opt-in per row, the same shape as #397's.** (Corrected in repair cycle 1. The first version of this call cited `issue-397-parked.patch`, which was saved before #397's third cycle and is stale.) #397's live, uncommitted diff (`.claude/worktrees/issue-397`, read-only) builds the same shape:
   - a `plainDefault` option on `markerOf`;
   - `glyph: … | null` and tone `plain`;
   - `FieldCell` renders `glyph === null` as the word alone;
   - #397 applies it to length, work type, lanes and road type.
   This branch applies it to Hours, Speed reduction and Carriageway. The opt-in is per row, so neither branch changes the other's rows. The two diffs will conflict on text in three files:
   - `lib/scenarios/provenance-marker.ts`: the interface comment, the `OSM_WORDS` type, `TONE`, `mk` (#397's takes `null`), the `markerOf` doc and the `/^default\b/` line;
   - `components/bands/FieldCell.tsx:122`: the trigger's span;
   - `components/bands/PlanDetails.tsx`: `Cell`'s `plainDefault` prop and its doc.
   When resolving, keep #411's versions, because they add the `symClass` span on the glyph. #397's row callers (`plainDefault` at its call sites) then apply unchanged. Correcting comment on #397: https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6411650827.
2. **R145 self-ruled: hue on the glyph only.** The marker's word keeps `--ink-faint`, and only the glyph takes `symClass`. Rule 18 governs symbols, and a green word would read as a verdict. The guess marker (`.a-mark.is-guess`) stays amber throughout, as before.
3. **R145 self-ruled: no `.a-sym` on the marker glyph.** It keeps the trigger's font, so the marker's size and position don't change (P1). Only the hue changes. *Corrected in cycle 3: the glyph's own span moves the word after it +0.031 px inside the trigger and widens the trigger 0.031 px (measured); on screen that is the word 0.031 px right at 1440 and the glyph 0.031 px left at 390 (per width, § Results (cycle 3), corrected in cycle 4). Stated as a behaviour change below.*
4. **The "⚠ proposed" count, checked (the #411 acceptance).** "N guesses marked ⚠" is `whatHeader(warnMarkers)` in `components/bands/WhatBand.tsx`. It counts the WHAT rows' markers and nothing in WHERE, and `lib/scenarios/rail.ts` / `lib/tier-sources.ts` don't read `kind_proposal`. So "⚠ proposed" doesn't count, and no rule says it should: the header's own text is "change any that are wrong", about WHAT's prefilled values, and a proposal is never a value (#284: "never pre-selected"). Unchanged.
5. **Lane width needs no change.** It has no marker, only the details line "Lane width · default · …", which never carried a glyph.
6. **✓ as a verdict: built, then withdrawn, filed as #414.** Option (b) (a verdict reads its word, with no glyph) was built on StatusBar, ScheduleField, NeedsYouConditions and RevisionPanel. It failed six tests that pin earlier Ryan rulings: #281 Part 2 rule 95.4 (7c "leads with ✓"), rules 74–77 (the site-condition glyph track is `▲✓◌`) and #248 ("✓ none"). DESIGN-SPACING also still defines ✓ as "confirmed or passing". Overturning those would reverse Ryan rulings (park list), and the newer rulings point the other way, so the choice is Ryan's. The edits were reverted, and the failing names are in `full-run-fails.txt` (run 2). Filed: https://github.com/rtmakatura/conestruct/issues/414
7. **R145 self-ruled: some ✓s read as "yours".** Band facts, the ledger's answered rows, "✓ both set" and the "confirmed" record each mark an answer the operator gave. That fits "yours", so they are not in #414's verdict list (they are named there so Ryan can overrule).
8. **Surface C, and the × hue, filed as #415.** ▲ and ◌ need a ruling (the issue says so). The dismissed ×'s grey matches DESIGN-SPACING (`--none`) but not `symbols.ts` (`--fail`), so the sources conflict and neither hue can be chosen as "the" Rule 18 hue without a ruling. https://github.com/rtmakatura/conestruct/issues/415
9. **The ledger's green ✓ on rows nobody answered (brief item).** The only such row is the extent: `workLen > 0` is true at the default length, so it shows ✓ (and "· typed" on the base). The ✓ is a state/verdict ✓, like "laid out". #397's R145-12 defers it to this inventory, so its owner is #414, where it has been added (repair cycle 1). Not fixed here.
10. **Shots: the probe injects two things, as #407 and #412 did.** (a) The corridor-geometry answer gets a `kind_proposal` added in the browser (a real one needs a one-lane one-way street; the basis text is the probe's). (b) The side-control ⚠ line is a copy with WhereBand's own markup, injected into the real `[data-testid=side-control]` (the real lines need a backend refusal or an unmarked crossing). The Carriageway row didn't render on the stub road, so it has no shot; its marker is the same `Cell` path as Hours, pinned by `WhatBand.step2-layout.test.tsx`. The probe script stays in the scratchpad (`probe411.mjs`). *Superseded in cycle 3: the cycle-3 probe, `probe411c3.mjs`, is committed in this folder.*

## Measured contrast (AA 4.5:1 floor; the same at 1440 and 390)
| mark | ground | before | after |
|---|---|---|---|
| kind chip "⚠ proposed", unpressed | `#101c29` | faint `#93a0b0` 6.47 | `--warn` `#f4c020` 10.17 |
| kind chip "⚠ proposed", pressed | `rgb(19.6,42.1,60.1)` | 5.53 | not rendered (cycle 3, Ryan's ruling: ● alone on the picked chip) |
| proposal note ⚠ | `#101c29` | 6.47 | 10.17 |
| side-control ⚠ line | `#101c29` | 6.47 | 10.17 |
| marker ✓ (speed, lanes "measured") | `#101c29` | 6.47 | `--pass` `#4fd787` 9.35 |
| marker "default" (Hours, Speed reduction), the trigger's word ink | `#101c29` | `✓ default` 6.47 | `default` 6.47, measured at 1440 and 390 (`marker-night-word`, `marker-reduction-word`) |
| marker i "about" | `#101c29` | 6.47 | `--act` 6.55, measured at 1440 and 390 on a copy of the Speed row's trigger (cycle 3; no live row shows it) |
| marker ◌ | `#101c29` | 6.47 | 6.47 (same value) |

## Tests
*Superseded by cycle 3 (§ Results (cycle 3)): the figures below are from cycle 2 on `ca80d16`. The guard "plainDefault changes no other line" has been removed, and `provenance-marker.test.ts` was rewritten in place. Current: vitest 2590 passed, 1 skipped; red proof 17 against `04b76f5`.*
- Baseline: vitest 2562 passed, 1 skipped; pytest 3593 passed, 2 skipped.
- After: vitest 2571 passed, 1 skipped (+9: 5 in the new `FieldCell.marks.test.tsx`, 4 in `provenance-marker.test.ts`; 7 existing test files modified: 6 with tests amended in place, plus `provenance-marker.test.ts` with the 4 additions). tsc clean, `next lint` clean, mypy clean (49 files), ruff clean. Backend untouched.
- Red proof: 14 of the new and amended tests fail on base (`red-proof.txt`). The one green there is the guard "plainDefault changes no other line".

## Actual churn vs prediction
*Superseded by cycle 3 (§ Results (cycle 3)): this is the cycle-2 diff against `ca80d16`.*
**Over the prediction.** About 174 lines added (+123 / −37 in 14 tracked files, plus 51 in the new test file) against about 150 predicted. The repair cycles account for the rest. Cycle 1 added a 14th file, `lib/scenarios/types.ts` (one comment line, put in the prediction before its diff). Cycle 2 added the DESIGN-SPACING ⚠/⌁ row and note corrections and the WhereBand `#284` comment fix. The cycle-1 text said "+118 / −33 … within the ~150 predicted", which counted only tracked lines and left out the 51-line new file. That was wrong. The pixel changes match bullet 4 as corrected (both text shifts were missed in the first prediction, and are now measured).

## Repair cycle 1 (diff-verifier PASS, independent reviewer FAIL)
1. #397 claims corrected: Call 1 rewritten against #397's live diff (same shape; three files conflict; keep #411's versions).
2. Inventory: #397's live work shows plain "default", pending its commit.
3. Correcting comment on #397: https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6411650827
4. The Extent row's ✓ moved to #414 (inventory owner changed). Comment: https://github.com/rtmakatura/conestruct/issues/414#issuecomment-6411651308
5. The ✓ hue on "✓ both set" (`WhatBand.tsx:274`) and "✓ N none found" (`NeedsYouConditions.tsx:587`) added to #414: https://github.com/rtmakatura/conestruct/issues/414#issuecomment-6411651963. Not folded in: `WhatBand.tsx` is #397's.
6. Rule 5: plan bullet 4 corrected (the text shift after ⚠, measured +1.20 / +1.19 px in cycle 2; "default" alignment at 1440 vs 390, measured).
7. Cites: the dismissed grey is `app/globals.css:2584` (comment at 2572); "✓ N none found" is `NeedsYouConditions.tsx:587`. Correction on #415: https://github.com/rtmakatura/conestruct/issues/415#issuecomment-6411652331
8. Stale "✓ default" comments: `lib/scenarios/types.ts:415` amended (one line). `lib/scenarios/what-writes.ts:128` is left to #397, which already touches that file (noted in the inventory).
9. Test accounting: 9 new tests (5 in the new `FieldCell.marks.test.tsx`, 4 in `provenance-marker.test.ts`); 7 existing test files modified (6 amended in place, plus the file holding the 4 additions).

## Repair cycle 2 (diff-verifier PASS, independent reviewer FAIL; last cycle)
1. ⌁ claim corrected. The base already rendered no ⌁: DESIGN-SPACING's ⌁ rows are recorded as gone, and the proposed kind used ✓. DESIGN-SPACING's note now says "The form renders no ⌁ (already true on the base …)". The ⚠ row's meaning adds "a guess to check (from the road, proposed)", and the ⌁ row is marked "unused on the form". The inventory is fixed to match.
2. "default" contrast measured: the probe now reads the trigger's own ink (`marker-<id>-word`). Plain "default" is 6.47:1 on `#101c29` at 1440 and 390.
3. "✓ evaluated" and "✓ detected" are verdict ✓s, added to #414: https://github.com/rtmakatura/conestruct/issues/414#issuecomment-6411797801. The unknown-OSM-word → ✓ fallback (`provenance-marker.ts:58` base, `:68` branch) is filed as #416 (Rule 10): https://github.com/rtmakatura/conestruct/issues/416. Behaviour unchanged; both listed as OPEN in the inventory.
4. Churn overrun stated honestly (§ Actual churn vs prediction).
5. Base cites: proposed mark and note `WhereBand.tsx:431,439`; side-control ⚠ spans `:296,366`.
6. The stale comment at `WhereBand.tsx:391-392` now reads "⚠ proposed (amended #411)". Line 728 was left as it is.
7. `full-run-fails.txt`: the six run-2 tests were withdrawn, not amended. Each passes on unchanged sources when run alone (recorded there).
8. `measurements-*.json` re-written by the re-run probe as UTF-8 (`writeFileSync(..., 'utf8')`). Python strict-decodes both and finds 0 mojibake sequences. The bytes were already UTF-8 (⚠ = `E2 9A A0`); the mojibake was in how they were displayed.
9. The x-shift after ⚠ is measured and recorded in `measurements-after.json` → `xShiftAfterGlyph`.
10. Correction on #414 (582 → 587): https://github.com/rtmakatura/conestruct/issues/414#issuecomment-6411798241

## Repair cycle 3 (third cycle, allowed by Ryan 2026-10-26)

New base: `issue-397-untouched-provenance` `04b76f5` (#397's commit, on `form-marks-prod-check` `8b0a73f`, which descends from `ca80d16`). The parked work was saved as a patch, the worktree reset to `04b76f5`, and the patch re-applied with `git apply --3way`. Three files conflicted, the three call 1 predicted (`provenance-marker.ts`, `FieldCell.tsx`, `PlanDetails.tsx`); each conflicting hunk takes #411's side, as self-ruled (call 1, R145) and recorded on #397 (https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6411650827). #397's other lines in those files are kept.

### Ruling
- **Ryan, 2026-10-26** (https://github.com/rtmakatura/conestruct/issues/411#issuecomment-6428707756, amends #284): "Once the operator picks the proposed kind chip, '⚠ proposed' and its note go away, and ● alone says 'chosen'." The same comment allows this third cycle and keeps #414 filed, not built.

### Plan (5 bullets, before the diff)
1. **Problem.** (a) The pressed proposed kind chip shows ● and "⚠ proposed" together, and the note "⚠ proposed: … Pick it to use it." stays (`components/bands/WhereBand.tsx:437-455` on this branch). (b) Call 3 says the marker's size and position don't change, but the glyph's new span moves the word after it by 0.03 px (reviewer finding 1). (c) The inventory and #414/#415 cite `NeedsYouConditions.tsx:520`; the glyph is at `:525` and the word at `:528` (finding 2). (d) `markerOf` still maps a "default" line to "✓ default" unless the caller opts in (`provenance-marker.ts:83` on this branch; finding 7), and its doc now carries #397's and #411's two copies (finding 6). (e) "i 6.55" was computed, not measured (finding 4); DESIGN-SPACING says "as every glyph does" (finding 5; that wording was in the cycle-2 tree only, never on `04b76f5`: the #411 note is wholly new in this diff); `lib/scenarios/what-writes.ts:143` (was `:128` before #397) and `lib/scenarios/operator-set.test.ts:6` still say "✓ default" (finding 8).
2. **Rulings.** Ryan's above; the 2026-10-26 "'✓ default' becomes plain 'default', with no mark" (amends R110 Q8); Rule 18, Rule 13, Rule 5, P9.
3. **Change.** (a) `KindChips`: the "· ⚠ proposed" suffix and the proposal note render only while the proposed chip is not the pressed one. Picking another kind brings them back (the proposal stands; nothing was chosen from it). (b) `markerOf`: every "default" line reads the word alone; the `plainDefault` option is removed, with its prop and call sites in `PlanDetails.tsx` and `WhatBand.tsx` (against `04b76f5` this IS a rendered change: there, Hours (`PlanDetails.tsx:244` on `04b76f5`), Speed reduction (`:265`) and Carriageway (`:359`) did not pass it and read "✓ default"; they now read "default". #397's rows passed it on the base and are unchanged. The "no change" holds only against the cycle-2 tree, where this branch's `Cell` already passed it). One doc comment. (c) Inventory and the bodies of #414 and #415: `:525` (glyph) / `:528` (word). (d) "i about" measured live on an injected marker with FieldCell's own markup. (e) DESIGN-SPACING wording; the two stale comments; call 3 corrected and the 0.03 px move stated and measured.
4. **Rule 5 churn prediction (this cycle, on top of the parked diff).** Sources: `WhereBand.tsx` ~+8 / −3; `provenance-marker.ts` ~+4 / −12; `PlanDetails.tsx` ~+1 / −10; `WhatBand.tsx` (new to this branch) ~+1 / −10; `what-writes.ts` (new) 1 line. Docs: `DESIGN-SPACING.md` ~2 lines. Tests: `WhereBand.kind-proposal.test.tsx` ~+15; `provenance-marker.test.ts` ~10 changed; `FieldCell.marks.test.tsx` ~3; `operator-set.test.ts` (new) 1 comment line. About 50 lines added, 40 removed.
   Stated behaviour changes (this cycle):
   - Pressed proposed chip: reads its citation alone (no "· ⚠ proposed"); the note below the chips goes; the gate note and everything under it move up by the note's height plus its margin (measured in the shots).
   - Unpressed proposed chip, and any other state: unchanged from cycle 2.
   - The word after a marker glyph moves by about 0.03 px (the glyph's span; already in the parked diff, now stated and measured).
   Byte-identical: the backend, every rendered marker apart from those above and the three "default" rows below, #397's rows and its 20 tests.
   - Against `04b76f5` (stated in the gate repair): Hours, Speed reduction and Carriageway read `default` (were `✓ default` on the base, which never passed `plainDefault` for them); this is the cycle-1 change, and dropping the option is how it is now built.
5. **Proof.** New and amended tests red on `04b76f5` (`git archive` into the scratchpad; `red-proof.txt`), the full vitest run, tsc and lint; before (`04b76f5`) / after shots at 1440 and 390 of the proposed chip unpressed and pressed, the note, and a marker with "✓ measured"; measurements in `measurements-before.json` / `measurements-after.json`.

### Superseded
- Call 1's "`plainDefault` is opt-in per row": superseded in this cycle. Both branches are on one line now, and the ruling covers every "default", so the option is gone (R145 self-ruled, below).
- Call 3's "so the marker's size and position don't change": superseded. The word after the glyph moves about 0.03 px (measured, below).
- Ruling 2's "'⚠ proposed' on the chip and the note": amended by Ryan's ruling above for the pressed chip.

### Calls (cycle 3)
1. **R145 self-ruled: drop `plainDefault`, make every "default" plain.** The ruling names no rows. On `04b76f5` only #397's rows passed the option; Hours (`PlanDetails.tsx:244` on `04b76f5`), Speed reduction (`:265`) and Carriageway (`:359`) did not, and read "✓ default". Mapping every "default" line to the word alone is what changes those three rows (the ruled change). A per-row option with a "✓ default" fallback only kept a latent wrong mark (finding 7).
2. **R145 self-ruled: the proposed mark returns if the operator picks another kind.** The ruling covers the picked chip. With another kind pressed the proposal is still unanswered, which is #284's state.
3. **#418 not folded.** Its three parts live in `WhatBand.tsx`'s lanes clause and doubt line. This branch touches `WhatBand.tsx` only to drop the option, (a) needs a choice between a new marker word and a plan-value reset (a stated Rule 5 change to a plan value), and the copy changes go beyond ~20 lines with their tests. Left on #418.

### Results (cycle 3)
**Behaviour changes, measured at 1440 and 390 against `04b76f5`** (`measurements-before.json`, `measurements-after.json`, shots `before-*` / `after-*`; probe `probe411c3.mjs`, which injects the proposal and the side line as call 10 says):
- Picked proposed chip: reads "TA-3/TA-5 · S-630-1" with ● and no "⚠ proposed" (was ● and "✓ proposed"); the note is gone. The block below the chips moves up by the note's height plus its 8 px margin: 23.75 px at 1440 (block 110.75 → 87 px), 55.25 px at 390 (320.25 → 265 px; the note wraps to three lines there). Shots `kind-block-pressed`, `kind-proposed-chip-pressed`.
- Every marker with a glyph: the glyph's own span puts the word 0.031 px further from the trigger's left edge and widens the trigger 0.031 px, the same at 1440 and 390 (measured inside the trigger). On screen: at 1440 (trigger left-aligned) the glyph stays and the word moves 0.031 px right; at 390 (trigger right-aligned) the word stays and the glyph moves 0.031 px left ("✓ measured" 68.766 → 68.797 px wide, word 15 → 15.031 px from the trigger's left; "⚠ from the road" 103.547 → 103.578, 16.172 → 16.203; `marker-<row>-wordx`). The alignment per width is the one measured on the "default" trigger (plan bullet 4: left edge x 736 kept at 1440; 296.95 → 311.95 px at 390, right edge kept). This comes from the cycle-1 glyph span, and was missed until cycle 3. *Corrected in cycle 4: this line said "the word moves +0.031 px" for both widths, which holds on screen at 1440 only.*
- "i about": 6.47 → 6.55:1, now measured.
- Dropping `plainDefault`, against `04b76f5`: Hours (`PlanDetails.tsx:244` on `04b76f5`), Speed reduction (`:265`) and Carriageway (`:359`) change from "✓ default" to "default" (shots `cell-night`, `cell-reduction`; trigger 62.05 → 47.05 px, word ink 6.47:1). Carriageway did not render on the stub road, so it has no shot or measurement; it is covered by `WhatBand.step2-layout.test.tsx` only. #397's rows already read plain "default" on the base and are unchanged; its 20 tests in `untouched-provenance.test.tsx` pass unchanged. (Against the cycle-2 tree, where this branch's `Cell` passed the option, dropping it changes nothing; that is the only sense in which "no change" was true.)
- Everything else as stated in cycles 1–2. Their before figures were taken on `ca80d16`; the cycle-3 re-run on `04b76f5` gives the same values (e.g. `xProposedMark` 35.16 → 36.36, contrast 6.47 → 10.17 / 9.35).

**Tests.** vitest: first full run 1 failed | 2589 passed | 1 skipped. The failure, `Landing.test.tsx` "the job form posts exactly the route's keys…", was saved to `full-run-fails.txt` before any re-run; alone it passed 31 of 31, in a file this branch doesn't touch. Re-run: Test Files 243 passed | 1 skipped (244), Tests 2590 passed | 1 skipped (2591). `tsc --noEmit` clean, `next lint` "No ESLint warnings or errors". No Python changed.
**Red proof** (`red-proof.txt`, against `04b76f5`): 17 failed | 93 passed in the 9 changed test files. Each new and amended test fails on base. The one file that stays green is `operator-set.test.ts`, which has a comment change only.

**Actual churn vs prediction (like for like, corrected in gate repair 2).** The prediction covered this cycle only, on top of the parked diff. So the comparison uses this cycle's delta: the current tree against the parked work merged onto `04b76f5` with #411's hunks (rebuilt in the scratchpad with `git merge-file --theirs`). *Cycle 4: that rebuilt tree was never committed and is not in the repo, so the per-file figures and the total below cannot be recomputed from the tree; they stand as derived then. The verifiable figure is the whole-branch total under the table.*

| file | this cycle | predicted |
|---|---|---|
| `WhereBand.tsx` | +10 / −5 | +8 / −3 |
| `provenance-marker.ts` | +9 / −16 | +4 / −12 |
| `PlanDetails.tsx` | +2 / −10 | +1 / −10 |
| `WhatBand.tsx` | +3 / −12 | +1 / −10 |
| `what-writes.ts` | +1 / −1 | 1 line |
| `DESIGN-SPACING.md` | +6 / −3, plus the `i` row fold (gate repair 2) | ~2 lines |
| `WhereBand.kind-proposal.test.tsx` | +28 / −2 | ~+15 |
| `provenance-marker.test.ts` | +6 / −23 | ~10 changed |
| `FieldCell.marks.test.tsx` | +1 / −3 | ~3 |
| `operator-set.test.ts` | +1 / −1 | 1 line |
| `PlanDetails.test.tsx` | +1 / −1 | not predicted |

- Total: about +68 / −77, against ~+50 / −40 predicted. **Over.**
- The kind-proposal test runs about double, because the new test also checks that the mark comes back after another pick.
- `provenance-marker.test.ts` removed more than predicted: the opt-in tests went, and so did the guard.
- `PlanDetails.test.tsx` wasn't predicted.

Whole branch, a separate figure: *superseded in cycle 4* (it read +146 / −72; the gate-repair-2 `i` row fold made it +147 / −73, and cycle 4's DESIGN-SPACING line and FieldCell comment made it +150 / −73). Current: § Cycle 4.

### Findings, cycle 3 disposition
1. 0.03 px move: corrected (call 3, results).
2. Base cite: inventory now cites `NeedsYouConditions.tsx:525` (glyph) and `:528` (word). The other cites are moved to `04b76f5` lines. The bodies of #414 and #415 are corrected.
3. Pressed proposed chip: built per Ryan's ruling.
4. "i 6.55": measured.
5. DESIGN-SPACING: now reads "as Rule 18 requires" (a change to the cycle-2 tree only; against `04b76f5` the whole #411 note is new).
6. #397's "⚠ default": resolved by #397 cycle 4. The inventory says so, and the stale `markerOf` doc is replaced.
7. Latent `mk("✓","default")`: removed (call 1, cycle 3).
8. `what-writes.ts` stale comment: fixed (`:143`).

## Cycle 4 (doc fixes only, ruled by Ryan 2026-10-27)

Ruling: https://github.com/rtmakatura/conestruct/issues/411#issuecomment-6435840305, "#411 gets a fourth cycle, doc fixes only … There is no code change." Scope: the four open findings in `validation-artifacts/committed/missions/finish-marks/report.md` § "#411 Remaining double meanings in the form's marks (parked)", plus the diff-verifier's advisory there. New base: `finish-marks-prod-check` `54b8182`, which contains `04b76f5`; `git diff 04b76f5 54b8182 -- conestruct` is empty (the delta is `validation-artifacts/committed/missions/finish-marks/` only), so every code line and every `04b76f5` line cite above holds on `54b8182`. Moved with `git reset --keep 54b8182`; `git status` shows the same modified and untracked set before and after. No code line or test changed in this cycle; one comment in FieldCell.tsx:122-125 was corrected (below).

### Findings and fixes
1. **Branch total (diff-verifier REPAIR 1).** "+146 / −72" was stale. `git diff 54b8182 --shortstat` now: 17 files changed, 150 insertions(+), 73 deletions(−) (+147 / −73 before this cycle; this cycle's DESIGN-SPACING line adds +2 and the FieldCell comment +1), plus the untracked 49-line `components/bands/FieldCell.marks.test.tsx` and this evidence folder. The old line in § Results (cycle 3) is marked superseded.
2. **The +0.031 px move per width (reviewer).** The measurements are inside the trigger and the same at both widths (`marker-<row>-wordx`: word 15 → 15.031 px from the trigger's left, trigger 68.766 → 68.797 px). On screen, at 1440 the trigger is left-aligned (the glyph stays, the word moves 0.031 px right); at 390 it is right-aligned (the word stays, the glyph moves 0.031 px left). Corrected in § Results (cycle 3), the plan-bullet-4 ◌ note, `mark-inventory.md` (✓ and ◌ sections) and the commit message.
3. **DESIGN-SPACING #411 note (reviewer).** "its word keeps the marker's faint ink" was wrong for the guess tone: `.a-mark` sets `--ink-faint`, and `.a-mark.is-guess` sets `--warn` (`conestruct/site/app/globals.css:5379-5399`), so a guess marker's word stays amber. The note now says so. The same shorthand sat in the code comment at `components/bands/FieldCell.tsx:122-124` ("the word keeps the marker's faint ink"). **R145 self-ruled (orchestrator):** the comment is corrected to match (now `:122-125`, 3 → 4 comment lines). It is a comment-only edit inside Ryan's doc-only ruling: `git diff -U0` shows the TSX lines unchanged from cycle 3 and only the comment lines differ, so no test re-run is needed for it.
4. **`mark-inventory.md` contradictions (reviewer).** (a) The ✓ heading said "Hue is ONE (FIXED)" while the same section holds the plain-text ✓ hue OPEN on #414; the heading now says the hue is fixed on the marker and open on those two ✓s, and the summary lists it. (b) `→` was listed with two uses under "Each has one use". **R145 self-ruled:** `→` has one meaning, "becomes", in both uses: was → now (`components/bands/RevisionPanel.tsx:221`) and a staged field edit's "label → value" (`components/NeedsYouConditions.tsx:260`, a type guard its comment says a condition row never reaches). The line now says "Each has one meaning" and names both uses with their cites.
5. **The +68 / −77 this-cycle delta (diff-verifier advisory).** It was taken against a tree rebuilt in a cycle-3 scratchpad and never committed, so it can't be recomputed from the repo. It is now labelled as derived and not verifiable from the tree; the whole-branch total (finding 1) is the checkable figure.
6. **Found while editing:** § Calls 1 printed the regex `/^default\b/` with a backspace byte in place of `\b`. Fixed.

### Tests (cycle 4, `54b8182` base, run one at a time)
- vitest: Test Files 243 passed | 1 skipped (244); Tests 2590 passed | 1 skipped (2591).
- pytest: 3593 passed, 2 skipped.
- Both runs came before the FieldCell comment fix; that change is comment-only, so they were not repeated.
- Red proof unchanged (`red-proof.txt`, 17 failed | 93 passed against `04b76f5`): no test or source changed since, and `04b76f5` and `54b8182` carry the same `conestruct/` tree.
