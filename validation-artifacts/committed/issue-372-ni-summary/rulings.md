# #372 rulings

## R1 (R145 self-ruled, 2026-10-23): page 1's summary counts the cross street

**Question.** Page 1's TRAFFIC CONTROL DEVICE SUMMARY on a near-intersection plan counted only the mainline (W20-1, R2-10, R2-11 one each on N1; total 37). The device XLSX counts the cross-street legs too (three each; total 43). The issue offers two fixes: count the cross street, or retitle the block and drop the total.

**Ruling.** Count every placement, cross street included. The plan still draws the mainline only (#117 Option C).

**Why.**
- `_draw_device_summary`'s docstring already promises "sheet == spreadsheet by construction" (#150/#151). The undercount broke that promise; it wasn't a design.
- The block is titled a summary and gives a total. Counting everything keeps the title and the total true. Retitling would leave page 1 without a device count and change the #150 spec block for one kind.
- P2 (one voice per fact): the XLSX, quote, crew sheet and audit already count the cross street.

**Mechanism.** `render_plan_sheet` keeps the unfiltered list (`summary_placements`) before the Option C mainline filter and passes it to the summary only. The drawing, the sign schedule and the notes still use the mainline list.

## Churn (Rule 5): predicted, then measured

Prediction: on near-intersection plans, only the summary's quantities and total move. Every other line on page 1, all XLSX output, and all flagger and shoulder page 1s stay identical.

Measured (`check.py` on the base tree `bdd5b6c` and the fix, `churn.py` → `churn.json`):
- N1–N14 (the #370 requests, rendered offline): page 1 changes only in the W20-1, R2-10 and R2-11 rows and the total (for example N1 37 → 43, N6 46 → 49, N10 48 → 54, N14 42 → 45). Row names, the text outside the summary, and the XLSX are identical. Before the fix all 14 disagreed with the XLSX. After it, all 14 agree.
- Flagger and shoulder, with no jurisdiction and with Denver, Greeley and Thornton: page 1 text is identical and agrees with the XLSX before and after.

Prediction met.

## Files
- `check.py <tree> <out.json>`: renders the 14 NI requests and 8 flagger/shoulder bodies through the real endpoints of `<tree>`, and records page 1's summary, the XLSX rows and totals, and page 1 text hashes.
- `base.json`, `fix.json`, `churn.json`: the runs and the comparison.
- Test: `tests/test_ni_summary_counts_cross_street.py` (6 tests). On the base code, 3 fail on their assertions (totals 31 ≠ 34 and 31 ≠ 37; per-leg `1 > 1`) and the 2 flagger/shoulder guards pass. The Denver case returned 400 there, because the scratch copy held only `src`/`tests` without the jurisdiction data, so it isn't counted as red evidence; `base.json` shows the same disagreement for the Denver N rows.
