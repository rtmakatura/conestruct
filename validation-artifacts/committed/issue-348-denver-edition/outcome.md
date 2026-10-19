# #348 — prediction and outcome

## Rule 5 prediction (stated before the diff)

- **Changes:** for a Denver plan, the results Reference row's first chain link goes from "MUTCD 2009 R2 (pinned)" to "MUTCD 11th (PT-116.1 pins 2009 R2)". That is `data/jurisdictions/denver.json:11`. It reaches the row verbatim through `jurisdiction.chain` (`src/rules/jurisdiction.py:625`) and `conestruct/site/lib/reference-summary.ts:57`. The hover title (`denver.json:10`) is unchanged.
- **Byte-identical:** `REFERENCE_LINE`, so page 1, the crew instructions and the Streamlit caption are unchanged. So are the nav, the audit JSON, the landing page, every other jurisdiction's record, and the recorded fixture `tests/fixtures/tiering/adv-ni-denver.json`.
- **Comment-only:** the module docstring in `src/rules/references.py`.

## Outcome (2026-10-18, worktree `.claude/worktrees/issue-348`, base `47940d6`)

New suite `tests/test_edition_one_voice.py`:
- **Red on the old record.** With `denver.json` restored to `47940d6`: `2 failed, 14 passed`. The two failures were `test_denver_results_row_and_sheet_name_the_same_edition` and `test_no_chain_names_a_second_edition[denver]`.
- **Green on the new record:** `16 passed`.

Full checks:
- pytest: `3027 passed, 2 skipped` (baseline `3011 passed, 2 skipped`; +16 is this suite).
- ruff: `All checks passed!`
- mypy: `Success: no issues found in 49 source files`

No file under `conestruct/site/` changed, so vitest wasn't rerun.
