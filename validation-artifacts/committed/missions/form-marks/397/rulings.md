# #397 — untouched setup values read as the operator's (mission provenance-marks, #408, item 1; resumed in mission form-marks, #413, item 1)

Branch `issue-397-untouched-provenance`, worktree `.claude/worktrees/issue-397`. Built off `mission-swa-prod-check` (`7678d0b`) in cycles 1 and 2; parked there uncommitted. Repair cycle 3 (below) moved the work onto `mission-pm-prod-check` (`525c2e4`, which carries #407's ● and its production check). This folder moved from `missions/provenance-marks/397/` to `missions/form-marks/397/` so the commit has one home for its evidence. Cycle 4 moved it onto `form-marks-prod-check` (`8b0a73f`).

**Line cites.** A `file:line` cite in the sections before cycle 4 points at the base the section was written on (`525c2e4`; every file this diff changes is the same at `8b0a73f`). Lines in a file this diff changes shift once it is committed, so read those cites against the base. R145-1 and R145-2, which the commit message reuses, now cite by subject (cycle 4, finding 3).

## Baseline (before the diff)

- `uv run --extra dev pytest -q`: 3593 passed, 2 skipped.
- `npx vitest run --reporter=dot` (conestruct/site): Test Files 241 passed | 1 skipped (242); Tests 2557 passed | 1 skipped (2558).

## Ruling context

Ryan, 2026-10-25, on #407: no exception to Rule 18; ✓ is a provenance mark only ("measured", "yours"); selected chips and toggles get their own mark (item 2, #407, not this item). Mission goal: every mark in the sandbox form means one thing. For #397: never print "yours", "typed" or "operator-set" for a value no operator edit produced; a tool-supplied default reuses the Hours / Speed reduction "✓ default" treatment (`PlanDetails.tsx:98`, R110 Q8).

## Plan

1. **Problem.** Three untouched values claim the operator: the length (`lib/scenarios/move-ledger.ts:182` "· typed"; `components/bands/WhereBand.tsx:761-768` "your answer" / "✓ yours" whenever `workLen > 0`; the 1,000 ft comes from `lib/scenarios/index.ts:126`); Work type (`components/bands/PlanDetails.tsx:205-209`, a fixed "your change · operator-set from here on"); Lanes on a near-intersection plan (`lib/road-detection/detected-rows.ts:237-261` reads the never-written relay as "withdrawn", and the kind default 2 differs from OSM's count, so `appliedTokenFor` says "operator-set").
2. **Rulings.** Rule 10; suggest-never-set (R108, R126); R110 Q8 ("✓ default" until changed, then "✓ yours"); Ryan's 2026-10-25 #407 ruling above. Surface A self-ruled below (R145-1).
3. **Change.** (A) the length keeps 1,000 ft but reads "default" in the ledger ("1,000 ft · default") and the field ("✓ default") until the operator commits a length, which is recorded (`meta.operatorSet` gains `workLen`) and flips both to "typed" / "✓ yours". (B) Work type reads "✓ default" until changed (`operatorSet` gains `workType`; the record goes on a kind switch, since the kind's own default comes back). (C) on a near-intersection plan the Lanes row reads "⚠ default" (amber, repair cycle 1) with a line that says the map's count and why the plan doesn't use it, until the operator picks a count (`operatorSet` gains `lanes`, written for kinds detection never fills); a lanes or road-type row with no detection behind it reads "default" instead of "yours" when nobody edited it; a withdrawn lane detection gets a plain-words line in the row's details.
4. **Rule 5 churn prediction** (below).
5. **Proof.** New rendered-output tests (red on base): ledger Extent value, the length field marker, Work type marker, NI Lanes marker and line, and the flips after an edit; full vitest, tsc, lint; before/after screenshots at 1440 and 390 in this folder.

## Rule 5 churn prediction (written before the diff)

- `lib/scenarios/types.ts`: `OperatorSetField` gains `"workLen" | "workType" | "lanes"` (~5 lines incl. comment).
- `lib/scenarios/what-writes.ts`: new `setWorkLen`, `setWorkType`, `workLenIsDefault`; `setLanes` records `lanes` for every kind but shoulder (~25 lines).
- `lib/scenarios/index.ts`: `carryAcrossKinds` drops the `workType` and `lanes` records (~3 lines). `DEFAULT_SHOULDER.workLen` stays 1000 (byte-identical).
- `lib/scenarios/move-ledger.ts`: "· typed" only for a recorded length, "· default" otherwise (~5 lines).
- `components/bands/WhereBand.tsx`: length marker and provenance from the record; commit through `setWorkLen` (~12 lines).
- `components/bands/ManualFallback.tsx`: its length input writes through `setWorkLen` (~3 lines).
- `components/bands/PlanDetails.tsx`: Work type through `defaultOrYours` and `setWorkType` (~8 lines).
- `components/bands/WhatBand.tsx`: NI lanes line; `clauseFor` takes a default-or-yours fallback for a row with no detection; the withdrawn detail line (~30 lines).
- New test file `components/bands/untouched-provenance.test.tsx` (~200 lines, ~10 tests, red on base). Existing tests expected to change: `MoveLedger.form.test.tsx` (the "1,000 ft · typed" assertion), `GeneratorSidebar.corridor-bar.test.tsx` (the "✓ yours" length marker), and up to 3 more that pin NI lanes or the work-type line. Expected count about 2567 passed, 1 skipped.
- No Python, no wire field the backend reads (`meta.operatorSet` is frontend bookkeeping the backend ignores, `types.ts:415`), no API route.
- **Behaviour change, stated:** markers and two ledger words only. The plan's numbers, every request payload's values, Generate's gating and every deliverable are unchanged. `meta.operatorSet` on a saved plan may now carry `workLen` / `workType` / `lanes`.
- Byte-identical: `DEFAULT_*` scenarios, every backend file, the strip, the rail, every API route.

## Calls (R145 self-ruled)

- **R145-1 (Surface A: option (b), not (a)).** Option (a), starting `workLen` unset, breaks the location flow, and the break has a name: the three reads the WHERE band makes before Generate (`/render/corridor-geometry` for the side control's options, the kind proposal and the aerial; `/render/nearest-intersection` for the cross-street tag; `/render/corridor-map`) validate the scenario through `_SCENARIO_ADAPTER` (`src/api/render_api.py:1622`, used at `:1664` and `:1815`) or `_CORRIDOR_MAP_ADAPTER` (`:1790`), and every scenario kind's `workLen` is `Field(gt=0.0, le=WORK_LEN_MAX_FT)` (`src/api/schemas.py:572` shoulder, `:960` near-intersection). Read from the schema, not run: a fresh session with no length would get a 422 on the geometry and cross-street reads, so the side control would have no options until a length was typed. Making (a) work needs a backend schema change for the reads or a reorder of the WHERE flow, and the strip, rail and CTA ranks would all move (probe: setting the session default to 0 and nothing else fails 16 tests in 7 files that predate this branch, starting with the strip reading "INVALID INPUT · Work zone length is required." on a fresh load; first seen unrecorded on the base, re-run and recorded in repair cycle 1 in `option-a-probe.md`, where this branch's own 2 tests that assume the 1,000 ft start add up to 18 in 9 files). So (b): 1,000 ft stays and is marked "default" in the ledger and the field until the operator commits a length. The 1,000 ft itself has no source (Rule 12): it was picked to clear the backend's buffer/2 soft rule at 65 mph (the comment on `DEFAULT_SHOULDER.workLen` in `lib/scenarios/index.ts`), so it is marked CHOSEN here, not sourced. Recording the default in the audit (the second half of the issue's (b)) needs a wire field the backend reads plus an audit block; that fails the R154 fold test (Python, a new wire field), so it is filed as a follow-up. R145 self-ruled.
- **R145-2 (Surface C: the 2/12 vs 4/10.5 cause, no code change to the numbers).** The difference is deliberate, not a detection bug. The shoulder kind applies OSM's per-direction count, clamped to 1..4 (`applyClassification`'s `shoulder` case in `lib/scenarios/auto-apply.ts`, `clampLanesToDomain`), and fits the width to the sheet for that count (`fitLaneWidth`, same case), which gives 4 and 10.5 on Wadsworth. The near-intersection kind deliberately leaves the mainline count at its default 2, because OSM counts near an intersection can include turn lanes (the comment opening `applyClassification`'s `near_intersection` case: "OSM lane counts are turn-lane-inflated near intersections … the user sets the count"), and the width fit for 2 lanes keeps 12. The issue's acceptance allows "or the surface says why they differ", so the Lanes row now says it. Making the near-intersection kind take OSM's count would reverse that recorded decision and reopen the parked mainline-confidence question; not built and not filed again. R145 self-ruled.
- **R145-3 (the lanes record), amended in repair cycle 3.** As first written: `lanes` was recorded only for kinds detection never writes. That stopped being true in repair cycle 2, which records it on the shoulder too, and the note was not amended (reviewer finding 2). As built now: `setLanes` records `lanes` on both kinds that carry a count (shoulder, near-intersection). On the near-intersection kind detection never writes the count, so `OperatorSetField`'s contract ("a fresh detection never overwrites them") holds there. On the shoulder kind a detection that reports a count still rewrites it, which is the stated exception: `applyClassification` drops the `lanes` record when it does (repair cycle 3, `auto-apply.ts`), the way R110 Q7 drops the width's record, and `setRoadType`'s divided reset drops it too (repair cycle 2). The shoulder row is judged by the record alone; a lane detection on the current road still speaks for the row first. R145 self-ruled.
- **R145-4 (wording), its near-intersection Lanes line superseded by R145-13/14 (cycle 4).** Per docs/style.md. Lines: length "default · the plan's starting length; enter the real one"; ledger "1,000 ft · default"; Work type "default · this kind's usual job; change it if the job differs"; NI lanes, amber, "not confirmed · the map reads N per side, but turn lanes inflate counts near an intersection; set the real count · default" (marker "⚠ default"; repair cycle 1) (no map count: "default · set the real count"); withdrawn detail "withdrawn · you changed the count, so the plan no longer uses the map's". R145 self-ruled.
- **R145-5 (✓ on "default"), superseded by Ryan's ruling.** Cycles 1 and 2 reused R110 Q8's "✓ default" and flagged it. Ryan ruled on 2026-10-26 (recorded on #411, https://github.com/rtmakatura/conestruct/issues/411#issuecomment-6410071272, and applied to this item on #397, https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6410070989): "'✓ default' becomes plain 'default', with no mark. This amends R110 Q8 … Once edited, '✓ yours' stays as it is." Repair cycle 3 applies it to this item's rows; see R145-6 and R145-7.

## Actual churn vs prediction (Rule 5)

| File | Predicted | Actual (+/-) |
|---|---|---|
| `lib/scenarios/types.ts` | ~5 | +9 / -1 (repair cycle 2: +2) |
| `lib/scenarios/what-writes.ts` | ~25 | +27 / -4 (repair cycle 2: +11 / -3) (`workLenIsDefault` landed in `index.ts` instead, beside `DEFAULT_SCENARIO`) |
| `lib/scenarios/index.ts` | ~3 | +25 / 0 (the two predicates `workLenIsDefault`, `isKindDefault`, plus a CHOSEN comment on the 1,000 ft; values byte-identical) |
| `lib/scenarios/move-ledger.ts` | ~5 | +6 / -2 |
| `components/bands/WhereBand.tsx` | ~12 | +21 / -9 (repair cycle 2: +5 / -1) |
| `components/bands/ManualFallback.tsx` | ~3 | +3 / -4 |
| `components/bands/PlanDetails.tsx` | ~8 | +10 / -3 |
| `components/bands/WhatBand.tsx` | ~30 | +63 / -10 (repair cycle 1: +4; repair cycle 2: +6) (the road-type fallback rides `clauseFor`'s new parameter; one more line than planned) |
| new `components/bands/untouched-provenance.test.tsx` | ~200, ~10 tests | 351 lines, 13 tests (repair cycle 1: +10 lines; repair cycle 2: +40 lines, 3 tests) |
| existing tests changed | up to 5 files | 1 file (`MoveLedger.form.test.tsx`, one assertion); `GeneratorSidebar.corridor-bar.test.tsx` needed no change (its fixture types 400 ft before asserting "✓ yours") |

Misses, stated: the predicates moved file (what-writes → index), and the road-type no-detection fallback ("default · the plan's starting road type") was added in `WhatBand.tsx` as part of the `clauseFor` change; it is the same Rule 10 fix for the same helper and stays under the fold test.

Residual, stated (amended in repair cycle 2): the first build judged an untouched shoulder count by value, so on a road with no OSM lane count a divided reset (1 instead of 2) read "✓ yours" without an edit, and a deliberate pick of 2 read "✓ default". Repair cycle 2 fixed both instead of disclosing them: `setLanes` now records `lanes` on the shoulder too, `setRoadType` drops that record when its divided flip resets the count, and the shoulder row is judged by the record alone. What remains: a shoulder plan saved before this change, on a road with no lane count, whose count the operator edited, has no record and reads "✓ default".

## Tests

(Cycles 1 and 2, on the old base `7678d0b`. `red-proof.txt` now holds the cycle-3 proof against `525c2e4`; see Tests (cycle 3) below.)

- vitest: Test Files 242 passed | 1 skipped (243); Tests 2567 passed | 1 skipped (2568). First full run after the fix: 1 failed (predicted), logged in `full-run-failures.md`.
- Red proof: `red-proof.txt` (10 of 10 new tests fail on the base sources, pass on the fix).
- `tsc --noEmit` clean; `next lint` no errors (one pre-existing warning in `LocationPickerModal.tsx`).
- No Python touched; pytest baseline 3593 passed, 2 skipped.

## Screenshots

(Cycles 1 and 2. Superseded in repair cycle 3: every shot was redone against `525c2e4` and the change, see the cycle-3 Screenshots section below.)

`shots/{before,after}-{1440,390}-{w1-ledger-extent,w1-length-field,w2-work-type,w3-lanes-near-intersection}.png`, with the rendered text of each in `shots/text-{before,after}.json`. Method (`script/shoot.mjs`): local `next dev` of this worktree (base sources for before, the fix for after), Playwright Chromium at DPR 2, 1440x900 and 390x844; `/api/road-bearing` stubbed with one candidate per site (East Colfax Avenue eastbound, way `600545936`; Wadsworth Boulevard northbound, way `427683596`, `lanes=4`, one-way); everything else live. The dev server ran with a local-only gate token; the token in `.env.local` was not used for the shots (locally it did not pass the gate: 307 to `/`), and no token is printed. Before reproduces the issue's strings exactly ("1,000 ft · typed", "✓ yours", "Work type ✓ yours", "Lanes ⚠ yours", "⚠ OSM · withdrawn · operator-set").

## Follow-ups filed

- #409 — the audit doesn't record a defaulted work-zone length (R145-1's second half). https://github.com/rtmakatura/conestruct/issues/409
- #410 — landing step 1 says Conestruct finds the extent (copy; `Landing.tsx:163`, outside this branch's files). https://github.com/rtmakatura/conestruct/issues/410
- #418 — Lanes row wording left by cycle 4: a previous road's count is marked "default" after a shoulder re-pick; the turn-lane doubt line shows when the map reads fewer lanes; a three-clause line (from the cycle-4 independent reviewer; filed, not folded: (a) needs a ruling or a stated value change). https://github.com/rtmakatura/conestruct/issues/418

## Repair cycle 1 (independent reviewer FAIL)

1. The untouched near-intersection Lanes line had been built `amber: false` ("✓ default"), next to a line saying the map disagrees. The tool doubts that value, so under Rule 10 it can't look settled, and it had dropped out of R108's "N guesses marked ⚠". Now amber: marker "⚠ default", line "⚠ not confirmed · the map reads 4 per side, but turn lanes inflate counts near an intersection; set the real count · default" (the marker word is the line's last segment, `markerOf`). It counts among the guesses as the base's "⚠ yours" did, so the header count is unchanged from base; the "count drops by one" behaviour change this file stated is withdrawn. With no map count the line stays "default · set the real count" (✓, not amber), as the base had no amber there either. Test updated (marker, line, and header N equals the ⚠ markers shown); w3 after shots and `shots/text-after.json` re-shot at 1440 and 390 (the whole after set was re-run from the same script; the other after shots are unchanged in content).
2. The option (a) probe was re-run and its failing test names saved (`option-a-probe.md`); R145-1 now cites it.

## Repair cycle 2 (independent reviewer FAIL)

1. `WhereBand.tsx` `commitWorkLen` wrote only when the value changed, so typing 1000 over the starting 1,000 never recorded `workLen` and the field kept reading "✓ default", while `ManualFallback` records on every keystroke. Now a committed draft records the length even when the value repeats (written once: the guard is `next !== workLen || !isOperatorSet(workLen)`). Stated: that write opens one request, as any edit does; a blur with no draft still writes nothing. New mounted-flow test, red on the pre-repair tree.
2. Stated behaviour change: a plan saved before this change with exactly 1,000 ft and no `workLen` record now reads "1,000 ft · default" / "✓ default", even if the operator typed that length then. There is no record to tell the two apart; "default" is the honest reading of a value equal to the starting one with no record.
3. The shoulder lane pick is now recorded (the tiny fix, chosen over disclosure); see the amended Residual line above. Two new tests: the deliberate pick of 2 reads "✓ yours" (red on the pre-repair tree), and the divided reset drops the record (a guard; it passes on the pre-repair tree because that build never recorded a shoulder count).

No screen in the shots changes (the shots show untouched values), so no re-shoot. vitest Test Files 242 passed | 1 skipped (243); Tests 2570 passed | 1 skipped (2571); tsc clean; lint 0 errors.

## Repair cycle 3 (Ryan, 2026-10-26: a third cycle; https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6410070989)

### The move onto the new base

The parked work (9 modified files, 2 untracked paths, at `7678d0b`) was saved first: `git diff HEAD` as a patch and copies of the untracked files, in the session scratchpad. Then a temporary WIP commit of the tracked changes, `git rebase --onto origin/mission-pm-prod-check 7678d0b`, and `git reset --mixed origin/mission-pm-prod-check`, so HEAD is `525c2e4` and the work is uncommitted again. One conflict, in `WhereBand.tsx`'s imports: #407 had added `import { symClass } from "@/lib/design/symbols"` beside the line this item extends. Both are kept. #407's side-chip ● (`WhereBand.tsx:354`) is unchanged.

### Ruling

Ryan, 2026-10-26, on #411 (https://github.com/rtmakatura/conestruct/issues/411#issuecomment-6410071272): "'✓ default' becomes plain 'default', with no mark. This amends R110 Q8 … It covers every `defaultOrYours` site: Hours, Speed reduction, Carriageway, lane width, and #397's length, work type and lanes. Once edited, '✓ yours' stays as it is." This item applies it to its own rows. Hours, Speed reduction, Carriageway and lane width are #411's and keep "✓ default" here.

### Rule 5 churn prediction (written before the cycle-3 diff; only the marker type had been touched)

- `lib/scenarios/provenance-marker.ts`: `glyph` may be null (word alone, tone "plain"); `markerOf` takes `plainDefault` (~10 lines).
- `components/bands/FieldCell.tsx`: a null glyph renders the word alone (1 line).
- `components/bands/WhatBand.tsx`: the no-detection header line (finding 1, 1 line); `Cell` passes `plainDefault` to `markerOf` (~4); the shoulder lanes fallback says "not from this road" with a road and plain "default · set the real count" with none (findings 4, 5, ~6); the lanes row and its guess count pass `plainDefault`.
- `components/bands/PlanDetails.tsx`: `Cell` takes `plainDefault`; Work type passes it (~4).
- `components/bands/WhereBand.tsx`: the length marker's default is `{ glyph: null, word: "default", tone: "plain" }` (~2).
- `lib/scenarios/auto-apply.ts` (new to this branch): a shoulder detection that writes the count drops the operator's `lanes` record, as Q7 does for the width (finding 4, ~6).
- `lib/scenarios/types.ts`: the `lanes` comment amended (~3).
- `components/bands/untouched-provenance.test.tsx`: "✓ default" assertions become "default"; ~5 new tests (header, NI edited count, NI lanes:forward only, shoulder re-pick, shoulder with no detection), ~+90 lines.
- No existing test file outside this branch's expected to change (no test pins the old header line; grep).
- Behaviour change, stated: on the length, work type and lanes rows "✓ default" becomes "default" with no glyph; Hours, Speed reduction, Carriageway and lane width keep "✓ default" (#411's). The no-detection header words change. A shoulder detection that reports a count drops the `lanes` record. Plan values, payloads, gating and deliverables unchanged.

### Calls (R145 self-ruled)

- **R145-6 (how "no mark" is drawn).** `ProvenanceMarker.glyph` may be `null`; `markerOf(line, { plainDefault: true })` returns the word "default" with no glyph, and `FieldCell` renders the word alone. The tone is a new "plain", which has no CSS rule: every marker but ⚠ is already drawn in `--ink-faint` (`.workbench .a-mark { color: var(--ink-faint) }` in `app/globals.css`), so no hue changes (Rule 13: no signal by hue). The option is per row, so #411 can flip the rest by passing it (or making it the default) without touching this item's rows. R145 self-ruled.
- **R145-7 (road type too).** The road-type row's "default · the plan's starting road type" (no detection, no record) is this item's own line from cycle 1, not an older `defaultOrYours` site, so it takes the plain "default" as well; leaving it would add a "✓ default" this branch created. R145 self-ruled.
- **R145-8 (finding 1, the header).** With nothing detected and no ⚠ on show, the WHAT header read "nothing detected; every value here is yours" over rows that read "default". Now: "nothing detected; set what the plan needs", the same instruction as the band's question line ("Set what the plan needs."). It claims nothing about whose values they are. R145 self-ruled.
- **R145-9 (finding 4, the shoulder re-pick).** Fixed, not disclosed. When a shoulder detection reports a count, `applyClassification` drops the `lanes` record (the count is now the map's). On a later road with no count, the row has no record and no detection, so it reads "default · not from this road; the map has no count here; set the real count". That line is true whichever way the tool set the count (the start, a divided reset, or an earlier road's map count), and "not from this road" says the plan's count was not read here. The plan's count itself is unchanged (it keeps the earlier road's 4, as on the base). Resetting it would change plan values, which this item doesn't do. R145 self-ruled.
- **R145-10 (finding 5, no map read).** With no detection at all, the shoulder line is "default · set the real count" (the near-intersection kind's no-map line), and it names no map. R145 self-ruled.
- **R145-11 (findings 3a and 3b, stated, not changed), (a) and (b) superseded by R145-13/14 (cycle 4).** Both are correct readings under Rule 10, so they are stated as behaviour changes and pinned by tests (red on the base, green on the cycle-2 tree and on this diff):
  - (a) *Superseded by R145-13/14 (cycle 4): the untouched count no longer carries a ⚠, so the edit leaves N unchanged.* A near-intersection count the operator edited was "⚠ yours" on the base (the never-written relay read as withdrawn, which is amber). It is now "✓ yours", so the header's "N guesses marked ⚠" drops by one after the edit.
  - (b) *Superseded by R145-13/14 (cycle 4): it now reads "default" with the doubt line, and N is unchanged.* On a near-intersection way tagged `lanes:forward` with no `lanes` total, the base row read the detection (method "measured", the applied 2 differing from the map's 3, so "operator-set", not amber: "✓ yours"). The untouched count now reads "⚠ default" with the map's figure, so it counts as one more guess (+1) until the operator sets the count.

  R145 self-ruled.
- **R145-12 (the ledger's ✓).** The WHERE ledger's "Extent ✓ 1,000 ft · default" keeps its ✓: that glyph is the move's state ("done", Rule 70, `move-ledger.ts:175`), not a provenance mark, and the ledger's ✓-as-settled is listed in #411's inventory (`provenance-marks/407/mark-inventory.md:23`). Not changed here. R145 self-ruled.

### Findings, one by one

1. Header on the no-detection path: fixed (R145-8). Test "finding 1"; shots `r3-what-header-no-detection`.
2. R145-3 out of date: amended above.
3. Behaviour changes on near-intersection lanes: stated (R145-11), tests "finding 3a" and "finding 3b".
4. Shoulder re-pick shows a lookup's count as "✓ yours": fixed (R145-9), test "finding 4".
5. "the map has none for this road" with no map read: fixed (R145-10), test "finding 5"; shots `r3-lanes-no-detection`.

### Actual churn vs the cycle-3 prediction (diff against the cycle-2 tree, `58394fc`)

| File | Predicted | Actual (+/-) |
|---|---|---|
| `lib/scenarios/provenance-marker.ts` | ~10 | +13 / -6 |
| `components/bands/FieldCell.tsx` | 1 | +1 / -1 |
| `components/bands/WhatBand.tsx` | ~11 | +25 / -5 (also the road-type row, R145-7, and comments) |
| `components/bands/PlanDetails.tsx` | ~4 | +7 / -3 |
| `components/bands/WhereBand.tsx` | ~2 | +2 / -1 |
| `lib/scenarios/auto-apply.ts` | ~6 | +7 / 0 |
| `lib/scenarios/types.ts` | ~3 | +4 / -4 |
| `lib/scenarios/what-writes.ts` | not predicted | +4 / -3 (three comments that said "✓ default") |
| `components/bands/untouched-provenance.test.tsx` | ~+90, ~5 tests | +91 lines, 7 tests (also the near-intersection no-map line and a road-type check), 4 assertions amended |
| other test files | none | none |

Misses, stated: the road-type row (R145-7) and the three comments in `what-writes.ts` were not in the prediction. Both are this item's own lines.

### Whole diff against `525c2e4`

12 tracked files, +219 / -46, plus the new test file (442 lines, 20 tests). No Python, no API route, no wire field the backend reads.

### Tests (cycle 3)

- Red proof, `red-proof.txt`: on the base, 19 failed and 1 passed of 20 (the one that passes is a guard). On the cycle-2 tree, 11 failed and 9 passed. On this diff, all 20 pass.
- vitest, full: the first run had 1 failure, `GeneratorShell.a11y-announce.test.tsx` "clears at the click …". It passed on its own (8 of 8), and the second full run was green: Test Files 242 passed | 1 skipped (243); Tests 2581 passed | 1 skipped (2582). Logged in `full-run-failures.md`.
- `tsc --noEmit` clean. `next lint`: no errors (the one existing warning in `LocationPickerModal.tsx`).
- pytest 3593 passed, 2 skipped. mypy "Success: no issues found in 49 source files". ruff "All checks passed!".

### Screenshots (cycle 3: all redone)

`shots/{before,after}-{1440,390}-*.png` and `shots/text-{before,after}.json`. Before is a local `next dev` of a `git archive` of `525c2e4`; after is a copy of this worktree's site with the diff. Both use the same `script/shoot.mjs`. Six views at each width:
- w1: the ledger's Extent row and the length field.
- w2: Work type.
- w3: near-intersection Lanes on Wadsworth.
- r3 (new in cycle 3): a pin with no road, where the scan stub returns no candidate. It shows the WHAT header after the operator re-selects the pin's jurisdiction (so no ⚠ is on show), and the shoulder Lanes row with its details open.

Before reads "1,000 ft · typed", "✓ yours" (length, Work type, no-detection Lanes), "⚠ yours" / "OSM · withdrawn · operator-set" (Wadsworth) and "nothing detected; every value here is yours". After reads "1,000 ft · default", "default" with no mark (length, Work type, no-detection Lanes), "⚠ default" (Wadsworth) and "nothing detected; set what the plan needs".

The dev servers ran with a local-only gate token, made up for the run and never printed. The site's `.env.local` was copied into the two scratchpad copies for the run and deleted after.

## Cycle 4 (mission finish-marks, #417)

The parked work was backed up (patch and untracked files, in the session scratchpad), then the branch was fast-forwarded from `525c2e4` to `form-marks-prod-check` `8b0a73f` with the work left uncommitted (`git merge --ff-only`; no file overlap, the diff byte-identical after). No temporary commit, no hook skipped.

### Ruling

Ryan, 2026-10-26 (https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6428707399): "The near-intersection Lanes row reads plain "default". The ⚠ moves to the doubt line, for example "⚠ not confirmed · the map reads 4 per side…". A fourth cycle is allowed. It applies this ruling and fixes the reviewer's open findings 2–5."

### Plan (written before the cycle-4 diff)

1. **Problem.** `WhatBand.tsx`, the near-intersection branch of `lanesClause`: an untouched count with a map count is an amber clause ending "· default", so the row's marker reads "⚠ default" and counts among the header's guesses; its comment cites R108, which covers street class and jurisdiction, not this row. The line says turn lanes "inflate" counts (stated as fact). Test cites and two tests are loose (findings 3–5).
2. **Rulings.** Ryan's ruling above; Ryan's 2026-10-26 plain-"default" ruling on #411 (R110 Q8 amended); P2 (the header counts only the ⚠ marks the rows show).
3. **Change.** The untouched near-intersection count reads `default · set the real count` (plain marker "default", as with no map count). The doubt is its own amber line in the row's details: "⚠ not confirmed · the map reads N per side, but turn lanes can inflate counts near an intersection" (finding 2: "can inflate"). The R108 cite goes. Tests: the near-intersection tests assert plain "default", the doubt line, and the guess count; the "four rows" test is renamed to the two rows it checks (finding 4: length and work type are W1 and W2); finding 4's re-pick test asserts the plan's count is 4 after the re-pick and mounts that plan without forcing `lanes` (finding 5). Line cites in this file and the commit message that a file in this diff shifts become subject cites or are marked "at 525c2e4" (finding 3).
4. **Rule 5 churn prediction.** `WhatBand.tsx` ~+15 / −14 (lanes clause, a doubt line passed as the Lanes row's `lines`, comments). `untouched-provenance.test.tsx` ~+25 / −20. No other source file. Stated behaviour change against cycle 3: the untouched near-intersection count with a map count reads "default" (was "⚠ default") and leaves the header's guess count (one fewer guess while untouched; an edit to it no longer changes N); the doubt line moves from the provenance line to its own ⚠ line, worded "can inflate". Against the base: that row read "⚠ yours" and counted as a guess; it now reads "default" and doesn't. The `lanes:forward`-only way reads "default" with the doubt line (base "✓ yours", cycle 3 "⚠ default"); guess count same as the base. Every other row, plan values, payloads, gating and deliverables byte-identical to cycle 3.
5. **Proof.** The changed tests red-proved on `git archive` of `8b0a73f` (the base) and green here; full vitest; tsc; no Python touched. Before (`8b0a73f`) / after shots of the near-intersection Lanes row with its details open at 1440 and 390, `shots/*-w3-*`, replacing cycle 3's.

### Calls (R145 self-ruled)

- **R145-13 (how the ruling is drawn).** The untouched near-intersection count's provenance line is `default · set the real count`, the same line the kind shows with no map count, so its marker is plain "default". The doubt is its own amber line in the row's details, passed as the Lanes cell's `lines` (test id `detect-lanes-doubt`), as the road-type row's One-way and Divided facts are: "⚠ not confirmed · the map reads N per side, but turn lanes can inflate counts near an intersection". "; set the real count" moved off the doubt line, since the provenance line now says it. The comment citing R108 is gone; the new comment cites Ryan's ruling. R145 self-ruled.
- **R145-14 (the header's N).** The doubt line is not counted. The header counts the ⚠ marks the rows show (P2; the comment above `warnMarkers`), and a ⚠ line in a row's details was never counted (the road-type row's amber detection lines aren't either). Counting it would make the header name a ⚠ no row shows. Stated consequence: on Wadsworth (near-intersection, live) the header reads "2 guesses marked ⚠" where the base read 3 (`shots/text-{before,after}-cycle4.json`); on a near-intersection plan where Lanes was the only ⚠, it reads "prefilled from the road" (R110 Q5's line), as it already does over the lane width's default. Raised for Ryan in the report, not changed. R145 self-ruled.
- **R145-15 (finding 2).** "inflate" becomes "can inflate" on the user-facing line and in this item's comment in `WhatBand.tsx`. The older comment in `auto-apply.ts` ("turn-lane-inflated") is not this item's line and not user copy; left as it is. R145 self-ruled.
- **R145-16 (finding 3).** The two R145 cites the commit message reuses now cite by subject; older sections carry a note that their line cites are at the base. The commit message carries no line cite into a file this diff changes. R145 self-ruled.
- **R145-17 (findings 4 and 5).** The "four rows" test is renamed to the two rows it checks ("lanes or road-type"); the length and work type are W1's and W2's. The re-pick test asserts the plan's count is 4 after the second `applyClassification` and mounts that plan without forcing `lanes`, then checks the control reads 4. R145 self-ruled.

### Findings, one by one (cycle 4)

1. Ruling point ("⚠ default" on the near-intersection Lanes row): fixed per Ryan's ruling (R145-13, R145-14). Tests "near-intersection on Wadsworth…", "finding 3a", "finding 3b"; shots `w3-lanes-near-intersection`, `w3-what-header-near-intersection`.
2. "turn lanes inflate counts": now "can inflate" (R145-15).
3. Stale line cites: fixed (R145-16).
4. Test name claiming four rows: renamed (R145-17).
5. Finding-4 test forcing `{ lanes: 4 }`: it now proves the 4 (R145-17).

### Actual churn vs the cycle-4 prediction (against the cycle-3 tree)

| File | Predicted | Actual (+/-) |
|---|---|---|
| `components/bands/WhatBand.tsx` | ~+15 / −14 | +19 / −11 |
| `components/bands/untouched-provenance.test.tsx` | ~+25 / −20 | +27 / −22 (also imports `whatHeader` to check the header's line when N is 0) |
| other source files | none | none |
| evidence | rulings, red proof, shots | also `script/shoot.mjs` +7 (`SHOT_ONLY`, `SHOT_SUFFIX`, the Wadsworth header shot) |

Whole diff against `8b0a73f`: 12 tracked files, +227 / −46, plus the new test file (447 lines, 20 tests). No Python, no API route, no wire field the backend reads.

### Tests (cycle 4)

- Red proof, `red-proof.txt` § Cycle 4: base `8b0a73f` 19 failed, 1 passed (the guard); cycle-3 tree 3 failed, 17 passed (the three near-intersection tests this cycle changes); this diff 20 passed.
- vitest, full, first run: Test Files 242 passed | 1 skipped (243); Tests 2582 passed | 1 skipped (2583).
- `tsc --noEmit` clean. `next lint`: no errors (the one existing warning in `LocationPickerModal.tsx`).
- No Python touched this cycle; pytest, mypy and ruff not re-run (cycle 3: pytest 3593 passed, 2 skipped; mypy and ruff clean).

### Screenshots (cycle 4)

`shots/{before,after}-{1440,390}-w3-lanes-near-intersection.png` (replacing cycle 3's) and `shots/{before,after}-{1440,390}-w3-what-header-near-intersection.png` (new), with `shots/text-{before,after}-cycle4.json`. Before is a local `next dev` of a `git archive` of `8b0a73f`; after is the same archive with this diff applied. Same `script/shoot.mjs`, run with `SHOT_ONLY=wadsworth`. Before reads "⚠ yours" and "⚠ OSM · withdrawn · operator-set" on Lanes, header "3 guesses marked ⚠"; after reads "default", "default · set the real count" and "⚠ not confirmed · the map reads 4 per side, but turn lanes can inflate counts near an intersection" in the details, header "2 guesses marked ⚠". The other cycle-3 shots (w1, w2, r3) are of rows this cycle doesn't change and stay as they were (before = `525c2e4`). The dev servers ran with a local-only gate token, made up for the run and never printed; the site's `.env.local` was copied into the two scratchpad copies for the run and deleted after.
