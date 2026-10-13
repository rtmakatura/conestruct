# Rule 5 outcome: `issue-286-formula-fields` (Phase 4 branch 5A, #286, R144)

Prediction: `prediction.md` (committed `285960f`, before any code). Before = production at
`3fdf074`. After = this branch on a local stack (its own backend and Next dev server), because a
Vercel Preview talks to the production backend, which doesn't send the new fields yet. Both sides
planned the same roads through the browser: a shoulder closure on N Broadway SB (39.73370,
-104.98753) and a flagger closure on W Alameda Ave, Lakewood (39.71130, -105.08150), 40 mph on
both sides, each calculation row opened and read (`calcrows.cjs`).

## On screen: every field of every calculation row, before vs. after

18 rows (4 shoulder and 5 flagger, at 1440 and 360): title, result, cite, formula lines, footer.
Data: `before/calc-rows.json`, `after/calc-rows.json`. Differences: 6, all predicted.

| Row | Field | Before | After | Predicted |
|---|---|---|---|---|
| Advance warning sign set (all 4 runs) | footer | ✓ MUTCD § 6B-1 · ADVANCE WARNING SIGN SPACING | ✓ MUTCD § 6H.02 · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING | yes (3) |
| Flagger station sight distance (2 runs) | formula line | `SSD@40mph=305 ft` (per-token spans; the spacing was CSS) | `SSD @ 40 mph = 305 ft` | yes (4): same characters, the per-token colours go (`before/row-ssd-flagger-1440.png`, `after/row-ssd-flagger-1440.png`) |

Every result string is identical: "L/3 = 40 ft", "B = 200 ft", "22 devices · 30/60 ft o.c.",
"3 signs" (shoulder); "L = 100 ft", "B = 305 ft", "20 devices · 20/80 ft o.c.", "305 ft",
"4 signs" (flagger). Every cite and every other formula line is identical, "×" included.

## The wire

| Check | Result |
|---|---|
| Snapshots, key by key (`snapdiff.py`) | 78 change, additions only; 0 removed or changed values. 50 add the four sections' fields and `advance.citation`; 28 (27 corpus flagger files and `audit_flagger_reduction_fines_double_required.json`) also add the two sight-distance fields. Unchanged: the 8 `_pre_` archives and the 4 `ni-grid-*` placement lists, as predicted |
| New strings equal the panel's old ones (`parity286.py`) | on all 78 snapshots, every `result_text` / `formula_text` equals what `AuditTrail.tsx` at `3fdf074` computed from the same payload: 524 strings, 0 mismatches |
| The PDF ignores the new keys (`pdf_ignores.py`) | `audit_to_blocks` is identical with and without them, shoulder and flagger |
| Python suite | 2766 passed, 2 skipped |
| Site suite (vitest) | 2144 passed (207 files) |

The snapshots were regenerated through the tests themselves (a one-off pytest plugin recorded
each `/render/audit` response and wrote it with `write_snapshot` when the test read its file).

## Prediction vs. outcome

| Predicted | Outcome |
|---|---|
| Results character-identical | ✓ (above) |
| Formula lines character-identical | ✓ except the SSD line's styling, which was predicted |
| Advance footer corrected, header unchanged | ✓ |
| No-audit placeholders read "—" | ✓ (frontend tests); also before the plan is generated |
| 8 active audit snapshots and 70 corpus files change by additions; 8 `_pre_` and 4 `ni-grid` unchanged | ✓ exactly |
| Tests that move | ✓ plus three not listed: `AuditTrail.declined-stale.test.tsx` (its fixture now carries `result_text`), `tests/test_audit_pdf.py`, `tests/test_citation_single_source.py` |
| PDF unchanged | ✓, with one decision: `tests/test_audit_pdf.py` proves every projection string reaches the PDF, so the new keys are named panel-only there (`_PANEL_ONLY_KEYS`, and the advance chips in `_PANEL_ONLY_CITATIONS`), following the precedent for the SSD chips. Whether the PDF prints these lines too is left as a separate decision |

**Not predicted: 7 recorded fixtures.** The prediction missed the recorded wire fixtures
`tests/fixtures/tiering/*.json` (6) and `conestruct/site/components/__fixtures__/audit-shoulder-full.json`.
They are historical recordings, so they aren't recomputed (a recompute moves leaves this branch
never touched; `../../issue-243-note-8/rerecord/rerecord_note8.py` says the same). `rerecord_286.py`
derives each new field from the recording's own values and adds it, keeping each file's layout
byte for byte; `--check` passes on all 7. The tier pin (`tiering-expectations.json`) doesn't move.

## Found, not changed

- **The advance row's sign table at 360** is clipped at the row's right edge and its codes break
  mid-code ("W20-" / "1"), the same before and after (`before/row-advance-shoulder-360.png`).
  R141 ruled codes never break in the device table; this table is outside that ruling.
- **"Stations: 2 flagger station(s)"** in the SSD row is still counted by the panel from the form's
  AFAD toggle (`AuditTrail.tsx`, `flaggerSightDistanceItem`), outside R144's Q5 line.
- **The gated kinds' rows** (work beyond the shoulder, the mobile operations) still compose their
  own results; gated under Rule 8 and outside #286's live set, as predicted.
