# #338 rulings — page 1 states the assumed shoulder width

Issue: https://github.com/rtmakatura/conestruct/issues/338. One arc, no checkpoint stop: every ruling below fits existing rules (R145).

## S1 — R145 self-ruled: page 1 prints "Shoulder width: N ft (assumed)"
A shoulder plan's PARAMETERS block gains a row placed just before the taper it drives: `Shoulder width: 8 ft (assumed)` (10 ft on a divided highway). The value is `plan_shoulder_width_ft`'s, read from the same `shoulder_width_ft` the taper uses (`_draw_notes`), so the printed W and the printed L/3 can't disagree. The issue proposed "(assumed, not measured)". "(assumed)" is used because the half-width value column is 110 pt wide, and "assumed" already says nobody measured it. The audit item gives the full sentence.
Only the "Shoulder taper (L/3)" branch gets the row. Lane, flagger and near-intersection plans use the lane width, and mobile and off-road plans have no taper.
Rules: 10 (an assumed value is presented as assumed), 12 (the number traces to its producer).

## S2 — WITHDRAWN, pending checkpoint Q1 (checkpoint.md): built as below, it flips `is_clean` on every two-way and divided shoulder plan
*Originally: R145 self-ruled, the audit discloses it as a pending item on every road type.*
The pending item `shoulder_width_assumed` (tracking #338) is added to undivided and divided shoulder plans. One-way streets and one carriageway of a divided highway keep #308 R88's `one_way_street_widths_chosen` item, which already discloses the same 8 ft. The marker rides the case section and `audit_projection` pops it, the same way R88's does.
Why a pending item and not R110 Q2's `input_guesses` key: Q2 covers guesses the operator can change, which are prefilled from the road and marked ⚠. Shoulder width has no input, so the operator can't confirm or correct it. That makes it the same class of fact as R88's CHOSEN widths, and #308 put those in `pending_verification`. The site must verify it.
Label: "On an undivided road the plan assumes a shoulder 8 ft wide. Nothing measures it, and the shoulder taper is built on it (MUTCD Table 6B-4: W = width of offset), so a narrower or wider shoulder changes the taper. Verify against the site (#338)."
Citation: MUTCD 11th Ed. Table 6B-4, p. 775, "W = width of offset in feet" (quoted in #338's body).

## Out of scope (from the issue)
A shoulder-width input. It's the larger change the issue names as separate.
