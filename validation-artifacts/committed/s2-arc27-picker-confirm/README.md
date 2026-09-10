# s2-arc27 — #270 Confirm dismiss in the picker row's action cell (+ A's `#fff` fold)

Branch `issue-270-picker-confirm` off `origin/main 3fa7d18` (prod Modal healthz == 3fa7d18 during the local runs). GO: Ryan's ruling of 2026-09-10 against the 📋 checkpoint — all four recommendations adopted:

> (1) Confirm in the subgrid's col-2 `.sc-action` cell; (2) ≤420: Confirm spans both tracks on its own line under the chips, right-aligned (row grows one line, #153 class); (3) at 1440 assert all five picker heights equal and report the value, at 380 record per condition, not required equal; (4) the flex-line pin rewrite is the declared supersession of arc-21 ruling f / spec 42; hand-check = open the longest and shortest names' pickers, Confirm in the same place.

## What shipped

| commit | what |
|---|---|
| `a7c3aa9` | **#263 fold (cherry-picked from 062b98b)** — A's three `#fff` owner literals (`.site-correction-note`, `.sv.structural .val`, `.sv-editor input/select`) take `var(--ink-bright)`; their `CSS_OWNER_SWAPS` rows deleted; the length pin 3 → **0** on 3fa7d18 (every owner has folded). Red-proved: "length of 3 but got +0". |
| `124cfd3` | **#270** — the picker sub-row is a subgrid row: `.sc-picker` (legend · chips · note slot) is the lead cell, Confirm is the row's `.sc-action` cell (col 2, the shared right edge); the dashed rule and the 9/11 inset move to the row; ≤420 both cells span both tracks, Confirm right-aligned on its own line. Supersedes arc-21 ruling f / spec 42 (declared). Red-proved: "expected null not to be null" (no `.sc-action` on the sub-row), grid-tokens `.sc-sub` on `padding: 0`. |
| (fix, this branch) | **finding first from local run 1** — (a) at 1440 the row still measured 82.2 ×3 vs **116.2** for the longest legend: with Confirm out of the line, the legend's length still decided where chips + note wrapped. The legend is now its own full-width line (`float:none; display:block; width:100%; margin 0 0 6px`) and the note rides the chips line (`align-items: flex-end`), so the chips + note line is the same width for every name. (b) A regression I caused in 124cfd3: Confirm's filled pair was scoped `.sc-picker button.confirm` and Confirm had left `.sc-picker` — it measured 121×24 (was 135×30). The selector follows it (`.sc-sub button.confirm`), the pair unchanged; the WriteLock-pinned `:disabled` selector list is untouched (`.sc-grid button:disabled` already covers it). Red-proved: two grid-tokens pins (`rule not found: .sc-sub button.confirm`; `align-items: flex-end`). |
| (docs, this branch) | this README, `s2a27-lc.js`, `outS2A27Local-124cfd3/` (run 1, the finding), `outS2A27Local-run2/` (the fixed tree, 46/46). Nothing deleted. |

## Local runs (`s2a27-lc.js` = the arc-26 harness + leg C3)

Stack: `next dev -p 3001` in the worktree, proxying to the **prod Modal** backend (its healthz 3fa7d18 is the harness gate; the frontend under test is the local tree — run 1 at 124cfd3, run 2 at the fix). Live Overpass, Denver pin, no refusal. Only a DETECTED row may open the picker (spec 46), so C3 measures the four detected conditions at this pin (longest "Adjacent interchange (highway ramps)", shortest "Pedestrian sidewalks"); "School zone" was absent.

### Run 1 — `outS2A27Local-124cfd3/` — 45/46
- **C3 confirm edge PASS at both viewports**: Confirm right 1252 = action 1252 (1440) and 338 = 338 (380) on all four names — the #270 acceptance.
- **C3 picker heights FAIL at 1440**: 82.2 / **116.2** / 82.2 / 82.2 — the legend's length still moved the wrap (finding (a) above). Also visible in C2: Confirm 121×24 (finding (b)).
- 380: 206.2 ×4 (recorded).

### Run 2 — `outS2A27Local-run2/` — **ALL PASS 46/46**

| leg | 1440×1000 | 380×800 |
|---|---|---|
| C3 confirm edge | 1252 = 1252 ×4 | 338 = 338 ×4 |
| C3 picker heights | **71 ×4 (equal)** | 212.2 ×4 (recorded; equal in fact) |
| C2 Confirm still (before/after Other) | 135×30 at 1117,358 → same | 135×30 at 203,571 → same |
| C1 chip centre | Δ 0 ×4 | Δ 0 ×4 |
| C1 note slot | 184×27 void/hidden/disabled | same |
| R1 scan rows | 46 ×5 | 84.6 / 118.8 / 84.6 / 84.6 / 57.8 |
| S1 staged rows · Apply row | 46 ×2 · 46 | 84.6 ×2 · 68 |
| A1 band once · one request each | 1 mount, "after 2 corrections", +1/+1 | same |
| A2 record rows · advisory | 46 ×2 · ×1 | 76.4 ×2 · ×1 |
| X axe | 0 | 2 of the named four, none in the block |

Every arc-26 figure is unchanged by #270 except the picker row (82.2/116.2 → 71) and Confirm's origin (now the action cell). Prod run: Ryan's, sha-gated on the merged tip — `node s2a27-lc.js outProd-<sha> <sha> https://www.conestruct.com <modal healthz>`; hand-check per ruling 4.

## Rule-5 churn (predicted → actual)

| test | predicted | actual |
|---|---|---|
| `SetupStrip.corrections.test.tsx:453-472` | flex-line pin → action-cell pin | as predicted (the declared supersession of ruling f / spec 42) |
| `SetupStrip.corrections-tokens.test.tsx:39` | wording | wording |
| `SetupStrip.grid-tokens.test.tsx` | +1 it (`.sc-sub .sc-action` ≤420) | +1 it, plus (fix) `.sc-sub button.confirm` selector, legend `width:100%`/`float:none`, `.sc-picker align-items: flex-end` |
| `ink-literals.test.ts` (cherry-pick) | pin 3 → 0 | 3 → 0 |
| harness | +1 leg | C3 (per-condition `pickerH`, Confirm right vs action right) |
| WriteLock / WorkingBand / results-head / batch test | 0 | 0 |
| vitest | 1055 → 1056 | 141 files / **1083** on the branch (base on 3fa7d18 not measured separately — B-strip's merge moved it; #270 adds one `it`, the cherry-pick none) |
| pytest, snapshots, expectation JSON | 0 | 0 |

## Contracts
#198 n/a · suggest-never-set n/a · Rule 3 n/a · Rule 12: the edge is the measured 1252/338, the 6 px legend gap is the picker's existing gap · Rule 13 unchanged (Confirm's pair, `--sc-act-wash` + `--act-bright`) · payload senders 0 · band rules byte-identical, `WorkingBand.tsx` untouched · write-lock: Confirm keeps `data-write`; the `:disabled` selector list pinned by WriteLock untouched · spec 38 (one extra row) and 44 (Cancel in the condition row) kept; **spec 42 / arc-21 ruling f superseded — declared** · D's census: no `font-size` added or changed (`type-census.test.ts` green); no new hex; `CSS_OWNER_SWAPS` now empty.

## Principles
P1 honoured — the picker row's height no longer depends on the name (71 ×4; the legend line is the reservation) · P2 n/a · P3 n/a · P4 honoured — Confirm right = the action edge on every row, both viewports · P5 n/a · P6 honoured — 71 ×4 at 1440; 380 recorded (212.2 ×4) · P7 unchanged · P8 n/a · P9 unchanged (`title="choose a reason"`) · P10 n/a · P11 honoured — same control, same place for the longest and shortest names · P12 hand-check · P13–P16 n/a.

## Files
`s2a27-lc.js` (usage in its header), `outS2A27Local-124cfd3/`, `outS2A27Local-run2/`.
